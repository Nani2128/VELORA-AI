import { BaseChatProvider } from './base';
import { geminiChatProvider } from './gemini';
import { groqChatProvider } from './groq';
import { deepseekChatProvider } from './deepseek';
import { openAIChatProvider } from './openai';
import { huggingFaceChatProvider } from './huggingface';
import { ollamaChatProvider } from './ollama';
import { openAICompatibleChatProvider } from './openaiCompatible';
import { xaiChatProvider } from './xai';
import { 
  ChatRequestOptions, 
  ChatStreamChunk, 
  ChatSourceItem, 
  NormalizedError,
  TaskType,
  DiscoveredModel,
  RoutingRecommendation
} from './types';

export class ChatRouter {
  private providers: Map<string, BaseChatProvider> = new Map();

  constructor() {
    this.providers.set('gemini', geminiChatProvider);
    this.providers.set('groq', groqChatProvider);
    this.providers.set('deepseek', deepseekChatProvider);
    this.providers.set('xai', xaiChatProvider);
    this.providers.set('openai', openAIChatProvider);
    this.providers.set('huggingface', huggingFaceChatProvider);
    this.providers.set('ollama', ollamaChatProvider);
    this.providers.set('openai_compatible', openAICompatibleChatProvider);
  }

  getProvider(id: string): BaseChatProvider | undefined {
    return this.providers.get(id);
  }

  listProviders(): BaseChatProvider[] {
    return Array.from(this.providers.values());
  }

  // Classify user request intent
  classifyTask(prompt: string, options?: ChatRequestOptions): TaskType {
    if (options?.mapsGrounding || options?.webSearch) {
      return 'RESEARCH';
    }

    const text = prompt.toLowerCase();

    // Code & Debugging detection
    if (
      text.includes('```') ||
      text.includes('function') ||
      text.includes('def ') ||
      text.includes('const ') ||
      text.includes('import ') ||
      text.includes('class ') ||
      text.includes('script') ||
      text.includes('syntax error') ||
      text.includes('traceback') ||
      text.includes('debug ') ||
      text.includes('algorithm') ||
      text.includes('regex')
    ) {
      return text.includes('fix') || text.includes('error') || text.includes('bug') ? 'DEBUGGING' : 'CODING';
    }

    // Mathematical reasoning
    if (
      text.includes('calculate') ||
      text.includes('equation') ||
      text.includes('solve for') ||
      text.includes('integral') ||
      text.includes('derivative') ||
      text.includes('probability') ||
      text.includes('matrix')
    ) {
      return 'MATH';
    }

    // Step-by-step reasoning
    if (
      text.includes('step by step') ||
      text.includes('reason through') ||
      text.includes('deduce') ||
      text.includes('chain of thought') ||
      text.includes('logical proof')
    ) {
      return 'REASONING';
    }

    // Long Context
    if (prompt.length > 7000) {
      return 'LONG_CONTEXT';
    }

    return 'CASUAL_CHAT';
  }

  // Calculate intelligent model recommendation for AUTO mode
  async recommendModel(task: TaskType, options?: ChatRequestOptions): Promise<RoutingRecommendation> {
    const candidates = await this.getCandidateProviders(options?.model, task);

    if (candidates.length === 0) {
      return {
        recommended_provider: 'none',
        recommended_model: 'none',
        task,
        reason: 'No configured AI providers are currently available.',
        fallback_candidates: [],
      };
    }

    const primary = candidates[0];
    let recommendedModel = 'default';
    let reason = 'Fast, capable model matching your task.';

    if (primary.id === 'gemini') {
      recommendedModel = task === 'RESEARCH' ? 'gemini-3.8-flash' : 'gemini-3.8-flash';
      reason = task === 'RESEARCH' 
        ? 'Selected Gemini with Google Search Grounding for live web research' 
        : 'Selected Google Gemini for low latency and multimodal reasoning';
    } else if (primary.id === 'groq') {
      recommendedModel = 'qwen/qwen3.8-27b';
      reason = 'Selected Groq LPU with Qwen 3.8 for ultra-low latency response';
    } else if (primary.id === 'deepseek') {
      recommendedModel = (task === 'REASONING' || task === 'MATH') ? 'deepseek-reasoner' : 'deepseek-chat';
      reason = task === 'REASONING' 
        ? 'Selected DeepSeek-R1 chain-of-thought engine for deep technical analysis' 
        : 'Selected DeepSeek-V3 for high code quality and precision';
    } else if (primary.id === 'openai') {
      recommendedModel = 'gpt-4o-mini';
      reason = 'Selected OpenAI for consistent multimodal and coding reliability';
    } else if (primary.id === 'huggingface') {
      recommendedModel = 'meta-llama/Llama-3.3-70B-Instruct';
      reason = 'Selected Hugging Face serverless inference (free allowance available)';
    } else if (primary.id === 'ollama') {
      const ollama = primary as any;
      const installed = await ollama.getInstalledModels();
      recommendedModel = installed[0] || 'llama3';
      reason = 'Selected Local Ollama for private offline execution';
    }

    const fallbackCandidates = candidates.slice(1).map((c) => c.id);

    return {
      recommended_provider: primary.id,
      recommended_model: recommendedModel,
      task,
      reason,
      fallback_candidates: fallbackCandidates,
    };
  }

