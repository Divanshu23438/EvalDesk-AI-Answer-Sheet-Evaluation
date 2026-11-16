import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { SheetStoreError } from '../state/useSheetStore';

interface ErrorBannerProps {
  error: SheetStoreError | null;
  onDismiss: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss }) => {
  if (!error) return null;

  return (
    <aside
      role="alert"
      aria-live="assertive"
      className="absolute top-[48px] left-0 right-0 z-50 px-4 py-2 bg-[var(--status-failed-bg)] border-b border-[var(--status-failed-border)] text-[var(--status-failed)] shadow-md flex items-center justify-between text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-150"
    >
      <div className="flex items-center gap-2 min-w-0 pr-4">
        <AlertCircle className="w-4 h-4 shrink-0 text-[var(--status-failed)]" aria-hidden="true" />
        <span className="font-semibold uppercase tracking-wider text-[11px] px-1.5 py-0.5 rounded bg-[var(--status-failed)] text-white">
          {error.code || 'ERROR'}
        </span>
        <p className="truncate text-neutral-800 dark:text-neutral-200">
          {error.message}
          {error.retry_at && (
            <span className="ml-2 font-mono text-xs opacity-90">
              (Retry available at: {new Date(error.retry_at).toLocaleTimeString()})
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {error.onRetry && (
          <button
            type="button"
            onClick={error.onRetry}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-[var(--status-failed)] text-white hover:opacity-90 active:scale-95 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Retry
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
          aria-label="Dismiss error banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
