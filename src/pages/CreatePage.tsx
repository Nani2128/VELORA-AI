import React, { useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { ModeSelector } from '../features/create/ModeSelector';
import { PromptComposer } from '../features/create/PromptComposer';
import { ImageDropzone } from '../features/create/ImageDropzone';
import { GenerationSettings } from '../features/create/GenerationSettings';
import { GenerationState } from '../features/create/GenerationState';
import { ResultView } from '../features/create/ResultView';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Modal';
import { 
  Sparkles, 
  SlidersHorizontal, 
  RotateCcw, 
  Layers, 
  Video, 
  Image as ImageIcon 
} from 'lucide-react';

export const CreatePage: React.FC = () => {
  const { 
    generationType, 
    status, 
    startGeneration, 
    currentResult, 
    prompt,
    mobileSettingsOpen,
    setMobileSettingsOpen,
    settings 
  } = useAppStore();

  const isVideo = generationType.includes('VIDEO');
  const needsImageUpload = generationType === 'IMAGE_TO_IMAGE' || generationType === 'IMAGE_TO_VIDEO';
  const isGenerating = ['PREPARING', 'QUEUED', 'PROCESSING', 'FINALIZING'].includes(status);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider font-mono-numbers">
            Creative Synthesizer
          </span>
          <h1 className="text-2xl font-display font-extrabold text-white mt-0.5">
            Studio Canvas
          </h1>
        </div>

        {/* Action button on desktop */}
        <div className="hidden sm:flex items-center gap-3">
          <Button
            size="md"
            variant="primary"
            onClick={startGeneration}
            isLoading={isGenerating}
            leftIcon={<Sparkles className="w-4 h-4" />}
            className="shadow-lg shadow-amber-500/15"
          >
            {isVideo ? 'Synthesize Video Sequence' : 'Synthesize Image Frame'}
          </Button>
        </div>
      </div>

      {/* 2-Column Desktop Grid / Stacked Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Directing & Controls (7 cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Mode Selector */}
          <ModeSelector />

          {/* Conditional Image Dropzone */}
          {needsImageUpload && (
            <div className="p-4 rounded-2xl bg-[#0F121C] border border-white/10">
              <ImageDropzone />
            </div>
          )}

          {/* Prompt Composer */}
          <div className="p-4 rounded-2xl bg-[#0F121C] border border-white/10">
            <PromptComposer />
          </div>

          {/* Desktop Generation Settings (hidden on mobile, opened via sheet) */}
          <div className="hidden md:block p-4 rounded-2xl bg-[#0F121C] border border-white/10">
            <GenerationSettings />
          </div>

          {/* Mobile Settings Trigger Button */}
          <div className="md:hidden flex items-center justify-between p-3.5 rounded-xl bg-[#0F121C] border border-white/10">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">Cinematography Parameters</span>
              <span className="text-[11px] text-slate-400 font-mono-numbers">
                {settings.aspectRatio} · {settings.style} {isVideo ? `· ${settings.durationSeconds}s` : ''}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMobileSettingsOpen(true)}
              leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Adjust
            </Button>
          </div>
        </div>

        {/* Right Column: Viewport / State / Result (5 cols on desktop) */}
        <div className="lg:col-span-5 sticky top-20 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Studio Viewport</span>
            </span>

            {currentResult && (
              <span className="text-[11px] font-mono-numbers text-slate-400">
                Resolution: {currentResult.aspectRatio}
              </span>
            )}
          </div>

          {/* Dynamic Viewport Surface */}
          {status === 'IDLE' && !currentResult && (
            <div className="w-full aspect-video rounded-2xl bg-[#0F121C] border border-dashed border-white/15 p-6 flex flex-col items-center justify-center text-center gap-3 select-none">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-slate-400">
                {isVideo ? <Video className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Viewport Standby</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                  Enter your prompt directive and press synthesize to begin the latent pipeline.
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={startGeneration}
                leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                className="mt-2 text-xs"
              >
                Synthesize Now
              </Button>
            </div>
          )}

          {/* Active Generation State Machine Indicator */}
          {status !== 'IDLE' && status !== 'COMPLETED' && (
            <GenerationState />
          )}

          {/* Completed Result Viewport */}
          {status === 'COMPLETED' && currentResult && (
            <ResultView />
          )}
        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      <div className="sm:hidden fixed bottom-16 left-0 right-0 p-3 bg-[#0A0C13]/90 backdrop-blur-md border-t border-white/10 z-30 flex items-center gap-2">
        <Button
          size="md"
          variant="outline"
          onClick={() => setMobileSettingsOpen(true)}
          className="p-2 w-11 h-11 shrink-0"
          aria-label="Settings sheet"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
        <Button
          size="md"
          variant="primary"
          onClick={startGeneration}
          isLoading={isGenerating}
          leftIcon={<Sparkles className="w-4 h-4" />}
          className="flex-1"
        >
          {isVideo ? 'Synthesize Video' : 'Synthesize Image'}
        </Button>
      </div>

      {/* Mobile Bottom Sheet for Advanced Settings */}
      <Sheet
        isOpen={mobileSettingsOpen}
        onClose={() => setMobileSettingsOpen(false)}
        title="Cinematography Settings"
      >
        <div className="pt-2">
          <GenerationSettings />
          <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
            <Button size="sm" onClick={() => setMobileSettingsOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
};
