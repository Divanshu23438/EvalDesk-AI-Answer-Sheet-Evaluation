import React, { useState } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { Download, Award, BarChart3 } from 'lucide-react';

export const ReportScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'student' | 'paper'>('student');
  const [state] = useSheetStore();

  return (
    <div className="panel h-full flex flex-col p-4 space-y-4">
      {/* Sub-header Tabs & Actions */}
      <div className="flex items-center justify-between border-b border-[var(--surface-border)] pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('student')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'student'
                ? 'bg-[var(--accent-indigo)] text-white shadow-sm'
                : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              Student Report Card
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paper')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'paper'
                ? 'bg-[var(--accent-indigo)] text-white shadow-sm'
                : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Paper Analytics
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--ink-muted)] cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Main Report View */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="panel border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)] p-5">
          <h3 className="text-sm font-semibold text-[var(--ink-primary)] mb-3">
            {activeTab === 'student' ? 'Academic Evaluation Summary' : 'Score Distribution'}
          </h3>
          <p className="text-xs text-[var(--ink-muted)]">
            {state.sheetId ? `Report for Sheet ${state.sheetId}` : 'No evaluation data loaded.'}
          </p>
        </div>

        <div className="panel border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)] p-5">
          <h3 className="text-sm font-semibold text-[var(--ink-primary)] mb-3">
            {activeTab === 'student' ? 'Strengths & Improvements' : 'Question Breakdown'}
          </h3>
          <p className="text-xs text-[var(--ink-muted)]">
            Awaiting student evaluation completion to generate report analytics.
          </p>
        </div>
      </div>
    </div>
  );
};
