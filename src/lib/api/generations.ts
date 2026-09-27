import { apiFetch } from './client';
import { GenerationStatus, GenerationType } from '../../types';

export interface GenerationRequestPayload {
  type: GenerationType;
  prompt: string;
  model?: string;
  negative_prompt?: string;
  input_asset_id?: string;
  project_id?: string;
  enhance_prompt?: boolean;
  settings?: Record<string, any>;
}

export interface GenerationResponseData {
  id: string;
  user_id: string;
  project_id: string | null;
  type: GenerationType;
  prompt: string;
  enhanced_prompt: string | null;
  negative_prompt: string | null;
  input_asset_id: string | null;
  output_asset_id: string | null;
  provider: string;
  model: string;
  status: GenerationStatus;
  settings: Record<string, any>;
  error_code: string | null;
  error_message: string | null;
  output_asset?: {
    id: string;
    type: 'IMAGE' | 'VIDEO' | 'AUDIO';
    url: string;
    mime_type: string;
    size_bytes?: number;
    duration_seconds?: number;
  } | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface GenerationStatusEventData {
  generation_id: string;
  status: GenerationStatus;
  timestamp: string;
  stage?: string;
  switched_from?: string;
  switched_to?: string;
  switched_provider?: string;
  output_asset_id?: string | null;
  output_url?: string | null;
  error?: {
    code: string;
    message: string;
    alternatives?: string[];
    retryable?: boolean;
  } | null;
}

export async function createGeneration(payload: GenerationRequestPayload): Promise<GenerationResponseData> {
  return apiFetch<GenerationResponseData>('/api/v1/generations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getGeneration(id: string): Promise<GenerationResponseData> {
  return apiFetch<GenerationResponseData>(`/api/v1/generations/${id}`);
}

export async function cancelGeneration(id: string): Promise<{ status: string; id: string }> {
  return apiFetch<{ status: string; id: string }>(`/api/v1/generations/${id}/cancel`, {
    method: 'POST',
  });
}

export async function retryGeneration(id: string): Promise<{ status: string; id: string }> {
  return apiFetch<{ status: string; id: string }>(`/api/v1/generations/${id}/retry`, {
    method: 'POST',
  });
}

export async function enhancePrompt(prompt: string, type: string = 'TEXT_TO_IMAGE'): Promise<string> {
  try {
    const data = await apiFetch<{ enhanced_prompt: string }>('/api/v1/enhance-prompt', {
      method: 'POST',
      body: JSON.stringify({ prompt, type }),
    });
    return data.enhanced_prompt || prompt;
  } catch (err) {
    console.warn('Enhance prompt API fallback:', err);
    return prompt;
  }
}


export function subscribeToGenerationEvents(
  generationId: string,
  onUpdate: (event: GenerationStatusEventData) => void,
  onError?: (err: any) => void,
): () => void {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const url = `${baseUrl}/api/v1/generations/${generationId}/events`;
  const eventSource = new EventSource(url);

  eventSource.addEventListener('generation.status', (e: MessageEvent) => {
    try {
      const data: GenerationStatusEventData = JSON.parse(e.data);
      onUpdate(data);
      if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'CANCELLED') {
        eventSource.close();
      }
    } catch (parseErr) {
      console.error('Failed to parse generation event:', parseErr);
    }
  });

  eventSource.onerror = (err) => {
    if (onError) onError(err);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}
