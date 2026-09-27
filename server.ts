import http from 'node:http';
import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import dotenv from 'dotenv';
import { db, DEFAULT_USER_ID } from './src/server/db';
import { storage } from './src/server/storage';
import { aiProvider } from './src/server/aiProvider';
import { jobQueue } from './src/server/jobQueue';
import { modelRegistry } from './src/server/imageProviders/registry';
import { chatService } from './src/server/chatService';
import { authMiddleware, hashPassword, verifyPassword } from './src/server/auth';
import { chatRouter } from './src/server/chatProviders/router';
import { ollamaChatProvider } from './src/server/chatProviders/ollama';
import { databaseAdapter } from './src/server/databaseAdapter';
import { redisService } from './src/server/redisClient';
import { masterProviderRegistry } from './src/server/providerRegistry';
import { setupLiveVoiceService } from './src/server/liveVoiceService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Idempotency cache for generation requests
const idempotencyCache = new Map<string, { timestamp: number; response: any }>();

// Body parsing
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  let reqId = req.headers['x-request-id'] as string;
  if (!reqId || reqId.length > 64) {
    reqId = crypto.randomUUID();
  }
  req.headers['x-request-id'] = reqId;
  res.setHeader('X-Request-ID', reqId);
  next();
});

// Authentication middleware
app.use(authMiddleware);


// Static files for uploaded/generated assets
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Multer upload middleware
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported media format. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});

// Multer upload for audio files (for gemini-3.5-transcribe and lyria)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});


// =========================================================================
// API ROUTES (/api/v1 & /health)
// =========================================================================

// Rate limiting middleware using Redis/in-memory store
const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const clientIdentifier = (req as any).userId || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'client';
  const result = await redisService.checkRateLimit(String(clientIdentifier), 60, 60);

  res.setHeader('X-RateLimit-Limit', '60');
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', result.resetInSeconds.toString());

  if (!result.allowed) {
    return res.status(429).json({
      error: {
        code: 'APPLICATION_RATE_LIMITED',
        message: `Application rate limit reached. Please wait ${result.resetInSeconds}s before retrying.`,
        retry_after: result.resetInSeconds,
      },
    });
  }
  next();
};

// Health & Liveness check
app.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'VELORA AI',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    database: databaseAdapter.getEngine(),
  });
});

app.get('/api/v1/health', async (req: Request, res: Response) => {
  const imageHealth = await modelRegistry.getProvidersHealth().catch(() => []);
  const chatHealth = await chatRouter.getProvidersHealth().catch(() => []);
  res.json({
    status: 'ok',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: databaseAdapter.getEngine(),
    redis: redisService.isReady() ? 'connected' : 'memory-emulated',
    providers: {
      image: imageHealth,
      chat: chatHealth,
    },
  });
});

// Production Readiness probe (for Render and load balancers)
app.get('/ready', (req: Request, res: Response) => {
  const isDbReady = databaseAdapter.isReady();
  const isRedisReady = redisService.isReady();

  if (!isDbReady || !isRedisReady) {
    return res.status(503).json({
      status: 'not_ready',
      database: isDbReady ? 'ready' : 'unreachable',
      redis: isRedisReady ? 'ready' : 'degraded',
    });
  }

  return res.json({
    status: 'ready',
    database: databaseAdapter.getEngine(),
    redis: 'ready',
    uptime: Math.round(process.uptime()),
  });
});

// Master Providers Dashboard & Health
app.get('/api/v1/providers/dashboard', async (req: Request, res: Response) => {
  try {
    const dashboard = await masterProviderRegistry.getProvidersDashboard();
    return res.json({ providers: dashboard });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'DASHBOARD_ERROR', message: err?.message } });
  }
});

// Real Usage Tracking & Metrics
app.get('/api/v1/usage', (req: Request, res: Response) => {
  const userId = (req as any).userId || DEFAULT_USER_ID;
  const metrics = db.getUsageMetrics(userId);
  return res.json(metrics);
});

// Model Catalog across all modalities
app.get('/api/v1/all-models', async (req: Request, res: Response) => {
  try {
    const catalog = await masterProviderRegistry.getAllModels();
    return res.json(catalog);
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'CATALOG_ERROR', message: err?.message } });
  }
});

// =========================================================================
// AUTHENTICATION API (/api/v1/auth)
// =========================================================================

