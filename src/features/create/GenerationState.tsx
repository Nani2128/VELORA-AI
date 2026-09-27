import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../../components/ui/Button';
import { 
  Sparkles, 
  RotateCw, 
  AlertCircle, 
  CheckCircle2, 
  XOctagon, 
  Layers, 
  Clock, 
  Cpu, 
  Check,
  Zap,
  ArrowRight
} from 'lucide-react';

export const GenerationState: React.FC = () => {
  const { 
    status, 
    statusMessage, 
    cancelGeneration, 
    resetGeneration, 
    generationType, 
    errorCode, 
    errorMessage,
    selectedModelId,
    setSelectedModelId,
    startGeneration,
    retryGeneration
  } = useAppStore();

  const isVideo = generationType.includes('VIDEO');
  const isQuotaExhausted = errorCode === 'PROVIDER_QUOTA_EXHAUSTED' || 
    errorCode === 'PROVIDER_RATE_LIMITED' || 
    (errorMessage || '').toLowerCase().includes('quota') || 
    (errorMessage || '').toLowerCase().includes('429');

  // Stages definition for indeterminate timeline
  const stages = [
    { key: 'PREPARING', label: 'Token Preparation', icon: Layers },
    { key: 'QUEUED', label: 'Pipeline Queue', icon: Clock },
    { key: 'PROCESSING', label: isVideo ? 'Latent Temporal Synthesis' : 'Spatial Denoise Diffs', icon: Cpu },
    { key: 'FINALIZING', label: 'Color Grade & Assembly', icon: Sparkles },
  ];

  const getStageStatus = (stageKey: string) => {
    const order = ['PREPARING', 'QUEUED', 'PROCESSING', 'FINALIZING', 'COMPLETED'];
    const currentIndex = order.indexOf(status);
    const stageIndex = order.indexOf(stageKey);

    if (status === 'FAILED' || status === 'CANCELLED') {
      return stageIndex <= currentIndex ? 'inactive' : 'pending';
    }

    if (stageIndex < currentIndex || status === 'COMPLETED') return 'completed';
    if (stageIndex === currentIndex) return 'active';
    return 'pending';
  };

  const handleContinueWithFlux = async () => {
    setSelectedModelId('fal-ai/flux/schnell');
    await startGeneration();
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-6 md:p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] relative overflow-hidden select-none shadow-sm">
      {/* Background ambient animation for active state */}
      {['PREPARING', 'QUEUED', 'PROCESSING', 'FINALIZING'].includes(status) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-amber-500/20 blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-blue-600/20 blur-3xl animate-pulse delay-700" />
        </div>
      )}

      {/* Dynamic Status Icon */}
      <div className="mb-5 relative">
        {status === 'PREPARING' && (
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 animate-pulse">
            <Layers className="w-8 h-8" />
          </div>
        )}
        {status === 'QUEUED' && (
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500">
            <Clock className="w-8 h-8 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
        )}
        {status === 'PROCESSING' && (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-blue-500/20 border border-amber-400/40 flex items-center justify-center text-amber-500">
            <RotateCw className="w-8 h-8 animate-spin" style={{ animationDuration: '2.5s' }} />
          </div>
        )}
        {status === 'FINALIZING' && (
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 animate-bounce">
            <Sparkles className="w-8 h-8" />
          </div>
        )}
        {status === 'COMPLETED' && (
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="w-8 h-8" />
          </div>
        )}
        {status === 'CANCELLED' && (
          <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-[var(--text-muted)]">
            <XOctagon className="w-8 h-8" />
          </div>
        )}
        {status === 'FAILED' && (
          <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-500">
            <AlertCircle className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Main Status Text & Live Pipeline Stage Message */}
      <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight text-center">
        {status === 'PREPARING' && 'Configuring Latent Pipeline'}
        {status === 'QUEUED' && 'Dispatched to Execution Queue'}
        {status === 'PROCESSING' && (isVideo ? 'Synthesizing Video Latents' : 'Generating Image Latents')}
        {status === 'FINALIZING' && 'Encoding & Post-Processing Output'}
        {status === 'COMPLETED' && 'Render Process Complete'}
        {status === 'CANCELLED' && 'Operation Cancelled'}
        {status === 'FAILED' && (isQuotaExhausted ? 'Model Quota Completed' : 'Synthesis Terminated')}
      </h3>

      <p className="text-xs text-[var(--text-muted)] text-center max-w-sm mt-1 mb-4 leading-relaxed">
        {status === 'FAILED' 
          ? (isQuotaExhausted 
              ? `${selectedModelId} is temporarily unavailable. We've selected another compatible model for your request.` 
              : (errorMessage || statusMessage))
          : statusMessage}
      </p>

      {/* Quota Exhausted Alternative Recommendation Card */}
      {status === 'FAILED' && isQuotaExhausted && (
        <div className="w-full max-w-md p-4 mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-left flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-[var(--text-primary)]">Recommended Alternative</span>
            </div>
            <span className="text-[10px] font-mono-numbers px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30">
              ● Available
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[var(--text-primary)]">FLUX.1 Schnell</div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Provider: Fal.ai · Capability: Text → Image · 4-Step High Speed
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="primary"
              onClick={handleContinueWithFlux}
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              className="flex-1 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
            >
              Continue with FLUX.1 Schnell
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={resetGeneration}
              className="text-xs"
            >
              Choose another model
            </Button>
          </div>
        </div>
      )}

      {/* Indeterminate Shimmer Progress Bar (NO fake numeric percentage) */}
      {['PREPARING', 'QUEUED', 'PROCESSING', 'FINALIZING'].includes(status) && (
        <div className="w-full max-w-md h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden mb-6 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400 to-transparent w-1/2 rounded-full animate-shimmer" />
        </div>
      )}

      {/* Stage Step Indicators */}
      <div className="w-full max-w-md grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {stages.map((stage) => {
          const st = getStageStatus(stage.key);
          const Icon = stage.icon;

          return (
            <div
              key={stage.key}
              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all ${
                st === 'completed'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : st === 'active'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'bg-black/[0.02] dark:bg-white/[0.02] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}
            >
              <div className="w-5 h-5 rounded-md flex items-center justify-center">
                {st === 'completed' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>
              <span className="text-[10px] font-medium leading-tight">
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Cancellation / Reset Controls */}
      <div className="flex items-center gap-3">
        {['PREPARING', 'QUEUED', 'PROCESSING', 'FINALIZING'].includes(status) && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={cancelGeneration}
          >
            Cancel Generation
          </Button>
        )}

        {(status === 'CANCELLED' || (status === 'FAILED' && !isQuotaExhausted)) && (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={resetGeneration}
            >
              Return to Studio
            </Button>
            {status === 'FAILED' && (
              <Button
                size="sm"
                variant="primary"
                className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium"
                onClick={() => retryGeneration()}
              >
                Retry Generation
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
