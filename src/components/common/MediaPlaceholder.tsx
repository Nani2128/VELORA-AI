import React, { useState } from 'react';
import { Film, Image as ImageIcon, Play } from 'lucide-react';
import { AssetType, AspectRatio } from '../../types';

interface MediaPlaceholderProps {
  type: AssetType;
  title: string;
  aspectRatio?: AspectRatio;
  gradientTheme?: string;
  duration?: number;
  imageUrl?: string;
  className?: string;
  onClick?: () => void;
  showPlayBadge?: boolean;
}

export const MediaPlaceholder: React.FC<MediaPlaceholderProps> = ({
  type,
  title,
  aspectRatio = '16:9',
  gradientTheme = 'from-violet-900/30 via-slate-900 to-slate-950',
  duration,
  imageUrl,
  className = '',
  onClick,
  showPlayBadge = true,
}) => {
  const [imageError, setImageError] = useState(false);

  const aspectClasses = {
    '16:9': 'aspect-video',
    '9:16': 'aspect-[9/16]',
    '1:1': 'aspect-square',
    '4:3': 'aspect-[4/3]',
    '21:9': 'aspect-[21/9]',
  };

  return (
    <div
      onClick={onClick}
      className={`relative w-full ${aspectClasses[aspectRatio]} overflow-hidden rounded-xl border border-white/10 group select-none ${className}`}
    >
      {/* Background Graphic Layer */}
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt={title}
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className={`w-full h-full bg-gradient-to-br ${gradientTheme} relative flex flex-col justify-between p-4 overflow-hidden`}>
          {/* Subtle noise/grid pattern */}
          <div 
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Central graphic icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center backdrop-blur-md text-slate-300 group-hover:scale-110 group-hover:border-amber-400/40 group-hover:text-amber-300 transition-all duration-300">
              {type === 'VIDEO' ? (
                <Film className="w-6 h-6 stroke-[1.5]" />
              ) : (
                <ImageIcon className="w-6 h-6 stroke-[1.5]" />
              )}
            </div>
          </div>

          {/* Ambient luminous glow */}
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      )}

      {/* Video duration badge if applicable */}
      {type === 'VIDEO' && duration && showPlayBadge && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-mono-numbers text-slate-200">
          <Play className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span>00:0{duration}</span>
        </div>
      )}

      {/* Hover Scrim */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
    </div>
  );
};
