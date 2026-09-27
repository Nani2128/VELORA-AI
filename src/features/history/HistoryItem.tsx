import React from 'react';
import { GenerationRecord } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../../components/ui/Button';
import { RotateCcw, CheckCircle2, Clock, RotateCw, XOctagon, AlertCircle, ArrowUpRight } from 'lucide-react';

interface HistoryItemProps {
  record: GenerationRecord;
}

export const HistoryItem: React.FC<HistoryItemProps> = ({ record }) => {
  const { loadHistoryIntoStudio } = useAppStore();

  const getStatusBadge = () => {
    switch (record.status) {
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
            <span>Processing</span>
          </span>
        );
      case 'QUEUED':
        return (
          <span className="flex items-center gap-1.5 text-xs text-sky-400 font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>Queued</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <XOctagon className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1.5 text-xs text-rose-400 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0F121C] border border-white/5 hover:border-white/15 transition-all">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="mt-0.5">
          {getStatusBadge()}
        </div>

        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <p className="text-xs text-slate-200 font-medium leading-relaxed line-clamp-2">
            "{record.prompt}"
          </p>

          {/* Unboxed Metadata */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono-numbers">
            <span>{record.type.replace(/_/g, ' ')}</span>
            <span aria-hidden="true">·</span>
            <span>{record.settings.aspectRatio}</span>
            {record.settings.durationSeconds && (
              <>
                <span aria-hidden="true">·</span>
                <span>{record.settings.durationSeconds}s</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{record.settings.style}</span>
            <span aria-hidden="true">·</span>
            <span>{record.createdAt}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => loadHistoryIntoStudio(record)}
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          className="text-xs"
        >
          Load in Studio
        </Button>
      </div>
    </div>
  );
};
