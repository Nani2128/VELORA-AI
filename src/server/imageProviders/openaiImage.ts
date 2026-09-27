/**
 * VELORA AI — OpenAI Dedicated Image Provider
 * 
 * Invokes OpenAI Image APIs (DALL·E 3 / GPT Image models), stores outputs through VELORA storage,
 * and handles rate-limits and quota errors with the normalized error system.
 */

import { ImageProvider, ProviderGenerationResult, ProviderHealthStatus } from './base';
import { storage } from '../storage';
import { classifyProviderError } from '../errors/normalizedError';
import { quotaManager } from '../router/quotaManager';

export class OpenAIImageProvider implements ImageProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI GPT Image';
  readonly providerType = 'cloud' as const;
  type = 'image' as const;

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  supports(feature: string): boolean {
    return ['text_to_image', 'aspect_ratio'].includes(feature);
  }

  capabilities(): string[] {
    return ['text_to_image', 'aspect_ratio'];
  }

  async health(): Promise<ProviderHealthStatus> {
    if (!this.isConfigured()) {
      return { status: 'unconfigured', message: 'OPENAI_API_KEY is not configured.' };
    }
    const qState = await quotaManager.getHealth('openai', 'dall-e-3');
    if (qState.state === 'RATE_LIMITED' || qState.state === 'QUOTA_EXHAUSTED') {
      return { status: 'error', message: qState.reason };
    }
    return { status: 'healthy', endpoint: 'https://api.openai.com/v1/images/generations', message: 'OpenAI Image API operational.' };
  }

  async generate(
    prompt: string,
    settings: {
      aspectRatio?: string;
      style?: string;
      negativePrompt?: string;
    } = {}
  ): Promise<ProviderGenerationResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_AUTH_ERROR',
          message: 'OPENAI_API_KEY is not configured on the server.',
        },
      };
    }

    const model = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3';
    const size = settings.aspectRatio === '9:16' ? '1024x1792' : settings.aspectRatio === '16:9' ? '1792x1024' : '1024x1024';
    const startTime = Date.now();

    try {
      const resp = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size,
          response_format: 'b64_json',
          quality: 'standard',
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        const classified = classifyProviderError(errorData, 'openai', model);
        await quotaManager.recordQuotaFailure(
          'openai',
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
          error: { code: 'GENERATION_FAILED', message: 'No image data returned from OpenAI.' },
        };
      }

      const buffer = Buffer.from(b64, 'base64');
      const { storageKey, publicUrl } = await storage.saveFile(buffer, 'png');

      await quotaManager.recordSuccess('openai', model, Date.now() - startTime);

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
      const classified = classifyProviderError(err, 'openai', model);
      return {
        success: false,
        error: { code: classified.code, message: classified.message },
      };
    }
  }

  async edit?(prompt: string, inputBuffer: Buffer): Promise<ProviderGenerationResult> {
    return {
      success: false,
      error: { code: 'PROVIDER_MODEL_UNAVAILABLE', message: 'Image editing is currently not available via this OpenAI model.' },
    };
  }
}

export const openAIImageProvider = new OpenAIImageProvider();
