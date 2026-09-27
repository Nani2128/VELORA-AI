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

export class DeepSeekChatProvider extends BaseChatProvider {
  readonly id = 'deepseek';
  readonly name = 'DeepSeek AI';
  readonly costClass: CostClass = 'PAID'; // Paid cloud inference API

  private defaultModel = 'deepseek-chat';

  constructor() {
    super();
    this.healthState.costClass = this.costClass;
  }

  isConfigured(): boolean {
    const enabled = process.env.DEEPSEEK_ENABLED;
    if (enabled !== undefined && enabled.toLowerCase() === 'false') return false;
    return Boolean(process.env.DEEPSEEK_API_KEY);
  }

  supports(feature: 'streaming' | 'web_search' | 'image_input' | 'system_instruction' | 'reasoning'): boolean {
    return feature === 'streaming' || feature === 'system_instruction' || feature === 'reasoning';
  }

  supportsTask(task: TaskType): boolean {
    // DeepSeek is a world-class coding, reasoning, math, and technical analysis model
    return ['CODING', 'DEBUGGING', 'REASONING', 'MATH', 'GENERAL_QA', 'STRUCTURED_OUTPUT'].includes(task);
  }

  private getBaseUrl(): string {
    return process.env.DEEPSEEK_BASE_URL?.replace(/\/$/, '') || 'https://api.deepseek.com';
  }

  async discoverModels(): Promise<DiscoveredModel[]> {
    if (!this.isConfigured()) return [];

    if (this.cachedModels.length > 0 && Date.now() - this.lastModelDiscovery < 300000) {
      return this.cachedModels;
    }

    try {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      const res = await fetch(`${this.getBaseUrl()}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'velora-ai-studio',
        },
      });

      if (!res.ok) {
        if (res.status === 401) this.markAuthError('Invalid DeepSeek API key.');
        if (res.status === 402) this.markCreditExhausted(600, 'DeepSeek account balance exhausted.');
        if (res.status === 429) this.markRateLimited(60, 'DeepSeek rate limit reached.');
        return this.cachedModels;
      }

      const data = await res.json();
      if (Array.isArray(data.data)) {
        this.cachedModels = data.data.map((m: any) => {
          const isReasoner = m.id.includes('reasoner') || m.id.includes('r1');
          return {
            id: m.id,
            name: `DeepSeek: ${m.id}`,
            provider: 'deepseek',
            description: isReasoner 
              ? 'DeepSeek-R1 reasoning engine with chain-of-thought verification' 
              : 'DeepSeek-V3 advanced code generation and general intelligence',
            contextWindow: 65536,
            supportsStreaming: true,
            supportsTools: !isReasoner,
            supportsReasoning: isReasoner,
            costClass: this.costClass,
            capabilities: isReasoner ? ['reasoning', 'math', 'coding', 'streaming'] : ['coding', 'general', 'streaming'],
          };
        });
        this.lastModelDiscovery = Date.now();
      }
      return this.cachedModels;
    } catch (err: any) {
      console.warn('[DeepSeek] Model discovery error:', err?.message);
      // Fallback to official active model descriptors
      return [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek: deepseek-chat',
          provider: 'deepseek',
          description: 'DeepSeek-V3 flagship language and code synthesis model (64K context)',
          contextWindow: 65536,
          supportsStreaming: true,
          supportsTools: true,
          costClass: this.costClass,
          capabilities: ['coding', 'general', 'streaming'],
        },
        {
          id: 'deepseek-reasoner',
          name: 'DeepSeek: deepseek-reasoner',
          provider: 'deepseek',
          description: 'DeepSeek-R1 chain-of-thought deep reasoning model',
          contextWindow: 65536,
          supportsStreaming: true,
          supportsTools: false,
          supportsReasoning: true,
          costClass: this.costClass,
          capabilities: ['reasoning', 'math', 'coding', 'streaming'],
        },
      ];
    }
  }

  async health(): Promise<ProviderHealthState> {
    if (!this.isConfigured()) {
      return {
        ...this.healthState,
        status: 'NOT_CONFIGURED',
        lastChecked: Date.now(),
        lastError: 'DEEPSEEK_API_KEY is not configured in environment.',
      };
    }

    if (this.healthState.cooldownUntil && Date.now() < this.healthState.cooldownUntil) {
      return this.getHealthState();
    }

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
      throw new Error('PROVIDER_UNCONFIGURED: DeepSeek API key is not configured.');
    }

    if (!this.isAvailable()) {
      const remainingCooldown = Math.max(1, Math.round(((this.healthState.cooldownUntil || 0) - Date.now()) / 1000));
      throw new Error(`PROVIDER_RATE_LIMITED: DeepSeek is cooling down (${remainingCooldown}s remaining).`);
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const isDeepSeekModel = options.model && options.model.startsWith('deepseek-');
    const modelToUse = isDeepSeekModel
      ? options.model!
      : (options.task === 'REASONING' || options.task === 'MATH' ? 'deepseek-reasoner' : (process.env.DEEPSEEK_CHAT_MODEL || this.defaultModel));

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const startTime = Date.now();

    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'velora-ai-studio',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: formattedMessages,
        temperature: options.temperature ?? (modelToUse.includes('reasoner') ? 0.6 : 0.7),
        stream: true,
      }),
      signal: options.signal,
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

      if (response.status === 402 || msg.toLowerCase().includes('insufficient balance')) {
        this.markCreditExhausted(600, `DeepSeek balance insufficient: ${msg}`);
        throw new Error(`PROVIDER_QUOTA_EXHAUSTED: DeepSeek account balance exhausted. ${msg}`);
      }

      if (response.status === 429) {
        this.markRateLimited(60, `DeepSeek rate limit reached: ${msg}`);
        throw new Error(`PROVIDER_RATE_LIMITED: DeepSeek rate limit reached. ${msg}`);
      }

      if (response.status === 401) {
        this.markAuthError(`DeepSeek authentication failed: ${msg}`);
        throw new Error(`PROVIDER_AUTH_ERROR: DeepSeek authentication error. ${msg}`);
      }

      if (response.status >= 500) {
        this.markUnavailable(30, `DeepSeek server error (${response.status}): ${msg}`);
        throw new Error(`PROVIDER_UNAVAILABLE: DeepSeek server error. ${msg}`);
      }

      throw new Error(`DEEPSEEK_ERROR (${response.status}): ${msg}`);
    }

    if (!response.body) {
      throw new Error('PROVIDER_UNAVAILABLE: DeepSeek returned no readable stream body.');
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
              const choice = parsed.choices?.[0];
              const delta = choice?.delta?.content;
              const reasoning = choice?.delta?.reasoning_content;

              if (reasoning) {
                // Emit reasoning tokens if user selected reasoner
                onDelta({
                  type: 'chat.token',
                  delta: reasoning,
                  provider: this.id,
                  model: modelToUse,
                });
                onDelta({
                  type: 'delta',
                  delta: reasoning,
                  provider: this.id,
                  model: modelToUse,
                });
                accumulatedText += reasoning;
              } else if (delta) {
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

export const deepseekChatProvider = new DeepSeekChatProvider();
