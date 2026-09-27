import { GoogleGenAI } from '@google/genai';
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

export class GeminiChatProvider extends BaseChatProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly costClass: CostClass = 'FREE_ALLOWANCE'; // Free allowance / developer tier available
  private ai: GoogleGenAI | null = null;

  constructor() {
    super();
    this.healthState.costClass = this.costClass;
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
      this.healthState.status = 'AVAILABLE';
    } else {
      this.healthState.status = 'UNCONFIGURED';
    }
  }

  isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  supports(feature: string): boolean {
    return ['streaming', 'web_search', 'maps_grounding', 'system_instruction', 'image_input'].includes(feature);
  }

  supportsTask(task: TaskType): boolean {
    // Gemini excels at live research with Google Grounding, long context, and general multi-turn QA
    return ['RESEARCH', 'CASUAL_CHAT', 'GENERAL_QA', 'LONG_CONTEXT', 'IMAGE_ANALYSIS', 'CODING', 'REASONING'].includes(task);
  }

  async discoverModels(): Promise<DiscoveredModel[]> {
    return [
      {
        id: 'gemini-3.5-flash',
        name: 'Gemini 3.5 Flash (Google Grounded)',
        provider: 'gemini',
        description: 'Google Search & Maps Grounding optimized model for live real-time factual and spatial intelligence',
        contextWindow: 1048576,
        supportsStreaming: true,
        supportsTools: true,
        costClass: this.costClass,
        capabilities: ['chat', 'streaming', 'web_search', 'maps_grounding', 'fast'],
      },
      {
        id: 'gemini-3.8-flash',
        name: 'Gemini 3.8 Flash',
        provider: 'gemini',
        description: 'Fast, high-fidelity multimodal and conversational model',
        contextWindow: 1048576,
        supportsStreaming: true,
        supportsTools: true,
        costClass: this.costClass,
        capabilities: ['chat', 'streaming', 'web_search', 'fast'],
      },
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro',
        provider: 'gemini',
        description: 'Advanced reasoning, deep visual prompt directing, and multi-step workflows',
        contextWindow: 2097152,
        supportsStreaming: true,
        supportsTools: true,
        supportsReasoning: true,
        costClass: this.costClass,
        capabilities: ['chat', 'streaming', 'web_search', 'reasoning', 'coding'],
      },
    ];
  }

  async health(): Promise<ProviderHealthState> {
    if (!this.isConfigured()) {
      return {
        ...this.healthState,
        status: 'UNCONFIGURED',
        cooldownUntil: null,
        lastError: 'GEMINI_API_KEY is not set in environment.',
        lastChecked: Date.now(),
        consecutiveFailures: 0,
      };
    }
    return this.getHealthState();
  }

  private isQuotaOrRateLimitError(errStr: string): boolean {
    const lower = errStr.toLowerCase();
    return (
      lower.includes('429') ||
      lower.includes('resource_exhausted') ||
      lower.includes('quota') ||
      lower.includes('rate limit') ||
      lower.includes('too many requests')
    );
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
      throw new Error('PROVIDER_UNCONFIGURED: GEMINI_API_KEY is missing.');
    }

    if (!this.isAvailable()) {
      const remainingCooldown = Math.max(1, Math.round(((this.healthState.cooldownUntil || 0) - Date.now()) / 1000));
      const err: any = new Error(`PROVIDER_RATE_LIMITED: Gemini is cooling down (${remainingCooldown}s remaining).`);
      err.code = 'PROVIDER_RATE_LIMITED';
      throw err;
    }

    if (!this.ai) {
      this.initClient();
    }
    const enableMaps = !!options.mapsGrounding;
    const enableSearch = !enableMaps && !!options.webSearch;
    
    // Resolve model safely: only use options.model if it is a genuine Gemini model
    let model = 'gemini-3.8-flash';
    if (enableMaps || enableSearch) {
      model = 'gemini-3.5-flash';
    } else if (options.model && (options.model.startsWith('gemini-') || options.model.startsWith('models/gemini-'))) {
      model = options.model;
    } else if (options.task === 'REASONING' || options.task === 'CODING' || options.task === 'MATH') {
      model = 'gemini-3.1-pro-preview';
    }

    const systemInstruction = `You are VELORA AI Creative Director and Studio Intelligence Assistant.
Provide articulate, structured, and actionable guidance for visual arts, cinematics, prompt crafting, tech research, and geographic locations. Use clean markdown formatting.
If Google Maps is enabled, provide specific location insights, recommendations, and point out relevant places.
If web search is enabled, synthesize live facts and provide clear context.`;

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const config: any = {
      systemInstruction,
      temperature: options.temperature ?? 0.7,
    };

    if (enableMaps) {
      config.tools = [{ googleMaps: {} }];
      if (options.userLocation) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: options.userLocation.latitude,
              longitude: options.userLocation.longitude,
            },
          },
        };
      }
    } else if (enableSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    let fullText = '';
    const sources: ChatSourceItem[] = [];
    let searchQueries: string[] = [];
    const startTime = Date.now();

    try {
      const responseStream = await client.models.generateContentStream({
        model,
        contents,
        config,
      });

      for await (const chunk of responseStream) {
        const textDelta = chunk.text || '';
        if (textDelta) {
          fullText += textDelta;
          onDelta({
            type: 'chat.token',
            delta: textDelta,
            provider: this.id,
            model,
          });
          onDelta({
            type: 'delta',
            delta: textDelta,
            provider: this.id,
            model,
          });
        }

        // Grounding metadata
        const candidate = chunk.candidates?.[0];
        if (candidate?.groundingMetadata) {
          const gm = candidate.groundingMetadata as any;
          if (gm.webSearchQueries && Array.isArray(gm.webSearchQueries)) {
            searchQueries = Array.from(new Set([...searchQueries, ...gm.webSearchQueries]));
          }
          if (gm.groundingChunks && Array.isArray(gm.groundingChunks)) {
            for (const item of gm.groundingChunks) {
              if (item.web?.uri) {
                const uri = item.web.uri;
                let domain = '';
                try {
                  domain = new URL(uri).hostname.replace(/^www\./, '');
                } catch {
                  domain = 'web';
                }
                const existing = sources.find((s) => s.url === uri);
                if (!existing) {
                  sources.push({
                    title: item.web.title || domain,
                    url: uri,
                    domain,
                    snippet: item.web.title,
                  });
                }
              }
              // Google Maps grounding chunks
              if (item.maps?.uri) {
                const uri = item.maps.uri;
                const title = item.maps.title || 'Google Maps Location';
                const snippet = item.maps.placeAnswerSources?.reviewSnippets?.[0] || title;
                const existing = sources.find((s) => s.url === uri);
                if (!existing) {
                  sources.push({
                    title,
                    url: uri,
                    domain: 'maps.google.com',
                    snippet,
                    placeInfo: {
                      title,
                      uri,
                      address: item.maps.address,
                      snippet,
                    },
                  });
                }
              }
            }
          }
        }
      }

      if (sources.length > 0 || searchQueries.length > 0) {
        onDelta({
          type: 'sources',
          sources,
          searchQueries,
          provider: this.id,
          model,
        });
      }

      this.recordLatency(Date.now() - startTime);
      this.markAvailable();

      return {
        content: fullText.trim(),
        sources: sources.length > 0 ? sources : undefined,
        searchQueries: searchQueries.length > 0 ? searchQueries : undefined,
        modelUsed: model,
      };
    } catch (err: any) {
      const errStr = err?.message || String(err);
      if (err.name === 'AbortError') throw err;

      if (this.isQuotaOrRateLimitError(errStr)) {
        this.markRateLimited(60, errStr);
        throw new Error(`PROVIDER_RATE_LIMITED: Gemini quota or rate limit reached (429). Cooling down for 60s.`);
      }

      if (errStr.includes('API_KEY_INVALID') || errStr.includes('unauthenticated')) {
        this.markAuthError(errStr);
        throw new Error(`PROVIDER_AUTH_ERROR: Invalid GEMINI_API_KEY.`);
      }

      // If it's a 404 or model not found error, do not lock out Gemini
      if (errStr.includes('404') || errStr.includes('not found') || errStr.includes('not supported')) {
        console.warn(`[Gemini] Non-fatal model request issue: ${errStr}`);
        throw err;
      }

      this.markUnavailable(30, errStr);
      throw err;
    }
  }
}

export const geminiChatProvider = new GeminiChatProvider();
