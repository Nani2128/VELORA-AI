import React from 'react';
import { Button } from '../ui/Button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 md:p-12 border border-dashed border-white/10 rounded-2xl bg-[#0F1118]/50 max-w-md mx-auto ${className}`}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
          {icon}
        </div>
      )}
      <h4 className="text-base font-semibold text-white tracking-tight">{title}</h4>
      <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">{description}</p>
      
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-3 mt-6">
          {actionLabel && onAction && (
            <Button size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button size="sm" variant="outline" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-6 border border-rose-500/20 bg-rose-950/15 rounded-2xl ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <p className="text-xs text-rose-300/80 mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <Button
          size="sm"
          variant="secondary"
          className="mt-4"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={onRetry}
        >
          Try Again
        </Button>
      )}
    </div>
  );
};

export const SkeletonCard: React.FC<{ aspectRatio?: string; className?: string }> = ({
  aspectRatio = 'aspect-video',
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-3 rounded-xl border border-white/5 bg-[#12141D] p-3 overflow-hidden ${className}`}>
      <div className={`w-full ${aspectRatio} rounded-lg bg-white/5 animate-pulse`} />
      <div className="flex flex-col gap-2 pt-1">
        <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-white/5 rounded animate-pulse" />
      </div>
    </div>
  );
};
