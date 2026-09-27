import React, { useState } from 'react';
import { MediaAsset } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import { MediaPlaceholder } from '../../components/common/MediaPlaceholder';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Heart, Download, Trash2, Sparkles, ExternalLink } from 'lucide-react';

interface MediaCardProps {
  asset: MediaAsset;
  viewMode?: 'grid' | 'list';
}

export const MediaCard: React.FC<MediaCardProps> = ({ asset, viewMode = 'grid' }) => {
  const { toggleFavorite, deleteAsset, addToast, navigate, setPrompt, setGenerationType } = useAppStore();
  const [detailOpen, setDetailOpen] = useState(false);

  const isVideo = asset.type === 'VIDEO';

  const handleOpenStudio = () => {
    setPrompt(asset.prompt);
    setGenerationType(isVideo ? 'TEXT_TO_VIDEO' : 'TEXT_TO_IMAGE');
    navigate('/app/create');
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (asset.url) {
      const link = document.createElement('a');
      link.href = asset.url;
      link.download = `${asset.title.replace(/\s+/g, '_')}.${isVideo ? 'mp4' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    addToast({
      type: 'info',
      title: 'Downloading Media',
      message: `Exporting ${asset.title} (${asset.format}).`,
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteAsset(asset.id);
    addToast({
      type: 'info',
      title: 'Media Deleted',
      message: `Asset "${asset.title}" removed from library.`,
    });
  };

  if (viewMode === 'list') {
    return (
      <div 
        onClick={() => setDetailOpen(true)}
        className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#0F121C] border border-white/5 hover:border-white/15 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0">
            <MediaPlaceholder
              type={asset.type}
              title={asset.title}
              aspectRatio="16:9"
              gradientTheme={asset.gradientTheme}
              duration={asset.duration}
              showPlayBadge={false}
              className="h-full w-full rounded-none border-0"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <h4 className="text-sm font-semibold text-white truncate group-hover:text-amber-300 transition-colors">
              {asset.title}
            </h4>
            {/* Zero-Pill unboxed metadata */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-mono-numbers">{asset.type}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-numbers">{asset.aspectRatio}</span>
              <span aria-hidden="true">·</span>
              <span>{asset.createdAt}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(asset.id);
            }}
            className="p-2 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            aria-label="Toggle favorite"
          >
            <Heart className={`w-4 h-4 ${asset.favorite ? 'fill-rose-400 text-rose-400' : ''}`} />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Download asset"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        onClick={() => setDetailOpen(true)}
        className="group relative flex flex-col rounded-2xl bg-[#0F121C] border border-white/10 hover:border-amber-500/30 transition-all duration-200 overflow-hidden cursor-pointer select-none"
      >
        {/* Media Preview Box */}
        <div className="relative w-full aspect-video overflow-hidden">
          {asset.url ? (
            asset.type === 'VIDEO' ? (
              <video
                src={asset.url}
                className="w-full h-full object-cover"
                muted
                playsInline
                loop
                onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                onMouseLeave={(e) => e.currentTarget.pause()}
              />
            ) : (
              <img src={asset.url} alt={asset.title} className="w-full h-full object-cover" />
            )
          ) : (
            <MediaPlaceholder
              type={asset.type}
              title={asset.title}
              aspectRatio={asset.aspectRatio}
              gradientTheme={asset.gradientTheme}
              duration={asset.duration}
              className="rounded-b-none border-0 h-full w-full"
            />
          )}

          {/* Quick Floating Actions */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(asset.id);
              }}
              className="p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white hover:text-rose-400 border border-white/10 transition-colors"
              aria-label="Favorite"
            >
              <Heart className={`w-3.5 h-3.5 ${asset.favorite ? 'fill-rose-400 text-rose-400' : ''}`} />
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white hover:text-amber-400 border border-white/10 transition-colors"
              aria-label="Download"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card Metadata (Zero-Pill Discipline) */}
        <div className="p-3.5 flex flex-col gap-1.5">
          <h4 className="text-xs font-semibold text-white tracking-tight group-hover:text-amber-300 transition-colors truncate">
            {asset.title}
          </h4>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono-numbers">
            <span>{asset.type}</span>
            <span aria-hidden="true">·</span>
            <span>{asset.aspectRatio}</span>
            {asset.duration && (
              <>
                <span aria-hidden="true">·</span>
                <span>00:0{asset.duration}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{asset.createdAt}</span>
          </div>

          <p className="text-[11px] text-slate-400 line-clamp-1 leading-relaxed mt-0.5">
            "{asset.prompt}"
          </p>
        </div>
      </div>

      {/* Asset Detail Modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="lg"
        title={asset.title}
        description={`Created ${asset.createdAt}`}
      >
        <div className="flex flex-col gap-4">
          <div className="w-full rounded-xl overflow-hidden border border-white/10 bg-black/40">
            <MediaPlaceholder
              type={asset.type}
              title={asset.title}
              aspectRatio={asset.aspectRatio}
              gradientTheme={asset.gradientTheme}
              duration={asset.duration}
              className="border-0"
            />
          </div>

          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-xs font-semibold text-slate-300">Prompt Directive</span>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              "{asset.prompt}"
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-mono-numbers">
            <div>
              <span className="text-slate-500 text-[10px] block uppercase">Type</span>
              <span className="text-white">{asset.type}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block uppercase">Aspect Ratio</span>
              <span className="text-white">{asset.aspectRatio}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block uppercase">Encoding</span>
              <span className="text-white">{asset.format}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <Button
              size="sm"
              variant="danger"
              onClick={handleDelete}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Delete
            </Button>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownload}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Download Master
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setDetailOpen(false);
                  handleOpenStudio();
                }}
                leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              >
                Open in Studio
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
