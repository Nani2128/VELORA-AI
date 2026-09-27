/**
 * VELORA AI — Fal.ai FLUX.1 [schnell] Image Provider
 * 
 * Implements first-class Fal.ai integration for high-speed FLUX.1 schnell image synthesis.
 * Uses official @fal-ai/client SDK, handles queue-based submission and status polling,
 * downloads media server-side, saves to VELORA storage, and tracks quota/health states.
 */

import { fal } from '@fal-ai/client';
import { ImageProvider, ProviderGenerationResult, ProviderHealthStatus } from './base';
import { storage } from '../storage';
import { classifyProviderError } from '../errors/normalizedError';
import { quotaManager } from '../router/quotaManager';

export interface FalFluxSettings {
  aspectRatio?: string;
  imageSize?: 'square' | 'square_hd' | 'portrait_4_3' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_16_9' | string;
  width?: number;
  height?: number;
  numInferenceSteps?: number;
  steps?: number;
  guidanceScale?: number;
  guidance?: number;
  seed?: number;
  numImages?: number;
  enableSafetyChecker?: boolean;
  outputFormat?: 'png' | 'jpeg';
  negativePrompt?: string;
  model?: string;
  [key: string]: any;
}

export class FalFluxImageProvider implements ImageProvider {
  readonly id = 'fal';
  readonly name = 'Fal.ai FLUX.1 [schnell]';
  readonly providerType = 'cloud' as const;
  readonly modelId = 'fal-ai/flux/schnell';

  isConfigured(): boolean {
    return !!process.env.FAL_KEY;
  }

  supports(feature: string): boolean {
    return [
      'text_to_image',
      'image_to_image',
      'aspect_ratio',
      'seed',
      'steps',
      'guidance',
      'negative_prompt',
      'multi_image',
    ].includes(feature);
  }

  capabilities(): string[] {
    return [
      'text_to_image',
      'image_to_image',
      'aspect_ratio',
      'seed',
      'steps',
      'guidance',
      'negative_prompt',
      'multi_image',
    ];
  }

  async health(): Promise<ProviderHealthStatus> {
    if (!this.isConfigured()) {
      return {
        status: 'unconfigured',
        message: 'FAL_KEY is not configured on the server.',
      };
    }

    const qState = await quotaManager.getHealth('fal', this.modelId);
    if (qState.state === 'RATE_LIMITED' || qState.state === 'QUOTA_EXHAUSTED') {
      return {
        status: 'error',
        message: qState.reason || 'Fal.ai FLUX quota or rate-limit active.',
      };
    }

    return {
      status: 'healthy',
      endpoint: 'https://queue.fal.run/fal-ai/flux/schnell',
      message: 'Fal.ai FLUX.1 [schnell] operational.',
    };
  }

  private mapImageSize(settings: FalFluxSettings): any {
    // If explicit width & height provided
    if (settings.width && settings.height) {
      return {
        width: Math.min(Math.max(settings.width, 256), 2048),
        height: Math.min(Math.max(settings.height, 256), 2048),
      };
    }

    // Preset mapping
    if (settings.imageSize) {
      return settings.imageSize;
    }

    // Aspect ratio mapping to FLUX presets
    const aspect = settings.aspectRatio || '1:1';
    switch (aspect) {
      case '16:9':
        return 'landscape_16_9';
      case '9:16':
        return 'portrait_16_9';
      case '4:3':
        return 'landscape_4_3';
      case '3:4':
        return 'portrait_4_3';
      case '1:1':
      default:
        return 'square_hd';
    }
  }

