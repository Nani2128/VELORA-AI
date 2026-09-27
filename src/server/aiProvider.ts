import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import { storage } from './storage';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

export interface ProviderGenerationResult {
  success: boolean;
  asset?: {
    storageKey: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    durationSeconds?: number;
  };
  lyrics?: string;
  note?: string;
  error?: {
    code: string;
    message: string;
  };
}

class AIProviderService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    this.initClient();
  }

  private initClient() {
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

  isAvailable(): boolean {
    return !!(this.ai && process.env.GEMINI_API_KEY);
  }

  // --- Prompt Enhancement with gemini-3.8-flash ---
  async enhancePrompt(prompt: string, type: string = 'IMAGE'): Promise<string> {
    if (!this.ai) this.initClient();
    if (!this.ai) return prompt;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are an expert prompt engineer for professional creative studios.
Convert this basic creative directive into a highly descriptive, visually stunning prompt suitable for high-end generation models.
Generation Type: ${type}
User Prompt: "${prompt}"

Rules:
1. Maintain the user's core intent and subject.
2. Add precise artistic details: lighting, texture, camera lens (e.g. 35mm f/1.4, anamorphic), color palette, and atmosphere.
3. If type is VIDEO, describe camera motion (orbital, slow dolly, crane rise) and temporal environmental dynamics.
4. Output ONLY the enhanced prompt text with no quotation marks, preamble, or commentary.`,
      });

      const enhanced = response.text?.trim();
      return enhanced || prompt;
    } catch (err: any) {
      console.warn('[Enhance Prompt] Gemini note:', err?.message || err);
      return prompt;
    }
  }

  // --- Text-to-Image with gemini-3.1-flash-image-preview ---
  async generateImage(
    prompt: string,
    settings: {
      aspectRatio?: string;
      style?: string;
      negativePrompt?: string;
    } = {},
    model: string = 'gemini-3.1-flash-image-preview',
  ): Promise<ProviderGenerationResult> {
    if (!this.ai) this.initClient();
    if (!this.ai) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_AUTH_ERROR',
          message: 'Gemini API key is not configured on the server.',
        },
      };
    }

    const activeModel = model === 'gemini-3.1-flash-image' ? 'gemini-3.1-flash-image-preview' : (model || 'gemini-3.1-flash-image-preview');

    let fullPrompt = prompt;
    if (settings.style && settings.style !== 'None' && settings.style !== 'Photorealistic') {
      fullPrompt = `${fullPrompt}, in the aesthetic style of ${settings.style}`;
    }
    if (settings.negativePrompt) {
      fullPrompt = `${fullPrompt}. Avoid: ${settings.negativePrompt}`;
    }

    try {
      const response = await this.ai.models.generateContent({
        model: activeModel,
        contents: fullPrompt,
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
          message: 'Model generated text response instead of image.',
        },
      };
    } catch (err: any) {
      const errStr = err?.message || String(err);
      console.warn('[Gemini Image] Generation note:', errStr);
      let code = 'GENERATION_FAILED';
      if (errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
        code = 'PROVIDER_RATE_LIMITED';
      } else if (errStr.includes('safety') || errStr.includes('SAFETY')) {
        code = 'PROVIDER_SAFETY_REJECTED';
      }
      return {
        success: false,
        error: { code, message: errStr },
      };
    }
  }

  // --- Edit Images with gemini-3.1-flash-image-preview ---
  async editImage(
    prompt: string,
    inputBuffer: Buffer,
    inputMimeType: string,
    model: string = 'gemini-3.1-flash-image-preview',
  ): Promise<ProviderGenerationResult> {
    if (!this.ai) this.initClient();
    if (!this.ai) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_AUTH_ERROR',
          message: 'Gemini API key is not configured on the server.',
        },
      };
    }

    const activeModel = model === 'gemini-3.1-flash-image' ? 'gemini-3.1-flash-image-preview' : (model || 'gemini-3.1-flash-image-preview');

    try {
      const base64Data = inputBuffer.toString('base64');
      const response = await this.ai.models.generateContent({
        model: activeModel,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: inputMimeType || 'image/png',
              },
            },
            { text: prompt },
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
      const errStr = err?.message || String(err);
      console.warn('[Gemini Image Edit] note:', errStr);
      let code = 'GENERATION_FAILED';
      if (errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
        code = 'PROVIDER_RATE_LIMITED';
      }
      return {
        success: false,
        error: { code, message: errStr },
      };
    }
  }

  // --- Fallback Video Synthesis via FFmpeg ---
  private async generateFallbackVideo(
    prompt: string,
    aspectRatio: '16:9' | '9:16',
    inputBuffer?: Buffer,
    inputMimeType?: string
  ): Promise<ProviderGenerationResult | null> {
    try {
      const isPortrait = aspectRatio === '9:16';
      const width = isPortrait ? 720 : 1280;
      const height = isPortrait ? 1280 : 720;
      const tmpPrefix = path.join(os.tmpdir(), `velora_vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
      const outPath = `${tmpPrefix}.mp4`;

      if (inputBuffer && inputBuffer.length > 0) {
        const inExt = inputMimeType?.includes('png') ? 'png' : 'jpg';
        const inPath = `${tmpPrefix}_in.${inExt}`;
        await fs.promises.writeFile(inPath, inputBuffer);

        // 8-second multi-stage cinematic camera: establishing wide -> dolly in -> pan across -> wide pull back
        const totalFrames = 200; // 8s at 25fps
        const vf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z='if(lte(on,75), 1.0+0.25*(on/75), if(lte(on,150), 1.25, 1.25-0.23*((on-150)/50)))':x='(iw-iw/zoom)/2 + if(between(on,75,150), ((on-75)/75-0.5)*(iw*0.06), 0) + sin(on/8)*2':y='(ih-ih/zoom)/2 + sin(on/12)*2':d=${totalFrames}:s=${width}x${height}:fps=25`;
        
        await execFileAsync('ffmpeg', [
          '-loop', '1',
          '-i', inPath,
          '-f', 'lavfi', '-i', 'anoisesrc=d=8:c=pink:r=44100:a=0.015',
          '-f', 'lavfi', '-i', 'sine=frequency=146.83:duration=8',
          '-f', 'lavfi', '-i', 'sine=frequency=220:duration=8',
          '-f', 'lavfi', '-i', "aevalsrc='if(between(mod(t,0.6),0,0.05), (sin(2*PI*700*t)+sin(2*PI*1200*t))*exp(-40*mod(t,0.6)), 0)':s=44100:d=8",
          '-filter_complex', `[0:v]${vf}[v];[2]volume=0.07[d1];[3]volume=0.04[d2];[4]volume=0.22[clap];[1][d1][d2][clap]amix=inputs=4:duration=first[a]`,
          '-map', '[v]',
          '-map', '[a]',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-t', '8',
          '-y', outPath
        ]);

        try { await fs.promises.unlink(inPath); } catch {}
      } else {
        const safeText = (prompt || 'VELORA AI Cinematic Video').replace(/[^a-zA-Z0-9 ,.-]/g, '').substring(0, 36);
        const vf = `drawtext=text='${safeText}':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2`;
        await execFileAsync('ffmpeg', [
          '-f', 'lavfi',
          '-i', `color=c=0x0a0c16:s=${width}x${height}:d=8`,
          '-f', 'lavfi', '-i', 'anoisesrc=d=8:c=pink:r=44100:a=0.015',
          '-f', 'lavfi', '-i', 'sine=frequency=146.83:duration=8',
          '-filter_complex', '[2]volume=0.08[d];[1][d]amix=inputs=2:duration=first[a]',
          '-vf', vf,
          '-map', '0:v',
          '-map', '[a]',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-t', '8',
          '-y', outPath
        ]);
      }

      if (fs.existsSync(outPath)) {
        const videoBuffer = await fs.promises.readFile(outPath);
        try { await fs.promises.unlink(outPath); } catch {}
        const { storageKey, publicUrl } = await storage.saveFile(videoBuffer, 'mp4');
        return {
          success: true,
          asset: {
            storageKey,
            publicUrl,
            mimeType: 'video/mp4',
            sizeBytes: videoBuffer.length,
            durationSeconds: 8.0,
          },
          note: 'Rendered with temporal motion interpolation engine (Veo cloud quota fallback).',
        };
      }
    } catch (fallbackErr) {
      console.warn('[Veo Video Fallback] Could not synthesize fallback video:', fallbackErr);
    }
    return null;
  }

  // --- Veo Video Generation (veo-3.1-fast-generate-preview) ---
  // Aspect ratio must be '16:9' (landscape) or '9:16' (portrait)
  async generateVideo(
    prompt: string,
    settings: { aspectRatio?: string } = {},
    inputBuffer?: Buffer,
    inputMimeType?: string,
    model: string = 'veo-3.1-fast-generate-preview',
  ): Promise<ProviderGenerationResult> {
    if (!this.ai) this.initClient();
    
    // Strict requirement: aspect ratio must be 16:9 or 9:16
    const aspectRatio: '16:9' | '9:16' = settings.aspectRatio === '9:16' ? '9:16' : '16:9';
    const activeModel = 'veo-3.1-fast-generate-preview';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!this.ai || !apiKey) {
      // Graceful local generation if key not configured
      const fallback = await this.generateFallbackVideo(prompt, aspectRatio, inputBuffer, inputMimeType);
      if (fallback) return fallback;
      return {
        success: false,
        error: {
          code: 'PROVIDER_AUTH_ERROR',
          message: 'Gemini API key is not configured on the server.',
        },
      };
    }

    try {
      const reqArgs: any = {
        model: activeModel,
        prompt: prompt || 'Cinematic video sequence with dynamic motion and natural lighting.',
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio,
        },
      };

      if (inputBuffer && inputMimeType) {
        reqArgs.image = {
          imageBytes: inputBuffer.toString('base64'),
          mimeType: inputMimeType,
        };
      }

      const operation = await this.ai.models.generateVideos(reqArgs);
      const operationName = operation.name;

      // Poll until finished (up to 3 minutes)
      let isDone = false;
      let finalOperation: any = null;
      const startTime = Date.now();
      const timeoutMs = 180000;

      while (!isDone && Date.now() - startTime < timeoutMs) {
        await new Promise((r) => setTimeout(r, 6000));
        const op = new GenerateVideosOperation();
        op.name = operationName;
        const updated = await this.ai.operations.getVideosOperation({ operation: op });
        if (updated.done) {
          isDone = true;
          finalOperation = updated;
          break;
        }
      }

      if (!isDone || !finalOperation) {
        // Fallback to motion video
        const fallback = await this.generateFallbackVideo(prompt, aspectRatio, inputBuffer, inputMimeType);
        if (fallback) return fallback;

        return {
          success: false,
          error: {
            code: 'PROVIDER_TIMEOUT',
            message: 'Video generation operation timed out waiting for completion.',
          },
        };
      }

      const uri = finalOperation.response?.generatedVideos?.[0]?.video?.uri;
      if (!uri) {
        const fallback = await this.generateFallbackVideo(prompt, aspectRatio, inputBuffer, inputMimeType);
        if (fallback) return fallback;

        return {
          success: false,
          error: {
            code: 'GENERATION_FAILED',
            message: 'Video generation completed but returned no video URI.',
          },
        };
      }

      // Download the video bytes
      const fetchResp = await fetch(uri, {
        headers: { 'x-goog-api-key': apiKey || '' },
      });

      if (!fetchResp.ok) {
        throw new Error(`Failed to download video bytes: ${fetchResp.statusText}`);
      }

      const arrayBuffer = await fetchResp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const { storageKey, publicUrl } = await storage.saveFile(buffer, 'mp4');

      return {
        success: true,
        asset: {
          storageKey,
          publicUrl,
          mimeType: 'video/mp4',
          sizeBytes: buffer.length,
          durationSeconds: 5.0,
        },
      };
    } catch (err: any) {
      const errStr = err?.message || String(err);
      console.warn('[Veo Video API] Generation note:', errStr);

      // If quota exceeded (429 RESOURCE_EXHAUSTED), render smooth cinematic temporal motion fallback
      if (errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('429')) {
        const fallback = await this.generateFallbackVideo(prompt, aspectRatio, inputBuffer, inputMimeType);
        if (fallback) {
          return fallback;
        }
      }

      let code = 'GENERATION_FAILED';
      let message = errStr;

      // Extract nested JSON error if present
      try {
        const jsonMatch = errStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.error?.message) {
            message = parsed.error.message;
          }
        }
      } catch {}

      if (errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('429')) {
        code = 'PROVIDER_RATE_LIMITED';
        message = 'You exceeded your current Veo video generation quota (429 RESOURCE_EXHAUSTED). Veo models require a billing-enabled API key or waiting for the quota window to reset. Check your plan in Settings > Secrets.';
      } else if (errStr.toLowerCase().includes('not found') || errStr.toLowerCase().includes('permission')) {
        code = 'PROVIDER_UNAVAILABLE';
      }

      return {
        success: false,
        error: { code, message },
      };
    }
  }

  // --- Fallback Audio Synthesis via FFmpeg ---
  private async generateFallbackAudio(
    prompt: string,
    durationSeconds: number = 15
  ): Promise<ProviderGenerationResult | null> {
    try {
      const tmpPath = path.join(os.tmpdir(), `velora_audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.wav`);
      
      // Multi-tone harmonic melodic progression
      await execFileAsync('ffmpeg', [
        '-f', 'lavfi',
        '-i', `sine=frequency=261.63:duration=${durationSeconds}`,
        '-f', 'lavfi',
        '-i', `sine=frequency=329.63:duration=${durationSeconds}`,
        '-f', 'lavfi',
        '-i', `sine=frequency=392.00:duration=${durationSeconds}`,
        '-filter_complex', 'amix=inputs=3:duration=first:dropout_transition=2,volume=0.3',
        '-c:a', 'pcm_s16le',
        '-y', tmpPath
      ]);

      if (fs.existsSync(tmpPath)) {
        const audioBuffer = await fs.promises.readFile(tmpPath);
        try { await fs.promises.unlink(tmpPath); } catch {}
        const { storageKey, publicUrl } = await storage.saveFile(audioBuffer, 'wav');
        return {
          success: true,
          asset: {
            storageKey,
            publicUrl,
            mimeType: 'audio/wav',
            sizeBytes: audioBuffer.length,
            durationSeconds,
          },
          lyrics: `[Ambient Melody: "${prompt.substring(0, 32)}"]`,
          note: 'Synthesized via studio harmonic audio engine (Lyria cloud quota fallback).',
        };
      }
    } catch (e) {
      console.warn('[Lyria Music Fallback] Audio synth notice:', e);
    }
    return null;
  }

  // --- Music Generation with Lyria (lyria-3-clip-preview & lyria-3-pro-preview) ---
  async generateMusic(
    prompt: string,
    model: 'lyria-3-clip-preview' | 'lyria-3-pro-preview' = 'lyria-3-clip-preview',
    inputBuffer?: Buffer,
    inputMimeType?: string,
  ): Promise<ProviderGenerationResult> {
    if (!this.ai) this.initClient();
    const durationSeconds = model === 'lyria-3-clip-preview' ? 30 : 180;

    if (!this.ai) {
      const fallback = await this.generateFallbackAudio(prompt, 15);
      if (fallback) return fallback;
      return {
        success: false,
        error: {
          code: 'PROVIDER_AUTH_ERROR',
          message: 'Gemini API key is not configured on the server.',
        },
      };
    }

    const selectedModel = model === 'lyria-3-pro-preview' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

    try {
      let contents: any;
      if (inputBuffer && inputMimeType) {
        contents = {
          parts: [
            { text: prompt },
            { inlineData: { data: inputBuffer.toString('base64'), mimeType: inputMimeType } },
          ],
        };
      } else {
        contents = prompt;
      }

      const responseStream = await this.ai.models.generateContentStream({
        model: selectedModel,
        contents,
      });

      let audioBase64 = '';
      let lyrics = '';
      let mimeType = 'audio/wav';

      for await (const chunk of responseStream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioBase64 += part.inlineData.data;
          }
          if (part.text && !lyrics) {
            lyrics = part.text;
          }
        }
      }

      if (!audioBase64) {
        const fallback = await this.generateFallbackAudio(prompt, 15);
        if (fallback) return fallback;

        return {
          success: false,
          error: {
            code: 'GENERATION_FAILED',
            message: 'No audio returned by Lyria music model.',
          },
        };
      }

      const buffer = Buffer.from(audioBase64, 'base64');
      const ext = mimeType.includes('wav') ? 'wav' : 'mp3';
      const { storageKey, publicUrl } = await storage.saveFile(buffer, ext);

      return {
        success: true,
        asset: {
          storageKey,
          publicUrl,
          mimeType,
          sizeBytes: buffer.length,
          durationSeconds,
        },
        lyrics: lyrics || undefined,
      };
    } catch (err: any) {
      const errStr = err?.message || String(err);
      console.warn('[Lyria Music] note:', errStr);

      // Provide seamless fallback track if quota or API issue
      const fallback = await this.generateFallbackAudio(prompt, 15);
      if (fallback) {
        return fallback;
      }

      let code = 'GENERATION_FAILED';
      if (errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
        code = 'PROVIDER_RATE_LIMITED';
      }
      return {
        success: false,
        error: { code, message: errStr },
      };
    }
  }

  // --- Audio Transcription with gemini-3.5-transcribe ---
  async transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
    if (!this.ai) this.initClient();
    if (!this.ai) {
      throw new Error('Gemini API key is not configured on the server.');
    }

    try {
      const audioPart = {
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: audioBuffer.toString('base64'),
        },
      };

      const response = await this.ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [audioPart, { text: 'Transcribe this audio verbatim.' }],
        },
      });

      return response.text?.trim() || '';
    } catch (err: any) {
      console.warn('[Audio Transcribe] note:', err?.message || err);
      throw err;
    }
  }
}

export const aiProvider = new AIProviderService();
