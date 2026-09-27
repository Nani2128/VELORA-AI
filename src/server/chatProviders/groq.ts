import { BaseChatProvider } from './base';
import { 
  ChatRequestOptions, 
  ChatStreamChunk, 
  ChatSourceItem, 
  ProviderHealthState,
  DiscoveredModel,
  CostClass,
  TaskType
} from './types';

export class GroqChatProvider extends BaseChatProvider {
  readonly id = 'groq';
  readonly name = 'Groq LPU Engine';
  readonly costClass: CostClass = 'FREE_ALLOWANCE'; // Free developer allowance available, usage limits apply

  private defaultModel = 'qwen/qwen3.8-27b';

  constructor() {
    super();
    this.healthState.costClass = this.costClass;
  }

  isConfigured(): boolean {
    const enabled = process.env.GROQ_ENABLED;
    if (enabled !== undefined && enabled.toLowerCase() === 'false') return false;
    return Boolean(process.env.GROQ_API_KEY);
  }

  supports(feature: 'streaming' | 'web_search' | 'image_input' | 'system_instruction' | 'reasoning'): boolean {
    return feature === 'streaming' || feature === 'system_instruction';
  }

  supportsTask(task: TaskType): boolean {
    // Groq excels at fast conversational chat, general QA, coding, math, and structured output
    return ['CASUAL_CHAT', 'GENERAL_QA', 'CODING', 'DEBUGGING', 'STRUCTURED_OUTPUT', 'MATH'].includes(task);
  }

