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

export class OpenAIChatProvider extends BaseChatProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly costClass: CostClass = 'PAID'; // Paid cloud inference API

  constructor() {
    super();
    this.healthState.costClass = this.costClass;
    this.healthState.status = this.isConfigured() ? 'AVAILABLE' : 'UNCONFIGURED';
  }

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  private getApiKey(): string {
    return process.env.OPENAI_API_KEY || '';
  }

  private getModel(requestedModel?: string): string {
    if (requestedModel && (requestedModel.startsWith('gpt') || requestedModel.startsWith('o1') || requestedModel.startsWith('o3'))) {
      return requestedModel;
    }
    return process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
  }

  supports(feature: string): boolean {
    return ['streaming', 'system_instruction', 'image_input'].includes(feature);
  }

  supportsTask(task: TaskType): boolean {
    return ['CODING', 'DEBUGGING', 'REASONING', 'MATH', 'STRUCTURED_OUTPUT', 'GENERAL_QA', 'CASUAL_CHAT'].includes(task);
  }

  async discoverModels(): Promise<DiscoveredModel[]> {
    if (!this.isConfigured()) return [];

    if (this.cachedModels.length > 0 && Date.now() - this.lastModelDiscovery < 300000) {
      return this.cachedModels;
    }

    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${this.getApiKey()}` },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          // Filter to conversational chat and reasoning models
          const relevant = data.data.filter((m: any) => {
            const id = m.id.toLowerCase();
            return (
              (id.startsWith('gpt-4') || id.startsWith('gpt-3.5') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('chatgpt')) &&
              !id.includes('instruct') &&
              !id.includes('realtime') &&
              !id.includes('audio')
            );
          });

          this.cachedModels = relevant.map((m: any) => ({
            id: m.id,
            name: `OpenAI: ${m.id}`,
            provider: 'openai',
            description: `Official OpenAI ${m.id} model (Paid API usage)`,
            contextWindow: 128000,
            supportsStreaming: true,
            supportsTools: true,
            costClass: this.costClass,
            capabilities: ['chat', 'coding', 'reasoning', 'streaming'],
          }));
          this.lastModelDiscovery = Date.now();
        }
      }
    } catch {
      // Fallback to official active standards
    }

    if (this.cachedModels.length === 0) {
      this.cachedModels = [
        {
          id: 'gpt-4o-mini',
          name: 'OpenAI: gpt-4o-mini',
          provider: 'openai',
          description: 'Fast, cost-effective multimodal model for everyday tasks (128K context)',
          contextWindow: 128000,
          supportsStreaming: true,
          supportsTools: true,
          costClass: this.costClass,
          capabilities: ['chat', 'coding', 'fast', 'streaming'],
        },
        {
          id: 'gpt-4o',
          name: 'OpenAI: gpt-4o',
          provider: 'openai',
          description: 'High-intelligence flagship model for complex reasoning and code synthesis',
          contextWindow: 128000,
          supportsStreaming: true,
          supportsTools: true,
          costClass: this.costClass,
          capabilities: ['chat', 'coding', 'reasoning', 'streaming'],
        },
      ];
    }

    return this.cachedModels;
  }

  async health(): Promise<ProviderHealthState> {
    if (!this.isConfigured()) {
      return {
        ...this.healthState,
        status: 'UNCONFIGURED',
        cooldownUntil: null,
        lastError: 'OPENAI_API_KEY is not set in environment.',
        lastChecked: Date.now(),
        consecutiveFailures: 0,
      };
    }

    if (this.healthState.cooldownUntil && Date.now() < this.healthState.cooldownUntil) {
      return this.getHealthState();
    }

    const start = Date.now();
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${this.getApiKey()}` },
        signal: AbortSignal.timeout(3000),
      });

      if (res.status === 401) {
        this.markAuthError('Invalid OpenAI API key.');
      } else if (res.status === 429) {
        this.markRateLimited(60, 'OpenAI quota or rate limit exceeded.');
      } else if (res.ok) {
        this.recordLatency(Date.now() - start);
        this.markAvailable();
      }
    } catch (e: any) {
      this.markUnavailable(30, e.message);
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
      throw new Error('PROVIDER_UNCONFIGURED: OPENAI_API_KEY is missing.');
    }

    if (!this.isAvailable()) {
      const remainingCooldown = Math.max(1, Math.round(((this.healthState.cooldownUntil || 0) - Date.now()) / 1000));
      throw new Error(`PROVIDER_RATE_LIMITED: OpenAI is cooling down (${remainingCooldown}s remaining).`);
    }

    const modelToUse = this.getModel(options.model);
    const apiKey = this.getApiKey();

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const startTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
        this.markRateLimited(60, `OpenAI quota exceeded: ${msg}`);
        throw new Error(`PROVIDER_RATE_LIMITED: OpenAI quota exceeded (429). ${msg}`);
      }

      if (response.status === 401) {
        this.markAuthError(`OpenAI auth failure: ${msg}`);
        throw new Error(`PROVIDER_AUTH_ERROR: Invalid OPENAI_API_KEY.`);
      }

      if (response.status >= 500) {
        this.markUnavailable(30, `OpenAI server error (${response.status}): ${msg}`);
        throw new Error(`PROVIDER_UNAVAILABLE: OpenAI upstream server error. ${msg}`);
      }

      throw new Error(`OPENAI_ERROR (${response.status}): ${msg}`);
    }

    if (!response.body) {
      throw new Error('PROVIDER_UNAVAILABLE: OpenAI returned no stream body.');
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
              // Ignore partial JSON
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

export const openAIChatProvider = new OpenAIChatProvider();
