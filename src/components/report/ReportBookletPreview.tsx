import React, { useState, useEffect, useRef } from 'react';
import { NormalizedQuestion } from './types';

interface ReportBookletPreviewProps {
  sheetId: string | null;
  filename: string;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  activeQuestion?: NormalizedQuestion | null;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitZoom: () => void;
}

export const ReportBookletPreview: React.FC<ReportBookletPreviewProps> = ({
  sheetId,
  filename,
  totalPages,
  currentPage,
  onPageChange,
  activeQuestion,
  zoom,
  onZoomChange,
  onFitZoom,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset image error on page or sheet change
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [sheetId, currentPage]);

  // Extract bbox for activeQuestion on currentPage
  const activeBbox = (() => {
    if (!activeQuestion?.bbox) return null;
    let b = activeQuestion.bbox;
    const pgs = activeQuestion.page_numbers || [1];
    const pageIdx = pgs.indexOf(currentPage);

    // If active question is not on this page, don't show its bbox
    if (pageIdx < 0 && pgs.length > 0 && pgs[0] !== currentPage) {
      return null;
    }

    if (pageIdx >= 0 && Array.isArray(b) && Array.isArray(b[pageIdx])) {
      b = b[pageIdx];
    }
    while (Array.isArray(b) && b.length === 1 && Array.isArray(b[0])) {
      b = b[0];
    }
    if (Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === 'number')) {
      const [ymin, xmin, ymax, xmax] = b;
      if (ymax > ymin && xmax > xmin) {
        return {
          top: Math.max(0, Math.min(1, ymin)) * 100,
          left: Math.max(0, Math.min(1, xmin)) * 100,
          width: Math.max(0.01, Math.min(1, xmax - xmin)) * 100,
          height: Math.max(0.01, Math.min(1, ymax - ymin)) * 100,
        };
      }
    }
    return null;
  })();

  const handleZoomIn = () => {
    onZoomChange(Math.min(250, zoom + 15));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(40, zoom - 15));
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const imageUrl = sheetId ? `/api/sheets/${sheetId}/pages/${currentPage}/image?w=1200` : '';

  const matchPct = activeQuestion?.legibility
    ? Math.round(activeQuestion.legibility > 1 ? activeQuestion.legibility : activeQuestion.legibility * 100)
    : 92;

  return (
    <div
      className="h-full bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden select-none"
      style={{ height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Single-row Header (h-12) */}
      <div className="h-12 border-b border-slate-200 px-4 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center space-x-2 min-w-0">
          <h2 className="font-semibold text-slate-900 text-sm shrink-0">Answer Booklet Preview</h2>
          <span
            className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded truncate max-w-[170px]"
            title={filename || 'sheet.pdf'}
          >
            {filename || 'sheet.pdf'}
          </span>
        </div>

        {/* Minimal inline controls */}
        <div className="flex items-center space-x-2 text-xs shrink-0">
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:text-indigo-600 text-slate-500 transition-colors cursor-pointer"
              title="Zoom Out"
              type="button"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M20 12H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
            <span className="font-mono text-[11px] font-semibold text-slate-700 px-1 tabular-nums">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 hover:text-indigo-600 text-slate-500 transition-colors cursor-pointer"
              title="Zoom In"
              type="button"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </div>

          <button
            onClick={onFitZoom}
            className="px-2 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
            type="button"
            title="Reset Zoom to Fit"
          >
            Fit
          </button>

          <div className="flex items-center space-x-1 text-slate-600 border border-slate-200 bg-slate-50 rounded-md px-2 py-0.5 font-mono text-xs">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="hover:text-slate-900 p-0.5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              type="button"
              title="Previous Page"
            >
              ‹
            </button>
            <span className="font-semibold text-slate-900">Page {currentPage}</span>
            <span className="text-slate-400">of {Math.max(1, totalPages)}</span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className="hover:text-slate-900 p-0.5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              type="button"
              title="Next Page"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Scanned Canvas Viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-[#F1F5F9] p-4 flex items-start justify-center relative min-h-0"
      >
        <div
          className="relative transition-transform duration-150 origin-top flex flex-col items-center shadow-md bg-white rounded-sm border border-slate-300"
          style={{
            transform: `scale(${zoom / 100})`,
            width: 'fit-content',
            maxWidth: '100%',
          }}
        >
          {/* Real Page Image */}
          {!imageError && imageUrl ? (
            <div className="relative inline-block max-w-[650px] min-w-[320px]">
              <img
                src={imageUrl}
                alt={`Sheet page ${currentPage}`}
                className="w-full h-auto block select-none pointer-events-none rounded-sm"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />

              {/* Bounding box overlay highlight */}
              {activeBbox && (
                <div
                  className="absolute border-2 border-indigo-600 bg-indigo-500/15 rounded pointer-events-none transition-all duration-200 z-10"
                  style={{
                    top: `${activeBbox.top}%`,
                    left: `${activeBbox.left}%`,
                    width: `${activeBbox.width}%`,
                    height: `${activeBbox.height}%`,
                  }}
                >
                  <div className="absolute -top-3.5 right-0 bg-indigo-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-xs tracking-wider whitespace-nowrap">
                    ANS Q{activeQuestion?.q_no || ''} · {matchPct}% MATCH
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Fallback Exam Sheet Representation */
            <div
              className="w-[500px] max-w-full bg-white shadow-xs relative rounded-sm p-6 border border-slate-300 select-text font-sans text-xs"
              style={{
                backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px)',
                backgroundSize: '100% 28px',
                lineHeight: '28px',
              }}
            >
              <div
                className="absolute top-0 bottom-0 left-[44px] w-[1.5px] bg-rose-300 pointer-events-none"
              />

              <div className="pl-8 space-y-2">
                <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] pb-1 border-b border-slate-100">
                  <span>Page {currentPage} of {totalPages}</span>
                  <span>{activeQuestion ? `Question Q${activeQuestion.q_no}` : 'Answer Booklet'}</span>
                </div>

                {activeQuestion ? (
                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-md relative z-10">
                    <div className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wider mb-1">
                      ANS Q{activeQuestion.q_no} · {matchPct}% OCR MATCH
                    </div>
                    <div className="text-slate-800 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                      {activeQuestion.ocr_text || '(No OCR text extracted for this question)'}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 italic py-8 text-center font-mono text-xs">
                    Select a question from Overview or Question-wise Marks to highlight on page
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
