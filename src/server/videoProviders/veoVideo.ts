/**
 * VELORA AI — Google Veo Video Provider
 * 
 * Supports text-to-video and image-to-video using Google Veo (veo-3.1-fast-generate-preview).
 * Handles operation polling, aspect ratio enforcement (16:9 and 9:16), quota classification,
 * and high-definition fallback synthesis.
 */

import { VideoProvider, VideoCapability, VideoGenerationSettings, VideoProviderResult } from './base';
import { aiProvider } from '../aiProvider';
import { quotaManager } from '../router/quotaManager';

export class VeoVideoProvider implements VideoProvider {
  id = 'veo';
  name = 'Google Veo 3 Video Generator';

  isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  async health(): Promise<{ status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE'; latencyMs?: number; error?: string }> {
    if (!this.isConfigured()) {
      return { status: 'UNAVAILABLE', error: 'GEMINI_API_KEY is not configured.' };
    }
    const qState = await quotaManager.getHealth('gemini', 'veo-3.1-fast-generate-preview');
    if (qState.state === 'RATE_LIMITED' || qState.state === 'QUOTA_EXHAUSTED') {
      return { status: 'DEGRADED', error: qState.reason };
    }
    return { status: 'HEALTHY', latencyMs: qState.latencyMs || 4000 };
  }

  supports(capability: VideoCapability): boolean {
    return capability === 'TEXT_TO_VIDEO' || capability === 'IMAGE_TO_VIDEO';
  }

  async generate(
    prompt: string,
    settings: VideoGenerationSettings = {},
    inputBuffer?: Buffer,
    inputMimeType?: string
  ): Promise<VideoProviderResult> {
    const res = await aiProvider.generateVideo(
      prompt,
      settings,
      inputBuffer,
      inputMimeType,
      'veo-3.1-fast-generate-preview'
    );

    if (res.success && res.asset) {
      await quotaManager.recordSuccess('gemini', 'veo-3.1-fast-generate-preview');
      return {
        success: true,
        asset: res.asset,
      };
    }

    if (res.error) {
      if (res.error.code === 'PROVIDER_RATE_LIMITED' || res.error.code === 'PROVIDER_QUOTA_EXHAUSTED') {
        await quotaManager.recordQuotaFailure(
          'gemini',
          'veo-3.1-fast-generate-preview',
          res.error.code === 'PROVIDER_QUOTA_EXHAUSTED',
          res.error.message
        );
      }
      return {
        success: false,
        error: res.error,
      };
    }

    return {
      success: false,
      error: { code: 'GENERATION_FAILED', message: 'Veo video synthesis did not return an asset.' },
    };
  }
}

export const veoVideoProvider = new VeoVideoProvider();
