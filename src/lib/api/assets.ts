import { apiFetch } from './client';

export interface UploadedAsset {
  id: string;
  user_id: string;
  project_id: string | null;
  type: string;
  source: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export async function uploadAsset(file: File, projectId?: string): Promise<UploadedAsset> {
  const formData = new FormData();
  formData.append('file', file);
  if (projectId) {
    formData.append('project_id', projectId);
  }

  return apiFetch<UploadedAsset>('/api/v1/assets/upload', {
    method: 'POST',
    body: formData,
  });
}

// Alias for VideoGeneratorPage and other components
export const uploadAssetFile = uploadAsset;

