import React from 'react';

interface ReportTopBarProps {
  paperTitle: string;
  studentName: string;
  uiScale: 'A-' | 'A' | 'A+';
  onSetUiScale: (scale: 'A-' | 'A' | 'A+') => void;
  onResetLayout: () => void;
  onStepUpload: () => void;
  onStepEvaluate: () => void;
}

export const ReportTopBar: React.FC<ReportTopBarProps> = ({
  paperTitle,
  studentName,
  uiScale,
  onSetUiScale,
  onResetLayout,
  onStepUpload,
  onStepEvaluate,
}) => {
  return (
    <header
      className="h-12 bg-white border-b border-[#E2E8F0] px-5 flex items-center justify-between shrink-0 z-30"
      style={{ height: '48px', minHeight: '48px', maxHeight: '48px', flexShrink: 0 }}
    >
      {/* Left: Logo & Breadcrumbs */}
      <div className="flex items-center space-x-3 text-xs">
        <div className="flex items-center space-x-2 font-bold text-indigo-600 text-sm tracking-tight">
          <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span className="text-[#0F172A] font-bold text-base tracking-tight">EvalDesk</span>
        </div>
        <span className="text-slate-300">/</span>
        <div className="flex items-center space-x-2 text-slate-500 font-medium">
          <span className="truncate max-w-[200px]" title={paperTitle}>
            {paperTitle || 'Examination'}
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-semibold truncate max-w-[160px]" title={studentName}>
            {studentName || 'Student'}
          </span>
        </div>
      </div>

      {/* Center: Minimalist 3-Step Horizontal Stepper */}
      <nav aria-label="Workflow Stepper" className="hidden md:flex items-center space-x-2 text-xs">
        {/* Step 1 */}
        <button
          type="button"
          onClick={onStepUpload}
          className="flex items-center space-x-1.5 text-slate-500 font-medium hover:text-slate-900 transition-colors cursor-pointer"
        >
          <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                clipRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                fillRule="evenodd"
              />
            </svg>
          </span>
          <span>1. Upload</span>
        </button>

        <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>

        {/* Step 2 */}
        <button
          type="button"
          onClick={onStepEvaluate}
          className="flex items-center space-x-1.5 text-slate-500 font-medium hover:text-slate-900 transition-colors cursor-pointer"
        >
          <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                clipRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                fillRule="evenodd"
              />
            </svg>
          </span>
          <span>2. Evaluate</span>
        </button>

        <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>

        {/* Step 3 (Active) */}
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white font-medium text-xs shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          <span>3. Report</span>
        </div>
      </nav>

      {/* Right Controls: Text Size Toggle & Reset */}
      <div className="flex items-center space-x-3 text-xs">
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
          <button
            className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
              uiScale === 'A-'
                ? 'font-semibold text-indigo-600 bg-white shadow-xs'
                : 'font-medium text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => onSetUiScale('A-')}
            type="button"
            title="Compact UI Scale"
          >
            A-
          </button>
          <button
            className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
              uiScale === 'A'
                ? 'font-semibold text-indigo-600 bg-white shadow-xs'
                : 'font-medium text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => onSetUiScale('A')}
            type="button"
            title="Default UI Scale"
          >
            A
          </button>
          <button
            className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
              uiScale === 'A+'
                ? 'font-semibold text-indigo-600 bg-white shadow-xs'
                : 'font-medium text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => onSetUiScale('A+')}
            type="button"
            title="Enlarged UI Scale"
          >
            A+
          </button>
        </div>

        <button
          onClick={onResetLayout}
          className="flex items-center space-x-1.5 text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium transition-colors cursor-pointer"
          type="button"
          title="Reset pane split and zoom"
        >
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>Reset Layout</span>
        </button>
      </div>
    </header>
  );
};
