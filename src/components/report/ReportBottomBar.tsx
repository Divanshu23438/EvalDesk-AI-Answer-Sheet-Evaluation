import React from 'react';

interface ReportBottomBarProps {
  currentSheetIndex: number;
  totalSheets: number;
  onBackToEvaluate: () => void;
  onDownloadExcel: () => void;
  onDownloadPdf: () => void;
  onNextSheet: () => void;
  isDownloadingExcel?: boolean;
  isDownloadingPdf?: boolean;
  isLastSheet?: boolean;
}

export const ReportBottomBar: React.FC<ReportBottomBarProps> = ({
  currentSheetIndex,
  totalSheets,
  onBackToEvaluate,
  onDownloadExcel,
  onDownloadPdf,
  onNextSheet,
  isDownloadingExcel = false,
  isDownloadingPdf = false,
  isLastSheet = false,
}) => {
  return (
    <footer
      className="h-14 bg-white border-t border-[#E2E8F0] px-6 flex items-center justify-between shrink-0 z-30 select-none"
      style={{ height: '56px', minHeight: '56px', maxHeight: '56px', flexShrink: 0 }}
    >
      {/* Left: Back Button & Subtle Sheet Counter */}
      <div className="flex items-center space-x-3 text-xs">
        <button
          onClick={onBackToEvaluate}
          className="px-3 py-1.5 rounded-lg text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
          type="button"
          title="Return to Evaluation Workspace"
        >
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          <span>Back to Evaluate</span>
        </button>
        <span className="text-slate-400 font-mono">
          Sheet {currentSheetIndex} of {Math.max(1, totalSheets)}
        </span>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center space-x-2 text-xs">
        {/* Download Excel (.xlsx) */}
        <button
          onClick={onDownloadExcel}
          disabled={isDownloadingExcel}
          className="px-3 py-1.5 rounded-lg text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 font-medium flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
          type="button"
          title="Download Class Excel Results Report"
        >
          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>{isDownloadingExcel ? 'Exporting Excel...' : 'Download Excel (.xlsx)'}</span>
        </button>

        {/* Download PDF Report */}
        <button
          onClick={onDownloadPdf}
          disabled={isDownloadingPdf}
          className="px-3 py-1.5 rounded-lg text-[#0F5132] hover:text-[#0B3D26] bg-[#E8F3EE] hover:bg-[#E8F3EE] border border-[#0F5132]/20 font-medium flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
          type="button"
          title="Download Student Report Card PDF"
        >
          <svg className="w-3.5 h-3.5 text-[#0F5132]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
        </button>

        {/* Next Sheet */}
        <button
          onClick={onNextSheet}
          disabled={isLastSheet}
          title={isLastSheet ? 'Last sheet in assessment' : 'Navigate to next sheet'}
          className="px-4 py-1.5 rounded-lg text-white bg-[#0F5132] hover:bg-[#0B3D26] disabled:opacity-40 disabled:cursor-not-allowed font-semibold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          type="button"
        >
          <span>Next Sheet</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>
      </div>
    </footer>
  );
};
