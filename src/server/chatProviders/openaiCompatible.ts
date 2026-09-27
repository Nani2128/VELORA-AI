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

export class OpenAICompatibleChatProvider extends BaseChatProvider {
  readonly id = 'openai_compatible';
  readonly name = 'OpenAI Compatible Gateway';
  readonly costClass: CostClass = 'UNKNOWN'; // Self-hosted or third-party endpoint

  constructor() {
    super();
    this.healthState.costClass = this.costClass;
    this.healthState.status = this.isConfigured() ? 'AVAILABLE' : 'UNCONFIGURED';
  }

  isConfigured(): boolean {
    return (
      process.env.OPENAI_COMPATIBLE_ENABLED === 'true' ||
      !!process.env.OPENAI_COMPATIBLE_BASE_URL
    );
  }

  private getBaseUrl(): string {
    return (process.env.OPENAI_COMPATIBLE_BASE_URL || 'http://localhost:8000/v1').replace(/\/+$/, '');
  }

  private getApiKey(): string {
    return process.env.OPENAI_COMPATIBLE_API_KEY || '';
  }

  private getModel(requestedModel?: string): string {
    return requestedModel || process.env.OPENAI_COMPATIBLE_MODEL || 'default';
  }

  supports(feature: string): boolean {
    return ['streaming', 'system_instruction'].includes(feature);
  }

  supportsTask(task: TaskType): boolean {
    return true; // General gateway
  }

  async discoverModels(): Promise<DiscoveredModel[]> {
    if (!this.isConfigured()) return [];

    try {
      const headers: Record<string, string> = {};
      if (this.getApiKey()) headers['Authorization'] = `Bearer ${this.getApiKey()}`;
      const res = await fetch(`${this.getBaseUrl()}/models`, {
        headers,
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          return data.data.map((m: any) => ({
            id: m.id,
            name: `Gateway: ${m.id}`,
            provider: 'openai_compatible',
            description: `Configured OpenAI-compatible server endpoint model`,
            contextWindow: 16384,
            supportsStreaming: true,
            supportsTools: true,
            costClass: this.costClass,
            capabilities: ['chat', 'streaming'],
          }));
        }
      }
    } catch {
      // Fallback
    }

    return [
      {
        id: this.getModel(),
        name: `Gateway: ${this.getModel()}`,
        provider: 'openai_compatible',
        description: `Custom configured OpenAI-compatible model`,
        contextWindow: 8192,
        supportsStreaming: true,
        supportsTools: true,
        costClass: this.costClass,
        capabilities: ['chat', 'streaming'],
      },
    ];
  }

  async health(): Promise<ProviderHealthState> {
    if (!this.isConfigured()) {
      return {
        ...this.healthState,
        status: 'UNCONFIGURED',
        cooldownUntil: null,
        lastError: 'OPENAI_COMPATIBLE_BASE_URL not configured.',
        lastChecked: Date.now(),
        consecutiveFailures: 0,
      };
    }

    try {
      const headers: Record<string, string> = {};
      if (this.getApiKey()) headers['Authorization'] = `Bearer ${this.getApiKey()}`;
      const res = await fetch(`${this.getBaseUrl()}/models`, {
        headers,
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        this.markAvailable();
      } else {
        this.markUnavailable(30, `Gateway HTTP ${res.status}`);
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
      throw new Error('PROVIDER_UNCONFIGURED: Custom OpenAI Compatible gateway is not configured.');
    }

    const modelToUse = this.getModel(options.model);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.getApiKey()) headers['Authorization'] = `Bearer ${this.getApiKey()}`;

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelToUse,
        messages: formattedMessages,
        temperature: options.temperature ?? 0.7,
        stream: true,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      this.markUnavailable(30, `Gateway error: ${err}`);
      throw new Error(`GATEWAY_ERROR (${response.status}): ${err}`);
    }

    if (!response.body) {
      throw new Error('PROVIDER_UNAVAILABLE: Gateway returned no response stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let buffer = '';

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
            try {
              const parsed = JSON.parse(trimmed.slice(6));
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
            } catch {
              // Ignore partial JSON
            }
          }
        }
      }

      this.markAvailable();
      return { content: accumulatedText.trim(), modelUsed: modelToUse };
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      this.markUnavailable(20, err.message);
      throw err;
    }
  }
}

export const openAICompatibleChatProvider = new OpenAICompatibleChatProvider();
