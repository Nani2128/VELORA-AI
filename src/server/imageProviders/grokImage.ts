/**
 * VELORA AI — xAI Grok Imagine Dedicated Image Provider
 * 
 * Invokes xAI image synthesis endpoints (grok-imagine-image-2.0),
 * stores generated assets in VELORA storage, and tracks quota/health states.
 */

import { ImageProvider, ProviderGenerationResult, ProviderHealthStatus } from './base';
import { storage } from '../storage';
import { classifyProviderError } from '../errors/normalizedError';
import { quotaManager } from '../router/quotaManager';

export class GrokImageProvider implements ImageProvider {
  readonly id = 'xai';
  readonly name = 'xAI Grok Imagine';
  readonly providerType = 'cloud' as const;
  type = 'image' as const;

  isConfigured(): boolean {
    return !!process.env.XAI_API_KEY;
  }

  supports(feature: string): boolean {
    return ['text_to_image', 'aspect_ratio'].includes(feature);
  }

  capabilities(): string[] {
    return ['text_to_image', 'aspect_ratio'];
  }

  async health(): Promise<ProviderHealthStatus> {
    if (!this.isConfigured()) {
      return { status: 'unconfigured', message: 'XAI_API_KEY is not configured.' };
    }
    const qState = await quotaManager.getHealth('xai', 'grok-imagine-image-2.0');
    if (qState.state === 'RATE_LIMITED' || qState.state === 'QUOTA_EXHAUSTED') {
      return { status: 'error', message: qState.reason };
    }
    return { status: 'healthy', endpoint: 'https://api.x.ai/v1', message: 'xAI Grok Image API operational.' };
  }

  async generate(
    prompt: string,
    settings: {
      aspectRatio?: string;
      style?: string;
      negativePrompt?: string;
    } = {},
    referenceImageBuffer?: Buffer
  ): Promise<ProviderGenerationResult> {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_AUTH_ERROR',
          message: 'XAI_API_KEY is not configured on the server.',
        },
      };
    }

    const model = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-2.0';
    const size = settings.aspectRatio === '9:16' ? '720x1280' : settings.aspectRatio === '16:9' ? '1280x720' : '1024x1024';
    const startTime = Date.now();

    try {
      const payload: any = {
        model,
        prompt,
        size,
        response_format: 'b64_json',
      };

      if (referenceImageBuffer) {
        payload.image = referenceImageBuffer.toString('base64');
      }

      const resp = await fetch('https://api.x.ai/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        const classified = classifyProviderError(errorData, 'xai', model);
        await quotaManager.recordQuotaFailure(
          'xai',
          model,
          classified.code === 'PROVIDER_QUOTA_EXHAUSTED',
          classified.message,
          classified.retryAfter
        );
        return {
          success: false,
          error: { code: classified.code, message: classified.message },
        };
      }

      const data = await resp.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) {
        return {
          success: false,
          error: { code: 'GENERATION_FAILED', message: 'No image data returned from xAI Grok.' },
        };
      }

      const buffer = Buffer.from(b64, 'base64');
      const { storageKey, publicUrl } = await storage.saveFile(buffer, 'png');

      await quotaManager.recordSuccess('xai', model, Date.now() - startTime);

      return {
        success: true,
        asset: {
          storageKey,
          publicUrl,
          mimeType: 'image/png',
          sizeBytes: buffer.length,
        },
      };
    } catch (err: any) {
      const classified = classifyProviderError(err, 'xai', model);
      return {
        success: false,
        error: { code: classified.code, message: classified.message },
      };
    }
  }

  async edit?(prompt: string, inputBuffer: Buffer): Promise<ProviderGenerationResult> {
    return this.generate(prompt, {}, inputBuffer);
  }
}

export const grokImageProvider = new GrokImageProvider();
