import React, { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../../components/ui/Button';
import { MediaPlaceholder } from '../../components/common/MediaPlaceholder';
import { Modal } from '../../components/ui/Modal';
import { 
  Download, 
  Heart, 
  Share2, 
  RotateCcw, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Sparkles, 
  Copy, 
  Check 
} from 'lucide-react';
import { useSound } from '../../lib/sound';
import { triggerHaptic } from '../../lib/haptics';

export const ResultView: React.FC = () => {
  const { currentResult, resetGeneration, toggleFavorite, addToast, startGeneration } = useAppStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { play } = useSound();

  if (!currentResult) return null;

  const isVideo = currentResult.type === 'VIDEO';

  const handleDownload = () => {
    play('click');
    triggerHaptic('light');
    if (currentResult.url) {
      const link = document.createElement('a');
      link.href = currentResult.url;
      link.download = `${currentResult.title.replace(/\s+/g, '_')}.${isVideo ? 'mp4' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    addToast({
      type: 'info',
      title: 'Exporting Asset',
      message: `Exporting ${currentResult.title} in master quality (${currentResult.format}).`,
    });
  };

  const handleShare = () => {
    setShareModalOpen(true);
  };

  const handleCopyShareLink = () => {
    play('click');
    triggerHaptic('light');
    setCopiedLink(true);
    navigator.clipboard?.writeText(window.location.href);
    setTimeout(() => setCopiedLink(false), 2000);
    addToast({
      type: 'success',
      title: 'Share Link Copied',
      message: 'Direct link to this creative asset copied to clipboard.',
    });
  };

  return (
    <div className="w-full flex flex-col gap-4 p-4 md:p-6 rounded-2xl bg-[#0F121C] border border-white/10 select-none">
      {/* Top action header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ready in Viewport</span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-xs font-mono-numbers text-slate-400">
            {currentResult.aspectRatio} · {currentResult.format}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggleFavorite(currentResult.id)}
            className={`p-2 h-8 w-8 ${currentResult.favorite ? 'text-rose-400' : 'text-slate-400'}`}
            title="Add to favorites"
          >
            <Heart className={`w-4 h-4 ${currentResult.favorite ? 'fill-rose-400 text-rose-400' : ''}`} />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleShare}
            className="p-2 h-8 w-8 text-slate-400"
            title="Share asset"
          >
            <Share2 className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownload}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            Export
          </Button>
        </div>
      </div>

      {/* Main Viewport Media Player / Canvas */}
      <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-black/60 shadow-2xl">
        {currentResult.url ? (
          isVideo ? (
            <video
              src={currentResult.url}
              className="w-full max-h-[520px] object-contain mx-auto bg-black"
              controls
              playsInline
              loop
            />
          ) : (
            <img
              src={currentResult.url}
              alt={currentResult.title}
              className="w-full max-h-[520px] object-contain mx-auto bg-black"
            />
          )
        ) : (
          <MediaPlaceholder
            type={currentResult.type}
            title={currentResult.title}
            aspectRatio={currentResult.aspectRatio}
            gradientTheme={currentResult.gradientTheme}
            duration={currentResult.duration}
            showPlayBadge={false}
            className="rounded-none border-0"
          />
        )}
      </div>

      {/* Metadata & Prompt Breakdown */}
      <div className="flex flex-col gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white tracking-tight">{currentResult.title}</span>
          <span className="text-[11px] text-slate-400 font-mono-numbers">{currentResult.createdAt}</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed font-sans">
          "{currentResult.prompt}"
        </p>
      </div>

      {/* Footer studio actions */}
      <div className="flex items-center justify-between pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={resetGeneration}
          className="text-xs"
        >
          New Canvas
        </Button>

        <Button
          size="sm"
          variant="primary"
          onClick={startGeneration}
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          className="text-xs"
        >
          Regenerate Variant
        </Button>
      </div>

      {/* Share Modal Dialog */}
      <Modal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Share Creative Asset"
        description="Share this viewport output or integrate into external video production pipelines."
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#141724] border border-white/10">
            <input
              type="text"
              readOnly
              value={typeof window !== 'undefined' ? window.location.href : 'https://velora.ai/asset/' + currentResult.id}
              className="bg-transparent text-xs text-slate-300 font-mono-numbers flex-1 focus:outline-none"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopyShareLink}
              leftIcon={copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              className="text-xs shrink-0"
            >
              {copiedLink ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className="flex flex-col gap-1 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Direct Embed Format</span>
            <span className="text-[11px]">Supports Webhook callbacks and production CDN distribution in Phase 02.</span>
          </div>
        </div>
      </Modal>
    </div>
  );
};
