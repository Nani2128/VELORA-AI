export type ProviderStatus = 
  | 'HEALTHY'
  | 'AVAILABLE' 
  | 'DEGRADED' 
  | 'RATE_LIMITED' 
  | 'QUOTA_EXHAUSTED' 
  | 'CREDIT_EXHAUSTED'
  | 'AUTH_ERROR' 
  | 'UNAVAILABLE' 
  | 'NOT_CONFIGURED'
  | 'UNCONFIGURED';

export type CostClass = 'FREE_ALLOWANCE' | 'LOCAL' | 'PAID' | 'PAID_API' | 'UNKNOWN';

export type TaskType = 
  | 'CASUAL_CHAT'
  | 'GENERAL_QA'
  | 'CODING'
  | 'DEBUGGING'
  | 'REASONING'
  | 'MATH'
  | 'RESEARCH'
  | 'LONG_CONTEXT'
  | 'IMAGE_ANALYSIS'
  | 'IMAGE_GENERATION'
  | 'VIDEO_GENERATION'
  | 'STRUCTURED_OUTPUT'
  | 'TOOL_USE';

export interface RateLimitInfo {
  remainingRequests?: number;
  remainingTokens?: number;
  resetRequests?: string;
  resetTokens?: string;
  retryAfterSeconds?: number;
  lastUpdated?: number;
}

export interface ProviderHealthState {
  status: ProviderStatus;
  cooldownUntil: number | null; // epoch timestamp in ms
  lastError?: string;
  lastChecked: number;
  lastSuccess?: number;
  consecutiveFailures: number;
  averageLatencyMs?: number;
  rateLimitInfo?: RateLimitInfo;
  costClass: CostClass;
  isConfigured?: boolean;
}

export interface DiscoveredModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextWindow?: number;
  supportsStreaming: boolean;
  supportsTools?: boolean;
  supportsReasoning?: boolean;
  supportsVision?: boolean;
  costClass: CostClass;
  capabilities: string[];
}

export interface ChatSourceItem {
  title: string;
  url: string;
  domain: string;
  snippet?: string;
  placeInfo?: {
    title?: string;
    uri?: string;
    address?: string;
    snippet?: string;
  };
}

export interface ChatStreamChunk {
  type: 
    | 'delta' 
    | 'sources' 
    | 'done' 
    | 'error' 
    | 'provider_switched'
    | 'chat.started'
    | 'provider.selected'
    | 'provider.rate_limited'
    | 'provider.switching'
    | 'provider.switched'
    | 'chat.token'
    | 'chat.completed'
    | 'chat.failed';
  delta?: string;
  sources?: ChatSourceItem[];
  searchQueries?: string[];
  messageId?: string;
  error?: string;
  provider?: string;
  model?: string;
  fromProvider?: string;
  toProvider?: string;
  reason?: string;
  task?: TaskType;
  fallbackAttempted?: boolean;
  partialResponseMarked?: boolean;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface NormalizedError {
  code: string;
  message: string;
  provider?: string;
  model?: string;
  retryable: boolean;
  fallback_attempted?: boolean;
  request_id?: string;
  retry_after?: number;
  details?: Record<string, any>;
}

export interface ChatRequestOptions {
  model?: string;
  webSearch?: boolean;
  mapsGrounding?: boolean;
  userLocation?: { latitude: number; longitude: number };
  temperature?: number;
  maxTokens?: number;
  task?: TaskType;
  signal?: AbortSignal;
}

export interface RoutingRecommendation {
  recommended_provider: string;
  recommended_model: string;
  task: TaskType;
  reason: string;
  fallback_candidates: string[];
}
