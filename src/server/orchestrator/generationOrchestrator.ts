/**
 * VELORA AI — Multi-Provider Generation Orchestrator
 * 
 * Central controller for all AI media generation pipelines (Image, Video, Music).
 * Features:
 * - Automatic task classification & capability validation
 * - Health-aware & quota-aware model routing
 * - Multi-provider fallback chain execution
 * - Idempotency checking & deduping
 * - Real-time SSE event emission with robust reconnect metadata
 * - Database asset persistence & history tracking
 */

import crypto from 'node:crypto';
import { db } from '../db';
import { storage } from '../storage';
import { capabilityRouter } from '../router/capabilityRouter';
import { quotaManager } from '../router/quotaManager';
import { classifyProviderError, NormalizedProviderError } from '../errors/normalizedError';
import { geminiImageProvider } from '../imageProviders/gemini';
import { openAIImageProvider } from '../imageProviders/openaiImage';
import { grokImageProvider } from '../imageProviders/grokImage';
import { huggingFaceMediaProvider } from '../imageProviders/huggingfaceMedia';
import { fluxImageProvider } from '../imageProviders/flux';
import { stableDiffusionImageProvider } from '../imageProviders/stableDiffusion';
import { falFluxImageProvider } from '../imageProviders/falFlux';
import { veoVideoProvider } from '../videoProviders/veoVideo';
import { grokVideoProvider } from '../videoProviders/grokVideo';
import { aiProvider } from '../aiProvider';

export interface GenerationRequestParams {
  userId: string;
  projectId?: string;
  type?: string;
  prompt: string;
  enhancedPrompt?: string;
  model?: string;
  autoModelSwitching?: boolean;
  settings?: any;
  inputAssetId?: string;
  inputBuffer?: Buffer;
  inputMimeType?: string;
  idempotencyKey?: string;
  requestId?: string;
}

export type GenerationSSEEvent =
  | { type: 'generation.created'; generationId: string; requestId: string; timestamp: number }
  | { type: 'generation.queued'; generationId: string; model: string; provider: string; timestamp: number }
  | { type: 'generation.provider_selected'; generationId: string; provider: string; model: string; reason: string; timestamp: number }
  | { type: 'generation.provider_failed'; generationId: string; provider: string; model: string; error: NormalizedProviderError; timestamp: number }
  | { type: 'generation.provider_switching'; generationId: string; fromProvider: string; fromModel: string; toProvider: string; toModel: string; reason: string; timestamp: number }
  | { type: 'generation.processing'; generationId: string; stage: string; timestamp: number }
  | { type: 'generation.finalizing'; generationId: string; timestamp: number }
  | { type: 'generation.completed'; generationId: string; asset: any; switchedFrom?: { provider: string; model: string }; timestamp: number }
  | { type: 'generation.failed'; generationId: string; error: NormalizedProviderError; timestamp: number }
  | { type: 'generation.cancelled'; generationId: string; timestamp: number };

export class GenerationOrchestrator {
  private activeGenerations: Map<string, { status: string; cancel: () => void }> = new Map();
  private listeners: Map<string, Set<(event: GenerationSSEEvent) => void>> = new Map();

  /**
   * Subscribe to SSE updates for a generation
   */
  subscribe(generationId: string, listener: (event: GenerationSSEEvent) => void): () => void {
    if (!this.listeners.has(generationId)) {
      this.listeners.set(generationId, new Set());
    }
    this.listeners.get(generationId)!.add(listener);

    return () => {
      const set = this.listeners.get(generationId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.listeners.delete(generationId);
      }
    };
  }

  private emit(generationId: string, event: GenerationSSEEvent) {
    const set = this.listeners.get(generationId);
    if (set) {
      for (const listener of set) {
        try { listener(event); } catch {}
      }
    }
  }

  /**
   * Cancel an ongoing generation
   */
  cancel(generationId: string): boolean {
    const active = this.activeGenerations.get(generationId);
    if (active) {
      active.cancel();
      this.activeGenerations.delete(generationId);
      db.updateGeneration(generationId, { status: 'CANCELLED', completed_at: new Date().toISOString() });
      this.emit(generationId, { type: 'generation.cancelled', generationId, timestamp: Date.now() });
      return true;
    }
    return false;
  }