app.post('/api/v1/auth/signup', (req: Request, res: Response) => {
  const { email, password, name } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Valid email address is required.' } });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Password must be at least 6 characters.' } });
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: { code: 'USER_EXISTS', message: 'An account with this email already exists.' } });
  }

  const { hash, salt } = hashPassword(password);
  const user = db.createUser(email, name || email.split('@')[0], hash, salt);
  const token = db.createSession(user.id);

  return res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      created_at: user.created_at,
    },
  });
});

app.post('/api/v1/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Email and password are required.' } });
  }

  const user = db.getUserByEmail(email);
  if (!user || !user.password_hash || !user.salt) {
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
  }

  const valid = verifyPassword(password, user.password_hash, user.salt);
  if (!valid) {
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
  }

  const token = db.createSession(user.id);
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      created_at: user.created_at,
    },
  });
});

app.post('/api/v1/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    db.deleteSession(token);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

app.get('/api/v1/auth/me', (req: Request, res: Response) => {
  const user = req.user;
  return res.json({
    id: user?.id || DEFAULT_USER_ID,
    email: user?.email || 'creator@velora.ai',
    name: user?.name || 'Studio Director',
    tier: 'Creator Pro',
    status: user?.status || 'active',
  });
});

// =========================================================================
// PROVIDER CONTROL PLANE & DISCOVERY
// =========================================================================

app.get('/api/v1/providers', async (req: Request, res: Response) => {
  try {
    const imageHealth = await modelRegistry.getProvidersHealth();
    const chatHealth = await chatRouter.getProvidersHealth();
    return res.json({
      providers: {
        image: imageHealth,
        chat: chatHealth,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err?.message } });
  }
});

app.get('/api/v1/providers/ollama/models', async (req: Request, res: Response) => {
  try {
    const models = await ollamaChatProvider.getInstalledModels();
    return res.json({ models, isConfigured: ollamaChatProvider.isConfigured() });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'OLLAMA_ERROR', message: err?.message } });
  }
});

// --- Model Registry & Capabilities API ---
app.get('/api/v1/models', async (req: Request, res: Response) => {
  try {
    const models = await modelRegistry.getModels();
    return res.json({ models });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err?.message || 'Failed to fetch models' } });
  }
});

app.get('/api/v1/models/:id', async (req: Request, res: Response) => {
  try {
    const model = await modelRegistry.getModel(req.params.id);
    if (!model) {
      return res.status(404).json({ error: { code: 'MODEL_NOT_FOUND', message: 'Model not found' } });
    }
    return res.json(model);
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err?.message } });
  }
});

app.get('/api/v1/providers/health', async (req: Request, res: Response) => {
  try {
    const health = await modelRegistry.getProvidersHealth();
    const chatHealth = await chatRouter.getProvidersHealth();
    return res.json({ providers: health, chatProviders: chatHealth });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err?.message } });
  }
});

// --- Assets Upload API ---
app.post('/api/v1/assets/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'No file provided in form-data field "file".' },
      });
    }

    const originalName = req.file.originalname || 'upload.png';
    const ext = path.extname(originalName) || '.png';
    const { storageKey, publicUrl } = await storage.saveFile(req.file.buffer, ext);

    const asset = db.createAsset({
      user_id: DEFAULT_USER_ID,
      project_id: (req.body.project_id as string) || null,
      type: 'IMAGE',
      source: 'UPLOAD',
      storage_key: storageKey,
      thumbnail_key: null,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      metadata: { original_name: originalName },
    });

    return res.status(201).json({
      id: asset.id,
      user_id: asset.user_id,
      project_id: asset.project_id,
      type: asset.type,
      source: asset.source,
      storage_key: asset.storage_key,
      mime_type: asset.mime_type,
      size_bytes: asset.size_bytes,
      url: publicUrl,
      created_at: asset.created_at,
      metadata: asset.metadata,
    });
  } catch (err: any) {
    console.error('Upload asset error:', err);
    return res.status(400).json({
      error: { code: 'UPLOAD_FAILED', message: err?.message || 'Failed to upload asset.' },
    });
  }
});

// --- Prompt Enhancement API ---
app.post('/api/v1/enhance-prompt', async (req: Request, res: Response) => {
  try {
    const { prompt, type } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Prompt is required.' } });
    }
    const enhanced = await aiProvider.enhancePrompt(String(prompt), type || 'TEXT_TO_IMAGE');
    return res.json({ enhanced_prompt: enhanced });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'ENHANCE_FAILED', message: err?.message } });
  }
});