  async discoverModels(): Promise<DiscoveredModel[]> {
    if (!this.isConfigured()) return [];

    // Cache discovery for 5 minutes
    if (this.cachedModels.length > 0 && Date.now() - this.lastModelDiscovery < 300000) {
      return this.cachedModels;
    }

    try {
      const apiKey = process.env.GROQ_API_KEY;
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'velora-ai-studio',
        },
      });

      if (!res.ok) {
        if (res.status === 401) this.markAuthError('Invalid Groq API key.');
        if (res.status === 429) this.markRateLimited(60, 'Groq rate limit reached during model discovery.');
        return this.cachedModels;
      }

      const data = await res.json();
      if (Array.isArray(data.data)) {
        // Filter out deprecated models, keep active text/code models
        const activeModels = data.data.filter((m: any) => {
          const id = m.id.toLowerCase();
          const isDeprecated = id.includes('deprecated') || id.includes('whisper') || id.includes('guard');
          return m.active !== false && !isDeprecated;
        });

        this.cachedModels = activeModels.map((m: any) => ({
          id: m.id,
          name: `Groq: ${m.id}`,
          provider: 'groq',
          description: `Ultra-low latency inference via Groq LPU (${m.context_window ? `${Math.round(m.context_window / 1000)}k ctx` : 'high speed'})`,
          contextWindow: m.context_window || 8192,
          supportsStreaming: true,
          supportsTools: true,
          costClass: this.costClass,
          capabilities: ['chat', 'streaming', 'fast_inference'],
        }));
        this.lastModelDiscovery = Date.now();
      }
      return this.cachedModels;
    } catch (err: any) {
      console.warn('[Groq] Model discovery error:', err?.message);
      return this.cachedModels;
    }
  }

  async health(): Promise<ProviderHealthState> {
    if (!this.isConfigured()) {
      return {
        ...this.healthState,
        status: 'NOT_CONFIGURED',
        lastChecked: Date.now(),
        lastError: 'GROQ_API_KEY is not configured in environment.',
      };
    }

    if (this.healthState.cooldownUntil && Date.now() < this.healthState.cooldownUntil) {
      return this.getHealthState();
    }

    // Ping model discovery as a health check
    const start = Date.now();
    try {
      const models = await this.discoverModels();
      if (models.length > 0) {
        this.recordLatency(Date.now() - start);
        this.markAvailable();
      }
    } catch (err: any) {
      this.markUnavailable(30, err?.message);
    }

    return this.getHealthState();
  }

  async streamChat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: ChatRequestOptions,
    onDelta: (chunk: ChatStreamChunk) => void
  ): Promise<{ 
    content: string; 
    sources?: ChatSourceItem[]; 
    searchQueries?: string[]; 
    modelUsed?: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  }> {
    if (!this.isConfigured()) {
      throw new Error('PROVIDER_UNCONFIGURED: Groq API key is not configured.');
    }

    if (!this.isAvailable()) {
      const remainingCooldown = Math.max(1, Math.round(((this.healthState.cooldownUntil || 0) - Date.now()) / 1000));
      throw new Error(`PROVIDER_RATE_LIMITED: Groq is cooling down (${remainingCooldown}s remaining).`);
    }

    const apiKey = process.env.GROQ_API_KEY;
    const knownGroqModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'allam-2-7b'];
    let modelToUse = this.defaultModel;
    if (options.model && knownGroqModels.includes(options.model)) {
      modelToUse = options.model;
    } else if (process.env.GROQ_CHAT_MODEL && knownGroqModels.includes(process.env.GROQ_CHAT_MODEL)) {
      modelToUse = process.env.GROQ_CHAT_MODEL;
    }

    // Convert messages
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const startTime = Date.now();

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'velora-ai-studio',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: formattedMessages,
        temperature: options.temperature ?? 0.7,
        stream: true,
      }),
      signal: options.signal,
    });

    // Parse rate limit headers
    const remainingRequests = response.headers.get('x-ratelimit-remaining-requests');
    const remainingTokens = response.headers.get('x-ratelimit-remaining-tokens');
    const resetRequests = response.headers.get('x-ratelimit-reset-requests');
    const resetTokens = response.headers.get('x-ratelimit-reset-tokens');
    const retryAfter = response.headers.get('retry-after');

    this.updateRateLimit({
      remainingRequests: remainingRequests ? parseInt(remainingRequests, 10) : undefined,
      remainingTokens: remainingTokens ? parseInt(remainingTokens, 10) : undefined,
      resetRequests: resetRequests || undefined,
      resetTokens: resetTokens || undefined,
      retryAfterSeconds: retryAfter ? parseInt(retryAfter, 10) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let parsedErr: any;
      try {
        parsedErr = JSON.parse(errorText);
      } catch {
        parsedErr = { error: { message: errorText } };
      }

      const msg = parsedErr?.error?.message || errorText;

      if (response.status === 429) {
        const cooldown = retryAfter ? parseInt(retryAfter, 10) : 60;
        this.markRateLimited(cooldown, `Groq rate limit exceeded: ${msg}`);
        throw new Error(`PROVIDER_RATE_LIMITED: Groq rate limit exceeded. ${msg}`);
      }

      if (response.status === 401) {
        this.markAuthError(`Groq authentication failed: ${msg}`);
        throw new Error(`PROVIDER_AUTH_ERROR: Groq authentication error. ${msg}`);
      }

      if (response.status >= 500) {
        this.markUnavailable(30, `Groq server error: ${msg}`);
        throw new Error(`PROVIDER_UNAVAILABLE: Groq upstream failure (${response.status}). ${msg}`);
      }

      throw new Error(`GROQ_ERROR (${response.status}): ${msg}`);
    }

    if (!response.body) {
      throw new Error('PROVIDER_UNAVAILABLE: Groq returned no readable stream body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let buffer = '';
    let usage: any;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                accumulatedText += delta;
                onDelta({
                  type: 'chat.token',
                  delta,
                  provider: this.id,
                  model: modelToUse,
                });
                onDelta({
                  type: 'delta',
                  delta,
                  provider: this.id,
                  model: modelToUse,
                });
              }
              if (parsed.usage) {
                usage = {
                  promptTokens: parsed.usage.prompt_tokens,
                  completionTokens: parsed.usage.completion_tokens,
                  totalTokens: parsed.usage.total_tokens,
                };
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }

      this.recordLatency(Date.now() - startTime);
      this.markAvailable();

      return {
        content: accumulatedText.trim(),
        modelUsed: modelToUse,
        usage,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      this.markUnavailable(20, err?.message);
      throw err;
    }
  }
}

export const groqChatProvider = new GroqChatProvider();
