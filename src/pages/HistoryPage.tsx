import React, { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { HistoryItem } from '../features/history/HistoryItem';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/common/EmptyState';
import { Clock, Trash2, Sparkles, RefreshCw } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const { history, loadHistory, clearHistory, navigate, addToast } = useAppStore();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClear = () => {
    clearHistory();
    addToast({
      type: 'info',
      title: 'History Cleared',
      message: 'All local session generation logs removed.',
    });
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider font-mono-numbers">
            Audit & Pipeline Logs
          </span>
          <h1 className="text-2xl font-display font-extrabold text-white mt-0.5">
            Generation History
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review past latent synthesis jobs, inspect parameters, and reload directives into the studio canvas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {history.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClear}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Clear Logs
            </Button>
          )}

          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/app/create')}
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            New Job
          </Button>
        </div>
      </div>

      {/* History List or Empty State */}
      {history.length === 0 ? (
        <EmptyState
          icon={<Clock className="w-6 h-6" />}
          title="No generation history yet"
          description="Your synthesis queue runs and execution statuses will appear here as you create in the studio."
          actionLabel="Launch Studio"
          onAction={() => navigate('/app/create')}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((record) => (
            <HistoryItem key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
};
