import { 
  ProviderStatus, 
  ProviderHealthState, 
  ChatRequestOptions, 
  ChatStreamChunk, 
  ChatSourceItem,
  DiscoveredModel,
  CostClass,
  RateLimitInfo,
  TaskType
} from './types';

export abstract class BaseChatProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly costClass: CostClass;
  
  protected healthState: ProviderHealthState = {
    status: 'AVAILABLE',
    cooldownUntil: null,
    lastChecked: Date.now(),
    consecutiveFailures: 0,
    costClass: 'UNKNOWN',
  };

  protected cachedModels: DiscoveredModel[] = [];
  protected lastModelDiscovery: number = 0;

  constructor() {
    // Will be initialized in subclass with appropriate costClass
  }

  abstract isConfigured(): boolean;

  abstract streamChat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: ChatRequestOptions,
    onDelta: (chunk: ChatStreamChunk) => void
  ): Promise<{ 
    content: string; 
    sources?: ChatSourceItem[]; 
    searchQueries?: string[]; 
    modelUsed?: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  }>;

  abstract discoverModels(): Promise<DiscoveredModel[]>;

  abstract health(): Promise<ProviderHealthState>;

  supports(feature: 'streaming' | 'web_search' | 'image_input' | 'system_instruction' | 'reasoning'): boolean {
    return feature === 'streaming';
  }

  supportsTask(task: TaskType): boolean {
    return true; // Subclasses can specialize
  }

  isAvailable(): boolean {
    if (!this.isConfigured()) return false;
    if (this.healthState.cooldownUntil && Date.now() < this.healthState.cooldownUntil) {
      return false; // Still in cooldown
    }
    return (
      this.healthState.status !== 'QUOTA_EXHAUSTED' && 
      this.healthState.status !== 'CREDIT_EXHAUSTED' && 
      this.healthState.status !== 'AUTH_ERROR'
    );
  }

  recordLatency(ms: number) {
    if (!this.healthState.averageLatencyMs) {
      this.healthState.averageLatencyMs = ms;
    } else {
      this.healthState.averageLatencyMs = Math.round((this.healthState.averageLatencyMs * 0.7) + (ms * 0.3));
    }
    this.healthState.lastSuccess = Date.now();
  }

  updateRateLimit(info: RateLimitInfo) {
    this.healthState.rateLimitInfo = {
      ...this.healthState.rateLimitInfo,
      ...info,
      lastUpdated: Date.now(),
    };
  }

  markRateLimited(cooldownSeconds: number = 60, errorMsg?: string) {
    this.healthState.status = 'RATE_LIMITED';
    this.healthState.cooldownUntil = Date.now() + cooldownSeconds * 1000;
    this.healthState.lastError = errorMsg || 'Provider quota or rate limit exceeded.';
    this.healthState.lastChecked = Date.now();
    this.healthState.consecutiveFailures += 1;
    console.warn(`[AI Router] Provider ${this.id} marked RATE_LIMITED for ${cooldownSeconds}s.`);
  }

  markQuotaExhausted(cooldownSeconds: number = 300, errorMsg?: string) {
    this.healthState.status = 'QUOTA_EXHAUSTED';
    this.healthState.cooldownUntil = Date.now() + cooldownSeconds * 1000;
    this.healthState.lastError = errorMsg || 'Monthly or daily quota completely exhausted.';
    this.healthState.lastChecked = Date.now();
    this.healthState.consecutiveFailures += 1;
    console.warn(`[AI Router] Provider ${this.id} marked QUOTA_EXHAUSTED for ${cooldownSeconds}s.`);
  }

  markCreditExhausted(cooldownSeconds: number = 600, errorMsg?: string) {
    this.healthState.status = 'CREDIT_EXHAUSTED';
    this.healthState.cooldownUntil = Date.now() + cooldownSeconds * 1000;
    this.healthState.lastError = errorMsg || 'Account balance or credit allowance exhausted.';
    this.healthState.lastChecked = Date.now();
    this.healthState.consecutiveFailures += 1;
    console.warn(`[AI Router] Provider ${this.id} marked CREDIT_EXHAUSTED.`);
  }

  markAuthError(errorMsg?: string) {
    this.healthState.status = 'AUTH_ERROR';
    this.healthState.cooldownUntil = Date.now() + 600 * 1000;
    this.healthState.lastError = errorMsg || 'Invalid authentication credentials or API key.';
    this.healthState.lastChecked = Date.now();
  }

  markUnavailable(cooldownSeconds: number = 30, errorMsg?: string) {
    this.healthState.status = 'UNAVAILABLE';
    this.healthState.cooldownUntil = Date.now() + cooldownSeconds * 1000;
    this.healthState.lastError = errorMsg || 'Provider server is unreachable or timed out.';
    this.healthState.lastChecked = Date.now();
    this.healthState.consecutiveFailures += 1;
  }

  markAvailable() {
    this.healthState.status = 'AVAILABLE';
    this.healthState.cooldownUntil = null;
    this.healthState.consecutiveFailures = 0;
    this.healthState.lastChecked = Date.now();
  }

  getHealthState(): ProviderHealthState {
    this.healthState.costClass = this.costClass;
    // If cooldown elapsed, reset status
    if (this.healthState.cooldownUntil && Date.now() >= this.healthState.cooldownUntil) {
      this.healthState.cooldownUntil = null;
      if (this.healthState.status === 'RATE_LIMITED' || this.healthState.status === 'UNAVAILABLE') {
        this.healthState.status = 'AVAILABLE';
      }
    }
    return { ...this.healthState };
  }
}
