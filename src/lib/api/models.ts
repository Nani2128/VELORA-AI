import { apiFetch } from './client';
import { ModelDescriptor, ProviderHealth } from '../../types';

export interface ProviderDashboardItem {
  id: string;
  name: string;
  category: 'chat' | 'image' | 'video' | 'multimodal';
  status: string;
  configured: boolean;
  costClass: string;
  capabilities: string[];
  latencyMs?: number;
  modelsCount: number;
}

export interface UsageMetrics {
  totalRequests: number;
  totalSuccess: number;
  totalFailed: number;
  providers: Array<{
    provider: string;
    requests: number;
    success: number;
    failed: number;
    rateLimited: number;
    averageLatencyMs: number;
    tokensUsed: number;
  }>;
}

export interface ChatModelDescriptor {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextWindow?: number;
  supportsStreaming: boolean;
  supportsTools?: boolean;
  supportsReasoning?: boolean;
  costClass: string;
  capabilities: string[];
}

export interface RecommendationResult {
  recommended_provider: string;
  recommended_model: string;
  task: string;
  reason: string;
  fallback_candidates: string[];
}

export async function fetchModels(): Promise<ModelDescriptor[]> {
  const data = await apiFetch<{ models: ModelDescriptor[] }>('/api/v1/models');
  return data.models;
}

export async function fetchModel(id: string): Promise<ModelDescriptor> {
  return apiFetch<ModelDescriptor>(`/api/v1/models/${encodeURIComponent(id)}`);
}

export async function fetchProvidersHealth(): Promise<ProviderHealth[]> {
  const data = await apiFetch<{ providers: ProviderHealth[] }>('/api/v1/providers/health');
  return data.providers;
}

export async function fetchProvidersDashboard(): Promise<ProviderDashboardItem[]> {
  const data = await apiFetch<{ providers: ProviderDashboardItem[] }>('/api/v1/providers/dashboard');
  return data.providers;
}

export async function fetchUsageMetrics(): Promise<UsageMetrics> {
  return apiFetch<UsageMetrics>('/api/v1/usage');
}

export async function fetchChatModels(): Promise<ChatModelDescriptor[]> {
  const data = await apiFetch<{ models: ChatModelDescriptor[] }>('/api/v1/chat/models');
  return data.models;
}

export async function fetchChatRecommendation(prompt: string, options?: any): Promise<RecommendationResult> {
  return apiFetch<RecommendationResult>('/api/v1/chat/recommend', {
    method: 'POST',
    body: JSON.stringify({ prompt, options }),
  });
}
