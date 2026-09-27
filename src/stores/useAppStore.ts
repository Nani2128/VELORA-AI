import { create } from 'zustand';
import { 
  GenerationType, 
  GenerationStatus, 
  GenerationSettings, 
  MediaAsset, 
  Project, 
  GenerationRecord, 
  UserProfile, 
  ToastNotification,
  AspectRatio,
  ThemeMode,
  ModelDescriptor
} from '../types';
import { soundManager } from '../lib/sound';
import { triggerHaptic } from '../lib/haptics';
import { 
  createGeneration as apiCreateGeneration, 
  cancelGeneration as apiCancelGeneration,
  retryGeneration as apiRetryGeneration,
  subscribeToGenerationEvents,
  GenerationStatusEventData
} from '../lib/api/generations';
import { fetchProjects, createProject as apiCreateProject, updateProject as apiUpdateProject, deleteProject as apiDeleteProject } from '../lib/api/projects';
import { fetchLibraryAssets } from '../lib/api/library';
import { fetchGenerationHistory } from '../lib/api/history';
import { fetchModels } from '../lib/api/models';


interface AppState {
  // Navigation & Routing
  currentPath: string;
  navigate: (path: string) => void;

  // User
  user: UserProfile;

  // Studio Workspace
  generationType: GenerationType;
  setGenerationType: (type: GenerationType) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  negativePrompt: string;
  setNegativePrompt: (neg: string) => void;
  uploadedImage: {
    id: string;
    name: string;
    previewUrl: string;
    fileSize: string;
    assetId?: string;
    width?: number;
    height?: number;
  } | null;
  setUploadedImage: (img: AppState['uploadedImage']) => void;
  settings: GenerationSettings;
  updateSettings: (partial: Partial<GenerationSettings>) => void;
  
  // Real UI State Machine
  status: GenerationStatus;
  statusMessage: string;
  currentResult: MediaAsset | null;
  activeGenerationId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startGeneration: () => Promise<void>;
  cancelGeneration: () => Promise<void>;
  resetGeneration: () => void;
  retryGeneration: (generationId?: string) => Promise<void>;