  async generate(
    prompt: string,
    settings: {
      aspectRatio?: string;
      seed?: number;
      steps?: number;
      guidance?: number;
      negativePrompt?: string;
      model?: string;
      [key: string]: any;
    } = {}
  ): Promise<ProviderGenerationResult> {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_AUTH_ERROR',
          message: 'FAL_KEY is not configured on the server.',
        },
      };
    }

    // Configure fal client with server-side credential
    fal.config({ credentials: falKey });

    const startTime = Date.now();
    const imageSize = this.mapImageSize(settings);

    const inputPayload: Record<string, any> = {
      prompt,
      image_size: imageSize,
      num_inference_steps: settings.steps ?? settings.numInferenceSteps ?? 4,
      guidance_scale: settings.guidance ?? settings.guidanceScale ?? 3.5,
      num_images: settings.numImages ?? 1,
      enable_safety_checker: settings.enableSafetyChecker ?? true,
      output_format: settings.outputFormat ?? 'png',
    };

    if (settings.seed !== undefined && settings.seed !== null) {
      inputPayload.seed = settings.seed;
    }

    try {
      console.log(`[Fal.ai FLUX] Submitting generation queue request: "${prompt.slice(0, 50)}..."`);
      
      // Use subscribe for queue submission + automatic polling until completion
      const result: any = await (fal.subscribe as any)(this.modelId, {
        input: inputPayload,
        logs: false,
      });

      const images = result?.data?.images || result?.images;
      if (!images || !Array.isArray(images) || images.length === 0 || !images[0]?.url) {
        return {
          success: false,
          error: {
            code: 'GENERATION_FAILED',
            message: 'No image data returned from Fal.ai FLUX.',
          },
        };
      }

      const imageUrl = images[0].url;
      const contentType = images[0].content_type || 'image/png';
      const width = images[0].width || (typeof imageSize === 'object' ? imageSize.width : 1024);
      const height = images[0].height || (typeof imageSize === 'object' ? imageSize.height : 1024);

      // Download the generated image server-side
      const imgRes = await fetch(imageUrl, {
        signal: AbortSignal.timeout(30000),
      });

      if (!imgRes.ok) {
        throw new Error(`Failed to download Fal generated asset: HTTP ${imgRes.status}`);
      }

      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = contentType.includes('jpeg') ? 'jpg' : 'png';

      // Store in permanent local/s3 storage
      const { storageKey, publicUrl } = await storage.saveFile(buffer, ext);

      await quotaManager.recordSuccess('fal', this.modelId, Date.now() - startTime);

      return {
        success: true,
        asset: {
          storageKey,
          publicUrl,
          mimeType: contentType,
          sizeBytes: buffer.length,
          width,
          height,
        },
      };
    } catch (err: any) {
      console.warn('[Fal.ai FLUX] Error generating image:', err?.message || err);
      const classified = classifyProviderError(err, 'fal', this.modelId);

      await quotaManager.recordQuotaFailure(
        'fal',
        this.modelId,
        classified.code === 'PROVIDER_QUOTA_EXHAUSTED',
        classified.message,
        classified.retryAfter
      );

      return {
        success: false,
        error: {
          code: classified.code,
          message: classified.message,
        },
      };
    }
  }

  async edit(
    prompt: string,
    imageBuffer: Buffer,
    settings: {
      aspectRatio?: string;
      model?: string;
      [key: string]: any;
    } = {}
  ): Promise<ProviderGenerationResult> {
    return this.generateWithReference(prompt, imageBuffer, settings);
  }

  async generateWithReference(
    prompt: string,
    imageBuffer: Buffer,
    settings: {
      aspectRatio?: string;
      model?: string;
      [key: string]: any;
    } = {}
  ): Promise<ProviderGenerationResult> {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_AUTH_ERROR',
          message: 'FAL_KEY is not configured on the server.',
        },
      };
    }

    fal.config({ credentials: falKey });
    const startTime = Date.now();
    const imageSize = this.mapImageSize(settings);

    try {
      const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      const result: any = await (fal.subscribe as any)('fal-ai/flux/dev/image-to-image', {
        input: {
          prompt,
          image_url: base64Image,
          strength: 0.8,
          image_size: imageSize,
          num_inference_steps: settings.steps ?? settings.numInferenceSteps ?? 8,
          guidance_scale: settings.guidance ?? settings.guidanceScale ?? 3.5,
        },
      });

      const images = result?.data?.images || result?.images;
      if (!images || !Array.isArray(images) || images.length === 0 || !images[0]?.url) {
        return {
          success: false,
          error: {
            code: 'GENERATION_FAILED',
            message: 'No image returned from Fal image-to-image synthesis.',
          },
        };
      }

      const imgRes = await fetch(images[0].url);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const { storageKey, publicUrl } = await storage.saveFile(buffer, 'png');

      await quotaManager.recordSuccess('fal', this.modelId, Date.now() - startTime);

      return {
        success: true,
        asset: {
          storageKey,
          publicUrl,
          mimeType: 'image/png',
          sizeBytes: buffer.length,
          width: images[0].width || 1024,
          height: images[0].height || 1024,
        },
      };
    } catch (err: any) {
      const classified = classifyProviderError(err, 'fal', this.modelId);
      return {
        success: false,
        error: { code: classified.code, message: classified.message },
      };
    }
  }

  async getStatus(requestId: string): Promise<{ status: string; progress?: number }> {
    try {
      const falKey = process.env.FAL_KEY;
      if (falKey) fal.config({ credentials: falKey });
      const status = await fal.queue.status(this.modelId, { requestId, logs: false });
      return {
        status: status.status,
      };
    } catch {
      return { status: 'UNKNOWN' };
    }
  }

  async cancel(requestId: string): Promise<boolean> {
    try {
      const falKey = process.env.FAL_KEY;
      if (falKey) fal.config({ credentials: falKey });
      await fal.queue.cancel(this.modelId, { requestId });
      return true;
    } catch {
      return false;
    }
  }
}

export const falFluxImageProvider = new FalFluxImageProvider();
