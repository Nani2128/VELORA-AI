import { ImageProvider, ProviderGenerationResult } from './base';
import { geminiImageProvider } from './gemini';
import { openAIImageProvider } from './openaiImage';
import { grokImageProvider } from './grokImage';
import { huggingFaceMediaProvider } from './huggingfaceMedia';
import { fluxImageProvider } from './flux';
import { stableDiffusionImageProvider } from './stableDiffusion';
import { falFluxImageProvider } from './falFlux';

export interface UnifiedModelInfo {
  id: string;
  name: string;
  provider: 'google' | 'openai' | 'xai' | 'huggingface' | 'flux' | 'stability' | 'fal';
  providerName: string;
  type: 'image' | 'video';
  family: 'gemini' | 'openai' | 'grok' | 'huggingface' | 'flux' | 'sdxl' | 'sd35' | 'veo';
  description: string;
  capabilities: string[];
  supports_text_to_image: boolean;
  supports_image_to_image: boolean;
  supports_inpainting: boolean;
  supports_negative_prompt: boolean;
  supports_aspect_ratio: boolean;
  supports_seed: boolean;
  supports_steps: boolean;
  supports_guidance: boolean;
  availability: 'available' | 'configured' | 'unconfigured';
  configuration_status: {
    configured: boolean;
    endpoint?: string;
    notes?: string;
  };
}

class ModelRegistryService {
  private providers: Map<string, ImageProvider> = new Map();

  constructor() {
    this.providers.set('google', geminiImageProvider);
    this.providers.set('openai', openAIImageProvider);
    this.providers.set('xai', grokImageProvider);
    this.providers.set('huggingface', huggingFaceMediaProvider);
    this.providers.set('flux', fluxImageProvider);
    this.providers.set('stability', stableDiffusionImageProvider);
    this.providers.set('fal', falFluxImageProvider);
  }

  listProviders(): ImageProvider[] {
    return Array.from(this.providers.values());
  }

