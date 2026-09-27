import React, { useState, useRef } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Sparkles, Wand2, X, Mic, Square, ChevronDown, ChevronUp } from 'lucide-react';
import { useSound } from '../../lib/sound';
import { transcribeAudio } from '../../lib/api/audio';

export const PromptComposer: React.FC = () => {
  const { 
    prompt, 
    setPrompt, 
    negativePrompt, 
    setNegativePrompt, 
    settings, 
    updateSettings, 
    generationType,
    addToast 
  } = useAppStore();

  const [showNegative, setShowNegative] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { play } = useSound();

  const promptSuggestions = generationType.includes('VIDEO')
    ? [
        'Anamorphic slow cinematic dolly push through a foggy brutalist concrete pavilion with amber interior illumination',
        'Aerial drone orbit at dawn above cascading alpine waterfalls, volumetric light rays and morning mist',
        'High-speed tracking shot beside a futuristic metallic aerodynamic hypercar speeding on rainy neon asphalt',
      ]
    : [
        'Editorial fashion photography of a model in sculptural pleated silk, dramatic high-contrast window shadow, 35mm film',
        'Photorealistic modernist glass villa nestled in misty Scandinavian pine forest at dusk, warm glow on wet slate',
        'Macro close-up of obsidian volcanic crystal refracts warm sunset light, intricate prismatic caustic reflections',
      ];

  const handleApplySuggestion = (text: string) => {
    play('click');
    setPrompt(text);
  };

  const handleClear = () => {
    play('click');
    setPrompt('');
  };

  const handleVoiceDictation = async () => {
    if (isRecordingVoice) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecordingVoice(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        addToast({
          type: 'info',
          title: 'Transcribing Audio',
          message: 'Transcribing microphone audio with gemini-3.5-transcribe...',
        });

        try {
          const res = await transcribeAudio(blob);
          if (res.text) {
            setPrompt(prompt ? `${prompt.trim()} ${res.text}` : res.text);
            addToast({
              type: 'success',
              title: 'Voice Transcribed',
              message: 'Appended prompt using gemini-3.5-transcribe.',
            });
          }
        } catch (err: any) {
          addToast({
            type: 'error',
            title: 'Transcription Failed',
            message: err?.message || 'Could not transcribe speech.',
          });
        }
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      play('click');
      addToast({
        type: 'info',
        title: 'Microphone Dictation Active',
        message: 'Speak clearly into your microphone... Click mic again to finish.',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Microphone Error',
        message: 'Microphone access denied or unavailable.',
      });
    }
  };

  return (
    <div className="w-full flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <label htmlFor="prompt-composer" className="text-xs font-semibold text-slate-300 tracking-wide uppercase flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Prompt Description</span>
        </label>
        <div className="flex items-center gap-2">
          {prompt && (
            <button
              onClick={handleClear}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
          <span className="text-[11px] font-mono-numbers text-slate-400">
            {prompt.length} chars
          </span>
        </div>
      </div>

      {/* Main Textarea Container */}
      <div className="relative rounded-2xl bg-[#10121B] border border-white/10 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/30 transition-all p-3.5 flex flex-col gap-3">
        <textarea
          id="prompt-composer"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder={
            generationType.includes('VIDEO')
              ? 'Describe camera motion, visual lighting, subject movement, and atmospheric texture...'
              : 'Describe the scene, subject, composition, mood, and lighting in vivid detail...'
          }
          className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none leading-relaxed"
        />

        {/* Toolbar below textarea */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateSettings({ enhancePrompt: !settings.enhancePrompt })}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                settings.enhancePrompt
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wand2 className="w-3 h-3" />
              <span>Enhance Prompt</span>
            </button>

            <button
              type="button"
              onClick={handleVoiceDictation}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 text-xs ${
                isRecordingVoice
                  ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
              title={isRecordingVoice ? 'Click to stop recording and transcribe' : 'Dictate prompt with microphone (gemini-3.5-transcribe)'}
              aria-label="Dictate prompt"
            >
              {isRecordingVoice ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3.5 h-3.5 text-amber-400" />}
              {isRecordingVoice && <span>Listening...</span>}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowNegative(!showNegative)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
          >
            <span>Negative Prompt</span>
            {showNegative ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Negative Prompt Drawer */}
      {showNegative && (
        <div className="rounded-xl bg-[#0D0F16] border border-white/10 p-3 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Elements to exclude (negative guidance)</span>
            <span className="font-mono-numbers text-[10px]">{negativePrompt.length} chars</span>
          </div>
          <textarea
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            rows={2}
            placeholder="Blurry, oversaturated, deformed proportions, pixelation, watermarks, low resolution..."
            className="w-full bg-[#121520] text-xs text-slate-200 placeholder:text-slate-600 rounded-lg p-2.5 border border-white/5 focus:outline-none focus:border-amber-500/40 resize-none"
          />
        </div>
      )}

      {/* Quick Prompt Suggestions */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[11px] font-medium text-slate-400">
          Curated Studio Directions
        </span>
        <div className="flex flex-col gap-1.5">
          {promptSuggestions.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplySuggestion(sug)}
              className="text-left text-xs text-slate-400 hover:text-amber-300 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-amber-500/25 px-3 py-2 rounded-xl transition-all truncate cursor-pointer"
            >
              {sug}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
