import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { uploadAssetFile } from '../lib/api/assets';
import { enhancePrompt as apiEnhancePrompt } from '../lib/api/generations';
import { transcribeAudio } from '../lib/api/audio';
import { 
  Film, 
  Upload, 
  Sparkles, 
  Video, 
  RotateCcw, 
  Download, 
  Play, 
  Check, 
  AlertCircle, 
  Sliders, 
  Layers, 
  ArrowRight,
  RefreshCw,
  Compass,
  Eye,
  Info,
  Mic,
  Square
} from 'lucide-react';
import { Button } from '../components/ui/Button';

// Sample starter photos for instant 1-click testing
const SAMPLE_PHOTOS = [
  {
    id: 'sample-1',
    name: 'Cyberpunk Neon Alley',
    url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=800&q=80',
    prompt: 'Add falling rain ripples on neon pavement, pulsing holographic signs, and cinematic slow forward dolly.',
  },
  {
    id: 'sample-2',
    name: 'Alpine Mountain Mist',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
    prompt: 'Gentle morning fog rolling over jagged peaks, dramatic sunbeams breaking through clouds, drone flythrough.',
  },
  {
    id: 'sample-3',
    name: 'Futuristic Astral Explorer',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    prompt: 'Cosmic nebula swirling in deep space with glowing cosmic dust particles drifting past the visor.',
  },
  {
    id: 'sample-4',
    name: 'Golden Hour Ocean Shore',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    prompt: 'Ocean waves crashing gently on sandy shore with shimmering reflections and warm golden breeze.',
  },
];

const MOTION_PRESETS = [
  { label: 'Drone Orbit', promptSuffix: ', cinematic high-angle orbital drone movement with smooth 360 degree rotation' },
  { label: 'Slow Push-In', promptSuffix: ', cinematic slow camera push-in focusing closely on key foreground details' },
  { label: 'Atmospheric Drift', promptSuffix: ', dreamy atmospheric particle drift with ambient soft wind motion' },
  { label: 'Hyperlapse', promptSuffix: ', high-speed hyperlapse motion with dynamic shadows and clouds flowing overhead' },
  { label: 'Crane Rise', promptSuffix: ', majestic vertical crane rise revealing breathtaking expansive scale' },
];