// --- Audio Transcription API (gemini-3.5-transcribe) ---
app.post('/api/v1/audio/transcribe', audioUpload.single('file'), async (req: Request, res: Response) => {
  try {
    let buffer: Buffer | null = null;
    let mimeType = 'audio/webm';

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype || 'audio/webm';
    } else if (req.body.audio_base64) {
      buffer = Buffer.from(req.body.audio_base64, 'base64');
      mimeType = req.body.mime_type || 'audio/webm';
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'No audio data provided in "file" or "audio_base64".' },
      });
    }

    const transcription = await aiProvider.transcribeAudio(buffer, mimeType);
    return res.json({
      success: true,
      model: 'gemini-3.5-transcribe',
      text: transcription,
    });
  } catch (err: any) {
    console.error('Audio transcription error:', err);
    return res.status(500).json({
      error: { code: 'TRANSCRIPTION_FAILED', message: err?.message || 'Failed to transcribe audio' },
    });
  }
});

// --- Music Generation API (lyria-3-clip-preview & lyria-3-pro-preview) ---
app.post('/api/v1/music/generate', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { prompt, model } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Prompt cannot be empty for music generation.' },
      });
    }

    const selectedModel = model === 'lyria-3-pro-preview' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
    let inputBuffer: Buffer | undefined;
    let inputMime: string | undefined;

    if (req.file) {
      inputBuffer = req.file.buffer;
      inputMime = req.file.mimetype;
    }

    const result = await aiProvider.generateMusic(prompt.trim(), selectedModel, inputBuffer, inputMime);

    if (!result.success || !result.asset) {
      return res.status(500).json({
        error: { code: result.error?.code || 'GENERATION_FAILED', message: result.error?.message || 'Music generation failed.' },
      });
    }

    // Save asset to database
    const asset = db.createAsset({
      user_id: (req as any).userId || DEFAULT_USER_ID,
      project_id: (req.body.project_id as string) || null,
      type: 'AUDIO',
      source: 'GENERATED',
      storage_key: result.asset.storageKey,
      thumbnail_key: null,
      mime_type: result.asset.mimeType,
      size_bytes: result.asset.sizeBytes,
      duration_seconds: result.asset.durationSeconds || (selectedModel === 'lyria-3-clip-preview' ? 30 : 180),
      metadata: {
        prompt: prompt.trim(),
        model: selectedModel,
        lyrics: result.lyrics,
      },
    });

    return res.status(201).json({
      id: asset.id,
      model: selectedModel,
      url: result.asset.publicUrl,
      duration_seconds: asset.duration_seconds,
      lyrics: result.lyrics,
      created_at: asset.created_at,
    });
  } catch (err: any) {
    console.error('Music generation error:', err);
    return res.status(500).json({
      error: { code: 'MUSIC_GENERATION_FAILED', message: err?.message || 'Failed to generate music' },
    });
  }
});

// --- Generations API ---
app.post('/api/v1/generations', async (req: Request, res: Response) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
      const cached = idempotencyCache.get(idempotencyKey)!;
      return res.status(200).json(cached.response);
    }

    const { type, prompt, negative_prompt, input_asset_id, project_id, enhance_prompt, settings } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Prompt cannot be empty.' },
      });
    }

    // Optional prompt enhancement
    let enhancedPrompt: string | null = null;
    if (enhance_prompt) {
      enhancedPrompt = await aiProvider.enhancePrompt(prompt.trim(), type || 'TEXT_TO_IMAGE');
    }

    const isVideo = (type || '').includes('VIDEO');
    const isMusic = type === 'TEXT_TO_MUSIC';
    let selectedModel = req.body.model;
    let provider = 'google_gemini_image';

    if (isMusic) {
      selectedModel = selectedModel || 'lyria-3-clip-preview';
      provider = 'google_lyria_music';
    } else if (isVideo) {
      selectedModel = 'veo-3.1-fast-generate-preview';
      provider = 'google_veo_video';
    } else {
      selectedModel = selectedModel || 'gemini-3.1-flash-image-preview';
      if (selectedModel.startsWith('fal') || selectedModel.includes('flux/schnell')) {
        provider = 'fal';
      } else if (selectedModel.startsWith('flux')) {
        provider = 'flux';
      } else if (selectedModel.startsWith('sd')) {
        provider = 'stability';
      } else if (selectedModel.startsWith('dall-e')) {
        provider = 'openai';
      } else if (selectedModel.includes('grok')) {
        provider = 'xai';
      } else if (selectedModel.startsWith('hf-')) {
        provider = 'huggingface';
      }
    }

    const generation = db.createGeneration({
      user_id: req.userId || DEFAULT_USER_ID,
      project_id: project_id || null,
      type: type || 'TEXT_TO_IMAGE',
      prompt: prompt.trim(),
      enhanced_prompt: enhancedPrompt,
      negative_prompt: negative_prompt?.trim() || null,
      input_asset_id: input_asset_id || null,
      output_asset_id: null,
      provider,
      model: selectedModel,
      status: 'QUEUED',
      settings: settings || {},
      provider_operation_id: null,
      error_code: null,
      error_message: null,
    });

    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, { timestamp: Date.now(), response: generation });
    }

    // Enqueue async job
    jobQueue.enqueue(generation.id);

    return res.status(201).json(generation);
  } catch (err: any) {
    console.error('Create generation error:', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err?.message || 'Server error creating generation' },
    });
  }
});

