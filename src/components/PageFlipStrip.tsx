import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Check, RefreshCw, BookOpen, Layers } from 'lucide-react';

export type PageOcrStatus = 'pending' | 'reading' | 'done' | 'failed';

export interface SheetPageStatus {
  n: number;
  status: PageOcrStatus;
  image_url?: string | null;
  legibility?: number | null;
  error?: string | null;
}

const CSS = `
@keyframes evalScan {
  0% { top: 2%; opacity: 0.9; }
  50% { opacity: 1; }
  100% { top: 96%; opacity: 0.9; }
}
.eval-scan-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, rgba(99,102,241,0.2) 0%, rgba(99,102,241,0.95) 50%, rgba(99,102,241,0.2) 100%);
  box-shadow: 0 0 10px rgba(99,102,241,0.8), 0 0 4px rgba(99,102,241,0.9);
  animation: evalScan 1.2s ease-in-out infinite alternate;
  z-index: 25;
  pointer-events: none;
}
.spine-shadow {
  background: linear-gradient(to right, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.18) 3%, rgba(0,0,0,0.06) 8%, transparent 16%);
  pointer-events: none;
}
.page-shadow {
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.18), 0 8px 10px -6px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.08);
}
@media (prefers-reduced-motion: reduce) {
  .eval-leaf-flip { transition: none !important; }
  .eval-scan-line { animation: none; top: 50%; }
}
`;

const LINED_PAPER: React.CSSProperties = {
  background: 'repeating-linear-gradient(#fcfcfd, #fcfcfd 15px, #e2e8f0 15px, #e2e8f0 16px)',
};