  // Determine candidate providers in prioritized order for the specific task
  async getCandidateProviders(requestedModel?: string, task?: TaskType): Promise<BaseChatProvider[]> {
    const list: BaseChatProvider[] = [];

    // 1. If explicit provider/model was requested
    if (requestedModel && requestedModel !== 'auto') {
      for (const p of this.providers.values()) {
        if (p.isConfigured() && p.isAvailable()) {
          const models = await p.discoverModels();
          if (models.some((m) => m.id === requestedModel) || requestedModel.includes(p.id)) {
            list.push(p);
            break;
          }
        }
      }
    }

    // 2. Task-specific primary choices
    if (task === 'RESEARCH') {
      // Gemini has native Google Search Grounding
      const gemini = this.providers.get('gemini')!;
      if (gemini.isConfigured() && gemini.isAvailable() && !list.includes(gemini)) {
        list.push(gemini);
      }
    } else if (task === 'CODING' || task === 'DEBUGGING') {
      // Prioritize DeepSeek, Groq, OpenAI, Ollama
      for (const id of ['deepseek', 'groq', 'openai', 'ollama', 'gemini', 'huggingface']) {
        const p = this.providers.get(id);
        if (p?.isConfigured() && p.isAvailable() && !list.includes(p)) {
          list.push(p);
        }
      }
    } else if (task === 'REASONING' || task === 'MATH') {
      // Prioritize DeepSeek Reasoner, OpenAI, Gemini Pro, Groq
      for (const id of ['deepseek', 'openai', 'gemini', 'groq', 'huggingface', 'ollama']) {
        const p = this.providers.get(id);
        if (p?.isConfigured() && p.isAvailable() && !list.includes(p)) {
          list.push(p);
        }
      }
    }

    // 3. General Priority Chain: Gemini -> Groq -> DeepSeek -> xAI -> OpenAI -> Ollama -> Hugging Face -> OpenAI Compatible
    const standardPriority = ['gemini', 'groq', 'deepseek', 'xai', 'openai', 'ollama', 'huggingface', 'openai_compatible'];
    for (const id of standardPriority) {
      const p = this.providers.get(id);
      if (p?.isConfigured() && p.isAvailable() && !list.includes(p)) {
        list.push(p);
      }
    }

    // 4. If all healthy candidates are exhausted, include configured providers even if in cooldown as last resort
    if (list.length === 0) {
      for (const id of standardPriority) {
        const p = this.providers.get(id);
        if (p?.isConfigured() && !list.includes(p)) {
          list.push(p);
        }
      }
    }

    return list;
  }

  // Model catalog across all providers
  async getAllDiscoveredModels(): Promise<DiscoveredModel[]> {
    const all: DiscoveredModel[] = [];
    for (const provider of this.providers.values()) {
      if (provider.isConfigured()) {
        try {
          const models = await provider.discoverModels();
          all.push(...models);
        } catch {
          // Ignore failing provider
        }
      }
    }
    return all;
  }