  async getModels(): Promise<UnifiedModelInfo[]> {
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    const hasFalKey = !!process.env.FAL_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const hasXAIKey = !!process.env.XAI_API_KEY;
    const hasHFToken = !!process.env.HF_TOKEN;
    const fluxUrl = process.env.FLUX_API_URL;
    const hasFlux = (process.env.FLUX_ENABLED === 'true' || !!fluxUrl) && !!fluxUrl;
    const sdUrl = process.env.SD_API_URL;
    const hasSd = (process.env.SD_ENABLED === 'true' || !!sdUrl) && !!sdUrl;

    const models: UnifiedModelInfo[] = [
      {
        id: 'fal-ai/flux/schnell',
        name: 'FLUX.1 Schnell',
        provider: 'fal',
        providerName: 'Fal.ai',
        type: 'image',
        family: 'flux',
        description: 'Ultra-fast 4-step rectified flow generation on Fal.ai cloud queue architecture with custom resolutions.',
        capabilities: ['text_to_image', 'image_to_image', 'aspect_ratio', 'seed', 'guidance', 'multi_image'],
        supports_text_to_image: true,
        supports_image_to_image: true,
        supports_inpainting: false,
        supports_negative_prompt: true,
        supports_aspect_ratio: true,
        supports_seed: true,
        supports_steps: true,
        supports_guidance: true,
        availability: hasFalKey ? 'available' : 'unconfigured',
        configuration_status: {
          configured: hasFalKey,
          endpoint: hasFalKey ? 'https://queue.fal.run/fal-ai/flux/schnell' : undefined,
          notes: hasFalKey ? 'Active via Fal.ai API Key' : 'Set FAL_KEY to activate',
        },
      },
      {
        id: 'gemini-3.1-flash-image-preview',
        name: 'Gemini 3.1 Flash Image Preview',
        provider: 'google',
        providerName: 'Google Cloud (GenAI)',
        type: 'image',
        family: 'gemini',
        description: 'Native high-fidelity visual generation and precision image-to-image editing.',
        capabilities: ['text_to_image', 'image_to_image', 'aspect_ratio'],
        supports_text_to_image: true,
        supports_image_to_image: true,
        supports_inpainting: false,
        supports_negative_prompt: false,
        supports_aspect_ratio: true,
        supports_seed: false,
        supports_steps: false,
        supports_guidance: false,
        availability: hasGeminiKey ? 'available' : 'unconfigured',
        configuration_status: {
          configured: hasGeminiKey,
          endpoint: hasGeminiKey ? 'https://generativelanguage.googleapis.com' : undefined,
          notes: hasGeminiKey ? 'Active via Google GenAI SDK' : 'Set GEMINI_API_KEY to activate',
        },
      },
      {
        id: 'gemini-3.1-flash-image',
        name: 'Gemini 3.1 Flash Image',
        provider: 'google',
        providerName: 'Google Cloud (GenAI)',
        type: 'image',
        family: 'gemini',
        description: 'Native high-fidelity visual generation with multi-aspect ratio and photo-realistic coherence.',
        capabilities: ['text_to_image', 'image_to_image', 'aspect_ratio'],
        supports_text_to_image: true,
        supports_image_to_image: true,
        supports_inpainting: false,
        supports_negative_prompt: false,
        supports_aspect_ratio: true,
        supports_seed: false,
        supports_steps: false,
        supports_guidance: false,
        availability: hasGeminiKey ? 'available' : 'unconfigured',
        configuration_status: {
          configured: hasGeminiKey,
          endpoint: hasGeminiKey ? 'https://generativelanguage.googleapis.com' : undefined,
          notes: hasGeminiKey ? 'Active via Google GenAI SDK' : 'Set GEMINI_API_KEY to activate',
        },
      },
      {
        id: 'dall-e-3',
        name: 'OpenAI DALL·E 3 (GPT Image)',
        provider: 'openai',
        providerName: 'OpenAI',
        type: 'image',
        family: 'openai',
        description: 'Advanced semantic adherence with cinematic composition and high visual detail.',
        capabilities: ['text_to_image', 'aspect_ratio', 'high_fidelity'],
        supports_text_to_image: true,
        supports_image_to_image: false,
        supports_inpainting: false,
        supports_negative_prompt: false,
        supports_aspect_ratio: true,
        supports_seed: false,
        supports_steps: false,
        supports_guidance: false,
        availability: hasOpenAIKey ? 'available' : 'unconfigured',
        configuration_status: {
          configured: hasOpenAIKey,
          endpoint: hasOpenAIKey ? 'https://api.openai.com/v1/images' : undefined,
          notes: hasOpenAIKey ? 'Active via OpenAI API Key' : 'Set OPENAI_API_KEY to activate',
        },
      },
      {
        id: 'grok-imagine-image-2.0',
        name: 'xAI Grok Imagine Image 2.0',
        provider: 'xai',
        providerName: 'xAI Grok Imagine',
        type: 'image',
        family: 'grok',
        description: 'Photorealistic image synthesis with reference image support and cinematic lighting.',
        capabilities: ['text_to_image', 'image_to_image', 'aspect_ratio'],
        supports_text_to_image: true,
        supports_image_to_image: true,
        supports_inpainting: false,
        supports_negative_prompt: false,
        supports_aspect_ratio: true,
        supports_seed: false,
        supports_steps: false,
        supports_guidance: false,
        availability: hasXAIKey ? 'available' : 'unconfigured',
        configuration_status: {
          configured: hasXAIKey,
          endpoint: hasXAIKey ? 'https://api.x.ai/v1/images' : undefined,
          notes: hasXAIKey ? 'Active via xAI API Key' : 'Set XAI_API_KEY to activate',
        },
      },
      {
        id: 'hf-black-forest-labs/FLUX.1-schnell',
        name: 'Hugging Face FLUX.1 [schnell]',
        provider: 'huggingface',
        providerName: 'Hugging Face Hub',
        type: 'image',
        family: 'huggingface',
        description: 'Serverless inference provider for fast 4-step rectified flow image synthesis.',
        capabilities: ['text_to_image'],
        supports_text_to_image: true,
        supports_image_to_image: false,
        supports_inpainting: false,
        supports_negative_prompt: true,
        supports_aspect_ratio: false,
        supports_seed: false,
        supports_steps: false,
        supports_guidance: false,
        availability: hasHFToken ? 'available' : 'unconfigured',
        configuration_status: {
          configured: hasHFToken,
          endpoint: hasHFToken ? 'https://api-inference.huggingface.co' : undefined,
          notes: hasHFToken ? 'Active via HF User Token' : 'Set HF_TOKEN to activate',
        },
      },
      {
        id: 'flux-1-schnell',
        name: 'FLUX.1 [schnell]',
        provider: 'flux',
        providerName: 'Black Forest Labs',
        type: 'image',
        family: 'flux',
        description: 'Next-generation 12B parameter rectified flow transformer for ultra-fast generation.',
        capabilities: ['text_to_image', 'image_to_image', 'fast_inference'],
        supports_text_to_image: true,
        supports_image_to_image: true,
        supports_inpainting: false,
        supports_negative_prompt: false,
        supports_aspect_ratio: true,
        supports_seed: true,
        supports_steps: true,
        supports_guidance: false,
        availability: hasFlux ? 'configured' : 'unconfigured',
        configuration_status: {
          configured: hasFlux,
          endpoint: fluxUrl,
          notes: hasFlux ? 'Connected to FLUX API endpoint' : 'Set FLUX_API_URL to activate',
        },
      },
      {
        id: 'sdxl-1.0',
        name: 'Stable Diffusion XL 1.0',
        provider: 'stability',
        providerName: 'Stability AI',
        type: 'image',
        family: 'sdxl',
        description: 'Flagship open latent diffusion model for photorealism, artistic styles, and negative prompts.',
        capabilities: ['text_to_image', 'image_to_image', 'negative_prompt', 'aspect_ratio'],
        supports_text_to_image: true,
        supports_image_to_image: true,
        supports_inpainting: false,
        supports_negative_prompt: true,
        supports_aspect_ratio: true,
        supports_seed: true,
        supports_steps: true,
        supports_guidance: true,
        availability: hasSd ? 'configured' : 'unconfigured',
        configuration_status: {
          configured: hasSd,
          endpoint: sdUrl,
          notes: hasSd ? 'Connected to SD API endpoint' : 'Set SD_API_URL to activate',
        },
      },
      {
        id: 'veo-3.1-fast-generate-preview',
        name: 'Google Veo 3.1 Fast Video Generator',
        provider: 'google',
        providerName: 'Google Cloud (Veo Video)',
        type: 'video',
        family: 'veo',
        description: 'High-speed temporal latent video generator and photo animator with 16:9 and 9:16 aspect ratios.',
        capabilities: ['text_to_video', 'image_to_video', 'camera_motion', 'photo_animation'],
        supports_text_to_image: false,
        supports_image_to_image: true,
        supports_inpainting: false,
        supports_negative_prompt: false,
        supports_aspect_ratio: true,
        supports_seed: false,
        supports_steps: false,
        supports_guidance: false,
        availability: hasGeminiKey ? 'available' : 'unconfigured',
        configuration_status: {
          configured: hasGeminiKey,
          endpoint: hasGeminiKey ? 'https://generativelanguage.googleapis.com' : undefined,
          notes: hasGeminiKey ? 'Active via Google GenAI SDK' : 'Set GEMINI_API_KEY to activate',
        },
      },
      {
        id: 'grok-imagine-video-1.5',
        name: 'xAI Grok Imagine Video 1.5',
        provider: 'xai',
        providerName: 'xAI Grok Video',
        type: 'video',
        family: 'grok',
        description: 'High-fidelity cinematic temporal video synthesis and photo animation.',
        capabilities: ['text_to_video', 'image_to_video', 'camera_motion'],
        supports_text_to_image: false,
        supports_image_to_image: true,
        supports_inpainting: false,
        supports_negative_prompt: false,
        supports_aspect_ratio: true,
        supports_seed: false,
        supports_steps: false,
        supports_guidance: false,
        availability: hasXAIKey ? 'available' : 'unconfigured',
        configuration_status: {
          configured: hasXAIKey,
          endpoint: hasXAIKey ? 'https://api.x.ai/v1/videos' : undefined,
          notes: hasXAIKey ? 'Active via xAI API Key' : 'Set XAI_API_KEY to activate',
        },
      },
      {
        id: 'veo-3.1-lite-generate-preview',
        name: 'Google Veo 3.1 Lite',
        provider: 'google',
        providerName: 'Google Cloud (Veo Video)',
        type: 'video',
        family: 'veo',
        description: 'Cinematic temporal consistency video synthesis with high dynamic camera movement.',
        capabilities: ['text_to_video', 'image_to_video', 'camera_motion'],
        supports_text_to_image: false,
        supports_image_to_image: false,
        supports_inpainting: false,
        supports_negative_prompt: false,
        supports_aspect_ratio: true,
        supports_seed: false,
        supports_steps: false,
        supports_guidance: false,
        availability: hasGeminiKey ? 'available' : 'unconfigured',
        configuration_status: {
          configured: hasGeminiKey,
          endpoint: hasGeminiKey ? 'https://generativelanguage.googleapis.com' : undefined,
          notes: hasGeminiKey ? 'Active via Google GenAI SDK' : 'Set GEMINI_API_KEY to activate',
        },
      },
    ];

    return models;
  }

