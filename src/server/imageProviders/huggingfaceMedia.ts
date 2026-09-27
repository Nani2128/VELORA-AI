/**
 * VELORA AI — Hugging Face Media Provider & Inference Client
 * 
 * Supports dynamic serverless inference for text-to-image models (FLUX.1-schnell, SDXL, etc.),
 * dynamic model verification, and standardized output storage.
 */

import { ImageProvider, ProviderGenerationResult, ProviderHealthStatus } from './base';
import { storage } from '../storage';
import { classifyProviderError } from '../errors/normalizedError';
import { quotaManager } from '../router/quotaManager';

export class HuggingFaceMediaProvider implements ImageProvider {
  readonly id = 'huggingface';
  readonly name = 'Hugging Face Inference';
  readonly providerType = 'open_source' as const;
  type = 'image' as const;

  isConfigured(): boolean {
    return !!process.env.HF_TOKEN;
  }

  supports(feature: string): boolean {
    return ['text_to_image', 'aspect_ratio'].includes(feature);
  }

  capabilities(): string[] {
    return ['text_to_image', 'aspect_ratio'];
  }

  async health(): Promise<ProviderHealthStatus> {
    if (!this.isConfigured()) {
      return { status: 'unconfigured', message: 'HF_TOKEN is not configured.' };
    }
    const qState = await quotaManager.getHealth('huggingface');
    if (qState.state === 'RATE_LIMITED' || qState.state === 'QUOTA_EXHAUSTED') {
      return { status: 'error', message: qState.reason };
    }
    return { status: 'healthy', endpoint: 'https://api-inference.huggingface.co', message: 'Hugging Face Inference API operational.' };
  }

  async generate(
    prompt: string,
    settings: {
      aspectRatio?: string;
      style?: string;
      negativePrompt?: string;
    } = {}
  ): Promise<ProviderGenerationResult> {
    const token = process.env.HF_TOKEN;
    if (!token) {
      return {
        success: false,
        error: { code: 'PROVIDER_AUTH_ERROR', message: 'HF_TOKEN is not configured on the server.' },
      };
    }

    const model = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';
    const startTime = Date.now();

    try {
      const resp = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt: settings.negativePrompt || undefined,
          },
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        const classified = classifyProviderError(errorData, 'huggingface', model);
        await quotaManager.recordQuotaFailure(
          'huggingface',
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

      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const { storageKey, publicUrl } = await storage.saveFile(buffer, 'png');

      await quotaManager.recordSuccess('huggingface', model, Date.now() - startTime);

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
      const classified = classifyProviderError(err, 'huggingface', model);
      return {
        success: false,
        error: { code: classified.code, message: classified.message },
      };
    }
  }

  async edit?(prompt: string, inputBuffer: Buffer): Promise<ProviderGenerationResult> {
    return {
      success: false,
      error: { code: 'PROVIDER_MODEL_UNAVAILABLE', message: 'Image editing is not supported on this Hugging Face pipeline.' },
    };
  }
}

export const huggingFaceMediaProvider = new HuggingFaceMediaProvider();

/**
 * Dynamic Hugging Face Model Discovery Engine
 */
let discoveryCache: { timestamp: number; data: any[] } | null = null;
const CACHE_TTL_MS = 3600000; // 1 hour

export async function discoverHuggingFaceModels(taskFilter?: string): Promise<any[]> {
  if (discoveryCache && Date.now() - discoveryCache.timestamp < CACHE_TTL_MS) {
    if (taskFilter) {
      return discoveryCache.data.filter((m) => m.pipeline_tag === taskFilter || m.task === taskFilter);
    }
    return discoveryCache.data;
  }

  try {
    const token = process.env.HF_TOKEN;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const url = 'https://huggingface.co/api/models?filter=inference-provider&sort=downloads&direction=-1&limit=30';
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      return discoveryCache?.data || [];
    }

    const list = await resp.json();
    const formatted = list.map((item: any) => ({
      id: `hf-${item.id}`,
      originalId: item.id,
      name: item.id.split('/').pop() || item.id,
      provider: 'huggingface',
      providerName: 'Hugging Face Hub',
      task: item.pipeline_tag || 'text-to-image',
      pipeline_tag: item.pipeline_tag,
      downloads: item.downloads || 0,
      likes: item.likes || 0,
    }));

    discoveryCache = { timestamp: Date.now(), data: formatted };

    if (taskFilter) {
      return formatted.filter((m: any) => m.pipeline_tag === taskFilter || m.task === taskFilter);
    }
    return formatted;
  } catch {
    return discoveryCache?.data || [];
  }
}