app.get('/api/v1/generations/:id', (req: Request, res: Response) => {
  const gen = db.getGeneration(req.params.id);
  if (!gen) {
    return res.status(404).json({ error: { code: 'GENERATION_NOT_FOUND', message: 'Generation not found' } });
  }

  let output_asset: any = null;
  if (gen.output_asset_id) {
    const asset = db.getAsset(gen.output_asset_id);
    if (asset) {
      output_asset = {
        id: asset.id,
        type: asset.type,
        url: storage.getPublicUrl(asset.storage_key),
        mime_type: asset.mime_type,
        size_bytes: asset.size_bytes,
        duration_seconds: asset.duration_seconds,
      };
    }
  }

  return res.json({ ...gen, output_asset });
});

// SSE endpoint for real-time status updates
app.get('/api/v1/generations/:id/events', (req: Request, res: Response) => {
  const genId = req.params.id;
  const gen = db.getGeneration(genId);
  if (!gen) {
    return res.status(404).json({ error: { code: 'GENERATION_NOT_FOUND', message: 'Generation not found' } });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current state immediately
  let outputUrl: string | null = null;
  if (gen.output_asset_id) {
    const asset = db.getAsset(gen.output_asset_id);
    if (asset) outputUrl = storage.getPublicUrl(asset.storage_key);
  }

  res.write(
    `event: generation.status\ndata: ${JSON.stringify({
      generation_id: gen.id,
      status: gen.status,
      timestamp: new Date().toISOString(),
      output_asset_id: gen.output_asset_id,
      output_url: outputUrl,
      error: gen.error_code ? { code: gen.error_code, message: gen.error_message } : null,
    })}\n\n`,
  );

  if (gen.status === 'COMPLETED' || gen.status === 'FAILED' || gen.status === 'CANCELLED') {
    res.end();
    return;
  }

  // Subscribe to live queue updates
  const unsubscribe = jobQueue.subscribe(genId, (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'CANCELLED') {
      unsubscribe();
      res.end();
    }
  });

  req.on('close', () => {
    unsubscribe();
  });
});

app.post('/api/v1/generations/:id/cancel', (req: Request, res: Response) => {
  const gen = db.getGeneration(req.params.id);
  if (!gen) {
    return res.status(404).json({ error: { code: 'GENERATION_NOT_FOUND', message: 'Generation not found' } });
  }

  if (gen.status === 'COMPLETED' || gen.status === 'FAILED') {
    return res.json({ status: gen.status, message: 'Cannot cancel finished generation' });
  }

  db.updateGeneration(gen.id, { status: 'CANCELLED' });
  jobQueue.emitStatus(gen.id, 'CANCELLED');
  return res.json({ status: 'CANCELLED', id: gen.id });
});

app.post('/api/v1/generations/:id/retry', (req: Request, res: Response) => {
  const gen = db.getGeneration(req.params.id);
  if (!gen) {
    return res.status(404).json({ error: { code: 'GENERATION_NOT_FOUND', message: 'Generation not found' } });
  }

  db.updateGeneration(gen.id, {
    status: 'QUEUED',
    error_code: null,
    error_message: null,
    started_at: null,
    completed_at: null,
  });

  jobQueue.enqueue(gen.id);
  jobQueue.emitStatus(gen.id, 'QUEUED');
  return res.json({ status: 'QUEUED', id: gen.id });
});