export const PageFlipStrip: React.FC<{ pages: SheetPageStatus[] }> = ({ pages }) => {
  const sorted = [...pages].sort((a, b) => a.n - b.n);
  const total = sorted.length;
  const donePages = sorted.filter((p) => p.status === 'done');
  const doneCount = donePages.length;
  const activeReading = sorted.find((p) => p.status === 'reading');
  const failedPage = sorted.find((p) => p.status === 'failed');

  const latestDonePage = donePages.length > 0 ? donePages[donePages.length - 1] : null;

  // Manual inspection page selection
  const [selectedPageNum, setSelectedPageNum] = useState<number | null>(null);

  // 3D Flip state management
  const [isFlipping, setIsFlipping] = useState(false);
  const [leafPrevPage, setLeafPrevPage] = useState<SheetPageStatus | null>(null);
  const [underlyingPage, setUnderlyingPage] = useState<SheetPageStatus | null>(null);

  const prevDoneCountRef = useRef<number>(doneCount);
  const flipTimerRef = useRef<any>(null);

  // When latest completed page advances, trigger 650ms 3D page flip
  useEffect(() => {
    if (doneCount > prevDoneCountRef.current && latestDonePage) {
      // Find the page that was shown right before this new completion
      const prevPageNum = latestDonePage.n > 1 ? latestDonePage.n - 1 : 1;
      const prevPage = sorted.find((p) => p.n === prevPageNum) || sorted[0];

      setLeafPrevPage(prevPage);
      setUnderlyingPage(latestDonePage);
      setIsFlipping(true);

      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
      flipTimerRef.current = setTimeout(() => {
        setIsFlipping(false);
      }, 650);
    }
    prevDoneCountRef.current = doneCount;

    return () => {
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    };
  }, [doneCount, latestDonePage, sorted]);

  // Determine which page to display on the base layer
  const activeDisplayPage: SheetPageStatus | undefined = (() => {
    if (selectedPageNum !== null) {
      const selected = sorted.find((p) => p.n === selectedPageNum);
      if (selected) return selected;
    }
    if (isFlipping && underlyingPage) {
      return underlyingPage;
    }
    if (activeReading) {
      return activeReading;
    }
    if (latestDonePage) {
      return latestDonePage;
    }
    return sorted[0];
  })();

  const isCurrentReading = activeDisplayPage?.status === 'reading';

  // Status message
  const statusText = (() => {
    if (failedPage) {
      return `Page ${failedPage.n} failed to read · ${doneCount} of ${total} scanned`;
    }
    if (activeReading) {
      return `Page ${doneCount} of ${total} scanned · Reading Page ${activeReading.n}...`;
    }
    if (doneCount === total && total > 0) {
      return `All ${total} pages scanned successfully`;
    }
    return `Page ${doneCount} of ${total} scanned`;
  })();

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/70 p-3 shadow-xs space-y-3">
      <style>{CSS}</style>

      {/* Top Status Header Bar */}
      <div className="flex items-center justify-between text-xs" aria-live="polite">
        <div className="flex items-center gap-2">
          {activeReading ? (
            <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
          ) : failedPage ? (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          ) : doneCount === total && total > 0 ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <BookOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
          <span
            className={`font-semibold ${
              failedPage ? 'text-rose-700' : activeReading ? 'text-indigo-900' : 'text-slate-800'
            }`}
          >
            {statusText}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
          <span className="font-bold text-indigo-700">{doneCount}</span>
          <span className="text-slate-400">/</span>
          <span>{total}</span>
        </div>
      </div>

      {/* 3D Book-Style Page Flip Container */}
      <div className="flex justify-center items-center py-1">
        <div
          className="relative w-full max-w-[220px] aspect-[3/4] rounded-r-lg rounded-l-xs overflow-hidden page-shadow bg-white"
          style={{ perspective: 1200 }}
        >
          {/* Base Layer: Current / Incoming Underlying Page */}
          {activeDisplayPage ? (
            <div className="absolute inset-0 bg-white flex flex-col overflow-hidden">
              {activeDisplayPage.image_url ? (
                <img
                  src={activeDisplayPage.image_url}
                  alt={`Page ${activeDisplayPage.n}`}
                  className="w-full h-full object-cover object-top select-none"
                  loading="eager"
                />
              ) : (
                <div style={LINED_PAPER} className="w-full h-full p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400">Page {activeDisplayPage.n}</span>
                  <span className="text-[10px] text-slate-400 italic">Scanned document preview</span>
                </div>
              )}

              {/* Spine Shadow on Left Edge */}
              <div className="absolute inset-y-0 left-0 w-8 spine-shadow" />

              {/* Laser Scan line when page is reading */}
              {isCurrentReading && <div className="eval-scan-line" />}

              {/* Page Number & Legibility Badge */}
              <div className="absolute bottom-2 right-2 flex items-center gap-1 z-20">
                {activeDisplayPage.legibility !== undefined && activeDisplayPage.legibility !== null && (
                  <span className="text-[9px] font-mono font-semibold text-emerald-800 bg-white/95 border border-emerald-200 px-1 py-0.5 rounded shadow-2xs">
                    {(activeDisplayPage.legibility * 100).toFixed(0)}% leg
                  </span>
                )}
                <span className="text-[10px] font-mono font-bold text-slate-700 bg-white/95 border border-slate-300 px-1.5 py-0.5 rounded shadow-2xs">
                  p.{activeDisplayPage.n}
                </span>
              </div>
            </div>
          ) : (
            <div style={LINED_PAPER} className="w-full h-full flex items-center justify-center">
              <span className="text-xs text-slate-400">No pages loaded</span>
            </div>
          )}

          {/* Top Layer: Flipping Leaf (Active during 650ms transition) */}
          {isFlipping && leafPrevPage && (
            <div
              className="eval-leaf-flip absolute inset-0 z-30 pointer-events-none"
              style={{
                transformStyle: 'preserve-3d',
                transformOrigin: 'left center',
                transition: 'transform 650ms cubic-bezier(0.4, 0.2, 0.2, 1)',
                transform: 'rotateY(-180deg)',
              }}
            >
              {/* Leaf Front: Previous Page turning over */}
              <div
                className="absolute inset-0 bg-white overflow-hidden page-shadow"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                {leafPrevPage.image_url ? (
                  <img
                    src={leafPrevPage.image_url}
                    alt={`Page ${leafPrevPage.n}`}
                    className="w-full h-full object-cover object-top select-none"
                  />
                ) : (
                  <div style={LINED_PAPER} className="w-full h-full p-3">
                    <span className="text-[10px] font-mono font-bold text-slate-400">Page {leafPrevPage.n}</span>
                  </div>
                )}
                <div className="absolute inset-y-0 left-0 w-8 spine-shadow" />
                <span className="absolute bottom-2 right-2 text-[10px] font-mono font-bold text-slate-700 bg-white/95 border border-slate-300 px-1.5 py-0.5 rounded shadow-2xs">
                  p.{leafPrevPage.n}
                </span>
              </div>

              {/* Leaf Back: Backside of turning paper with spine shadow */}
              <div
                className="absolute inset-0 bg-slate-50 border-r border-slate-200 overflow-hidden"
                style={{
                  transform: 'rotateY(180deg)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <div style={LINED_PAPER} className="w-full h-full opacity-60" />
                <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/25 to-transparent pointer-events-none" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="w-7 h-7 text-emerald-500 opacity-80" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mini Clickable Page Pills (1..N) to Inspect Any Scanned Page */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span className="font-medium">Pages: click to view</span>
          {selectedPageNum !== null && (
            <button
              type="button"
              onClick={() => setSelectedPageNum(null)}
              className="text-indigo-600 hover:text-indigo-800 underline font-medium"
            >
              Resume Live
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
          {sorted.map((p) => {
            const isSelected = activeDisplayPage?.n === p.n;
            const isDone = p.status === 'done';
            const isReading = p.status === 'reading';
            const isFailed = p.status === 'failed';

            return (
              <button
                key={p.n}
                type="button"
                onClick={() => setSelectedPageNum(p.n)}
                className={`px-2 py-1 rounded-md text-xs font-mono font-semibold transition flex items-center gap-1 border shrink-0 ${
                  isSelected
                    ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50 text-indigo-900 shadow-xs'
                    : isDone
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : isReading
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 animate-pulse'
                    : isFailed
                    ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                title={`Page ${p.n}: ${p.status}${p.legibility ? ` (${(p.legibility * 100).toFixed(0)}% leg)` : ''}`}
              >
                <span>{p.n}</span>
                {isDone && <Check className="w-3 h-3 text-emerald-600" />}
                {isReading && <RefreshCw className="w-3 h-3 text-indigo-600 animate-spin" />}
                {isFailed && <AlertTriangle className="w-3 h-3 text-rose-600" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
