import React from 'react';
import { UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import { useSheetStore } from '../state/useSheetStore';

export const UploadScreen: React.FC = () => {
  const [state] = useSheetStore();

  return (
    <div className="panel grid grid-cols-1 md:grid-cols-2 gap-4 p-4 h-full">
      {/* Drop Zone Panel */}
      <section
        aria-label="Upload Zone"
        className="flex flex-col items-center justify-center border-2 border-dashed border-[var(--surface-border)] rounded-lg p-6 bg-[var(--surface-card)] hover:border-[var(--accent-indigo)] hover:bg-[var(--accent-indigo-subtle)]/30 transition-all cursor-pointer text-center select-none"
      >
        <div className="w-12 h-12 rounded-full bg-[var(--accent-indigo-subtle)] text-[var(--accent-indigo)] flex items-center justify-center mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>
        <h2 className="text-base font-semibold text-[var(--ink-primary)] mb-1">
          Drop student answer sheets here
        </h2>
        <p className="text-xs text-[var(--ink-muted)] mb-4">
          or click to browse from device · Accepts PDF, JPG, PNG (multi-page)
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-indigo)] bg-[var(--accent-indigo-subtle)] px-3 py-1 rounded-md">
          <FileText className="w-3.5 h-3.5" />
          Select files
        </span>
      </section>

      {/* Queue Panel */}
      <section
        aria-label="Upload Queue"
        className="flex flex-col border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)] p-4 min-h-0"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)] mb-3">
          <h3 className="text-sm font-semibold text-[var(--ink-primary)]">
            Upload Queue (This Batch)
          </h3>
          <span className="text-xs text-[var(--ink-muted)] tabular-nums">0 sheets</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[var(--ink-muted)]">
          <p className="text-xs">No sheets in queue. Upload sheets on the left to begin.</p>
        </div>
      </section>
    </div>
  );
};