// --- Projects API ---
app.get('/api/v1/projects', (req: Request, res: Response) => {
  const projects = db.getProjects(DEFAULT_USER_ID);
  res.json(projects);
});

app.post('/api/v1/projects', (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Project name is required' } });
  }
  const project = db.createProject(DEFAULT_USER_ID, name.trim(), description?.trim() || null);
  return res.status(201).json(project);
});

app.get('/api/v1/projects/:id', (req: Request, res: Response) => {
  const project = db.getProject(req.params.id, DEFAULT_USER_ID);
  if (!project) {
    return res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } });
  }
  return res.json(project);
});

app.patch('/api/v1/projects/:id', (req: Request, res: Response) => {
  const updated = db.updateProject(req.params.id, DEFAULT_USER_ID, req.body);
  if (!updated) {
    return res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } });
  }
  return res.json(updated);
});

app.delete('/api/v1/projects/:id', (req: Request, res: Response) => {
  const deleted = db.deleteProject(req.params.id, DEFAULT_USER_ID);
  if (!deleted) {
    return res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } });
  }
  return res.json({ success: true, deleted_id: req.params.id });
});

// --- Library API ---
app.get('/api/v1/library', (req: Request, res: Response) => {
  const { type, project_id, limit, offset } = req.query;
  const assets = db.getAssets(DEFAULT_USER_ID, {
    type: type as string,
    projectId: project_id as string,
    limit: limit ? parseInt(limit as string, 10) : 50,
    offset: offset ? parseInt(offset as string, 10) : 0,
  });

  const formatted = assets.map((a) => ({
    id: a.id,
    user_id: a.user_id,
    project_id: a.project_id,
    type: a.type,
    source: a.source,
    storage_key: a.storage_key,
    mime_type: a.mime_type,
    size_bytes: a.size_bytes,
    duration_seconds: a.duration_seconds,
    url: storage.getPublicUrl(a.storage_key),
    thumbnail_url: a.thumbnail_key ? storage.getPublicUrl(a.thumbnail_key) : storage.getPublicUrl(a.storage_key),
    metadata: a.metadata,
    created_at: a.created_at,
  }));

  return res.json(formatted);
});

// --- History API ---
app.get('/api/v1/history', (req: Request, res: Response) => {
  const { status, type, limit, offset } = req.query;
  const generations = db.getHistory(DEFAULT_USER_ID, {
    status: status as string,
    type: type as string,
    limit: limit ? parseInt(limit as string, 10) : 50,
    offset: offset ? parseInt(offset as string, 10) : 0,
  });

  const formatted = generations.map((g) => {
    let output_asset: any = null;
    if (g.output_asset_id) {
      const asset = db.getAsset(g.output_asset_id);
      if (asset) {
        output_asset = {
          id: asset.id,
          type: asset.type,
          url: storage.getPublicUrl(asset.storage_key),
          mime_type: asset.mime_type,
        };
      }
    }
    return { ...g, output_asset };
  });

  return res.json(formatted);
});

// =========================================================================
// CHAT & WEB SEARCH SYSTEM (/api/v1/chat)
// =========================================================================

// List conversations
app.get('/api/v1/chat/conversations', (req: Request, res: Response) => {
  const conversations = db.getConversations(DEFAULT_USER_ID);
  return res.json(conversations);
});

// Create new conversation
app.post('/api/v1/chat/conversations', (req: Request, res: Response) => {
  const { title, model, web_search_enabled } = req.body || {};
  const conv = db.createConversation(
    DEFAULT_USER_ID,
    title || 'New Chat',
    model || 'gemini-3.8-flash',
    !!web_search_enabled
  );
  return res.status(201).json(conv);
});

// Get conversation with message history
app.get('/api/v1/chat/conversations/:id', (req: Request, res: Response) => {
  const conv = db.getConversation(req.params.id, DEFAULT_USER_ID);
  if (!conv) {
    return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' } });
  }
  return res.json(conv);
});

// Rename / update conversation
app.patch('/api/v1/chat/conversations/:id', (req: Request, res: Response) => {
  const { title, model, web_search_enabled } = req.body;
  const updateData: any = {};
  if (title !== undefined) updateData.title = String(title).trim();
  if (model !== undefined) updateData.model = String(model).trim();
  if (web_search_enabled !== undefined) updateData.web_search_enabled = Boolean(web_search_enabled);

  const updated = db.updateConversation(req.params.id, DEFAULT_USER_ID, updateData);
  if (!updated) {
    return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' } });
  }
  return res.json(updated);
});

