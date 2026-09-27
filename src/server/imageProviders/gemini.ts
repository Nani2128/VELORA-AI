import { GoogleGenAI } from '@google/genai';
import { ImageProvider, ProviderGenerationResult, ProviderHealthStatus } from './base';
import { storage } from '../storage';

export class GeminiImageProvider implements ImageProvider {
  readonly id = 'google_gemini';
  readonly name = 'Google Gemini (Imagen 3 / Nano Banana)';
  readonly providerType = 'cloud' as const;
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  async health(): Promise<ProviderHealthStatus> {
    if (!process.env.GEMINI_API_KEY) {
      return {
        status: 'unconfigured',
        message: 'GEMINI_API_KEY environment variable is not configured.',
      };
    }
    return {
      status: 'healthy',
      endpoint: 'https://generativelanguage.googleapis.com',
      message: 'Gemini Cloud provider operational.',
    };
  }

  supports(feature: string): boolean {
    return ['text_to_image', 'image_to_image', 'aspect_ratio'].includes(feature);
  }

  capabilities(): string[] {
    return ['text_to_image', 'image_to_image', 'aspect_ratio'];
  }

  async generate(
    prompt: string,
    settings: {
      aspectRatio?: string;
      model?: string;
    }
  ): Promise<ProviderGenerationResult> {
    if (!this.ai || !process.env.GEMINI_API_KEY) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_AUTH_ERROR',
          message: 'Gemini API key is not configured on the server.',
        },
      };
    }

    const model = settings.model || 'gemini-3.1-flash-image';
    const aspectRatio = (settings.aspectRatio || '16:9') as any;

    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: ['1:1', '3:4', '4:3', '9:16', '16:9'].includes(aspectRatio) ? aspectRatio : '16:9',
            imageSize: '1K',
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          const mimeType = part.inlineData.mimeType || 'image/png';
          const ext = mimeType.includes('png') ? 'png' : 'jpg';
          const { storageKey, publicUrl } = await storage.saveFile(buffer, ext);

          return {
            success: true,
            asset: {
              storageKey,
              publicUrl,
              mimeType,
              sizeBytes: buffer.length,
            },
          };
        }
      }

      return {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'No inline image data returned by Gemini API.',
        },
      };
    } catch (err: any) {
      console.error('Gemini image generation error:', err);
      return {
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: err?.message || 'Error executing Gemini image generation.',
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
    }
  ): Promise<ProviderGenerationResult> {
    if (!this.ai || !process.env.GEMINI_API_KEY) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_AUTH_ERROR',
          message: 'Gemini API key is not configured.',
        },
      };
    }

    const model = settings.model || 'gemini-3.1-flash-image';
    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: imageBuffer.toString('base64'),
              },
            },
            {
              text: `Modify this image according to the following direction: ${prompt}`,
            },
          ],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          const mimeType = part.inlineData.mimeType || 'image/png';
          const ext = mimeType.includes('png') ? 'png' : 'jpg';
          const { storageKey, publicUrl } = await storage.saveFile(buffer, ext);

          return {
            success: true,
            asset: {
              storageKey,
              publicUrl,
              mimeType,
              sizeBytes: buffer.length,
            },
          };
        }
      }

      return {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: 'No edited image returned.',
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: err?.message || 'Image editing failed.',
        },
      };
    }
  }
}

export const geminiImageProvider = new GeminiImageProvider();
