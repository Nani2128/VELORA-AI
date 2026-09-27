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

export class HuggingFaceChatProvider extends BaseChatProvider {
  readonly id = 'huggingface';
  readonly name = 'Hugging Face Inference';
  readonly costClass: CostClass = 'FREE_ALLOWANCE'; // Free allowance available, rate-limited serverless tiers

  private defaultModel = 'meta-llama/Llama-3.3-70B-Instruct';

  constructor() {
    super();
    this.healthState.costClass = this.costClass;
  }

  isConfigured(): boolean {
    const enabled = process.env.HF_ENABLED;
    if (enabled !== undefined && enabled.toLowerCase() === 'false') return false;
    return Boolean(process.env.HF_TOKEN);
  }

  supports(feature: 'streaming' | 'web_search' | 'image_input' | 'system_instruction' | 'reasoning'): boolean {
    return feature === 'streaming' || feature === 'system_instruction';
  }

  supportsTask(task: TaskType): boolean {
    return ['CASUAL_CHAT', 'GENERAL_QA', 'CODING', 'RESEARCH', 'REASONING'].includes(task);
  }

  async discoverModels(): Promise<DiscoveredModel[]> {
    if (!this.isConfigured()) return [];

    if (this.cachedModels.length > 0 && Date.now() - this.lastModelDiscovery < 300000) {
      return this.cachedModels;
    }

    // Curated high-availability serverless models on Hugging Face router v1
    const popularHfModels = [
      {
        id: 'meta-llama/Llama-3.3-70B-Instruct',
        name: 'HF: Llama 3.3 70B Instruct',
        desc: 'Meta state-of-the-art open weights conversational model',
        ctx: 131072,
        caps: ['general', 'coding', 'reasoning'],
      },
      {
        id: 'Qwen/Qwen2.5-72B-Instruct',
        name: 'HF: Qwen 2.5 72B Instruct',
        desc: 'Alibaba Qwen powerful multilingual and coding model',
        ctx: 32768,
        caps: ['coding', 'multilingual', 'math'],
      },
      {
        id: 'deepseek-ai/DeepSeek-R1',
        name: 'HF: DeepSeek-R1 (Serverless Reasoning)',
        desc: 'Open weights DeepSeek R1 reasoning and thinking model',
        ctx: 65536,
        caps: ['reasoning', 'math', 'coding'],
      },
    ];

    this.cachedModels = popularHfModels.map((m) => ({
      id: m.id,
      name: m.name,
      provider: 'huggingface',
      description: `${m.desc} (Free allowance available)`,
      contextWindow: m.ctx,
      supportsStreaming: true,
      supportsTools: true,
      costClass: this.costClass,
      capabilities: m.caps,
    }));

    this.lastModelDiscovery = Date.now();
    return this.cachedModels;
  }

  async health(): Promise<ProviderHealthState> {
    if (!this.isConfigured()) {
      return {
        ...this.healthState,
        status: 'NOT_CONFIGURED',
        lastChecked: Date.now(),
        lastError: 'HF_TOKEN is not configured in environment.',
      };
    }

    if (this.healthState.cooldownUntil && Date.now() < this.healthState.cooldownUntil) {
      return this.getHealthState();
    }

    // Check reachability
    const token = process.env.HF_TOKEN;
    const start = Date.now();
    try {
      const res = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'velora-ai-studio',
        },
      });

      if (res.ok) {
        this.recordLatency(Date.now() - start);
        this.markAvailable();
      } else if (res.status === 401) {
        this.markAuthError('Invalid Hugging Face access token.');
      } else {
        this.markUnavailable(30, `HF API returned status ${res.status}`);
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
      throw new Error('PROVIDER_UNCONFIGURED: Hugging Face token (HF_TOKEN) is not configured.');
    }

    if (!this.isAvailable()) {
      const remainingCooldown = Math.max(1, Math.round(((this.healthState.cooldownUntil || 0) - Date.now()) / 1000));
      throw new Error(`PROVIDER_RATE_LIMITED: Hugging Face is cooling down (${remainingCooldown}s remaining).`);
    }

    const token = process.env.HF_TOKEN;
    const knownHfModels = [
      'meta-llama/Llama-3.3-70B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'deepseek-ai/DeepSeek-R1'
    ];
    let modelToUse = this.defaultModel;
    if (options.model && knownHfModels.includes(options.model)) {
      modelToUse = options.model;
    } else if (process.env.HF_MODEL && knownHfModels.includes(process.env.HF_MODEL)) {
      modelToUse = process.env.HF_MODEL;
    }

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const startTime = Date.now();

    // Use standard Hugging Face router v1 completions endpoint
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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
        parsedErr = { error: errorText };
      }

      const msg = parsedErr?.error || parsedErr?.message || errorText;

      if (response.status === 429) {
        this.markRateLimited(60, `HF rate limit exceeded: ${msg}`);
        throw new Error(`PROVIDER_RATE_LIMITED: Hugging Face rate limit exceeded. ${msg}`);
      }

      if (response.status === 402 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('credit')) {
        this.markCreditExhausted(600, `HF credits exhausted: ${msg}`);
        throw new Error(`PROVIDER_QUOTA_EXHAUSTED: Hugging Face credit allowance reached. ${msg}`);
      }

      if (response.status === 401) {
        this.markAuthError(`HF authentication failed: ${msg}`);
        throw new Error(`PROVIDER_AUTH_ERROR: Invalid HF_TOKEN. ${msg}`);
      }

      if (response.status === 503) {
        this.markUnavailable(30, `HF model warming up or server busy: ${msg}`);
        throw new Error(`PROVIDER_UNAVAILABLE: Model is currently loading or server is busy. ${msg}`);
      }

      throw new Error(`HUGGINGFACE_ERROR (${response.status}): ${msg}`);
    }

    if (!response.body) {
      throw new Error('PROVIDER_UNAVAILABLE: Hugging Face returned no readable stream body.');
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

export const huggingFaceChatProvider = new HuggingFaceChatProvider();