// Delete conversation
app.delete('/api/v1/chat/conversations/:id', (req: Request, res: Response) => {
  const deleted = db.deleteConversation(req.params.id, DEFAULT_USER_ID);
  if (!deleted) {
    return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' } });
  }
  return res.json({ success: true, deleted_id: req.params.id });
});

// Intelligent Model Recommendation for AUTO Mode
app.post('/api/v1/chat/recommend', async (req: Request, res: Response) => {
  try {
    const { prompt, options } = req.body || {};
    const task = chatRouter.classifyTask(prompt || '', options);
    const recommendation = await chatRouter.recommendModel(task, options);
    return res.json(recommendation);
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'ROUTING_ERROR', message: err?.message } });
  }
});

// All Active Chat Models Discovery
app.get('/api/v1/chat/models', async (req: Request, res: Response) => {
  try {
    const models = await chatRouter.getAllDiscoveredModels();
    return res.json({ models });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'DISCOVERY_ERROR', message: err?.message } });
  }
});

// Send message to conversation (Streamed via SSE or JSON)
app.post('/api/v1/chat/conversations/:id/messages', rateLimitMiddleware, async (req: Request, res: Response) => {
  const convId = req.params.id;
  const conv = db.getConversation(convId, DEFAULT_USER_ID);
  if (!conv) {
    return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' } });
  }

  const { content, model, web_search_enabled, maps_grounding_enabled, user_location } = req.body;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Message content cannot be empty.' } });
  }

  const modelToUse = model || conv.model || 'gemini-3.8-flash';
  const mapsEnabled = !!maps_grounding_enabled;
  const searchEnabled = !mapsEnabled && (web_search_enabled !== undefined ? !!web_search_enabled : conv.web_search_enabled);

  const isStream = req.query.stream === 'true' || req.headers.accept?.includes('text/event-stream');

  if (isStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      await chatService.streamChat(
        convId,
        content.trim(),
        { model: modelToUse, webSearch: searchEnabled, mapsGrounding: mapsEnabled, userLocation: user_location },
        (chunk) => {
          res.write(`event: ${chunk.type}\ndata: ${JSON.stringify(chunk)}\n\n`);
        }
      );
      res.end();
    } catch (err: any) {
      const code = err?.code || (err?.message?.includes('429') ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_UNAVAILABLE');
      const normErr = {
        code,
        message: err?.message || 'Chat provider is temporarily unavailable.',
        provider: err?.provider || 'gemini',
        retryable: err?.retryable ?? true,
        fallback_attempted: err?.fallback_attempted ?? false,
      };
      res.write(`event: error\ndata: ${JSON.stringify(normErr)}\n\n`);
      res.end();
    }
  } else {
    // Non-streaming fallback
    try {
      let accumulated = '';
      let sources: any[] = [];
      let searchQueries: string[] = [];
      const assistantMessage = await chatService.streamChat(
        convId,
        content.trim(),
        { model: modelToUse, webSearch: searchEnabled, mapsGrounding: mapsEnabled, userLocation: user_location },
        (chunk) => {
          if (chunk.type === 'delta' && chunk.delta) accumulated += chunk.delta;
          if (chunk.type === 'sources') {
            sources = chunk.sources || [];
            searchQueries = chunk.searchQueries || [];
          }
        }
      );

      return res.status(201).json(assistantMessage);
    } catch (err: any) {
      const code = err?.code || (err?.message?.includes('429') ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_UNAVAILABLE');
      return res.status(code === 'PROVIDER_RATE_LIMITED' ? 429 : 500).json({
        error: {
          code,
          message: err?.message || 'Chat provider is temporarily unavailable.',
          provider: err?.provider || 'gemini',
          retryable: err?.retryable ?? true,
          fallback_attempted: err?.fallback_attempted ?? false,
        },
      });
    }
  }
});


// =========================================================================
// VITE OR STATIC FRONTEND INTEGRATION
// =========================================================================

async function startServer() {
  const httpServer = http.createServer(app);
  
  // Attach Gemini Live Audio WebSocket service (/live)
  setupLiveVoiceService(httpServer);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`VELORA AI Production Full-Stack Server running on 0.0.0.0:${PORT} (HTTP + Live WebSocket)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
