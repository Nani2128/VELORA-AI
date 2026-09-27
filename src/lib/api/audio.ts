import { apiFetch } from './client';

export interface TranscriptionResponse {
  success: boolean;
  model: string;
  text: string;
}

export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');

  return apiFetch<TranscriptionResponse>('/api/v1/audio/transcribe', {
    method: 'POST',
    body: formData,
  });
}
