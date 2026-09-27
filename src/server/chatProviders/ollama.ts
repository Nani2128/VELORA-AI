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

export class OllamaChatProvider extends BaseChatProvider {
  readonly id = 'ollama';
  readonly name = 'Local Ollama';
  readonly costClass: CostClass = 'LOCAL'; // Local private model inference

  private installedModels: string[] = [];

  constructor() {
    super();
    this.healthState.costClass = this.costClass;
    this.healthState.status = 'UNCONFIGURED';
  }

  isConfigured(): boolean {
    return process.env.OLLAMA_ENABLED === 'true' || !!process.env.OLLAMA_BASE_URL;
  }

  supports(feature: string): boolean {
    return ['streaming', 'system_instruction'].includes(feature);
  }

  supportsTask(task: TaskType): boolean {
    return ['CASUAL_CHAT', 'GENERAL_QA', 'CODING', 'DEBUGGING'].includes(task);
  }

  private getBaseUrl(): string {
    return (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
  }

  async getInstalledModels(): Promise<string[]> {
    const url = `${this.getBaseUrl()}/api/tags`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
          this.installedModels = data.models.map((m: any) => m.name || m.model);
          this.markAvailable();
          return this.installedModels;
        }
      }
    } catch {
      // Ollama not reachable
    }
    return this.installedModels;
  }

  async discoverModels(): Promise<DiscoveredModel[]> {
    if (!this.isConfigured()) return [];

    const names = await this.getInstalledModels();
    return names.map((name) => {
      const isCoding = name.toLowerCase().includes('code') || name.toLowerCase().includes('deepseek');
      return {
        id: name,
        name: `Ollama: ${name}`,
        provider: 'ollama',
        description: `Locally running model on host via Ollama (100% private, local inference)`,
        contextWindow: 8192,
        supportsStreaming: true,
        supportsTools: false,
        costClass: this.costClass,
        capabilities: isCoding ? ['coding', 'local', 'streaming'] : ['general', 'local', 'streaming'],
      };
    });
  }

  async health(): Promise<ProviderHealthState> {
    if (!this.isConfigured()) {
      return {
        ...this.healthState,
        status: 'UNCONFIGURED',
        cooldownUntil: null,
        lastError: 'OLLAMA_BASE_URL is not configured.',
        lastChecked: Date.now(),
        consecutiveFailures: 0,
      };
    }

    const start = Date.now();
    try {
      const models = await this.getInstalledModels();
      if (models.length > 0) {
        this.recordLatency(Date.now() - start);
        this.markAvailable();
      } else {
        this.markUnavailable(30, 'Ollama endpoint reachable but no models installed. Run "ollama pull llama3" to install.');
      }
    } catch (e: any) {
      this.markUnavailable(30, `Cannot reach Ollama at ${this.getBaseUrl()}: ${e.message}`);
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
      throw new Error('PROVIDER_UNCONFIGURED: Ollama is not configured.');
    }

    // Determine model to use
    let modelToUse = options.model;
    if (!modelToUse || modelToUse === 'default' || modelToUse.startsWith('gemini') || modelToUse.startsWith('gpt')) {
      const installed = await this.getInstalledModels();
      if (installed.length === 0) {
        throw new Error('MODEL_UNAVAILABLE: No models found installed in local Ollama instance.');
      }
      modelToUse = process.env.OLLAMA_CHAT_MODEL || installed[0];
    }

    const startTime = Date.now();

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(`${this.getBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelToUse,
        messages: formattedMessages,
        stream: true,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.markUnavailable(30, `Ollama error: ${errorText}`);
      throw new Error(`OLLAMA_ERROR: ${errorText || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('PROVIDER_UNAVAILABLE: Ollama returned no stream body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let buffer = '';
    let evalCount: number | undefined;
    let promptEvalCount: number | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            const delta = parsed.message?.content;
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
            if (parsed.eval_count !== undefined) evalCount = parsed.eval_count;
            if (parsed.prompt_eval_count !== undefined) promptEvalCount = parsed.prompt_eval_count;
          } catch {
            // Ignore non-json lines
          }
        }
      }

      this.recordLatency(Date.now() - startTime);
      this.markAvailable();

      return {
        content: accumulatedText.trim(),
        modelUsed: modelToUse,
        usage: {
          promptTokens: promptEvalCount,
          completionTokens: evalCount,
          totalTokens: (promptEvalCount || 0) + (evalCount || 0),
        },
      };
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      this.markUnavailable(20, err.message);
      throw err;
    }
  }
}

export const ollamaChatProvider = new OllamaChatProvider();
