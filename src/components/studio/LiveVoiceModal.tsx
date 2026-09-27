import React, { useEffect, useRef, useState } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  X, 
  Radio, 
  Sparkles, 
  Settings2, 
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { Button } from '../ui/Button';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TranscriptItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({ isOpen, onClose }) => {
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error'
  >('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir'>('Zephyr');
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [micVolume, setMicVolume] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isMutedRef = useRef(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const transcriptsEndRef = useRef<HTMLDivElement | null>(null);

  isMutedRef.current = isMuted;

  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Convert Float32Array from microphone to 16-bit PCM little-endian Base64 string
  const pcm16ToBase64 = (float32Array: Float32Array): string => {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const uint8 = new Uint8Array(pcm16.buffer);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  };

  // Play gapless 24kHz PCM chunk
  const playPcm24kChunk = (base64Data: string) => {
    try {
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
      }
      const audioCtx = outputAudioCtxRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      const currentTime = audioCtx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime + 0.04;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;
      activeSourcesRef.current.push(source);

      setConnectionStatus('speaking');

      source.onended = () => {
        const idx = activeSourcesRef.current.indexOf(source);
        if (idx !== -1) {
          activeSourcesRef.current.splice(idx, 1);
        }
        if (activeSourcesRef.current.length === 0) {
          setConnectionStatus('listening');
        }
      };
    } catch (err) {
      console.error('Error playing 24kHz PCM chunk:', err);
    }
  };

  // Stop playback on interruption
  const stopPlayback = () => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setConnectionStatus('listening');
  };

  // Start Live Session
  const startLiveSession = async () => {
    setConnectionStatus('connecting');
    setErrorMessage(null);

    try {
      // 1. Microphone capture
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      inputAudioCtxRef.current = inputAudioCtx;

      const sourceNode = inputAudioCtx.createMediaStreamSource(stream);
      const analyserNode = inputAudioCtx.createAnalyser();
      analyserNode.fftSize = 64;
      analyserRef.current = analyserNode;

      const processorNode = inputAudioCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processorNode;

      sourceNode.connect(analyserNode);
      analyserNode.connect(processorNode);
      processorNode.connect(inputAudioCtx.destination);

      // Volume monitoring for visualizer
      const updateVolume = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicVolume(isMutedRef.current ? 0 : Math.min(100, Math.round((avg / 255) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // 2. Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'init', voice: selectedVoice }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ready') {
            setConnectionStatus('listening');
          } else if (msg.type === 'audio' && msg.audio) {
            playPcm24kChunk(msg.audio);
          } else if (msg.type === 'interrupted') {
            stopPlayback();
          } else if (msg.type === 'transcription') {
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === msg.role && Date.now() - Number(last.id) < 4000) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: `${last.text} ${msg.text}`.trim() },
                ];
              }
              return [
                ...prev,
                {
                  id: String(Date.now()),
                  role: msg.role,
                  text: msg.text,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ];
            });
          } else if (msg.type === 'error') {
            setErrorMessage(msg.error || 'Gemini Live error occurred.');
            setConnectionStatus('error');
          }
        } catch (err) {
          console.error('Error handling WebSocket live message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        setErrorMessage('Failed to connect to real-time voice server. Check server health.');
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
      };

      // 3. Audio chunk processing & forwarding
      processorNode.onaudioprocess = (e) => {
        if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const base64Audio = pcm16ToBase64(inputData);
        ws.send(JSON.stringify({ type: 'audio', audio: base64Audio }));
      };
    } catch (err: any) {
      console.error('Microphone/Live API initialization failed:', err);
      setErrorMessage(
        err?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow microphone access in your browser.'
          : err?.message || 'Could not start voice session.'
      );
      setConnectionStatus('error');
    }
  };

  // Cleanup on close or unmount
  const stopLiveSession = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    stopPlayback();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
  };

  useEffect(() => {
    if (isOpen) {
      startLiveSession();
    } else {
      stopLiveSession();
    }
    return () => {
      stopLiveSession();
    };
  }, [isOpen]);

  // Voice switch handler
  const handleVoiceChange = (voice: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir') => {
    setSelectedVoice(voice);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'init', voice }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Gemini Live Voice Studio
                </h3>
                <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold">
                  gemini-3.8-live
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Ultra-low latency bidirectional real-time audio interaction
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visualizer & Voice Orb Area */}
        <div className="p-8 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-amber-500/[0.03] to-transparent">
          {/* Glowing Animated Central Orb */}
          <div className="relative flex items-center justify-center my-4">
            {/* Background ripple rings */}
            <div
              className={`absolute rounded-full border border-amber-500/20 transition-all duration-300 ${
                connectionStatus === 'speaking'
                  ? 'w-48 h-48 animate-ping opacity-25'
                  : 'w-40 h-40 opacity-40'
              }`}
            />
            <div
              className="absolute rounded-full border border-amber-400/30 transition-transform duration-200"
              style={{
                width: `${140 + micVolume * 0.7}px`,
                height: `${140 + micVolume * 0.7}px`,
              }}
            />

            {/* Core Orb */}
            <div
              className={`w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300 cursor-pointer ${
                connectionStatus === 'speaking'
                  ? 'bg-gradient-to-tr from-amber-500 to-amber-300 shadow-amber-500/40 scale-105'
                  : connectionStatus === 'listening'
                  ? 'bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-amber-500/40 shadow-amber-500/20'
                  : connectionStatus === 'connecting'
                  ? 'bg-slate-800 border border-white/10 animate-pulse'
                  : 'bg-red-950/40 border border-red-500/30'
              }`}
            >
              {connectionStatus === 'speaking' ? (
                <Volume2 className="w-10 h-10 text-slate-950 animate-bounce" />
              ) : connectionStatus === 'listening' ? (
                <Mic className="w-10 h-10 text-amber-400" />
              ) : connectionStatus === 'connecting' ? (
                <Sparkles className="w-8 h-8 text-amber-300 animate-spin" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-400" />
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'speaking'
                  ? 'bg-amber-400 animate-ping'
                  : connectionStatus === 'listening'
                  ? 'bg-emerald-400 animate-pulse'
                  : connectionStatus === 'connecting'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono-numbers">
              {connectionStatus === 'speaking'
                ? 'Gemini is speaking...'
                : connectionStatus === 'listening'
                ? isMuted
                  ? 'Microphone Muted'
                  : 'Listening to your voice...'
                : connectionStatus === 'connecting'
                ? 'Connecting Live Session...'
                : 'Session Disconnected'}
            </span>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 max-w-md text-center">
              {errorMessage}
            </div>
          )}

          {/* Voice Personality Selector */}
          <div className="mt-5 flex items-center gap-2 flex-wrap justify-center">
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 mr-1">
              <Settings2 className="w-3.5 h-3.5" /> Persona:
            </span>
            {(['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'] as const).map((voice) => (
              <button
                key={voice}
                onClick={() => handleVoiceChange(voice)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  selectedVoice === voice
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold shadow-xs'
                    : 'bg-white/[0.04] border-white/10 text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {voice}
              </button>
            ))}
          </div>
        </div>

        {/* Live Scrolling Transcription */}
        <div className="flex-1 overflow-y-auto px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]/30 min-h-[160px] max-h-[220px]">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            <MessageSquare className="w-3.5 h-3.5" /> Real-time Speech Transcript
          </div>

          {transcripts.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] italic text-center py-6">
              Speak into your microphone. Your spoken words and Gemini&apos;s voice responses will be transcribed here.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {transcripts.map((t) => (
                <div
                  key={t.id}
                  className={`flex flex-col max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                    t.role === 'user'
                      ? 'ml-auto bg-amber-500/10 border border-amber-500/20 text-amber-200'
                      : 'mr-auto bg-white/[0.05] border border-white/10 text-[var(--text-primary)]'
                  }`}
                >
                  <span className="text-[10px] font-semibold opacity-70 mb-0.5">
                    {t.role === 'user' ? 'You' : `Gemini Live (${selectedVoice})`} · {t.timestamp}
                  </span>
                  <span>{t.text}</span>
                </div>
              ))}
              <div ref={transcriptsEndRef} />
            </div>
          )}
        </div>

        {/* Footer Action Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isMuted
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-white/5 border-white/10 text-[var(--text-primary)] hover:bg-white/10'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
              <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="text-xs"
            >
              End Conversation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
