/**
 * VELORA AI — Video Provider Interface & Abstraction
 */

export type VideoCapability =
  | 'TEXT_TO_VIDEO'
  | 'IMAGE_TO_VIDEO'
  | 'REFERENCE_TO_VIDEO'
  | 'VIDEO_EDIT'
  | 'VIDEO_EXTENSION';

export interface VideoGenerationSettings {
  aspectRatio?: '16:9' | '9:16' | '1:1';
  durationSeconds?: number;
  quality?: string;
  fps?: number;
  motionStrength?: number;
  cameraMovement?: string;
}

export interface VideoProviderResult {
  success: boolean;
  operationId?: string;
  isAsync?: boolean;
  asset?: {
    storageKey: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface VideoProvider {
  id: string;
  name: string;
  isConfigured(): boolean;
  health(): Promise<{ status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE'; latencyMs?: number; error?: string }>;
  supports(capability: VideoCapability): boolean;
  generate(
    prompt: string,
    settings: VideoGenerationSettings,
    inputBuffer?: Buffer,
    inputMimeType?: string
  ): Promise<VideoProviderResult>;
  getStatus?(operationId: string): Promise<{ status: 'QUEUED' | 'PROCESSING' | 'FINALIZING' | 'COMPLETED' | 'FAILED'; assetUrl?: string; error?: string }>;
  cancel?(operationId: string): Promise<boolean>;
}
