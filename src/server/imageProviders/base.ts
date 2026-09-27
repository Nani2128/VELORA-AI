export interface ProviderGenerationResult {
  success: boolean;
  asset?: {
    storageKey: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    durationSeconds?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ProviderHealthStatus {
  status: 'healthy' | 'unconfigured' | 'error';
  endpoint?: string;
  message?: string;
}

export interface ImageProvider {
  readonly id: string;
  readonly name: string;
  readonly providerType: 'cloud' | 'self_hosted' | 'open_source';

  generate(
    prompt: string,
    settings: {
      aspectRatio?: string;
      seed?: number;
      steps?: number;
      guidance?: number;
      negativePrompt?: string;
      model?: string;
    }
  ): Promise<ProviderGenerationResult>;

  edit?(
    prompt: string,
    imageBuffer: Buffer,
    settings: {
      aspectRatio?: string;
      model?: string;
    }
  ): Promise<ProviderGenerationResult>;

  health(): Promise<ProviderHealthStatus>;

  supports(feature: 'text_to_image' | 'image_to_image' | 'inpainting' | 'negative_prompt' | 'aspect_ratio' | 'seed' | 'steps' | 'guidance'): boolean;

  capabilities(): string[];
}
