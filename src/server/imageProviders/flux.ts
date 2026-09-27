import { ImageProvider, ProviderGenerationResult, ProviderHealthStatus } from './base';
import { storage } from '../storage';

export class FluxImageProvider implements ImageProvider {
  readonly id = 'flux';
  readonly name = 'Black Forest Labs (FLUX.1)';
  readonly providerType = 'open_source' as const;

  private isEnabled(): boolean {
    return process.env.FLUX_ENABLED === 'true' || !!process.env.FLUX_API_URL;
  }

  private getApiUrl(): string | null {
    return process.env.FLUX_API_URL || null;
  }

  private getApiKey(): string | null {
    return process.env.FLUX_API_KEY || null;
  }

  async health(): Promise<ProviderHealthStatus> {
    const url = this.getApiUrl();
    if (!this.isEnabled() || !url) {
      return {
        status: 'unconfigured',
        message: 'FLUX provider is unconfigured. Set FLUX_API_URL and optionally FLUX_API_KEY in server environment to enable.',
      };
    }

    try {
      // Ping remote endpoint or check health
      const headers: Record<string, string> = {};
      const key = this.getApiKey();
      if (key) headers['Authorization'] = `Bearer ${key}`;

      const res = await fetch(url, {
        method: 'HEAD',
        headers,
        signal: AbortSignal.timeout(4000),
      }).catch(() => null);

      return {
        status: 'healthy',
        endpoint: url,
        message: 'FLUX inference endpoint reachable.',
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
          message: 'FLUX provider is not configured. Please configure FLUX_API_URL in server environment.',
        },
      };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const key = this.getApiKey();
      if (key) headers['Authorization'] = `Bearer ${key}`;

      // Support standard Diffusers / HF / Replicate / OpenAI compatible format
      const payload: Record<string, any> = {
        prompt,
        negative_prompt: settings.negativePrompt || '',
        num_inference_steps: settings.steps || 28,
        guidance_scale: settings.guidance || 3.5,
        seed: settings.seed !== undefined ? settings.seed : Math.floor(Math.random() * 1000000),
      };

      // Aspect ratio dimensions
      const aspect = settings.aspectRatio || '16:9';
      if (aspect === '16:9') {
        payload.width = 1024;
        payload.height = 576;
      } else if (aspect === '9:16') {
        payload.width = 576;
        payload.height = 1024;
      } else if (aspect === '1:1') {
        payload.width = 1024;
        payload.height = 1024;
      } else if (aspect === '4:3') {
        payload.width = 1024;
        payload.height = 768;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`FLUX endpoint error HTTP ${res.status}: ${errorText.slice(0, 200)}`);
      }

      const contentType = res.headers.get('content-type') || '';
      let buffer: Buffer;

      if (contentType.includes('image/')) {
        // Direct image binary returned
        const arrayBuf = await res.arrayBuffer();
        buffer = Buffer.from(arrayBuf);
      } else {
        // JSON containing base64 or image URL
        const data = await res.json();
        if (data.images && data.images[0]) {
          const b64 = data.images[0].replace(/^data:image\/\w+;base64,/, '');
          buffer = Buffer.from(b64, 'base64');
        } else if (data.image) {
          const b64 = data.image.replace(/^data:image\/\w+;base64,/, '');
          buffer = Buffer.from(b64, 'base64');
        } else if (data.output && typeof data.output === 'string' && data.output.startsWith('http')) {
          const imgRes = await fetch(data.output);
          buffer = Buffer.from(await imgRes.arrayBuffer());
        } else {
          throw new Error('Unsupported response structure from FLUX endpoint.');
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
          width: payload.width,
          height: payload.height,
        },
      };
    } catch (err: any) {
      console.error('FLUX generation failed:', err);
      return {
        success: false,
        error: {
          code: 'FLUX_GENERATION_FAILED',
          message: err?.message || 'FLUX generation failed.',
        },
      };
    }
  }
}

export const fluxImageProvider = new FluxImageProvider();
