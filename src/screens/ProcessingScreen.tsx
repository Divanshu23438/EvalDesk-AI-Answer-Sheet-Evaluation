import React from 'react';
import { Loader2, CheckCircle2, Clock } from 'lucide-react';
import { useSheetStore } from '../state/useSheetStore';

export const ProcessingScreen: React.FC = () => {
  const [state] = useSheetStore();

  return (
    <div className="panel flex flex-col items-center justify-center p-6 h-full text-center">
      <div className="max-w-md w-full bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-xl p-8 shadow-sm flex flex-col items-center">
        <div className="relative w-20 h-28 bg-[var(--surface-subtle)] border border-[var(--surface-border)] rounded-md flex items-center justify-center mb-6 overflow-hidden">
          <Loader2 className="w-8 h-8 text-[var(--accent-indigo)] animate-spin" />
          {/* Scanline animation sweep */}
          <div
            className="absolute inset-x-0 h-1 bg-[var(--accent-indigo)] shadow-[0_0_8px_var(--accent-indigo)] animate-[scanline_1.6s_ease-in-out_infinite]"
            style={{ top: '0%' }}
          />
        </div>

        <h2 className="text-base font-semibold text-[var(--ink-primary)] mb-2">
          Evaluating Answer Sheet
        </h2>
        <p className="text-xs text-[var(--ink-muted)] mb-6">
          {state.sheetId ? `Processing Sheet ID: ${state.sheetId}` : 'Awaiting sheet processing...'}
        </p>

        {/* Real Stage Indicator Strip */}
        <div className="w-full flex items-center justify-between text-[11px] text-[var(--ink-muted)] border-t border-[var(--surface-border)] pt-4">
          <span className="flex items-center gap-1 font-medium text-[var(--accent-indigo)]">
            <Clock className="w-3.5 h-3.5 animate-spin" /> Reading
          </span>
          <span>→</span>
          <span>Matching</span>
          <span>→</span>
          <span>Marking</span>
          <span>→</span>
          <span>Flagging</span>
        </div>
      </div>
    </div>
  );
};