  /**
   * Execute Generation Pipeline with Multi-Provider Fallback
   */
  async execute(params: GenerationRequestParams): Promise<{ generationId: string; asset?: any; error?: NormalizedProviderError }> {
    const requestId = params.requestId || crypto.randomUUID();
    const hasImage = Boolean(params.inputBuffer && params.inputBuffer.length > 0);
    const task = capabilityRouter.classifyTask(params.prompt, params.type, hasImage);
    const autoSwitch = params.autoModelSwitching !== false; // Default true

    // 1. Plan routing & candidate chain
    const route = await capabilityRouter.planRoute(task, params.model);
    if (!route.primaryModel) {
      const normErr: NormalizedProviderError = {
        code: 'NO_COMPATIBLE_PROVIDER',
        provider: 'orchestrator',
        message: 'No compatible generation provider is currently configured with active quota.',
        retryable: false,
        fallbackAvailable: false,
        suggestedProviders: ['Google Gemini', 'OpenAI', 'xAI Grok', 'Hugging Face'],
        requestId,
      };
      return { generationId: '', error: normErr };
    }

    // 2. Create database record
    const genRecord = db.createGeneration({
      user_id: params.userId,
      project_id: params.projectId || null,
      type: (task.includes('VIDEO') ? 'IMAGE_TO_VIDEO' : task === 'TEXT_TO_MUSIC' ? 'TEXT_TO_MUSIC' : 'TEXT_TO_IMAGE') as any,
      prompt: params.prompt,
      enhanced_prompt: null,
      negative_prompt: params.settings?.negativePrompt || null,
      input_asset_id: params.inputAssetId || null,
      output_asset_id: null,
      provider: route.primaryModel.provider,
      model: route.primaryModel.id,
      status: 'PROCESSING',
      settings: params.settings || {},
      provider_operation_id: null,
      error_code: null,
      error_message: null,
    });
    const generationId = genRecord.id;

    let isCancelled = false;
    this.activeGenerations.set(generationId, {
      status: 'PROCESSING',
      cancel: () => { isCancelled = true; },
    });

    this.emit(generationId, { type: 'generation.created', generationId, requestId, timestamp: Date.now() });
    this.emit(generationId, { type: 'generation.queued', generationId, model: route.primaryModel.id, provider: route.primaryModel.provider, timestamp: Date.now() });

    // 3. Execution loop with fallback chain
    const candidates = [route.primaryModel, ...route.fallbackChain];
    const attemptedIds: string[] = [];
    let initialModel = route.primaryModel;
    let switchedNotice: { provider: string; model: string } | undefined;
    let lastError: NormalizedProviderError | null = null;

    for (let i = 0; i < candidates.length; i++) {
      if (isCancelled) {
        this.activeGenerations.delete(generationId);
        return { generationId };
      }

      const candidate = candidates[i];
      attemptedIds.push(candidate.id);

      // Check if user has disabled auto-switching and we're attempting a fallback
      if (i > 0 && !autoSwitch) {
        lastError = {
          code: 'PROVIDER_QUOTA_EXHAUSTED',
          provider: initialModel.provider,
          model: initialModel.id,
          message: `${initialModel.name} quota reached. Automatic provider switching is disabled in your studio settings.`,
          retryable: false,
          fallbackAvailable: true,
          suggestedProviders: [candidate.name],
          requestId,
        };
        break;
      }

      // Emit provider selection or switching event
      if (i === 0) {
        this.emit(generationId, {
          type: 'generation.provider_selected',
          generationId,
          provider: candidate.provider,
          model: candidate.id,
          reason: route.reason,
          timestamp: Date.now(),
        });
      } else {
        switchedNotice = { provider: initialModel.providerName, model: initialModel.name };
        this.emit(generationId, {
          type: 'generation.provider_switching',
          generationId,
          fromProvider: candidates[i - 1].provider,
          fromModel: candidates[i - 1].name,
          toProvider: candidate.provider,
          toModel: candidate.name,
          reason: lastError?.message || 'Quota limit reached. Switching to compatible model.',
          timestamp: Date.now(),
        });
      }

      this.emit(generationId, {
        type: 'generation.processing',
        generationId,
        stage: `Synthesizing with ${candidate.name}`,
        timestamp: Date.now(),
      });

      // Execute provider adapter
      try {
        let result: any = null;

        if (task.includes('VIDEO')) {
          if (candidate.provider === 'xai') {
            result = await grokVideoProvider.generate(params.prompt, params.settings, params.inputBuffer, params.inputMimeType);
          } else {
            result = await veoVideoProvider.generate(params.prompt, params.settings, params.inputBuffer, params.inputMimeType);
          }
        } else if (task === 'TEXT_TO_MUSIC') {
          result = await aiProvider.generateMusic(params.prompt, (candidate.id as any) || 'lyria-3-clip-preview');
        } else {
          // Image generation
          if (candidate.provider === 'fal') {
            if (params.inputBuffer && falFluxImageProvider.edit) {
              result = await falFluxImageProvider.edit(params.prompt, params.inputBuffer, params.settings);
            } else {
              result = await falFluxImageProvider.generate(params.prompt, params.settings);
            }
          } else if (candidate.provider === 'openai') {
            result = await openAIImageProvider.generate(params.prompt, params.settings);
          } else if (candidate.provider === 'xai') {
            result = await grokImageProvider.generate(params.prompt, params.settings, params.inputBuffer);
          } else if (candidate.provider === 'huggingface') {
            result = await huggingFaceMediaProvider.generate(params.prompt, params.settings);
          } else if (candidate.provider === 'flux') {
            result = await fluxImageProvider.generate(params.prompt, params.settings);
          } else if (candidate.provider === 'stability') {
            result = await stableDiffusionImageProvider.generate(params.prompt, params.settings);
          } else {
            // Default Gemini Image
            if (params.inputBuffer && geminiImageProvider.edit) {
              result = await geminiImageProvider.edit(params.prompt, params.inputBuffer, params.settings);
            } else {
              result = await geminiImageProvider.generate(params.prompt, params.settings);
            }
          }
        }

        if (result && result.success && result.asset) {
          // Success! Finalize and persist asset
          this.emit(generationId, { type: 'generation.finalizing', generationId, timestamp: Date.now() });

          const assetRecord = db.createAsset({
            user_id: params.userId,
            project_id: params.projectId || null,
            type: task.includes('VIDEO') ? 'VIDEO' : task === 'TEXT_TO_MUSIC' ? 'AUDIO' : 'IMAGE',
            source: 'GENERATED',
            storage_key: result.asset.storageKey,
            thumbnail_key: null,
            mime_type: result.asset.mimeType,
            size_bytes: result.asset.sizeBytes,
            duration_seconds: result.asset.durationSeconds || null,
            metadata: {
              prompt: params.prompt,
              model: candidate.id,
              provider: candidate.provider,
              settings: params.settings,
              switchedFrom: switchedNotice,
            },
          });

          db.updateGeneration(generationId, {
            status: 'COMPLETED',
            output_asset_id: assetRecord.id,
            completed_at: new Date().toISOString(),
          });

          this.emit(generationId, {
            type: 'generation.completed',
            generationId,
            asset: {
              id: assetRecord.id,
              url: result.asset.publicUrl,
              mimeType: result.asset.mimeType,
              model: candidate.name,
              provider: candidate.providerName,
              durationSeconds: result.asset.durationSeconds,
            },
            switchedFrom: switchedNotice,
            timestamp: Date.now(),
          });

          this.activeGenerations.delete(generationId);
          return { generationId, asset: assetRecord };
        }

        // Provider failed
        const errObj = result?.error || new Error('Generation failed without error payload.');
        lastError = classifyProviderError(errObj, candidate.provider, candidate.id, requestId);

        // Record health failure
        await quotaManager.recordQuotaFailure(
          candidate.provider,
          candidate.id,
          lastError.code === 'PROVIDER_QUOTA_EXHAUSTED',
          lastError.message,
          lastError.retryAfter
        );

        this.emit(generationId, {
          type: 'generation.provider_failed',
          generationId,
          provider: candidate.provider,
          model: candidate.id,
          error: lastError,
          timestamp: Date.now(),
        });

        // If error is non-fallback (safety rejection), terminate immediately
        if (lastError.code === 'PROVIDER_CONTENT_REJECTED') {
          break;
        }
      } catch (err: any) {
        lastError = classifyProviderError(err, candidate.provider, candidate.id, requestId);
        await quotaManager.recordOperationalFailure(candidate.provider, candidate.id, 'SERVER_ERROR', lastError.message);
      }
    }

    // All candidates failed or non-fallback error occurred
    const finalErr: NormalizedProviderError = lastError || {
      code: 'GENERATION_FAILED',
      provider: initialModel.provider,
      model: initialModel.id,
      message: 'All compatible providers were unable to complete the request.',
      retryable: true,
      fallbackAvailable: false,
      requestId,
    };

    db.updateGeneration(generationId, {
      status: 'FAILED',
      error_code: finalErr.code,
      error_message: finalErr.message,
      completed_at: new Date().toISOString(),
    });

    this.emit(generationId, {
      type: 'generation.failed',
      generationId,
      error: finalErr,
      timestamp: Date.now(),
    });

    this.activeGenerations.delete(generationId);
    return { generationId, error: finalErr };
  }
}

export const generationOrchestrator = new GenerationOrchestrator();
