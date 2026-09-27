import { apiFetch } from './client';
import { GenerationResponseData } from './generations';

export async function fetchGenerationHistory(params?: {
  status?: string;
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<GenerationResponseData[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'ALL') query.set('status', params.status);
  if (params?.type && params.type !== 'ALL') query.set('type', params.type);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));

  const qs = query.toString();
  return apiFetch<GenerationResponseData[]>(`/api/v1/history${qs ? `?${qs}` : ''}`);
}