  async getModel(id: string): Promise<UnifiedModelInfo | null> {
    const models = await this.getModels();
    return models.find((m) => m.id === id) || null;
  }

  async getProvidersHealth() {
    const [geminiHealth, falHealth, openAIHealth, grokHealth, hfHealth, fluxHealth, sdHealth] = await Promise.all([
      geminiImageProvider.health(),
      falFluxImageProvider.health(),
      openAIImageProvider.health(),
      grokImageProvider.health(),
      huggingFaceMediaProvider.health(),
      fluxImageProvider.health(),
      stableDiffusionImageProvider.health(),
    ]);

    return [
      {
        id: 'fal',
        name: 'Fal.ai (FLUX.1 Schnell)',
        ...falHealth,
        models: ['fal-ai/flux/schnell'],
      },
      {
        id: 'google',
        name: 'Google Gemini & Veo Cloud',
        ...geminiHealth,
        models: ['gemini-3.1-flash-image-preview', 'gemini-3.1-flash-image', 'veo-3.1-fast-generate-preview'],
      },
      {
        id: 'openai',
        name: 'OpenAI GPT Image',
        ...openAIHealth,
        models: ['dall-e-3'],
      },
      {
        id: 'xai',
        name: 'xAI Grok Imagine',
        ...grokHealth,
        models: ['grok-imagine-image-2.0', 'grok-imagine-video-1.5'],
      },
      {
        id: 'huggingface',
        name: 'Hugging Face Inference',
        ...hfHealth,
        models: ['hf-black-forest-labs/FLUX.1-schnell'],
      },
      {
        id: 'flux',
        name: 'FLUX.1 Open-Source Provider',
        ...fluxHealth,
        models: ['flux-1-schnell'],
      },
      {
        id: 'stability',
        name: 'Stability AI Open-Source Provider',
        ...sdHealth,
        models: ['sdxl-1.0'],
      },
    ];
  }

