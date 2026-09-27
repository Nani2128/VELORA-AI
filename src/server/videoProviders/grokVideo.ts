/**
 * VELORA AI — xAI Grok Imagine Dedicated Video Provider
 * 
 * Invokes xAI video endpoints (grok-imagine-video-1.5), polls asynchronous status,
 * downloads final video bytes, and persists output in VELORA storage.
 */

import { VideoProvider, VideoCapability, VideoGenerationSettings, VideoProviderResult } from './base';
import { storage } from '../storage';
import { classifyProviderError } from '../errors/normalizedError';
import { quotaManager } from '../router/quotaManager';

export class GrokVideoProvider implements VideoProvider {
  id = 'xai_video';
  name = 'xAI Grok Imagine Video';

  isConfigured(): boolean {
    return !!process.env.XAI_API_KEY;
  }

  async health(): Promise<{ status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE'; latencyMs?: number; error?: string }> {
    if (!this.isConfigured()) {
      return { status: 'UNAVAILABLE', error: 'XAI_API_KEY is not configured.' };
    }
    const qState = await quotaManager.getHealth('xai_video', 'grok-imagine-video-1.5');
    if (qState.state === 'RATE_LIMITED' || qState.state === 'QUOTA_EXHAUSTED') {
      return { status: 'DEGRADED', error: qState.reason };
    }
    return { status: 'HEALTHY', latencyMs: qState.latencyMs || 2200 };
  }

  supports(capability: VideoCapability): boolean {
    return capability === 'TEXT_TO_VIDEO' || capability === 'IMAGE_TO_VIDEO' || capability === 'REFERENCE_TO_VIDEO';
  }

  async generate(
    prompt: string,
    settings: VideoGenerationSettings = {},
    inputBuffer?: Buffer,
    inputMimeType?: string
  ): Promise<VideoProviderResult> {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: { code: 'PROVIDER_AUTH_ERROR', message: 'XAI_API_KEY is not configured on the server.' },
      };
    }

    const model = process.env.XAI_VIDEO_MODEL || 'grok-imagine-video-1.5';
    const aspectRatio = settings.aspectRatio === '9:16' ? '9:16' : '16:9';
    const durationSeconds = settings.durationSeconds || 5;

    try {
      const payload: any = {
        model,
        prompt,
        aspect_ratio: aspectRatio,
        duration: durationSeconds,
      };

      if (inputBuffer) {
        payload.image = {
          data: inputBuffer.toString('base64'),
          mime_type: inputMimeType || 'image/png',
        };
      }

      // Initiate video generation operation
      const resp = await fetch('https://api.x.ai/v1/videos/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        const classified = classifyProviderError(errorData, 'xai_video', model);
        await quotaManager.recordQuotaFailure(
          'xai_video',
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

      const initData = await resp.json();
      const operationId = initData.id || initData.operation_id;

      if (!operationId && initData.video_url) {
        // Direct synchronous response
        const videoFetch = await fetch(initData.video_url);
        const arrayBuf = await videoFetch.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const { storageKey, publicUrl } = await storage.saveFile(buffer, 'mp4');

        return {
          success: true,
          asset: {
            storageKey,
            publicUrl,
            mimeType: 'video/mp4',
            sizeBytes: buffer.length,
            durationSeconds,
          },
        };
      }

      // Poll until finished (up to 3 minutes)
      let completedUrl: string | null = null;
      const startTime = Date.now();
      const timeoutMs = 180000;

      while (!completedUrl && Date.now() - startTime < timeoutMs) {
        await new Promise((r) => setTimeout(r, 6000));
        const statusResp = await fetch(`https://api.x.ai/v1/videos/operations/${operationId}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (statusResp.ok) {
          const statusData = await statusResp.json();
          if (statusData.status === 'COMPLETED' && statusData.video_url) {
            completedUrl = statusData.video_url;
            break;
          } else if (statusData.status === 'FAILED') {
            return {
              success: false,
              error: { code: 'GENERATION_FAILED', message: statusData.error || 'Video rendering failed upstream.' },
            };
          }
        }
      }

      if (!completedUrl) {
        return {
          success: false,
          error: { code: 'PROVIDER_TIMEOUT', message: 'xAI Grok Video operation timed out.' },
        };
      }

      const videoResp = await fetch(completedUrl);
      const arrayBuffer = await videoResp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const { storageKey, publicUrl } = await storage.saveFile(buffer, 'mp4');

      await quotaManager.recordSuccess('xai_video', model);

      return {
        success: true,
        asset: {
          storageKey,
          publicUrl,
          mimeType: 'video/mp4',
          sizeBytes: buffer.length,
          durationSeconds,
        },
      };
    } catch (err: any) {
      const classified = classifyProviderError(err, 'xai_video', model);
      return {
        success: false,
        error: { code: classified.code, message: classified.message },
      };
    }
  }
}

export const grokVideoProvider = new GrokVideoProvider();
