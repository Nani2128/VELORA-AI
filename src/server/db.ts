import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface UserRecord {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  password_hash?: string | null;
  salt?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface ProjectRecord {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_asset_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO';
  source: 'UPLOAD' | 'GENERATED' | 'EDITED';
  storage_key: string;
  thumbnail_key: string | null;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  metadata: Record<string, any>;
  created_at: string;
}

export type GenerationStatus = 'IDLE' | 'PREPARING' | 'QUEUED' | 'PROCESSING' | 'FINALIZING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface GenerationRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  type: 'TEXT_TO_IMAGE' | 'IMAGE_TO_IMAGE' | 'IMAGE_TO_VIDEO' | 'TEXT_TO_VIDEO' | 'TEXT_TO_MUSIC';
  prompt: string;
  enhanced_prompt: string | null;
  negative_prompt: string | null;
  input_asset_id: string | null;
  output_asset_id: string | null;
  provider: string;
  model: string;
  status: GenerationStatus;
  settings: Record<string, any>;
  provider_operation_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface GenerationJobRecord {
  id: string;
  generation_id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  attempts: number;
  worker_id: string | null;
  last_error: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ProviderModelRecord {
  id: string;
  provider: string;
  model: string;
  capability: string;
  enabled: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

export interface UsageRecord {
  id: string;
  user_id: string;
  generation_id?: string;
  provider: string;
  model: string;
  status?: string;
  latency_ms?: number | null;
  units?: number | null;
  processing_time_ms?: number | null;
  input_units?: number | null;
  output_units?: number | null;
  created_at: string;
}

export interface ConversationRecord {
  id: string;
  user_id: string;
  title: string;
  model: string;
  web_search_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Array<{
    title: string;
    url: string;
    domain: string;
    snippet?: string;
  }>;
  search_queries?: string[];
  created_at: string;
}

interface DatabaseSchema {
  users: UserRecord[];
  sessions: SessionRecord[];
  projects: ProjectRecord[];
  assets: AssetRecord[];
  generations: GenerationRecord[];
  generation_jobs: GenerationJobRecord[];
  provider_models: ProviderModelRecord[];
  usage_records: UsageRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
}


export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

class Database {
  private dataDir = path.resolve(process.cwd(), 'data');
  private dbFile = path.resolve(this.dataDir, 'velora.db.json');
  private state: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (fs.existsSync(this.dbFile)) {
      try {
        const raw = fs.readFileSync(this.dbFile, 'utf-8');
        this.state = JSON.parse(raw);
        if (!this.state.sessions) this.state.sessions = [];
        if (!this.state.conversations) this.state.conversations = [];
        if (!this.state.messages) this.state.messages = [];
      } catch (e) {
        console.error('Error reading db file, resetting:', e);
        this.state = this.initialState();
        this.persist();
      }
    } else {
      this.state = this.initialState();
      this.persist();
    }
  }

  private initialState(): DatabaseSchema {
    const now = new Date().toISOString();
    return {
      users: [
        {
          id: DEFAULT_USER_ID,
          email: 'creator@velora.ai',
          name: 'Studio Director',
          avatar_url: null,
          status: 'active',
          created_at: now,
          updated_at: now,
        },
      ],
      projects: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          user_id: DEFAULT_USER_ID,
          name: 'Cinematic Noir Chronicles',
          description: 'High-contrast monochrome and neon visual exploration',
          cover_asset_id: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          user_id: DEFAULT_USER_ID,
          name: 'Architectural Visions',
          description: 'Modernist concrete pavilions and foggy landscapes',
          cover_asset_id: null,
          created_at: now,
          updated_at: now,
        },
      ],
      assets: [],
      generations: [],
      generation_jobs: [],
      provider_models: [
        {
          id: crypto.randomUUID(),
          provider: 'google_gemini_image',
          model: 'gemini-3.1-flash-image',
          capability: 'IMAGE_SYNTHESIS',
          enabled: true,
          metadata: { resolutions: ['512px', '1K', '2K', '4K'] },
          created_at: now,
        },
        {
          id: crypto.randomUUID(),
          provider: 'google_gemini_image',
          model: 'gemini-3.1-flash-lite-image',
          capability: 'FAST_IMAGE_SYNTHESIS',
          enabled: true,
          metadata: {},
          created_at: now,
        },
        {
          id: crypto.randomUUID(),
          provider: 'google_veo_video',
          model: 'veo-3.1-lite-generate-preview',
          capability: 'VIDEO_SYNTHESIS',
          enabled: true,
          metadata: { resolutions: ['720p'] },
          created_at: now,
        },
      ],
      usage_records: [],
      conversations: [],
      messages: [],
      sessions: [],
    };
  }

  private persist() {
    try {
      const tempPath = `${this.dbFile}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.dbFile);
    } catch (err) {
      console.error('Failed to persist database:', err);
    }
  }

  // --- Users & Authentication ---
  getUserByEmail(email: string): UserRecord | null {
    return this.state.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null;
  }

  getUserById(id: string): UserRecord | null {
    return this.state.users.find((u) => u.id === id) || null;
  }

  createUser(email: string, name: string, passwordHash: string, salt: string): UserRecord {
    const now = new Date().toISOString();
    const newUser: UserRecord = {
      id: crypto.randomUUID(),
      email: email.trim().toLowerCase(),
      name: name.trim(),
      avatar_url: null,
      password_hash: passwordHash,
      salt: salt,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    this.state.users.push(newUser);
    this.persist();
    return newUser;
  }

  createSession(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    this.state.sessions.push({
      token,
      user_id: userId,
      created_at: now.toISOString(),
      expires_at: expiresAt,
    });
    this.persist();
    return token;
  }

  getSession(token: string): SessionRecord | null {
    const session = this.state.sessions.find((s) => s.token === token);
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      this.deleteSession(token);
      return null;
    }
    return session;
  }

  deleteSession(token: string): boolean {
    const idx = this.state.sessions.findIndex((s) => s.token === token);
    if (idx === -1) return false;
    this.state.sessions.splice(idx, 1);
    this.persist();
    return true;
  }

  // --- Projects ---
  getProjects(userId: string = DEFAULT_USER_ID) {
    return this.state.projects
      .filter((p) => p.user_id === userId)
      .map((p) => {
        const count = this.state.assets.filter((a) => a.project_id === p.id).length;
        return { ...p, asset_count: count };
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  getProject(id: string, userId: string = DEFAULT_USER_ID) {
    const p = this.state.projects.find((proj) => proj.id === id && proj.user_id === userId);
    if (!p) return null;
    const count = this.state.assets.filter((a) => a.project_id === p.id).length;
    return { ...p, asset_count: count };
  }

  createProject(userId: string, name: string, description: string | null) {
    const now = new Date().toISOString();
    const proj: ProjectRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      name,
      description,
      cover_asset_id: null,
      created_at: now,
      updated_at: now,
    };
    this.state.projects.push(proj);
    this.persist();
    return { ...proj, asset_count: 0 };
  }

  updateProject(id: string, userId: string, update: { name?: string; description?: string | null; cover_asset_id?: string | null }) {
    const proj = this.state.projects.find((p) => p.id === id && p.user_id === userId);
    if (!proj) return null;
    if (update.name !== undefined) proj.name = update.name;
    if (update.description !== undefined) proj.description = update.description;
    if (update.cover_asset_id !== undefined) proj.cover_asset_id = update.cover_asset_id;
    proj.updated_at = new Date().toISOString();
    this.persist();
    const count = this.state.assets.filter((a) => a.project_id === proj.id).length;
    return { ...proj, asset_count: count };
  }

  deleteProject(id: string, userId: string) {
    const idx = this.state.projects.findIndex((p) => p.id === id && p.user_id === userId);
    if (idx === -1) return false;
    this.state.projects.splice(idx, 1);
    this.persist();
    return true;
  }

  // --- Assets ---
  createAsset(asset: Omit<AssetRecord, 'id' | 'created_at'>) {
    const now = new Date().toISOString();
    const newAsset: AssetRecord = {
      ...asset,
      id: crypto.randomUUID(),
      created_at: now,
    };
    this.state.assets.unshift(newAsset);
    this.persist();
    return newAsset;
  }

  getAssets(userId: string = DEFAULT_USER_ID, filters: { type?: string; projectId?: string; limit?: number; offset?: number }) {
    let list = this.state.assets.filter((a) => a.user_id === userId);
    if (filters.type) {
      list = list.filter((a) => a.type.toLowerCase() === filters.type!.toLowerCase());
    }
    if (filters.projectId) {
      list = list.filter((a) => a.project_id === filters.projectId);
    }
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    return list.slice(offset, offset + limit);
  }

  getAsset(id: string, userId: string = DEFAULT_USER_ID) {
    return this.state.assets.find((a) => a.id === id && a.user_id === userId) || null;
  }

  // --- Generations ---
  createGeneration(gen: Omit<GenerationRecord, 'id' | 'created_at' | 'started_at' | 'completed_at'>) {
    const now = new Date().toISOString();
    const newGen: GenerationRecord = {
      ...gen,
      id: crypto.randomUUID(),
      created_at: now,
      started_at: null,
      completed_at: null,
    };
    this.state.generations.unshift(newGen);

    const newJob: GenerationJobRecord = {
      id: crypto.randomUUID(),
      generation_id: newGen.id,
      status: 'QUEUED',
      attempts: 0,
      worker_id: null,
      last_error: null,
      queued_at: now,
      started_at: null,
      completed_at: null,
    };
    this.state.generation_jobs.push(newJob);

    this.persist();
    return newGen;
  }

  updateGeneration(id: string, update: Partial<GenerationRecord>) {
    const gen = this.state.generations.find((g) => g.id === id);
    if (!gen) return null;
    Object.assign(gen, update);
    this.persist();
    return gen;
  }

  getGeneration(id: string, userId: string = DEFAULT_USER_ID) {
    return this.state.generations.find((g) => g.id === id && g.user_id === userId) || null;
  }

  getGenerationsByStatus(status: GenerationStatus): GenerationRecord[] {
    return this.state.generations.filter((g) => g.status === status);
  }

  getHistory(userId: string = DEFAULT_USER_ID, filters: { status?: string; type?: string; limit?: number; offset?: number }) {
    let list = this.state.generations.filter((g) => g.user_id === userId);
    if (filters.status) {
      list = list.filter((g) => g.status.toLowerCase() === filters.status!.toLowerCase());
    }
    if (filters.type) {
      list = list.filter((g) => g.type.toLowerCase() === filters.type!.toLowerCase());
    }
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    return list.slice(offset, offset + limit);
  }

  recordUsage(usage: Omit<UsageRecord, 'id' | 'created_at'>) {
    const record: UsageRecord = {
      ...usage,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.state.usage_records.push(record);
    this.persist();
    return record;
  }

  getUsageMetrics(userId: string = DEFAULT_USER_ID) {
    const records = this.state.usage_records.filter((r) => r.user_id === userId);
    const byProvider: Record<string, { requests: number; success: number; failed: number; rateLimited: number; totalLatencyMs: number; tokens: number }> = {};

    let totalRequests = records.length;
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const r of records) {
      if (!byProvider[r.provider]) {
        byProvider[r.provider] = { requests: 0, success: 0, failed: 0, rateLimited: 0, totalLatencyMs: 0, tokens: 0 };
      }
      const p = byProvider[r.provider];
      p.requests += 1;
      p.totalLatencyMs += r.latency_ms || 0;
      p.tokens += r.units || 0;

      if (r.status === 'COMPLETED' || r.status === 'SUCCESS') {
        p.success += 1;
        totalSuccess += 1;
      } else if (r.status === 'RATE_LIMITED') {
        p.rateLimited += 1;
        totalFailed += 1;
      } else {
        p.failed += 1;
        totalFailed += 1;
      }
    }

    const providerList = Object.entries(byProvider).map(([provider, data]) => ({
      provider,
      requests: data.requests,
      success: data.success,
      failed: data.failed,
      rateLimited: data.rateLimited,
      averageLatencyMs: data.requests > 0 ? Math.round(data.totalLatencyMs / data.requests) : 0,
      tokensUsed: data.tokens,
    }));

    return {
      totalRequests,
      totalSuccess,
      totalFailed,
      providers: providerList,
    };
  }

  // --- Conversations & Messages ---
  createConversation(
    userId: string = DEFAULT_USER_ID,
    title: string = 'Creative Consultation',
    model: string = 'gemini-3.8-flash',
    webSearchEnabled: boolean = false
  ): ConversationRecord {
    const now = new Date().toISOString();
    const conv: ConversationRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: title.trim(),
      model,
      web_search_enabled: webSearchEnabled,
      created_at: now,
      updated_at: now,
    };
    this.state.conversations.unshift(conv);
    this.persist();
    return conv;
  }

  getConversations(userId: string = DEFAULT_USER_ID): (ConversationRecord & { lastMessage?: string; messageCount: number })[] {
    return this.state.conversations
      .filter((c) => c.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .map((c) => {
        const msgs = this.state.messages.filter((m) => m.conversation_id === c.id);
        const lastMsg = msgs[msgs.length - 1];
        return {
          ...c,
          lastMessage: lastMsg ? lastMsg.content.slice(0, 120) : undefined,
          messageCount: msgs.length,
        };
      });
  }

  getConversation(id: string, userId: string = DEFAULT_USER_ID): (ConversationRecord & { messages: MessageRecord[] }) | null {
    const conv = this.state.conversations.find((c) => c.id === id && c.user_id === userId);
    if (!conv) return null;
    const messages = this.state.messages
      .filter((m) => m.conversation_id === id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return { ...conv, messages };
  }

  updateConversation(id: string, userId: string = DEFAULT_USER_ID, update: Partial<Omit<ConversationRecord, 'id' | 'user_id' | 'created_at'>>): ConversationRecord | null {
    const conv = this.state.conversations.find((c) => c.id === id && c.user_id === userId);
    if (!conv) return null;
    Object.assign(conv, update, { updated_at: new Date().toISOString() });
    this.persist();
    return conv;
  }

  deleteConversation(id: string, userId: string = DEFAULT_USER_ID): boolean {
    const index = this.state.conversations.findIndex((c) => c.id === id && c.user_id === userId);
    if (index === -1) return false;
    this.state.conversations.splice(index, 1);
    this.state.messages = this.state.messages.filter((m) => m.conversation_id !== id);
    this.persist();
    return true;
  }

  addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    sources?: Array<{ title: string; url: string; domain: string; snippet?: string }>,
    searchQueries?: string[]
  ): MessageRecord {
    const now = new Date().toISOString();
    const msg: MessageRecord = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      role,
      content,
      sources,
      search_queries: searchQueries,
      created_at: now,
    };
    this.state.messages.push(msg);

    // Touch conversation updated_at
    const conv = this.state.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.updated_at = now;
      if (conv.title === 'New Chat' || conv.title === 'Creative Consultation') {
        // Auto-title from first user message if short
        if (role === 'user') {
          conv.title = content.slice(0, 40).trim() || conv.title;
        }
      }
    }

    this.persist();
    return msg;
  }

  getMessages(conversationId: string): MessageRecord[] {
    return this.state.messages
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
}

export const db = new Database();