  async generate(
    modelId: string,
    prompt: string,
    settings: any,
    inputAssetBuffer?: Buffer
  ): Promise<ProviderGenerationResult> {
    const model = await this.getModel(modelId);
    if (!model) {
      return geminiImageProvider.generate(prompt, { ...settings, model: 'gemini-3.1-flash-image-preview' });
    }

    if (model.provider === 'fal') {
      if (inputAssetBuffer && model.supports_image_to_image && falFluxImageProvider.edit) {
        return falFluxImageProvider.edit(prompt, inputAssetBuffer, settings);
      }
      return falFluxImageProvider.generate(prompt, settings);
    }

    if (model.provider === 'openai') {
      return openAIImageProvider.generate(prompt, settings);
    }

    if (model.provider === 'xai') {
      return grokImageProvider.generate(prompt, settings, inputAssetBuffer);
    }

    if (model.provider === 'huggingface') {
      return huggingFaceMediaProvider.generate(prompt, settings);
    }

    if (model.provider === 'flux') {
      if (model.availability === 'unconfigured') {
        return {
          success: false,
          error: {
            code: 'PROVIDER_UNCONFIGURED',
            message: `FLUX inference endpoint is not configured. Set FLUX_API_URL in server environment to use ${model.name}.`,
          },
        };
      }
      return fluxImageProvider.generate(prompt, { ...settings, model: modelId });
    }

    if (model.provider === 'stability') {
      if (model.availability === 'unconfigured') {
        return {
          success: false,
          error: {
            code: 'PROVIDER_UNCONFIGURED',
            message: `Stable Diffusion endpoint is not configured. Set SD_API_URL in server environment to use ${model.name}.`,
          },
        };
      }
      return stableDiffusionImageProvider.generate(prompt, { ...settings, model: modelId });
    }

    // Google provider
    if (inputAssetBuffer && model.supports_image_to_image) {
      return geminiImageProvider.edit(prompt, inputAssetBuffer, { ...settings, model: modelId });
    }

    return geminiImageProvider.generate(prompt, { ...settings, model: modelId });
  }
}

export const modelRegistry = new ModelRegistryService();
