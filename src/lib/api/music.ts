import { apiFetch } from './client';

export interface MusicGenerationResponse {
  id: string;
  model: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
  url: string;
  duration_seconds: number;
  lyrics?: string;
  created_at: string;
}

export async function generateMusic(
  prompt: string,
  model: 'lyria-3-clip-preview' | 'lyria-3-pro-preview' = 'lyria-3-clip-preview',
  imageFile?: File,
  projectId?: string
): Promise<MusicGenerationResponse> {
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('model', model);
  if (imageFile) {
    formData.append('image', imageFile);
  }
  if (projectId) {
    formData.append('project_id', projectId);
  }

  return apiFetch<MusicGenerationResponse>('/api/v1/music/generate', {
    method: 'POST',
    body: formData,
  });
}