  async getProvidersHealth(): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    for (const [id, provider] of this.providers.entries()) {
      const state = await provider.health();
      results[id] = {
        name: provider.name,
        isConfigured: provider.isConfigured(),
        status: state.status,
        lastError: state.lastError,
        cooldownUntil: state.cooldownUntil,
        costClass: provider.costClass,
        averageLatencyMs: state.averageLatencyMs,
        rateLimitInfo: state.rateLimitInfo,
      };
    }
    return results;
  }

  private isNonFallbackError(errStr: string): boolean {
    const lower = errStr.toLowerCase();
    return (
      lower.includes('abort') ||
      lower.includes('safety') ||
      lower.includes('blocked') ||
      lower.includes('content policy') ||
      lower.includes('invalid user request')
    );
  }

  // Stream chat through intelligent router with fallback and live events
  async routeAndStreamChat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: ChatRequestOptions,
    onChunk: (chunk: ChatStreamChunk) => void
  ): Promise<{ 
    content: string; 
    provider: string; 
    modelUsed?: string;
    fallbackAttempted: boolean; 
    sources?: ChatSourceItem[]; 
    searchQueries?: string[];
    task?: TaskType;
    reason?: string;
  }> {
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop()?.content || '';
    const task = this.classifyTask(lastUserMessage, options);
    
    // Announce start
    onChunk({
      type: 'chat.started',
      task,
    });

    const candidates = await this.getCandidateProviders(options.model, task);

    if (candidates.length === 0) {
      const normErr: NormalizedError = {
        code: 'NO_PROVIDER_AVAILABLE',
        message: 'No AI chat provider is currently configured or available. Please configure Gemini, Groq, DeepSeek, OpenAI, or start an Ollama model.',
        retryable: true,
        fallback_attempted: false,
      };
      onChunk({ type: 'error', error: normErr.message });
      onChunk({ type: 'chat.failed', error: normErr.message });
      throw new Error(normErr.message);
    }

    let lastError: any = null;
    let fallbackAttempted = false;
    let partialEmitted = false;
    let accumulatedTextFromCurrentProvider = '';

    for (let i = 0; i < candidates.length; i++) {
      const provider = candidates[i];
      const isFallback = i > 0;
      if (isFallback) fallbackAttempted = true;

      onChunk({
        type: 'provider.selected',
        provider: provider.id,
        task,
      });

      try {
        console.log(`[AI Router] Attempting chat with provider: ${provider.id} for task ${task} (Attempt ${i + 1}/${candidates.length})`);

        accumulatedTextFromCurrentProvider = '';

        const result = await provider.streamChat(
          messages,
          { ...options, task },
          (chunk) => {
            if (chunk.type === 'delta' || chunk.type === 'chat.token') {
              partialEmitted = true;
              if (chunk.delta) accumulatedTextFromCurrentProvider += chunk.delta;
            }
            onChunk(chunk);
          }
        );

        // Completion event
        onChunk({
          type: 'chat.completed',
          provider: provider.id,
          model: result.modelUsed,
          usage: result.usage,
        });

        return {
          content: result.content,
          provider: provider.id,
          modelUsed: result.modelUsed,
          fallbackAttempted,
          sources: result.sources,
          searchQueries: result.searchQueries,
          task,
        };
      } catch (err: any) {
        lastError = err;
        const errMessage = err?.message || String(err);
        console.warn(`[AI Router] Provider ${provider.id} error:`, errMessage);

        // If user explicitly aborted, stop immediately
        if (err.name === 'AbortError') {
          onChunk({ type: 'error', error: 'Generation stopped by user.' });
          throw err;
        }

        // If safety policy or non-fallback error, do not retry
        if (this.isNonFallbackError(errMessage)) {
          onChunk({ type: 'error', error: errMessage });
          throw err;
        }

        // Notify client of rate limit or failure on this provider
        onChunk({
          type: 'provider.rate_limited',
          provider: provider.id,
          reason: errMessage,
        });

        // If this provider already emitted tokens and then broke mid-stream,
        // we mark the partial response safely so subsequent text is not concatenated incorrectly
        if (partialEmitted && accumulatedTextFromCurrentProvider.length > 20) {
          onChunk({
            type: 'delta',
            delta: '\n\n*(Note: AI provider switched during generation due to quota limits.)*\n\n',
            partialResponseMarked: true,
          });
        }

        // If another candidate exists, emit switching event
        const nextProvider = candidates[i + 1];
        if (nextProvider) {
          onChunk({
            type: 'provider.switching',
            fromProvider: provider.id,
            toProvider: nextProvider.id,
            reason: errMessage.includes('RATE_LIMITED') ? 'Quota reached' : 'Temporary provider error',
          });

          onChunk({
            type: 'provider_switched',
            provider: nextProvider.id,
            fromProvider: provider.id,
            toProvider: nextProvider.id,
            reason: `Automatically switched from ${provider.name} to ${nextProvider.name}.`,
          });
        }
      }
    }

    // If all candidates failed
    const finalErrorMessage = lastError?.message || 'All configured AI providers were unable to fulfill the request.';
    onChunk({ 
      type: 'error', 
      error: `All available providers exhausted. ${finalErrorMessage}`,
      fallbackAttempted: true,
    });
    onChunk({
      type: 'chat.failed',
      error: finalErrorMessage,
    });

    const errObj: any = new Error(finalErrorMessage);
    errObj.code = lastError?.code || (finalErrorMessage.includes('PROVIDER_RATE_LIMITED') || finalErrorMessage.includes('cooling down') ? 'PROVIDER_RATE_LIMITED' : 'NO_PROVIDER_AVAILABLE');
    throw errObj;
  }
}

export const chatRouter = new ChatRouter();