export const VideoGeneratorPage: React.FC = () => {
  const { 
    setGenerationType, 
    startGeneration, 
    status, 
    statusMessage, 
    currentResult, 
    prompt, 
    setPrompt, 
    settings, 
    updateSettings, 
    uploadedImage, 
    setUploadedImage,
    setSelectedModelId,
    cancelGeneration,
    addToast,
    errorCode,
    errorMessage,
    retryGeneration,
    resetGeneration,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'animate' | 'text'>('animate');
  const [isUploading, setIsUploading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);

  // Set default mode and ensure Veo 3.1 Fast model is active
  useEffect(() => {
    setSelectedModelId('veo-3.1-fast-generate-preview');
    if (activeTab === 'animate') {
      setGenerationType('IMAGE_TO_VIDEO');
    } else {
      setGenerationType('TEXT_TO_VIDEO');
    }
  }, [activeTab, setGenerationType, setSelectedModelId]);

  // Handle direct file upload from user
  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast({
        type: 'error',
        title: 'Unsupported File',
        message: 'Please select a valid image file (JPEG, PNG, or WebP).',
      });
      return;
    }

    setIsUploading(true);
    try {
      const asset = await uploadAssetFile(file);
      setUploadedImage({
        id: asset.id,
        name: file.name,
        previewUrl: asset.url || URL.createObjectURL(file),
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        assetId: asset.id,
      });

      addToast({
        type: 'success',
        title: 'Photo Uploaded',
        message: `Ready to animate "${file.name}" with Veo 3.`,
      });
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      // Fallback preview
      setUploadedImage({
        id: 'local-' + Date.now(),
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle selecting a sample photo
  const handleSelectSample = async (sample: typeof SAMPLE_PHOTOS[0]) => {
    try {
      setIsUploading(true);
      const res = await fetch(sample.url);
      const blob = await res.blob();
      const file = new File([blob], `${sample.id}.jpg`, { type: 'image/jpeg' });
      const asset = await uploadAssetFile(file);

      setUploadedImage({
        id: asset.id,
        name: sample.name,
        previewUrl: asset.url || sample.url,
        fileSize: 'Sample HD Photo',
        assetId: asset.id,
      });
      if (!prompt) {
        setPrompt(sample.prompt);
      }
    } catch {
      // Local fallback
      setUploadedImage({
        id: sample.id,
        name: sample.name,
        previewUrl: sample.url,
        fileSize: 'Sample HD Photo',
      });
      if (!prompt) {
        setPrompt(sample.prompt);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Enhance prompt with Gemini
  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const enhanced = await apiEnhancePrompt(prompt, 'IMAGE_TO_VIDEO');
      setPrompt(enhanced);
      addToast({
        type: 'info',
        title: 'Prompt Enhanced',
        message: 'Cinematic camera directive synthesized with Gemini.',
      });
    } catch (err) {
      console.warn('Enhance prompt fallback:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Voice dictation using gemini-3.5-transcribe
  const handleToggleVoiceDictate = async () => {
    if (isVoiceRecording) {
      if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
        voiceRecorderRef.current.stop();
      }
      setIsVoiceRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      voiceRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        addToast({
          type: 'info',
          title: 'Transcribing Voice',
          message: 'Transcribing speech with gemini-3.5-transcribe...',
        });
        try {
          const res = await transcribeAudio(blob);
          if (res.text) {
            setPrompt(prompt ? `${prompt.trim()} ${res.text}` : res.text);
            addToast({
              type: 'success',
              title: 'Voice Transcribed',
              message: 'Appended speech prompt via gemini-3.5-transcribe.',
            });
          }
        } catch (err: any) {
          addToast({
            type: 'error',
            title: 'Transcription Error',
            message: err?.message || 'Could not transcribe voice.',
          });
        }
      };

      mediaRecorder.start();
      setIsVoiceRecording(true);
      addToast({
        type: 'info',
        title: 'Microphone Active',
        message: 'Speak your video directive... Click mic again to stop.',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Microphone Error',
        message: 'Could not access microphone.',
      });
    }
  };

  const isGenerating = ['PREPARING', 'QUEUED', 'PROCESSING', 'FINALIZING'].includes(status);

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in pb-12">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider font-mono-numbers">
              Veo 3 Neural Motion Studio
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
              Model: veo-3.1-fast-generate-preview
            </span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mt-0.5">
            Animate Photos into Cinematic Video
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Transform still photography and text into temporal latent video sequences using Google Veo (veo-3.1-fast-generate-preview).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('animate')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'animate'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Animate Photo (Veo 3)</span>
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'text'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Text to Video</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Directing & Settings (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Photo Uploader (When in Animate Mode) */}
          {activeTab === 'animate' && (
            <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2">
                  <Film className="w-4 h-4 text-amber-400" />
                  <span>1. Upload Starting Photo</span>
                </label>
                {uploadedImage && (
                  <button
                    onClick={() => setUploadedImage(null)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    Clear Photo
                  </button>
                )}
              </div>

              {/* Upload Drop Area or Image Card */}
              {uploadedImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-amber-500/30 bg-black/40 group">
                  <img
                    src={uploadedImage.previewUrl}
                    alt={uploadedImage.name}
                    className="w-full max-h-72 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <p className="text-xs font-bold text-white truncate max-w-xs">{uploadedImage.name}</p>
                        <p className="text-[10px] text-amber-300 font-mono-numbers">{uploadedImage.fileSize}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs bg-black/60 border-white/20 hover:bg-black/80 text-white"
                      >
                        Change Photo
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
                  }}
                  className={`w-full p-8 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] hover:border-amber-500/40 bg-[var(--bg-surface-elevated)]/40 hover:bg-amber-500/[0.03] transition-all flex flex-col items-center justify-center text-center cursor-pointer group ${
                    isUploading ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    Drop your photo here or browse
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
                    Upload any portrait, landscape, architectural, or abstract image (.jpg, .png, .webp).
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                }}
              />

              {/* Preset Sample Gallery */}
              <div>
                <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
                  Or select a starter photo:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SAMPLE_PHOTOS.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => handleSelectSample(sample)}
                      className="group relative rounded-xl overflow-hidden border border-[var(--border-subtle)] hover:border-amber-500/40 aspect-video transition-all cursor-pointer text-left"
                    >
                      <img
                        src={sample.url}
                        alt={sample.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors p-1.5 flex items-end">
                        <span className="text-[10px] font-semibold text-white truncate drop-shadow-md">
                          {sample.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Prompt Composer & Motion Directives */}
          <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>2. Animation & Camera Motion Directives</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleVoiceDictate}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer font-semibold ${
                    isVoiceRecording
                      ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                      : 'border-[var(--border-subtle)] hover:border-amber-500/40 text-slate-300 hover:text-amber-400'
                  }`}
                  title={isVoiceRecording ? 'Stop recording' : 'Dictate with microphone (gemini-3.5-transcribe)'}
                >
                  {isVoiceRecording ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{isVoiceRecording ? 'Recording...' : 'Dictate'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleEnhancePrompt}
                  disabled={!prompt.trim() || isEnhancing}
                  className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-40 flex items-center gap-1 cursor-pointer font-semibold"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isEnhancing ? 'animate-spin' : ''}`} />
                  <span>{isEnhancing ? 'Enhancing...' : 'Enhance'}</span>
                </button>
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                activeTab === 'animate'
                  ? 'Describe camera motion, temporal changes, and atmospheric details (e.g. "Slow drone orbit, golden sunlight filtering through leaves, gentle breeze causing water reflections")...'
                  : 'Describe the complete cinematic scene you want to synthesize from scratch...'
              }
              rows={3}
              className="w-full p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/50 resize-none"
            />

            {/* Quick Motion Presets */}
            <div>
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-2">
                Quick Camera Motions:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {MOTION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      if (!prompt.includes(preset.label)) {
                        setPrompt(`${prompt ? prompt.trim() : 'Cinematic sequence'}${preset.promptSuffix}`);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--border-subtle)] hover:border-amber-500/40 bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cinematography & Aspect Ratio Settings */}
          <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>3. Veo Cinematography Parameters</span>
              </label>
              <span className="text-xs font-mono-numbers text-amber-400">
                Model: veo-3 (720p HD)
              </span>
            </div>

            {/* Aspect Ratio Options */}
            <div className="flex flex-col gap-2">
              <span className="text-xs text-[var(--text-muted)] font-medium">Aspect Ratio:</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateSettings({ aspectRatio: '16:9' })}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    settings.aspectRatio === '16:9'
                      ? 'border-amber-500/50 bg-amber-500/10 text-white font-semibold shadow-xs'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className={`w-7 h-4 border-2 rounded-xs ${settings.aspectRatio === '16:9' ? 'border-amber-400' : 'border-slate-500'}`} />
                  <div className="text-left">
                    <span className="text-xs font-bold block">16:9 Landscape</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Cinematic Widescreen / YouTube</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => updateSettings({ aspectRatio: '9:16' })}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    settings.aspectRatio === '9:16'
                      ? 'border-amber-500/50 bg-amber-500/10 text-white font-semibold shadow-xs'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className={`w-4 h-7 border-2 rounded-xs ${settings.aspectRatio === '9:16' ? 'border-amber-400' : 'border-slate-500'}`} />
                  <div className="text-left">
                    <span className="text-xs font-bold block">9:16 Vertical</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Reels, Shorts & TikTok</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Submit Generation Action */}
            <div className="pt-2">
              <Button
                size="lg"
                variant="primary"
                onClick={startGeneration}
                isLoading={isGenerating}
                leftIcon={<Film className="w-5 h-5" />}
                className="w-full shadow-lg shadow-amber-500/20 text-sm font-bold py-3.5"
              >
                {activeTab === 'animate'
                  ? 'Animate Photo with Veo 3'
                  : 'Synthesize Video with Veo 3'}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Viewport & Generated Result (5 cols) */}
        <div className="lg:col-span-5 sticky top-20 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Video Output Canvas</span>
            </span>

            {currentResult && (
              <span className="text-[10px] font-mono-numbers text-amber-400 font-semibold">
                {currentResult.format || 'MP4 / 720p'}
              </span>
            )}
          </div>

          {/* Active Generation State with Reassuring Progress Messages */}
          {isGenerating ? (
            <div className="w-full aspect-video rounded-3xl bg-[var(--bg-surface)] border border-amber-500/30 p-8 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden shadow-xl">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
                <Film className="w-8 h-8" />
              </div>

              <div>
                <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase font-mono-numbers">
                  Status: {status}
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Synthesizing Veo 3 Video
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-2 max-w-xs leading-relaxed">
                  {statusMessage || 'Analyzing image depth, camera trajectory, and temporal coherence...'}
                </p>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full max-w-xs h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 animate-pulse w-full" />
              </div>

              <p className="text-[11px] text-slate-400 italic">
                Veo video synthesis typically takes 1 to 2 minutes. Please keep this tab open.
              </p>

              <button
                onClick={cancelGeneration}
                className="text-xs text-red-400 hover:text-red-300 transition-colors mt-2 cursor-pointer font-medium"
              >
                Cancel Generation
              </button>
            </div>
          ) : currentResult && currentResult.type === 'VIDEO' ? (
            /* Completed Video Playback View */
            <div className="w-full rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-strong)] p-4 flex flex-col gap-4 shadow-xl">
              <div className="rounded-2xl overflow-hidden bg-black relative">
                <video
                  src={currentResult.url}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full max-h-[460px] object-contain"
                />
              </div>

              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  {currentResult.title}
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                  {currentResult.prompt}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
                {currentResult.url && (
                  <a
                    href={currentResult.url}
                    download="velora-veo3-video.mp4"
                    className="flex-1"
                  >
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={<Download className="w-4 h-4" />}
                      className="w-full text-xs"
                    >
                      Download MP4
                    </Button>
                  </a>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    startGeneration();
                  }}
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                  className="text-xs"
                >
                  Regenerate
                </Button>
              </div>
            </div>
          ) : status === 'FAILED' ? (
            /* Error & Quota Recovery View */
            <div className="w-full rounded-3xl bg-[var(--bg-surface)] border border-rose-500/30 p-6 flex flex-col items-center justify-center text-center gap-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-7 h-7" />
              </div>

              <div>
                <span className="text-[10px] font-bold tracking-widest text-rose-400 uppercase font-mono-numbers">
                  {errorCode || 'GENERATION_FAILED'}
                </span>
                <h4 className="text-base font-bold text-white mt-1">
                  Video Generation Did Not Complete
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-2 max-w-sm leading-relaxed">
                  {errorMessage || statusMessage || 'The model could not process this prompt. Please check parameters or retry.'}
                </p>
              </div>

              {errorCode === 'PROVIDER_RATE_LIMITED' && (
                <div className="w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-left flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    <strong>Veo Quota Tip:</strong> Google Veo video generation limits are based on your API tier. If quota is temporarily exhausted, you can retry in a few moments, or use image generation.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetGeneration}
                  className="text-xs"
                >
                  Reset Standby
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => retryGeneration()}
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                  className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Retry Generation
                </Button>
              </div>
            </div>
          ) : (
            /* Standby Placeholder */
            <div className="w-full aspect-video rounded-3xl bg-[var(--bg-surface)] border border-dashed border-[var(--border-subtle)] p-8 flex flex-col items-center justify-center text-center gap-3 select-none">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[var(--text-muted)]">
                <Film className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  Veo Viewport Standby
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs leading-relaxed">
                  Upload a photo and provide your animation directive to generate a temporal video sequence.
                </p>
              </div>

              <div className="mt-2 flex items-center gap-2 text-[10px] text-amber-400 font-mono-numbers bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                <Sparkles className="w-3 h-3" />
                <span>Veo 3 Model Engine Ready</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
