import { chatRouter } from './chatProviders/router';
import { modelRegistry as imageModelRegistry } from './imageProviders/registry';
import { BaseChatProvider } from './chatProviders/base';
import { ImageProvider } from './imageProviders/base';
import { TaskType, DiscoveredModel, RoutingRecommendation } from './chatProviders/types';

export interface ProviderSummary {
  id: string;
  name: string;
  category: 'chat' | 'image' | 'video' | 'multimodal';
  status: string;
  configured: boolean;
  costClass: string;
  capabilities: string[];
  latencyMs?: number;
  modelsCount: number;
}

export class MasterProviderRegistry {
  /**
   * List all Chat Providers registered in the system
   */
  listChatProviders(): BaseChatProvider[] {
    return chatRouter.listProviders();
  }

  /**
   * List all Image Providers registered in the system
   */
  listImageProviders(): ImageProvider[] {
    return imageModelRegistry.listProviders();
  }

  /**
   * Get all models across all modalities (Chat, Image, Video)
   */
  async getAllModels(): Promise<{
    chat: DiscoveredModel[];
    image: any[];
    video: any[];
  }> {
    const chatModels = await chatRouter.getAllDiscoveredModels();
    const mediaModels = await imageModelRegistry.getModels();

    const imageModels = mediaModels.filter((m) => m.type === 'image');
    const videoModels = mediaModels.filter((m) => m.type === 'video');

    return {
      chat: chatModels,
      image: imageModels,
      video: videoModels,
    };
  }

  /**
   * Comprehensive Health Check across ALL providers
   */
  async getFullHealth(): Promise<Record<string, any>> {
    const chatHealth = await chatRouter.getProvidersHealth();
    const imageHealth = await imageModelRegistry.getProvidersHealth();

    const result: Record<string, any> = {};

    // Chat providers
    for (const [id, info] of Object.entries(chatHealth)) {
      result[`chat_${id}`] = {
        category: 'chat',
        ...info,
      };
    }

    // Image/Video providers
    for (const item of imageHealth) {
      result[`media_${item.id}`] = {
        category: item.id === 'veo' ? 'video' : 'image',
        ...item,
      };
    }

    return result;
  }

  /**
   * Master Summary for Settings UI dashboard
   */
  async getProvidersDashboard(): Promise<ProviderSummary[]> {
    const health = await this.getFullHealth();
    const summaries: ProviderSummary[] = [];

    const providerMeta: Record<string, { name: string; category: any; costClass: string; capabilities: string[] }> = {
      chat_gemini: {
        name: 'Google Gemini',
        category: 'chat',
        costClass: 'FREE_ALLOWANCE',
        capabilities: ['streaming', 'web_search', 'reasoning', 'long_context'],
      },
      chat_groq: {
        name: 'Groq LPU Engine',
        category: 'chat',
        costClass: 'FREE_ALLOWANCE',
        capabilities: ['ultra_fast_streaming', 'tool_use', 'coding'],
      },
      chat_deepseek: {
        name: 'DeepSeek AI',
        category: 'chat',
        costClass: 'PAID',
        capabilities: ['deep_reasoning', 'code_synthesis', 'math'],
      },
      chat_openai: {
        name: 'OpenAI (GPT-4o)',
        category: 'chat',
        costClass: 'PAID',
        capabilities: ['multimodal_chat', 'streaming', 'code_generation'],
      },
      chat_huggingface: {
        name: 'Hugging Face Inference',
        category: 'chat',
        costClass: 'FREE_ALLOWANCE',
        capabilities: ['open_weights', 'serverless_streaming', 'free_allowance'],
      },
      chat_ollama: {
        name: 'Local Ollama',
        category: 'chat',
        costClass: 'LOCAL',
        capabilities: ['local_offline', 'private_inference', 'unmetered'],
      },
      media_google: {
        name: 'Gemini Image Synthesis',
        category: 'image',
        costClass: 'FREE_ALLOWANCE',
        capabilities: ['text_to_image', 'image_to_image', 'aspect_ratios'],
      },
      media_flux: {
        name: 'Black Forest Labs FLUX.1',
        category: 'image',
        costClass: 'LOCAL',
        capabilities: ['open_weights', 'schnell', 'dev', 'photorealism'],
      },
      media_stability: {
        name: 'Stability AI (SDXL / SD 3.5)',
        category: 'image',
        costClass: 'PAID',
        capabilities: ['latent_diffusion', 'custom_lora', 'guidance_control'],
      },
      media_veo: {
        name: 'Google Veo Video 3.1',
        category: 'video',
        costClass: 'PAID',
        capabilities: ['text_to_video', 'image_to_video', 'cinematic_motion'],
      },
    };

    for (const [key, meta] of Object.entries(providerMeta)) {
      const live = health[key] || {};
      const isConfigured = live.configured ?? live.isConfigured ?? false;
      const status = live.status || (isConfigured ? 'AVAILABLE' : 'NOT_CONFIGURED');

      summaries.push({
        id: key,
        name: meta.name,
        category: meta.category,
        status,
        configured: isConfigured,
        costClass: meta.costClass,
        capabilities: meta.capabilities,
        latencyMs: live.averageLatencyMs,
        modelsCount: meta.category === 'chat' ? 2 : 1,
      });
    }

    return summaries;
  }

  /**
   * Recommend candidate for AUTO mode
   */
  async recommend(task: TaskType): Promise<RoutingRecommendation> {
    return chatRouter.recommendModel(task);
  }
}

export const masterProviderRegistry = new MasterProviderRegistry();
