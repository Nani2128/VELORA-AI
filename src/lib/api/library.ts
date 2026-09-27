import { apiFetch } from './client';

export interface LibraryAsset {
  id: string;
  user_id: string;
  project_id: string | null;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO';
  source: 'UPLOAD' | 'GENERATED' | 'EDITED';
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds?: number | null;
  url: string;
  thumbnail_url?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export async function fetchLibraryAssets(params?: {
  type?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}): Promise<LibraryAsset[]> {
  const query = new URLSearchParams();
  if (params?.type && params.type !== 'ALL') query.set('type', params.type);
  if (params?.projectId) query.set('project_id', params.projectId);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));

  const qs = query.toString();
  return apiFetch<LibraryAsset[]>(`/api/v1/library${qs ? `?${qs}` : ''}`);
}
