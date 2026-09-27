import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { ChevronDown, Cpu, Sparkles, Check, Zap, Flame, ShieldCheck, Clock } from 'lucide-react';

interface ModelSelectorProps {
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ className = '' }) => {
  const { models, selectedModelId, setSelectedModelId, loadModels } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (models.length === 0) {
      loadModels();
    }
  }, [models.length, loadModels]);

  const currentModel = models.find((m) => m.id === selectedModelId) || models[0];

  const getProviderBadge = (provider: string) => {
    switch (provider) {
      case 'fal':
        return { label: 'Fal.ai Queue', bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' };
      case 'google':
        return { label: 'Google Cloud', bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
      case 'openai':
        return { label: 'OpenAI', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      case 'xai':
        return { label: 'xAI Grok', bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' };
      case 'huggingface':
        return { label: 'Hugging Face', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      case 'flux':
        return { label: 'FLUX (Dedicated)', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
      case 'stability':
        return { label: 'Stability AI', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
      default:
        return { label: 'Open Weights', bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Selector Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] transition-all cursor-pointer shadow-2xs group text-left"
        aria-label="Select AI Model"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
            {currentModel?.provider === 'fal' ? (
              <Zap className="w-4 h-4 text-amber-500" />
            ) : currentModel?.provider === 'google' ? (
              <Sparkles className="w-4 h-4 text-blue-500" />
            ) : (
              <Cpu className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {currentModel?.name || 'Select Model'}
              </span>
              {currentModel && (
                <span
                  className={`text-[10px] font-mono-numbers px-1.5 py-0.5 rounded border ${
                    getProviderBadge(currentModel.provider).bg
                  }`}
                >
                  {getProviderBadge(currentModel.provider).label}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] truncate max-w-xs">
              {currentModel?.description || 'AI Generation Engine'}
            </p>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl p-2 max-h-[420px] overflow-y-auto">
            <div className="px-2.5 py-2 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-1.5">
              <span>Production Model Registry</span>
              <span className="font-mono-numbers text-[10px]">{models.length} Models</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {models.map((model) => {
                const isSelected = model.id === selectedModelId;
                const isConfigured = model.availability === 'available' || model.availability === 'configured';
                const badge = getProviderBadge(model.provider);
                const isFal = model.provider === 'fal';

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      setSelectedModelId(model.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'border-amber-500/50 bg-amber-500/10 shadow-xs'
                        : 'border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {model.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${badge.bg}`}>
                          {badge.label}
                        </span>
                        {isFal && (
                          <span className="text-[10px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/30 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" />
                            Fast 4-Step
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isConfigured ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono-numbers font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Available
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)] font-mono-numbers bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                            Unconfigured
                          </span>
                        )}
                        {isSelected && <Check className="w-4 h-4 text-amber-500 ml-1" />}
                      </div>
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                      {model.description}
                    </p>

                    {/* Metadata tags */}
                    <div className="flex items-center gap-2 flex-wrap pt-0.5 text-[10px] text-[var(--text-muted)] font-mono-numbers">
                      <span>{model.supports_text_to_image ? 'Text → Image' : 'Video Synth'}</span>
                      <span>·</span>
                      <span>{isFal ? 'Queue Async' : 'Synchronous'}</span>
                      {model.supports_aspect_ratio && (
                        <>
                          <span>·</span>
                          <span>Multi-Aspect</span>
                        </>
                      )}
                      {model.supports_image_to_image && (
                        <>
                          <span>·</span>
                          <span>Img2Img</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
