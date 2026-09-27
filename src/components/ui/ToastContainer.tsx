import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAppStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
          warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
          error: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
          info: <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />,
        };

        const borders = {
          success: 'border-emerald-500/25 bg-[#0F1815]/95',
          warning: 'border-amber-500/25 bg-[#1A160F]/95',
          error: 'border-rose-500/25 bg-[#1C0F13]/95',
          info: 'border-sky-500/25 bg-[#0E1520]/95',
        };

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl border backdrop-blur-md shadow-xl text-slate-100 transition-all duration-200 animate-in slide-in-from-right-5 fade-in ${borders[toast.type]}`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {icons[toast.type]}
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white tracking-tight">{toast.title}</span>
                {toast.message && (
                  <span className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toast.message}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 text-slate-400 hover:text-white rounded-md transition-colors shrink-0"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
