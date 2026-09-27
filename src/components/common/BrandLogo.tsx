import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className={`relative ${iconSizes[size]} rounded-xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-900 p-0.5 shadow-md shadow-amber-500/20 shrink-0`}>
        <div className="w-full h-full bg-[#0A0C13] rounded-[10px] flex items-center justify-center overflow-hidden">
          <svg viewBox="0 0 24 24" className="w-4/5 h-4/5 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`font-display font-extrabold tracking-wider text-white ${textSizes[size]}`}>
          VELORA
        </span>
        <span className="text-[10px] font-mono-numbers font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300">
          AI
        </span>
      </div>
    </div>
  );
};
