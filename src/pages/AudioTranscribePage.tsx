import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { transcribeAudio } from '../lib/api/audio';
import { 
  Mic, 
  Square, 
  Upload, 
  Copy, 
  Check, 
  Sparkles, 
  ArrowRight, 
  FileText, 
  Download, 
  Trash2, 
  Radio,
  Image as ImageIcon,
  Film,
  Music,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export const AudioTranscribePage: React.FC = () => {
  const { setPrompt, setGenerationType, navigate, addToast } = useAppStore();

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      source.connect(analyser);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setVolumeLevel(Math.min(100, Math.round((avg / 255) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setVolumeLevel(0);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const localUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(localUrl);

        await processTranscription(audioBlob);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      addToast({
        type: 'error',
        title: 'Microphone Error',
        message: err?.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access in your browser settings.'
          : 'Could not access microphone.',
      });
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|webm)$/i)) {
      addToast({
        type: 'error',
        title: 'Unsupported file',
        message: 'Please select a valid audio file (WAV, MP3, WebM, OGG, or M4A).',
      });
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setAudioUrl(localUrl);
    await processTranscription(file);
  };

  const processTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    addToast({
      type: 'info',
      title: 'Transcribing Audio',
      message: 'Processing speech with Gemini 3.5 Transcribe model...',
    });

    try {
      const res = await transcribeAudio(blob);
      setTranscribedText(res.text || '');
      addToast({
        type: 'success',
        title: 'Transcription Complete',
        message: 'Speech transcribed verbatim using gemini-3.5-transcribe.',
      });
    } catch (err: any) {
      console.error('Transcription error:', err);
      addToast({
        type: 'error',
        title: 'Transcription Failed',
        message: err?.message || 'Could not transcribe audio. Please verify your GEMINI_API_KEY.',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopy = () => {
    if (!transcribedText) return;
    navigator.clipboard.writeText(transcribedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast({ type: 'info', title: 'Copied', message: 'Transcription copied to clipboard.' });
  };

  const handleDownloadTxt = () => {
    if (!transcribedText) return;
    const blob = new Blob([transcribedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcription-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendToStudio = (dest: 'image' | 'video' | 'music' | 'chat') => {
    if (!transcribedText.trim()) return;
    setPrompt(transcribedText);

    if (dest === 'image') {
      setGenerationType('TEXT_TO_IMAGE');
      navigate('/app/image');
    } else if (dest === 'video') {
      setGenerationType('TEXT_TO_VIDEO');
      navigate('/app/video');
    } else if (dest === 'music') {
      setGenerationType('TEXT_TO_MUSIC');
      navigate('/app/music');
    } else {
      navigate('/app/chat');
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-fade-in pb-12">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider font-mono-numbers">
              Speech-To-Text Engine
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-500 dark:text-amber-300">
              Model: gemini-3.5-transcribe
            </span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-[var(--text-primary)] mt-0.5">
            Microphone Audio Transcription
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Input audio with your microphone or upload sound clips to generate accurate, verbatim transcripts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Recording Controls */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
            {/* Visualizer Orb */}
            <div className="relative my-6 flex items-center justify-center">
              <div
                className={`absolute rounded-full border border-amber-500/20 transition-all duration-300 ${
                  isRecording ? 'w-48 h-48 animate-ping opacity-30' : 'w-40 h-40 opacity-0'
                }`}
              />
              <div
                className="absolute rounded-full border border-amber-400/30 transition-transform duration-200"
                style={{
                  width: `${140 + volumeLevel * 0.8}px`,
                  height: `${140 + volumeLevel * 0.8}px`,
                }}
              />
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing}
                className={`w-32 h-32 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300 cursor-pointer ${
                  isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600 scale-105 shadow-red-500/30'
                    : 'bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 hover:scale-105 shadow-amber-500/25'
                }`}
                title={isRecording ? 'Click to stop recording' : 'Click to start recording'}
              >
                {isRecording ? (
                  <>
                    <Square className="w-10 h-10 fill-current mb-1" />
                    <span className="text-[11px] font-bold uppercase tracking-wider font-mono-numbers">
                      {formatSeconds(recordingSeconds)}
                    </span>
                  </>
                ) : (
                  <>
                    <Mic className="w-10 h-10 mb-1" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      Tap To Record
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {isRecording ? (
                <span className="flex items-center justify-center gap-2 text-red-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  Recording live microphone input...
                </span>
              ) : isTranscribing ? (
                <span className="flex items-center justify-center gap-2 text-amber-500">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Transcribing audio with gemini-3.5-transcribe...
                </span>
              ) : (
                'Click the microphone to record your voice'
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mt-1">
              Supports continuous voice dictation, artistic prompts, interviews, and multilingual speech.
            </p>

            {/* Audio Playback if recorded */}
            {audioUrl && !isRecording && (
              <div className="w-full mt-6 pt-4 border-t border-[var(--border-subtle)] flex flex-col gap-2">
                <span className="text-[11px] text-[var(--text-muted)] text-left font-medium">Recorded Audio Preview</span>
                <audio controls src={audioUrl} className="w-full h-10 rounded-xl" />
              </div>
            )}
          </div>

          {/* Alternative File Upload Card */}
          <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Or Upload Audio File
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isRecording || isTranscribing}
              className="p-4 rounded-xl border border-dashed border-[var(--border-strong)] hover:border-amber-500/50 bg-[var(--bg-surface-elevated)] hover:bg-amber-500/5 transition-all flex items-center justify-center gap-3 cursor-pointer text-xs font-semibold text-[var(--text-secondary)] hover:text-amber-500"
            >
              <Upload className="w-4 h-4" />
              <span>Select WAV, MP3, WebM, or OGG file from disk</span>
            </button>
          </div>
        </div>

        {/* Right Column: Transcription Output & Studio Integration */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm flex flex-col gap-4 min-h-[380px]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-bold text-[var(--text-primary)]">
                  Verbatim Transcript Output
                </span>
              </div>
              {transcribedText && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-xs flex items-center gap-1"
                    title="Copy transcript"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleDownloadTxt}
                    className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-xs flex items-center gap-1"
                    title="Download .txt"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.txt</span>
                  </button>
                </div>
              )}
            </div>

            {/* Transcript content */}
            <div className="flex-1 rounded-2xl bg-[var(--bg-surface-elevated)] p-4 border border-[var(--border-subtle)] overflow-y-auto max-h-[300px]">
              {isTranscribing ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 gap-2 text-[var(--text-muted)]">
                  <Sparkles className="w-6 h-6 text-amber-500 animate-spin" />
                  <span className="text-xs font-medium">Decoding phonemes & synthesizing text with gemini-3.5-transcribe...</span>
                </div>
              ) : transcribedText ? (
                <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap select-text font-sans">
                  {transcribedText}
                </p>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 text-[var(--text-muted)] text-xs">
                  <Mic className="w-8 h-8 opacity-20 mb-2" />
                  <span>Your audio transcription will appear here in real-time once recorded or uploaded.</span>
                </div>
              )}
            </div>

            {/* Quick Actions to dispatch to other studios */}
            {transcribedText && (
              <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Send Transcribed Speech To:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => handleSendToStudio('image')}
                    className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:border-amber-500/40 text-xs font-medium text-[var(--text-primary)] hover:text-amber-500 transition-all cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                    <span>Image Studio</span>
                  </button>
                  <button
                    onClick={() => handleSendToStudio('video')}
                    className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:border-amber-500/40 text-xs font-medium text-[var(--text-primary)] hover:text-amber-500 transition-all cursor-pointer"
                  >
                    <Film className="w-3.5 h-3.5 text-amber-500" />
                    <span>Veo Video</span>
                  </button>
                  <button
                    onClick={() => handleSendToStudio('music')}
                    className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:border-amber-500/40 text-xs font-medium text-[var(--text-primary)] hover:text-amber-500 transition-all cursor-pointer"
                  >
                    <Music className="w-3.5 h-3.5 text-amber-500" />
                    <span>Lyria Music</span>
                  </button>
                  <button
                    onClick={() => handleSendToStudio('chat')}
                    className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:border-amber-500/40 text-xs font-medium text-[var(--text-primary)] hover:text-amber-500 transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                    <span>AI Chat</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
