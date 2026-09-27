import { ImageProvider, ProviderGenerationResult, ProviderHealthStatus } from './base';
import { storage } from '../storage';

export class StableDiffusionImageProvider implements ImageProvider {
  readonly id = 'stable_diffusion';
  readonly name = 'Stability AI (SDXL & SD 3.5 Medium)';
  readonly providerType = 'open_source' as const;

  private isEnabled(): boolean {
    return process.env.SD_ENABLED === 'true' || !!process.env.SD_API_URL;
  }

  private getApiUrl(): string | null {
    return process.env.SD_API_URL || null;
  }

  private getApiKey(): string | null {
    return process.env.SD_API_KEY || null;
  }

  async health(): Promise<ProviderHealthStatus> {
    const url = this.getApiUrl();
    if (!this.isEnabled() || !url) {
      return {
        status: 'unconfigured',
        message: 'Stable Diffusion provider is unconfigured. Set SD_API_URL and optionally SD_API_KEY to enable.',
      };
    }

    try {
      const headers: Record<string, string> = {};
      const key = this.getApiKey();
      if (key) headers['Authorization'] = `Bearer ${key}`;

      await fetch(url, {
        method: 'HEAD',
        headers,
        signal: AbortSignal.timeout(4000),
      }).catch(() => null);

      return {
        status: 'healthy',
        endpoint: url,
        message: 'Stable Diffusion inference endpoint reachable.',
      };
    } catch (e: any) {
      return {
        status: 'error',
        endpoint: url,
        message: `Endpoint connection error: ${e.message}`,
      };
    }
  }

  supports(feature: string): boolean {
    return ['text_to_image', 'image_to_image', 'aspect_ratio', 'seed', 'steps', 'guidance', 'negative_prompt'].includes(feature);
  }

  capabilities(): string[] {
    return ['text_to_image', 'image_to_image', 'aspect_ratio', 'seed', 'steps', 'guidance', 'negative_prompt'];
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
    }
  ): Promise<ProviderGenerationResult> {
    const url = this.getApiUrl();
    if (!this.isEnabled() || !url) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_UNCONFIGURED',
          message: 'Stable Diffusion provider is not configured. Please configure SD_API_URL in server environment.',
        },
      };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const key = this.getApiKey();
      if (key) headers['Authorization'] = `Bearer ${key}`;

      const aspect = settings.aspectRatio || '16:9';
      let width = 1024;
      let height = 576;
      if (aspect === '1:1') {
        width = 1024;
        height = 1024;
      } else if (aspect === '9:16') {
        width = 576;
        height = 1024;
      } else if (aspect === '4:3') {
        width = 1024;
        height = 768;
      }

      const payload = {
        prompt,
        negative_prompt: settings.negativePrompt || 'blurry, distorted, artifacts, low resolution',
        steps: settings.steps || 30,
        cfg_scale: settings.guidance || 7.0,
        seed: settings.seed !== undefined ? settings.seed : Math.floor(Math.random() * 1000000),
        width,
        height,
        model: settings.model || process.env.SD_MODEL || 'sdxl',
      };

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`SD endpoint error HTTP ${res.status}: ${errorText.slice(0, 200)}`);
      }

      const contentType = res.headers.get('content-type') || '';
      let buffer: Buffer;

      if (contentType.includes('image/')) {
        const arrayBuf = await res.arrayBuffer();
        buffer = Buffer.from(arrayBuf);
      } else {
        const data = await res.json();
        const b64 = data.images?.[0] || data.artifacts?.[0]?.base64 || data.image;
        if (b64) {
          buffer = Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        } else if (data.output && typeof data.output === 'string') {
          const imgRes = await fetch(data.output);
          buffer = Buffer.from(await imgRes.arrayBuffer());
        } else {
          throw new Error('Unsupported response structure from SD endpoint.');
        }
      }

      const { storageKey, publicUrl } = await storage.saveFile(buffer, 'png');

      return {
        success: true,
        asset: {
          storageKey,
          publicUrl,
          mimeType: 'image/png',
          sizeBytes: buffer.length,
          width,
          height,
        },
      };
    } catch (err: any) {
      console.error('Stable Diffusion generation failed:', err);
      return {
        success: false,
        error: {
          code: 'SD_GENERATION_FAILED',
          message: err?.message || 'Stable Diffusion generation failed.',
        },
      };
    }
  }
}

export const stableDiffusionImageProvider = new StableDiffusionImageProvider();