  // Projects
  projects: Project[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<void>;
  renameProject: (id: string, newName: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Library
  assets: MediaAsset[];
  assetFilter: 'ALL' | 'IMAGE' | 'VIDEO';
  setAssetFilter: (filter: 'ALL' | 'IMAGE' | 'VIDEO') => void;
  assetSearch: string;
  setAssetSearch: (query: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  loadLibrary: () => Promise<void>;
  toggleFavorite: (assetId: string) => void;
  deleteAsset: (assetId: string) => void;

  // History
  history: GenerationRecord[];
  loadHistory: () => Promise<void>;
  clearHistory: () => void;
  loadHistoryIntoStudio: (record: GenerationRecord) => void;

  // UI States & Preferences
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileSettingsOpen: boolean;
  setMobileSettingsOpen: (open: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
  isLiveVoiceOpen: boolean;
  setIsLiveVoiceOpen: (open: boolean) => void;

  // Model Registry
  models: ModelDescriptor[];
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  loadModels: () => Promise<void>;
  
  // Toasts
  toasts: ToastNotification[];
  addToast: (toast: Omit<ToastNotification, 'id'>) => void;
  removeToast: (id: string) => void;
}

const INITIAL_SETTINGS: GenerationSettings = {
  aspectRatio: '16:9',
  durationSeconds: 8,
  quality: 'ULTRA_HD',
  motionStrength: 6,
  cameraMovement: 'ORBIT',
  style: 'CINEMATIC',
  fps: 24,
  steps: 40,
  enhancePrompt: true,
};

let eventSourceCleanup: (() => void) | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  currentPath: typeof window !== 'undefined' ? (window.location.pathname === '/' ? '/' : window.location.pathname) : '/',
  navigate: (path: string) => {
    soundManager.play('click');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
    set({ currentPath: path });
  },

  // User profile
  user: {
    id: 'user-001',
    name: 'Elena Rostova',
    email: 'elena@velora.ai',
    tier: 'Creator Pro',
    avatarInitials: 'ER',
  },

  // Creation Workspace state
  generationType: 'TEXT_TO_IMAGE',
  setGenerationType: (type) => {
    soundManager.play('click');
    set({ generationType: type });
  },
  prompt: '',
  setPrompt: (prompt) => set({ prompt }),
  negativePrompt: '',
  setNegativePrompt: (neg) => set({ negativePrompt: neg }),
  uploadedImage: null,
  setUploadedImage: (img) => set({ uploadedImage: img }),
  settings: INITIAL_SETTINGS,
  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  // UI State Machine for Creation
  status: 'IDLE',
  statusMessage: 'Ready to create',
  currentResult: null,
  activeGenerationId: null,
  errorCode: null,
  errorMessage: null,

  startGeneration: async () => {
    const { prompt, generationType, settings, uploadedImage, activeProjectId, addToast, loadHistory, loadLibrary } = get();

    if (!prompt.trim() && generationType !== 'IMAGE_TO_IMAGE') {
      addToast({
        type: 'warning',
        title: 'Prompt required',
        message: 'Please describe the scene, motion, or subject you wish to create.',
      });
      return;
    }

    if ((generationType === 'IMAGE_TO_IMAGE' || generationType === 'IMAGE_TO_VIDEO') && !uploadedImage) {
      addToast({
        type: 'warning',
        title: 'Source image required',
        message: `Upload an image to use with ${generationType.replace(/_/g, ' ')}.`,
      });
      return;
    }

    // Clean up previous event stream
    if (eventSourceCleanup) {
      eventSourceCleanup();
      eventSourceCleanup = null;
    }

    soundManager.play('generation_start');
    triggerHaptic('medium');

    set({
      status: 'PREPARING',
      statusMessage: 'Submitting directives to creative generation engine...',
      errorCode: null,
      errorMessage: null,
      currentResult: null,
    });

    try {
      // Real backend API submission
      const generation = await apiCreateGeneration({
        type: generationType,
        model: get().selectedModelId,
        prompt: prompt.trim(),
        negative_prompt: settings.negativePrompt,
        input_asset_id: uploadedImage?.assetId,
        project_id: activeProjectId || undefined,
        enhance_prompt: settings.enhancePrompt,
        settings: {
          aspect_ratio: settings.aspectRatio,
          duration: settings.durationSeconds,
          quality: settings.quality,
          motion_strength: settings.motionStrength,
          camera_movement: settings.cameraMovement,
          style: settings.style,
          fps: settings.fps,
        },
      });

      set({
        activeGenerationId: generation.id,
        status: 'QUEUED',
        statusMessage: 'Enqueued in pipeline. Waiting for worker capacity...',
      });

      // Subscribe to real-time Server-Sent Events
      eventSourceCleanup = subscribeToGenerationEvents(
        generation.id,
        (event: GenerationStatusEventData) => {
          if (event.status === 'PROCESSING') {
            set({
              status: 'PROCESSING',
              statusMessage: generationType.includes('VIDEO')
                ? 'Synthesizing temporal latent frames and camera motion vectors with Veo...'
                : 'Evaluating diffusion denoise schedule and spatial coherence with Gemini...',
            });
          } else if (event.status === 'FINALIZING') {
            set({
              status: 'FINALIZING',
              statusMessage: 'Finalizing visual assets, encoding media, and indexing...',
            });
          } else if (event.status === 'COMPLETED') {
            const isVideo = generationType.includes('VIDEO');
            const mediaResult: MediaAsset = {
              id: event.output_asset_id || 'asset-' + Date.now(),
              type: isVideo ? 'VIDEO' : 'IMAGE',
              title: prompt.slice(0, 36).trim() || 'Studio Creation',
              prompt: prompt,
              url: event.output_url || undefined,
              aspectRatio: settings.aspectRatio,
              duration: isVideo ? settings.durationSeconds : undefined,
              format: isVideo ? 'MP4 / 720p' : 'PNG / 1K',
              createdAt: 'Just now',
              favorite: false,
              gradientTheme: isVideo 
                ? 'from-amber-600/30 via-slate-900 to-slate-950'
                : 'from-violet-700/30 via-slate-900 to-slate-950',
            };

            soundManager.play('generation_complete');
            triggerHaptic('success');

            set((state) => ({
              status: 'COMPLETED',
              statusMessage: 'Creation ready in studio viewport.',
              currentResult: mediaResult,
              assets: [mediaResult, ...state.assets],
            }));

            addToast({
              type: 'success',
              title: 'Creation Complete',
              message: `${isVideo ? 'Video' : 'Image'} rendered and available in studio viewport.`,
            });

            // Refresh history and library in background
            loadHistory();
            loadLibrary();
          } else if (event.status === 'FAILED') {
            soundManager.play('error');
            triggerHaptic('warning');
            const errCode = event.error?.code || 'GENERATION_FAILED';
            const errMsg = event.error?.message || 'Generation failed to complete.';

            set({
              status: 'FAILED',
              statusMessage: 'Generation could not be completed.',
              errorCode: errCode,
              errorMessage: errMsg,
            });

            let toastMsg = errMsg;
            if (errCode === 'PROVIDER_RATE_LIMITED') {
              toastMsg = 'API quota or rate limit reached. Please retry in a few moments.';
            } else if (errCode === 'PROVIDER_SAFETY_REJECTED') {
              toastMsg = 'Prompt triggered safety filters. Please refine the scene description.';
            }

            addToast({
              type: 'error',
              title: 'Generation Failed',
              message: toastMsg,
            });
          } else if (event.status === 'CANCELLED') {
            set({
              status: 'CANCELLED',
              statusMessage: 'Generation was cancelled.',
            });
          }
        },
        (sseErr) => {
          console.warn('SSE stream disconnected:', sseErr);
        }
      );
    } catch (apiErr: any) {
      soundManager.play('error');
      triggerHaptic('warning');
      const errCode = apiErr.code || 'REQUEST_FAILED';
      const errMsg = apiErr.message || 'Failed to submit generation request.';

      set({
        status: 'FAILED',
        statusMessage: 'Could not dispatch generation request.',
        errorCode: errCode,
        errorMessage: errMsg,
      });

      addToast({
        type: 'error',
        title: 'Submission Failed',
        message: errMsg,
      });
    }
  },

  cancelGeneration: async () => {
    const { activeGenerationId } = get();
    if (eventSourceCleanup) {
      eventSourceCleanup();
      eventSourceCleanup = null;
    }

    soundManager.play('error');
    triggerHaptic('warning');

    if (activeGenerationId) {
      try {
        await apiCancelGeneration(activeGenerationId);
      } catch (e) {
        console.warn('Cancel API error:', e);
      }
      set({
        status: 'CANCELLED',
        statusMessage: 'Generation cancelled by user.',
      });
    } else {
      set({ status: 'IDLE', statusMessage: 'Ready to create' });
    }
  },

  retryGeneration: async (genId?: string) => {
    const targetId = genId || get().activeGenerationId;
    if (!targetId) {
      get().startGeneration();
      return;
    }
    try {
      await apiRetryGeneration(targetId);
      set({
        status: 'QUEUED',
        statusMessage: 'Retrying generation in pipeline...',
        errorCode: null,
        errorMessage: null,
      });
    } catch (err: any) {
      get().startGeneration();
    }
  },

  resetGeneration: () => {
    if (eventSourceCleanup) {
      eventSourceCleanup();
      eventSourceCleanup = null;
    }
    set({
      status: 'IDLE',
      statusMessage: 'Ready to create',
      currentResult: null,
      activeGenerationId: null,
      errorCode: null,
      errorMessage: null,
    });
  },

  // Projects
  projects: [],
  activeProjectId: null,
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  loadProjects: async () => {
    try {
      const data = await fetchProjects();
      const formatted: Project[] = data.map((p, idx) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        coverGradient: idx % 2 === 0 
          ? 'from-violet-950 via-slate-900 to-indigo-950'
          : 'from-amber-950 via-stone-900 to-zinc-950',
        assetCount: p.asset_count || 0,
        updatedAt: new Date(p.updated_at).toLocaleDateString(),
        createdAt: new Date(p.created_at).toLocaleDateString(),
      }));
      set({ projects: formatted });
    } catch (err) {
      console.warn('Failed to load projects from API:', err);
    }
  },
  createProject: async (name, description = '') => {
    try {
      const p = await apiCreateProject(name, description);
      soundManager.play('generation_complete');
      triggerHaptic('success');
      const newProj: Project = {
        id: p.id,
        name: p.name,
        description: p.description || '',
        coverGradient: 'from-violet-950 via-slate-900 to-indigo-950',
        assetCount: 0,
        updatedAt: 'Just now',
        createdAt: 'Just now',
      };
      set((state) => ({ projects: [newProj, ...state.projects] }));
      get().addToast({
        type: 'success',
        title: 'Project Created',
        message: `Project "${name}" is ready for asset collection.`,
      });
    } catch (err: any) {
      get().addToast({ type: 'error', title: 'Error', message: err.message });
    }
  },
  renameProject: async (id, newName) => {
    try {
      await apiUpdateProject(id, { name: newName });
      soundManager.play('click');
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, name: newName, updatedAt: 'Just now' } : p
        ),
      }));
      get().addToast({
        type: 'info',
        title: 'Project Updated',
        message: `Renamed to "${newName}".`,
      });
    } catch (err: any) {
      get().addToast({ type: 'error', title: 'Error', message: err.message });
    }
  },
  deleteProject: async (id) => {
    try {
      await apiDeleteProject(id);
      soundManager.play('click');
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
      }));
      get().addToast({
        type: 'info',
        title: 'Project Removed',
        message: 'Project collection deleted.',
      });
    } catch (err: any) {
      get().addToast({ type: 'error', title: 'Error', message: err.message });
    }
  },

  // Library
  assets: [],
  assetFilter: 'ALL',
  setAssetFilter: (filter) => {
    soundManager.play('click');
    set({ assetFilter: filter });
  },
  assetSearch: '',
  setAssetSearch: (query) => set({ assetSearch: query }),
  viewMode: 'grid',
  setViewMode: (mode) => {
    soundManager.play('click');
    set({ viewMode: mode });
  },
  loadLibrary: async () => {
    try {
      const data = await fetchLibraryAssets();
      const formatted: MediaAsset[] = data.map((a) => ({
        id: a.id,
        type: a.type,
        title: (a.metadata?.prompt || 'Studio Asset').slice(0, 36),
        prompt: a.metadata?.prompt || '',
        url: a.url,
        thumbnailUrl: a.thumbnail_url || a.url,
        aspectRatio: '16:9',
        duration: a.duration_seconds || undefined,
        format: a.type === 'VIDEO' ? 'MP4 / 720p' : 'PNG / 1K',
        createdAt: new Date(a.created_at).toLocaleDateString(),
        favorite: false,
        projectId: a.project_id || undefined,
        gradientTheme: a.type === 'VIDEO'
          ? 'from-amber-600/30 via-slate-900 to-slate-950'
          : 'from-violet-700/30 via-slate-900 to-slate-950',
      }));
      set({ assets: formatted });
    } catch (err) {
      console.warn('Failed to load library assets:', err);
    }
  },
  toggleFavorite: (assetId) => {
    soundManager.play('click');
    triggerHaptic('light');
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === assetId ? { ...a, favorite: !a.favorite } : a
      ),
    }));
  },
  deleteAsset: (assetId) => {
    soundManager.play('click');
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== assetId),
    }));
    get().addToast({
      type: 'info',
      title: 'Asset Deleted',
      message: 'Asset removed from studio library.',
    });
  },

  // History
  history: [],
  loadHistory: async () => {
    try {
      const data = await fetchGenerationHistory();
      const formatted: GenerationRecord[] = data.map((g) => ({
        id: g.id,
        type: g.type,
        prompt: g.prompt,
        status: g.status,
        createdAt: new Date(g.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        completedAt: g.completed_at ? new Date(g.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
        settings: {
          aspectRatio: (g.settings?.aspect_ratio as AspectRatio) || '16:9',
          durationSeconds: g.settings?.duration || 8,
          quality: g.settings?.quality || 'ULTRA_HD',
          motionStrength: g.settings?.motion_strength || 6,
          cameraMovement: g.settings?.camera_movement || 'STATIC',
          style: g.settings?.style || 'CINEMATIC',
          fps: g.settings?.fps || 24,
          steps: 40,
          enhancePrompt: false,
        },
        outputAsset: g.output_asset ? {
          id: g.output_asset.id,
          type: g.output_asset.type,
          title: g.prompt.slice(0, 32),
          prompt: g.prompt,
          url: g.output_asset.url,
          aspectRatio: (g.settings?.aspect_ratio as AspectRatio) || '16:9',
          format: g.output_asset.type === 'VIDEO' ? 'MP4 / 720p' : 'PNG / 1K',
          createdAt: new Date(g.created_at).toLocaleDateString(),
        } : undefined,
        error: g.error_message || undefined,
        errorCode: g.error_code || undefined,
      }));
      set({ history: formatted });
    } catch (err) {
      console.warn('Failed to load history:', err);
    }
  },
  clearHistory: () => {
    soundManager.play('click');
    set({ history: [] });
    get().addToast({
      type: 'info',
      title: 'History Cleared',
      message: 'Pipeline activity logs cleared.',
    });
  },
  loadHistoryIntoStudio: (record) => {
    soundManager.play('click');
    set({
      prompt: record.prompt,
      generationType: record.type,
      settings: record.settings,
      status: record.status,
      currentResult: record.outputAsset || null,
      activeGenerationId: record.id,
    });
    get().navigate('/app/create');
    get().addToast({
      type: 'info',
      title: 'Parameters Loaded',
      message: 'Loaded historical prompt and settings into studio workspace.',
    });
  },

  // UI preferences
  theme: typeof window !== 'undefined' ? ((localStorage.getItem('velora_theme') as ThemeMode) || 'light') : 'light',
  setTheme: (theme: ThemeMode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('velora_theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
      document.documentElement.setAttribute('data-theme', theme);
    }
    set({ theme });
  },
  toggleTheme: () => {
    soundManager.play('click');
    const nextTheme: ThemeMode = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(nextTheme);
  },
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  mobileSettingsOpen: false,
  setMobileSettingsOpen: (open) => set({ mobileSettingsOpen: open }),
  soundEnabled: false,
  setSoundEnabled: (enabled) => {
    soundManager.setEnabled(enabled);
    set({ soundEnabled: enabled });
  },
  reducedMotion: false,
  setReducedMotion: (enabled) => set({ reducedMotion: enabled }),
  isLiveVoiceOpen: false,
  setIsLiveVoiceOpen: (open) => set({ isLiveVoiceOpen: open }),

  // Model Registry
  models: [],
  selectedModelId: 'gemini-3.1-flash-image-preview',
  setSelectedModelId: (id: string) => {
    soundManager.play('click');
    set({ selectedModelId: id });
  },
  loadModels: async () => {
    try {
      const models = await fetchModels();
      set({ models });
    } catch (err) {
      console.warn('Failed to fetch models:', err);
    }
  },

  // Toasts
  toasts: [],
  addToast: (toast) => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newToast: ToastNotification = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    const duration = toast.duration ?? 4500;
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

