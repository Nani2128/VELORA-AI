export type GenerationType = 
  | 'TEXT_TO_IMAGE' 
  | 'IMAGE_TO_IMAGE' 
  | 'IMAGE_TO_VIDEO' 
  | 'TEXT_TO_VIDEO'
  | 'TEXT_TO_MUSIC';

export type GenerationStatus = 
  | 'IDLE' 
  | 'PREPARING' 
  | 'QUEUED' 
  | 'PROCESSING' 
  | 'FINALIZING' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'CANCELLED';

export type AssetType = 'IMAGE' | 'VIDEO' | 'AUDIO';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '21:9';

export type CameraMovement = 'STATIC' | 'ORBIT' | 'PAN_LEFT' | 'PAN_RIGHT' | 'ZOOM_IN' | 'ZOOM_OUT' | 'CRANE';

export type VisualStyle = 'CINEMATIC' | 'PHOTOREALISTIC' | 'ANIME_STYLIZED' | 'ANALOG_FILM' | 'CONCEPT_ART';

export interface GenerationSettings {
  aspectRatio: AspectRatio;
  durationSeconds: number; // 4, 8, 16 for video
  quality: 'STANDARD' | 'ULTRA_HD';
  motionStrength: number; // 1 - 10
  cameraMovement: CameraMovement;
  style: VisualStyle;
  seed?: number;
  negativePrompt?: string;
  fps: 24 | 30 | 60;
  steps: number; // e.g. 30, 50
  enhancePrompt: boolean;
}

export interface MediaAsset {
  id: string;
  type: AssetType;
  title: string;
  prompt: string;
  url?: string;
  thumbnailUrl?: string;
  aspectRatio: AspectRatio;
  duration?: number;
  width?: number;
  height?: number;
  fileSize?: string;
  format: string;
  createdAt: string;
  favorite?: boolean;
  projectId?: string;
  gradientTheme?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  coverGradient: string;
  assetCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface GenerationRecord {
  id: string;
  type: GenerationType;
  prompt: string;
  status: GenerationStatus;
  inputAsset?: {
    id: string;
    name: string;
    previewUrl: string;
    fileSize: string;
  };
  outputAsset?: MediaAsset;
  settings: GenerationSettings;
  createdAt: string;
  completedAt?: string;
  progressMessage?: string;
  error?: string;
  errorCode?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  tier: 'Creator Pro' | 'Studio Enterprise' | 'Free Exploration';
  avatarInitials: string;
}

export interface ToastNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
}

// ============================================================
// PHASE 03 TYPES: MODEL REGISTRY, CHAT, & SOURCES
// ============================================================

export type ThemeMode = 'light' | 'dark';

export interface ModelDescriptor {
  id: string;
  name: string;
  provider: 'google' | 'flux' | 'stability' | string;
  providerName: string;
  type: 'image' | 'video' | 'chat';
  capabilities: string[];
  supports_text_to_image: boolean;
  supports_image_to_image: boolean;
  supports_inpainting: boolean;
  supports_negative_prompt: boolean;
  supports_aspect_ratio: boolean;
  supports_seed: boolean;
  supports_steps: boolean;
  supports_guidance: boolean;
  availability: 'available' | 'configured' | 'unconfigured' | 'unavailable';
  configuration_status: {
    configured: boolean;
    endpoint?: string;
    notes?: string;
  };
  description?: string;
  family?: 'gemini' | 'flux' | 'sdxl' | 'sd35' | 'openai' | 'grok' | 'veo';
  costClass?: string;
  latencyClass?: string;
  cooldownSeconds?: number;
  reason?: string;
  isRecommended?: boolean;
  supports_async?: boolean;
  modalities?: string[];
  inputTypes?: string[];
  outputTypes?: string[];
  supportsTextToImage?: boolean;
  supportsImageToImage?: boolean;
  supportsTextToVideo?: boolean;
  supportsImageToVideo?: boolean;
  supportsEditing?: boolean;
}

export interface ProviderHealth {
  id: string;
  name: string;
  status: 'healthy' | 'unconfigured' | 'error';
  endpoint?: string;
  models: string[];
  message?: string;
}

export interface ChatSource {
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

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: ChatSource[];
  searchQueries?: string[];
  createdAt: string;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  webSearchEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  messages?: ChatMessage[];
}

