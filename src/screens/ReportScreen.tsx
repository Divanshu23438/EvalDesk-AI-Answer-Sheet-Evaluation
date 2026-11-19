import React from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { StudentReportView } from '../components/StudentReportView';
import { ArrowLeft } from 'lucide-react';

export const ReportScreen: React.FC = () => {
  const [state, store] = useSheetStore();

  const getSheetIdFromUrl = () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/#\/report\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    return null;
  };

  const effectiveSheetId = state.sheetId || getSheetIdFromUrl() || '';

  const handleStepUpload = () => {
    store.setStep('upload');
    window.location.hash = '#/upload';
  };

  const handleStepEvaluate = () => {
    if (effectiveSheetId) {
      store.setStep('evaluate', effectiveSheetId);
      window.location.hash = `#/evaluate/${effectiveSheetId}`;
    } else {
      handleStepUpload();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden bg-[#F6F7F5] dark:bg-[#111312]">
      {/* Top 1 Upload → 2 Evaluate → 3 Report (ACTIVE) workflow bar & Back to Evaluation link */}
      <header className="h-11 bg-white dark:bg-[#181B19] border-b border-[#E2E8E4] dark:border-[#2A2F2C] px-4 flex items-center justify-between shrink-0 select-none z-10">
        <div className="flex items-center space-x-3 text-xs">
          <button
            type="button"
            onClick={handleStepEvaluate}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0F5132] dark:text-[#7CC9A3] hover:text-[#0B3D26] dark:hover:text-[#27855A] transition-colors cursor-pointer"
            title="Back to Evaluation"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Evaluation</span>
          </button>
          <span className="text-[#E2E8E4] dark:text-[#2F3532]">|</span>
          <div className="flex items-center space-x-2 text-[#6B7280] dark:text-[#68706C] font-medium">
            <span className="truncate max-w-[200px]" title={state.paperTitle || 'Examination'}>
              {state.paperTitle || 'Examination'}
            </span>
            {state.studentName && (
              <>
                <span className="text-[#E2E8E4] dark:text-[#2F3532]">/</span>
                <span className="text-[#111827] dark:text-[#ECEEED] font-semibold truncate max-w-[160px]" title={state.studentName}>
                  {state.studentName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Center: Minimalist 3-Step Horizontal Stepper */}
        <nav aria-label="Workflow Stepper" className="hidden md:flex items-center space-x-2 text-xs">
          {/* Step 1 */}
          <button
            type="button"
            onClick={handleStepUpload}
            className="flex items-center space-x-1.5 text-[#6B7280] dark:text-[#68706C] font-medium hover:text-[#111827] dark:hover:text-[#ECEEED] transition-colors cursor-pointer"
          >
            <span className="w-4 h-4 rounded-full bg-emerald-50 dark:bg-[#1A2B23] text-emerald-600 dark:text-[#7CC9A3] flex items-center justify-center">
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

          <svg className="w-3.5 h-3.5 text-[#E2E8E4] dark:text-[#2F3532]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>

          {/* Step 2 */}
          <button
            type="button"
            onClick={handleStepEvaluate}
            className="flex items-center space-x-1.5 text-[#6B7280] dark:text-[#68706C] font-medium hover:text-[#111827] dark:hover:text-[#ECEEED] transition-colors cursor-pointer"
          >
            <span className="w-4 h-4 rounded-full bg-emerald-50 dark:bg-[#1A2B23] text-emerald-600 dark:text-[#7CC9A3] flex items-center justify-center">
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

          <svg className="w-3.5 h-3.5 text-[#E2E8E4] dark:text-[#2F3532]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>

          {/* Step 3 (Active) */}
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#0F5132] dark:bg-[#1F6E4A] text-white font-medium text-xs shadow-none">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span>3. Report (ACTIVE)</span>
          </div>
        </nav>

        {/* Right placeholder for balance */}
        <div className="w-28 text-right text-[11px] font-mono text-[#6B7280] dark:text-[#68706C]">
          Finalized
        </div>
      </header>

      {/* Embedded Student Report View */}
      <StudentReportView sheetId={effectiveSheetId} onBack={handleStepEvaluate} />
    </div>
  );
};
