import React, { useState, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { generateMusic } from '../lib/api/music';
import { 
  Music, 
  Sparkles, 
  Play, 
  Pause, 
  Download, 
  Upload, 
  X, 
  Volume2, 
  Sliders, 
  RotateCcw,
  Check,
  Disc,
  Clock,
  Layers,
  FileText
} from 'lucide-react';
import { Button } from '../components/ui/Button';

const MUSIC_GENRE_PRESETS = [
  {
    name: 'Cinematic Orchestral',
    prompt: 'Dramatic cinematic orchestral arrangement with sweeping strings, booming brass, subtle timpani rhythms, and emotional crescendo for an epic movie trailer.',
  },
  {
    name: 'Cyberpunk Synthwave',
    prompt: 'Driving retro-futuristic synthwave track with punchy 80s analog synthesizers, pulsing neon bassline, gated reverb snare, and dark cyberpunk momentum.',
  },
  {
    name: 'Lo-Fi Chillhop',
    prompt: 'Warm lo-fi hip hop beat with dusty vinyl crackle, jazzy Rhodes piano chords, gentle boom bap swing drums, and cozy late-night atmosphere.',
  },
  {
    name: 'Ambient Electronic',
    prompt: 'Ethereal ambient soundscape with shimmering granular reverb pads, gentle pulsating sub-bass, and crystal-clear acoustic textures for meditation.',
  },
  {
    name: 'Acoustic Indie Folk',
    prompt: 'Warm acoustic indie folk ballad with fingerpicked guitar, gentle percussion shaker, rich cello accompaniment, and heartfelt intimate warmth.',
  },
  {
    name: 'Modern Melodic Techno',
    prompt: 'Peak-time melodic techno groove with deep hypnotic rolling bass, crisp percussion polyrhythms, and sweeping ethereal analog synth leads.',
  },
];

export const MusicGeneratorPage: React.FC = () => {
  const { addToast, loadLibrary } = useAppStore();

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<'lyria-3-clip-preview' | 'lyria-3-pro-preview'>('lyria-3-clip-preview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Result audio state
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedLyrics, setGeneratedLyrics] = useState<string | null>(null);
  const [generatedDuration, setGeneratedDuration] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast({ type: 'error', title: 'Invalid Image', message: 'Please select a valid image file.' });
      return;
    }
    setSelectedImage(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      addToast({ type: 'warning', title: 'Prompt Required', message: 'Please describe the music or choose a preset style.' });
      return;
    }

    setIsGenerating(true);
    setGeneratedAudioUrl(null);
    setGeneratedLyrics(null);
    setIsPlaying(false);

    addToast({
      type: 'info',
      title: 'Synthesizing Music',
      message: `Generating ${model === 'lyria-3-clip-preview' ? 'short clip (up to 30s)' : 'full-length track'} with Google Lyria...`,
    });

    try {
      const res = await generateMusic(prompt.trim(), model, selectedImage || undefined);
      setGeneratedAudioUrl(res.url);
      setGeneratedDuration(res.duration_seconds);
      setGeneratedLyrics(res.lyrics || null);

      addToast({
        type: 'success',
        title: 'Track Synthesized',
        message: 'Your music track is ready for studio playback and export.',
      });
      loadLibrary();
    } catch (err: any) {
      console.error('Music generation failed:', err);
      addToast({
        type: 'error',
        title: 'Synthesis Failed',
        message: err?.message || 'Could not generate music with Lyria. Please check your API settings.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    setAudioDuration(audioRef.current.duration || 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = Number(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in pb-12">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider font-mono-numbers">
              Lyria Neural Audio Synthesis
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-500 dark:text-amber-300">
              {model}
            </span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mt-0.5">
            AI Music Synthesizer Studio
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Generate cinematic background clips and full-length musical compositions from text prompts and visual inspiration.
          </p>
        </div>

        {/* Model Switcher */}
        <div className="flex items-center p-1 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
          <button
            onClick={() => setModel('lyria-3-clip-preview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              model === 'lyria-3-clip-preview'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Short Clip (Up to 30s)
          </button>
          <button
            onClick={() => setModel('lyria-3-pro-preview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              model === 'lyria-3-pro-preview'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Full Track (Lyria Pro)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Directing & Settings */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Main Prompt Card */}
          <div className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label htmlFor="music-prompt" className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-amber-500" />
                <span>Musical Concept & Style Directive</span>
              </label>
              {prompt && (
                <button
                  onClick={() => setPrompt('')}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <textarea
              id="music-prompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe instruments, tempo, mood, genre, rhythm, and progression (e.g. Uplifting cinematic synthwave with driving bass and neon melodic leads)..."
              className="w-full bg-[var(--bg-surface-elevated)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] p-3.5 rounded-2xl border border-[var(--border-subtle)] focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
            />

            {/* Optional Image Inspiration Upload */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                Optional: Inspire Track from Image (Multimodal)
              </span>

              {imagePreviewUrl ? (
                <div className="relative w-full h-32 rounded-xl overflow-hidden border border-[var(--border-strong)] group">
                  <img src={imagePreviewUrl} alt="Inspiration" className="w-full h-full object-cover" />
                  <button
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-white hover:bg-red-500 transition-colors cursor-pointer"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageSelect(file);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-xl border border-dashed border-[var(--border-strong)] hover:border-amber-500/50 bg-[var(--bg-surface-elevated)] hover:bg-amber-500/5 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs text-[var(--text-muted)] hover:text-amber-500 font-medium"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload artwork or photo to guide emotional tone</span>
                  </button>
                </>
              )}
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <Button
                size="lg"
                variant="primary"
                onClick={handleGenerate}
                isLoading={isGenerating}
                leftIcon={<Sparkles className="w-4 h-4" />}
                className="w-full shadow-lg shadow-amber-500/15"
              >
                {isGenerating
                  ? 'Synthesizing Audio Waves...'
                  : model === 'lyria-3-clip-preview'
                  ? 'Generate Music Clip (lyria-3-clip-preview)'
                  : 'Generate Full Track (lyria-3-pro-preview)'}
              </Button>
            </div>
          </div>

          {/* Quick Curated Presets */}
          <div className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Curated Genre Presets
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MUSIC_GENRE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setPrompt(preset.prompt)}
                  className="p-3 rounded-xl text-left border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:border-amber-500/40 hover:bg-amber-500/5 transition-all cursor-pointer group"
                >
                  <div className="text-xs font-bold text-[var(--text-primary)] group-hover:text-amber-500 transition-colors">
                    {preset.name}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] line-clamp-2 mt-0.5">
                    {preset.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Audio Player & Lyrics Viewport */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm flex flex-col gap-5 min-h-[380px]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Disc className="w-4 h-4 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  Studio Player & Waveform
                </span>
              </div>
              {generatedAudioUrl && (
                <a
                  href={generatedAudioUrl}
                  download="velora-music.wav"
                  className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-xs flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download WAV</span>
                </a>
              )}
            </div>

            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16 gap-3">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Music className="w-8 h-8 animate-bounce" />
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  Composing & Synthesizing Audio...
                </span>
                <span className="text-xs text-[var(--text-muted)] max-w-xs">
                  Streaming audio vectors through {model}. Encoding high-fidelity wave file...
                </span>
              </div>
            ) : generatedAudioUrl ? (
              <div className="flex-1 flex flex-col gap-5 justify-center">
                {/* Visual Audio Waveform Simulation */}
                <div className="h-28 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center px-4 relative overflow-hidden">
                  <div className="flex items-center gap-1 w-full justify-between h-16">
                    {Array.from({ length: 36 }).map((_, i) => {
                      const height = 20 + Math.sin(i * 0.4 + currentTime * 4) * 40 + Math.random() * 20;
                      return (
                        <div
                          key={i}
                          className={`w-1 rounded-full transition-all duration-100 ${
                            isPlaying ? 'bg-amber-500' : 'bg-slate-500/30'
                          }`}
                          style={{ height: `${Math.max(8, Math.min(60, height))}px` }}
                        />
                      );
                    })}
                  </div>
                </div>

                <audio
                  ref={audioRef}
                  src={generatedAudioUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />

                {/* Timeline Scrubber */}
                <div className="flex flex-col gap-1.5">
                  <input
                    type="range"
                    min={0}
                    max={audioDuration || 30}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full accent-amber-500 h-1.5 rounded-full cursor-pointer bg-slate-200 dark:bg-slate-700"
                  />
                  <div className="flex items-center justify-between text-[11px] font-mono-numbers text-[var(--text-muted)]">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(audioDuration || (generatedDuration || 30))}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={togglePlay}
                    className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 transition-transform cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                  </button>
                </div>

                {/* Lyrics / Text Metadata Card */}
                {generatedLyrics && (
                  <div className="p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex flex-col gap-2">
                    <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-500" /> Generated Lyrics & Theme Notes
                    </span>
                    <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap font-sans">
                      {generatedLyrics}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-[var(--text-muted)] text-xs">
                <Music className="w-12 h-12 opacity-20 mb-3" />
                <span className="font-semibold text-sm text-[var(--text-secondary)]">No Track Synthesized Yet</span>
                <span className="max-w-xs mt-1">Enter a prompt directive and select either Lyria Clip (up to 30s) or Lyria Pro to produce audio.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
