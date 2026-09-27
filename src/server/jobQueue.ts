import { db, DEFAULT_USER_ID, GenerationRecord } from './db';
import { aiProvider } from './aiProvider';
import { modelRegistry } from './imageProviders/registry';
import { storage } from './storage';
import { capabilityRouter } from './router/capabilityRouter';
import { TaskType } from './router/modelCapabilityRegistry';

type SSEListener = (event: string, data: any) => void;

class JobQueue {
  private listeners: Map<string, Set<SSEListener>> = new Map();
  private runningJobs: Set<string> = new Set();

  subscribe(generationId: string, listener: SSEListener): () => void {
    if (!this.listeners.has(generationId)) {
      this.listeners.set(generationId, new Set());
    }
    this.listeners.get(generationId)!.add(listener);

    return () => {
      const set = this.listeners.get(generationId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(generationId);
        }
      }
    };
  }

  emitStatus(generationId: string, status: string, payload: any = {}) {
    const set = this.listeners.get(generationId);
    const eventData = {
      generation_id: generationId,
      status,
      timestamp: new Date().toISOString(),
      ...payload,
    };
    if (set) {
      for (const listener of set) {
        try {
          listener('generation.status', eventData);
        } catch (err) {
          console.error('SSE listener error:', err);
        }
      }
    }
  }

  async enqueue(generationId: string) {
    if (this.runningJobs.has(generationId)) return;
    this.runningJobs.add(generationId);

    // Process asynchronously without blocking HTTP caller
    setImmediate(async () => {
      await this.process(generationId);
      this.runningJobs.delete(generationId);
    });
  }

  private async process(generationId: string) {
    const gen = db.getGeneration(generationId);
    if (!gen) return;

    try {
      // 1. Transition: QUEUED -> PROCESSING
      db.updateGeneration(generationId, {
        status: 'PROCESSING',
        started_at: new Date().toISOString(),
      });
      this.emitStatus(generationId, 'PROCESSING');

      const isVideo = gen.type.includes('VIDEO');
      const isMusic = gen.type === 'TEXT_TO_MUSIC';
      const isImg2Img = gen.type === 'IMAGE_TO_IMAGE';
      const promptToUse = gen.enhanced_prompt || gen.prompt;

      let inputBuffer: Buffer | undefined;
      let inputMime: string | undefined;

      if (gen.input_asset_id) {
        const inputAsset = db.getAsset(gen.input_asset_id);
        if (inputAsset) {
          const buf = await storage.getFile(inputAsset.storage_key);
          if (buf) {
            inputBuffer = buf;
            inputMime = inputAsset.mime_type;
          }
        }
      }

      let result;
      if (isMusic) {
        result = await aiProvider.generateMusic(
          promptToUse,
          (gen.model as any) || 'lyria-3-clip-preview',
          inputBuffer,
          inputMime
        );
      } else if (isVideo) {
        result = await aiProvider.generateVideo(
          promptToUse,
          gen.settings,
          inputBuffer,
          inputMime,
          'veo-3.1-fast-generate-preview',
        );
      } else {
        result = await modelRegistry.generate(
          gen.model || 'gemini-3.1-flash-image-preview',
          promptToUse,
          gen.settings,
          isImg2Img ? inputBuffer : undefined
        );
      }

      // Check for user cancellation while job was running
      const currentGen = db.getGeneration(generationId);
      if (currentGen && currentGen.status === 'CANCELLED') {
        this.emitStatus(generationId, 'CANCELLED');
        return;
      }

      if (!result.success || !result.asset) {
        const errorCode = result.error?.code || 'GENERATION_FAILED';
        const errorMessage = result.error?.message || 'Model generation failed.';
        const isQuotaOrRateLimit =
          errorCode === 'PROVIDER_QUOTA_EXHAUSTED' ||
          errorCode === 'PROVIDER_RATE_LIMITED' ||
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.toLowerCase().includes('rate limit') ||
          errorMessage.toLowerCase().includes('429') ||
          errorMessage.toLowerCase().includes('resource_exhausted');

        const taskType: TaskType = isMusic
          ? 'TEXT_TO_MUSIC'
          : isVideo
          ? (isImg2Img ? 'IMAGE_TO_VIDEO' : 'TEXT_TO_VIDEO')
          : (isImg2Img ? 'IMAGE_TO_IMAGE' : 'TEXT_TO_IMAGE');

        let fallbackSucceeded = false;

        if (isQuotaOrRateLimit && taskType.includes('IMAGE')) {
          console.warn(`[JobQueue] Quota hit for ${gen.model}. Evaluating compatible fallback models...`);
          const route = await capabilityRouter.planRoute(taskType, gen.model, [gen.model]);

          for (const fallback of route.fallbackChain) {
            if (fallback.id === gen.model) continue;

            console.log(`[JobQueue] Attempting fallback model: ${fallback.name} (${fallback.id})`);
            this.emitStatus(generationId, 'PROCESSING', {
              stage: `Primary model quota reached. Continuing with ${fallback.name}...`,
              switched_from: gen.model,
              switched_to: fallback.id,
              switched_provider: fallback.provider,
            });

            const fallbackResult = await modelRegistry.generate(
              fallback.id,
              promptToUse,
              gen.settings,
              isImg2Img ? inputBuffer : undefined
            );

            if (fallbackResult && fallbackResult.success && fallbackResult.asset) {
              result = fallbackResult;
              fallbackSucceeded = true;
              db.updateGeneration(generationId, {
                model: fallback.id,
                provider: fallback.provider,
              });
              break;
            }
          }
        }

        if (!fallbackSucceeded && (!result.success || !result.asset)) {
          // Failed completely
          const alternatives = (await capabilityRouter.getCandidateModels(taskType))
            .filter((m) => m.id !== gen.model)
            .map((m) => m.name)
            .slice(0, 3);

          db.updateGeneration(generationId, {
            status: 'FAILED',
            error_code: errorCode,
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          });
          this.emitStatus(generationId, 'FAILED', {
            error: {
              code: errorCode,
              message: errorMessage,
              alternatives,
              retryable: true,
            },
          });
        }
      }

      if (!result || !result.success || !result.asset) {
        return;
      }

      // 2. Transition: FINALIZING
      db.updateGeneration(generationId, { status: 'FINALIZING' });
      this.emitStatus(generationId, 'FINALIZING');

      // Create Asset record in DB
      const assetRecord = db.createAsset({
        user_id: gen.user_id,
        project_id: gen.project_id,
        type: isMusic ? 'AUDIO' : (isVideo ? 'VIDEO' : 'IMAGE'),
        source: 'GENERATED',
        storage_key: result.asset.storageKey,
        thumbnail_key: null,
        mime_type: result.asset.mimeType,
        size_bytes: result.asset.sizeBytes,
        duration_seconds: result.asset.durationSeconds || null,
        metadata: {
          prompt: gen.prompt,
          model: gen.model,
          settings: gen.settings,
        },
      });

      // 3. Transition: COMPLETED
      db.updateGeneration(generationId, {
        status: 'COMPLETED',
        output_asset_id: assetRecord.id,
        completed_at: new Date().toISOString(),
      });

      // Record Usage
      db.recordUsage({
        user_id: gen.user_id,
        generation_id: gen.id,
        provider: gen.provider,
        model: gen.model,
        processing_time_ms: 2500,
        input_units: 1,
        output_units: 1,
      });

      this.emitStatus(generationId, 'COMPLETED', {
        output_asset_id: assetRecord.id,
        output_url: result.asset.publicUrl,
      });
    } catch (err: any) {
      console.error('JobQueue unhandled worker failure:', err);
      db.updateGeneration(generationId, {
        status: 'FAILED',
        error_code: 'INTERNAL_ERROR',
        error_message: err?.message || 'Unexpected worker exception',
        completed_at: new Date().toISOString(),
      });
      this.emitStatus(generationId, 'FAILED', {
        error: { code: 'INTERNAL_ERROR', message: err?.message || 'Server error' },
      });
    }
  }
}

export const jobQueue = new JobQueue();
