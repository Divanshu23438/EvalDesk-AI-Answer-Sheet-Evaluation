import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import { FlipQueue, FlipStep } from '../utils/flipQueue';

export type PageStatus = 'waiting' | 'pending' | 'reading' | 'done' | 'failed';

export interface PageItem {
  n: number;
  status: PageStatus;
  legibility?: number | null;
  imageUrl?: string | null;
  error?: string | null;
  finished_at?: string | null;
}

export interface PageBookProps {
  pages: PageItem[];
  currentIndex?: number; // 0-based index
  mode?: 'progress' | 'browse';
  stageName?: string;
  annotatable?: boolean;
  onPageChange?: (index: number) => void;
  onRetryPage?: (pageNumber: number) => void;
  className?: string;
  renderAnnotationLayer?: (page: PageItem, index: number, isCurrent: boolean) => React.ReactNode;
}

const LINED_PAPER: React.CSSProperties = {
  background: 'repeating-linear-gradient(#fcfcfd, #fcfcfd 19px, #e2e8f0 19px, #e2e8f0 20px)',
};

export const PageBook: React.FC<PageBookProps> = ({
  pages,
  currentIndex = 0,
  mode = 'browse',
  stageName,
  annotatable = false,
  onPageChange,
  onRetryPage,
  className = '',
  renderAnnotationLayer,
}) => {
  const sortedPages = [...pages].sort((a, b) => a.n - b.n);
  const totalPages = sortedPages.length || 1;

  // Reduced motion preference detection
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Internal index & Active animation step state
  const [internalIndex, setInternalIndex] = useState<number>(currentIndex);
  const [activeStep, setActiveStep] = useState<FlipStep | null>(null);
  const [flipProgress, setFlipProgress] = useState<number>(0); // 0 -> 1 during flip

  // Progress mode: Server-driven status and No-Jump rule tracking
  const donePages = sortedPages.filter((p) => p.status === 'done');
  const doneCount = donePages.length;
  const readingPage = sortedPages.find((p) => p.status === 'reading');
  const failedPage = sortedPages.find((p) => p.status === 'failed');

  let serverTargetIdx = 0;
  if (failedPage) {
    serverTargetIdx = sortedPages.findIndex((p) => p.n === failedPage.n);
  } else if (readingPage) {
    serverTargetIdx = sortedPages.findIndex((p) => p.n === readingPage.n);
  } else if (donePages.length > 0) {
    serverTargetIdx = Math.min(
      totalPages - 1,
      sortedPages.findIndex((p) => p.n === donePages[donePages.length - 1].n)
    );
  }
  serverTargetIdx = Math.max(0, Math.min(serverTargetIdx, totalPages - 1));

  const [isLookingBack, setIsLookingBack] = useState<boolean>(false);
  const [jumpBadge, setJumpBadge] = useState<{ pageNum: number; donePageNum: number } | null>(null);

  // Initialize FlipQueue instance
  const flipQueueRef = useRef<FlipQueue | null>(null);

  if (!flipQueueRef.current) {
    flipQueueRef.current = new FlipQueue({
      initialIndex: currentIndex,
      pageCount: totalPages,
      flipDuration: 450,
      reducedMotionDuration: 150,
      isReducedMotion: prefersReducedMotion,
      onFlipStart: (step) => {
        setActiveStep(step);
        setFlipProgress(0);
      },
      onFlipEnd: (step) => {
        setInternalIndex(step.toIndex);
        setActiveStep(null);
        setFlipProgress(1);
        onPageChange?.(step.toIndex);
      },
      onQueueIdle: (idx) => {
        setInternalIndex(idx);
        setActiveStep(null);
      },
      onPageChange: (idx) => {
        setInternalIndex(idx);
      },
    });
  }

  // Synchronize configuration changes
  useEffect(() => {
    if (flipQueueRef.current) {
      flipQueueRef.current.setPageCount(totalPages);
      flipQueueRef.current.setReducedMotion(prefersReducedMotion);
    }
  }, [totalPages, prefersReducedMotion]);

  // Server Progress Driver & No-Jump Rule
  const prevServerTargetRef = useRef<number>(serverTargetIdx);
  const prevDoneCountRef = useRef<number>(doneCount);

  useEffect(() => {
    if (mode !== 'progress') return;

    const hasNewDone = doneCount > prevDoneCountRef.current;
    const targetChanged = serverTargetIdx !== prevServerTargetRef.current;

    if (hasNewDone || targetChanged) {
      if (isLookingBack) {
        // NO-JUMP RULE: User is looking at an earlier page. Stay here!
        const latestDone =
          donePages.length > 0 ? donePages[donePages.length - 1].n : sortedPages[serverTargetIdx].n;
        setJumpBadge({
          pageNum: sortedPages[serverTargetIdx].n,
          donePageNum: latestDone,
        });
      } else {
        // Follow server progress live
        setJumpBadge(null);
        if (flipQueueRef.current) {
          flipQueueRef.current.enqueue(serverTargetIdx);
        }
      }
      prevServerTargetRef.current = serverTargetIdx;
      prevDoneCountRef.current = doneCount;
    }
  }, [mode, serverTargetIdx, doneCount, isLookingBack, donePages, sortedPages]);

  // Synchronize incoming controlled currentIndex prop in browse mode
  useEffect(() => {
    if (mode === 'browse' && currentIndex >= 0 && currentIndex < totalPages && flipQueueRef.current) {
      const currentQueueIdx = flipQueueRef.current.getCurrentIndex();
      if (currentIndex !== currentQueueIdx && !flipQueueRef.current.isFlipping()) {
        if (Math.abs(currentIndex - currentQueueIdx) <= 2) {
          flipQueueRef.current.enqueue(currentIndex);
        } else {
          flipQueueRef.current.jumpTo(currentIndex);
          setInternalIndex(currentIndex);
        }
      }
    }
  }, [mode, currentIndex, totalPages]);

  // Animate flip progress linearly across step duration using requestAnimationFrame
  useEffect(() => {
    if (!activeStep) return;

    let startTs: number | null = null;
    let animId: number;

    const animate = (timestamp: number) => {
      if (startTs === null) startTs = timestamp;
      const elapsed = timestamp - startTs;
      const progress = Math.min(elapsed / activeStep.duration, 1);
      setFlipProgress(progress);

      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [activeStep]);

  const activeIndex = Math.min(Math.max(0, internalIndex), totalPages - 1);
  const activePage = sortedPages[activeIndex] || {
    n: 1,
    status: 'waiting',
    legibility: null,
    imageUrl: null,
    error: null,
  };

  const maxClickableIndex = mode === 'progress' ? serverTargetIdx : totalPages - 1;

  const handlePageSelect = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= totalPages) return;
    if (mode === 'progress') {
      if (newIndex > serverTargetIdx) return; // not clickable
      if (newIndex < serverTargetIdx) {
        setIsLookingBack(true);
      } else {
        setIsLookingBack(false);
        setJumpBadge(null);
      }
    }
    if (flipQueueRef.current) {
      flipQueueRef.current.enqueue(newIndex);
    }
  }, [totalPages, mode, serverTargetIdx]);

  const handleJumpToLatest = useCallback(() => {
    setIsLookingBack(false);
    setJumpBadge(null);
    if (flipQueueRef.current) {
      flipQueueRef.current.enqueue(serverTargetIdx);
    }
  }, [serverTargetIdx]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0 && flipQueueRef.current) {
      if (mode === 'progress') {
        setIsLookingBack(true);
      }
      flipQueueRef.current.enqueue(activeIndex - 1);
    }
  }, [activeIndex, mode]);

  const handleNext = useCallback(() => {
    if (activeIndex < totalPages - 1 && flipQueueRef.current) {
      if (mode === 'browse' || sortedPages[activeIndex + 1]?.status === 'done' || activeIndex + 1 <= serverTargetIdx) {
        if (mode === 'progress' && activeIndex + 1 >= serverTargetIdx) {
          setIsLookingBack(false);
          setJumpBadge(null);
        }
        flipQueueRef.current.enqueue(activeIndex + 1);
      }
    }
  }, [activeIndex, totalPages, mode, sortedPages, serverTargetIdx]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePrev, handleNext]);

  // Touch Swipe navigation
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (annotatable) return;
    const t = e.touches[0];
    touchStartXRef.current = t.clientX;
    touchStartYRef.current = t.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (annotatable || touchStartXRef.current === null || touchStartYRef.current === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartXRef.current;
    const dy = t.clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }
  };

  // Stack thickness calculations
  const leftStackPx = Math.min(activeIndex * 1.5, 12);
  const rightStackPx = Math.min((totalPages - 1 - activeIndex) * 1.5, 12);

  // Legibility Chip
  const legibility = activePage.legibility;
  const showLegibility = legibility !== null && legibility !== undefined;
  const isHighLegibility = showLegibility && legibility >= 0.80;
  const legibilityPercent = showLegibility ? Math.round(legibility * 100) : 0;

  // Image source resolution with memory optimization
  const shouldLoadImage = (idx: number) => {
    if (Math.abs(idx - activeIndex) <= 1) return true;
    if (activeStep && (idx === activeStep.fromIndex || idx === activeStep.toIndex)) return true;
    return false;
  };

  const resolvedImageUrl = (page: PageItem) => {
    if (!page.imageUrl) return null;
    return page.imageUrl.includes('?') ? page.imageUrl : `${page.imageUrl}?w=1200`;
  };

  // 3D Flip calculations: ease-in-out curve
  const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
  const easedProgress = easeInOut(flipProgress);

  const isForward = activeStep?.direction === 'forward';
  const flipAngle = isForward ? -180 * easedProgress : -180 + 180 * easedProgress;

  const curlShadowOpacity = Math.sin(easedProgress * Math.PI) * 0.45;
  const curlShadowX = easedProgress * 100;

  const isFlipping = activeStep !== null;

  const fromPage = activeStep ? sortedPages[activeStep.fromIndex] : activePage;
  const toPage = activeStep ? sortedPages[activeStep.toIndex] : activePage;

  const isPageFailed = activePage.status === 'failed';

  return (
    <div
      data-testid="page-book-root"
      data-mode={mode}
      data-flipping={isFlipping ? 'true' : 'false'}
      data-flip-direction={activeStep?.direction || 'none'}
      data-current-page={activePage.n}
      data-is-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      data-is-looking-back={isLookingBack ? 'true' : 'false'}
      className={`page-book relative flex flex-col items-center justify-between h-full w-full select-none overflow-hidden bg-slate-900/60 p-2 text-slate-100 ${className}`}
      style={{
        ['--u' as any]: 'min(1vw, 1.6vh)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ==================================================================== */}
      {/* TOP HEADER BAR: Page indicator, Reading status, Jump badge, Chip   */}
      {/* ==================================================================== */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-slate-300">
            {mode === 'progress' ? `p. ${activePage.n} / ${totalPages}` : `p. ${activePage.n} / ${totalPages}`}
          </span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full border capitalize font-medium ${
              activePage.status === 'done'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : activePage.status === 'reading'
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse'
                : activePage.status === 'failed'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {activePage.status === 'done' ? 'Read' : activePage.status}
          </span>
          {isFlipping && (
            <span className="text-[10px] font-mono text-indigo-400 animate-pulse uppercase tracking-wider">
              {activeStep?.direction === 'forward' ? 'Turning...' : 'Turning back...'}
            </span>
          )}
        </div>

        {/* Center: "Page X done" + [Jump to latest] badge (No-Jump Rule) */}
        {jumpBadge && isLookingBack && (
          <div
            data-testid="badge-jump-to-latest"
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-600/90 text-white text-xs font-semibold shadow-lg border border-indigo-400/50 backdrop-blur-xs animate-bounce"
          >
            <span>Page {jumpBadge.donePageNum} done</span>
            <button
              type="button"
              data-testid="btn-jump-to-latest"
              onClick={handleJumpToLatest}
              className="px-2 py-0.5 rounded-full bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
            >
              <span>Jump to latest</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Legibility Chip in Browse Mode (or when legibility exists) */}
        {showLegibility && (
          <div
            data-testid="legibility-chip"
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
              isHighLegibility
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}
          >
            {isHighLegibility ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>
              {legibilityPercent}% {isHighLegibility ? 'legible' : '· Hard to read'}
            </span>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MAIN BOOK DISPLAY CONTAINER WITH 3D PERSPECTIVE                      */}
      {/* ==================================================================== */}
      <div
        className="relative flex-1 min-h-0 w-full flex items-center justify-center p-1 overflow-hidden"
        style={{ perspective: '1800px' }}
      >
        <div
          data-testid="book-leaf-envelope"
          className="relative max-h-full aspect-[1/1.414] shadow-2xl rounded-sm flex items-center justify-center overflow-hidden transition-all duration-300"
          style={{
            height: 'calc(100% - 8px)',
            maxWidth: '100%',
            boxShadow: `${-leftStackPx}px 0 0 -1px rgba(255,255,255,0.06), ${rightStackPx}px 0 0 -1px rgba(255,255,255,0.06), 0 20px 30px -10px rgba(0,0,0,0.5)`,
            borderLeft: leftStackPx > 0 ? `${leftStackPx}px solid #cbd5e1` : '2px solid #94a3b8',
            borderRight: rightStackPx > 0 ? `${rightStackPx}px solid #cbd5e1` : '2px solid #94a3b8',
            outline: isPageFailed ? '2px solid #ef4444' : 'none',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Lined Paper Background / Base Layer */}
          <div className="absolute inset-0 z-0" style={LINED_PAPER} />

          {/* Book Spine Shadow Overlay */}
          <div
            className="absolute top-0 bottom-0 left-0 w-12 z-20 pointer-events-none"
            style={{
              background: 'linear-gradient(to right, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.12) 30%, transparent 100%)',
            }}
          />

          {/* Base / Destination Page (revealed underneath during flip) */}
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-hidden"
            style={{
              opacity: prefersReducedMotion && isFlipping ? easedProgress : 1,
            }}
          >
            {shouldLoadImage(isFlipping ? activeStep!.toIndex : activeIndex) &&
            resolvedImageUrl(isFlipping ? toPage : activePage) ? (
              <img
                src={resolvedImageUrl(isFlipping ? toPage : activePage)!}
                alt={`Page ${(isFlipping ? toPage : activePage).n}`}
                className="w-full h-full object-contain pointer-events-none"
                loading="eager"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-slate-500">
                <span className="text-3xl font-light text-slate-400">
                  Page {(isFlipping ? toPage : activePage).n}
                </span>
                <span className="text-xs text-slate-400 mt-2">
                  {(isFlipping ? toPage : activePage).status === 'reading'
                    ? 'Scanning handwriting...'
                    : 'Sheet Page Scan'}
                </span>
              </div>
            )}

            {/* Soft Scan Line Indicator when Reading */}
            {(isFlipping ? toPage : activePage).status === 'reading' && (
              <div
                data-testid="soft-scan-line"
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-indigo-500/20 via-indigo-400 to-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.9)] animate-bounce z-25 pointer-events-none top-1/2"
              />
            )}

            {/* Annotation Layer Slot on Base Page */}
            {renderAnnotationLayer && (
              <div className="absolute inset-0 z-20 pointer-events-auto">
                {renderAnnotationLayer(
                  isFlipping ? toPage : activePage,
                  isFlipping ? activeStep!.toIndex : activeIndex,
                  !isFlipping
                )}
              </div>
            )}
          </div>

          {/* Flipping Leaf (active during 3D flip animation) */}
          {isFlipping && !prefersReducedMotion && (
            <div
              data-testid="flipping-leaf"
              className="absolute inset-0 z-30 pointer-events-none"
              style={{
                transformOrigin: 'left center',
                transformStyle: 'preserve-3d',
                transform: `rotateY(${flipAngle}deg)`,
                willChange: 'transform',
              }}
            >
              {/* Front Face: Outgoing leaf */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  ...LINED_PAPER,
                }}
              >
                {resolvedImageUrl(fromPage) && (
                  <img
                    src={resolvedImageUrl(fromPage)!}
                    alt={`Page ${fromPage.n}`}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                )}
                {/* Annotation layer turns with the page */}
                {renderAnnotationLayer && (
                  <div className="absolute inset-0 z-20 pointer-events-none">
                    {renderAnnotationLayer(fromPage, activeStep!.fromIndex, false)}
                  </div>
                )}
                {/* Dynamic curl shadow on front face */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    opacity: curlShadowOpacity,
                    background: `linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) ${Math.max(
                      0,
                      curlShadowX - 30
                    )}%, rgba(0,0,0,0.4) ${curlShadowX}%, transparent ${Math.min(
                      100,
                      curlShadowX + 30
                    )}%)`,
                  }}
                />
              </div>

              {/* Back Face: Turning back of leaf */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  transform: 'rotateY(180deg)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  ...LINED_PAPER,
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(to left, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 20%, transparent 100%)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Failure Overlay & Retry button if page failed */}
          {isPageFailed && !isFlipping && (
            <div
              data-testid="page-error-overlay"
              className="absolute inset-x-4 bottom-6 z-30 bg-rose-950/95 border border-rose-500/80 p-3 rounded-lg shadow-2xl backdrop-blur-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 text-rose-200">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-rose-300">OCR Failed on Page {activePage.n}</div>
                  <div className="text-rose-200/80 line-clamp-1">
                    {activePage.error || 'Network connection dropped or scan was unreadable.'}
                  </div>
                </div>
              </div>
              {onRetryPage && (
                <button
                  type="button"
                  data-testid="btn-retry-page"
                  onClick={() => onRetryPage(activePage.n)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry this page
                </button>
              )}
            </div>
          )}

          {/* Left Edge Click Area */}
          <div
            data-testid="left-edge-click"
            onClick={handlePrev}
            className={`absolute top-0 bottom-0 left-0 w-[15%] z-20 flex items-center justify-start pl-2 transition-opacity ${
              activeIndex > 0 && !annotatable && !isFlipping
                ? 'cursor-pointer hover:bg-black/5 opacity-0 hover:opacity-100'
                : 'pointer-events-none opacity-0'
            }`}
            title="Previous page (Left Arrow)"
          >
            <div className="p-1 rounded-full bg-slate-900/80 text-white shadow-md">
              <ChevronLeft className="w-5 h-5" />
            </div>
          </div>

          {/* Right Edge Click Area */}
          <div
            data-testid="right-edge-click"
            onClick={handleNext}
            className={`absolute top-0 bottom-0 right-0 w-[15%] z-20 flex items-center justify-end pr-2 transition-opacity ${
              activeIndex < maxClickableIndex && !annotatable && !isFlipping
                ? 'cursor-pointer hover:bg-black/5 opacity-0 hover:opacity-100'
                : 'pointer-events-none opacity-0'
            }`}
            title="Next page (Right Arrow)"
          >
            <div className="p-1 rounded-full bg-slate-900/80 text-white shadow-md">
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* BOTTOM SECTION: Progress Bar + Stage Status (Progress) OR Dots (Browse) */}
      {/* ==================================================================== */}
      <div className="w-full flex flex-col shrink-0 z-30 bg-slate-950/50 border-t border-slate-800/80 px-4 py-2 gap-1.5">
        {mode === 'progress' && (
          <div className="w-full space-y-1.5">
            {/* Top row: Page count status & Stage Name */}
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-300 font-mono" data-testid="progress-read-count">
                Page {doneCount} of {totalPages} read
              </span>
              <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
                {doneCount === totalPages ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>All pages read</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                    <span>{stageName || (activePage.status === 'reading' ? 'Reading handwriting...' : 'Processing...')}</span>
                  </>
                )}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
                style={{ width: `${Math.round((doneCount / totalPages) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Navigation Dots and Prev/Next buttons */}
        <div className="flex items-center justify-between pt-0.5">
          <button
            type="button"
            data-testid="btn-prev-page"
            onClick={handlePrev}
            disabled={activeIndex <= 0 || isFlipping}
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/80 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Previous page (Left Arrow)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Page Dots Indicator */}
          <div data-testid="page-dots-bar" className="flex items-center gap-1.5 max-w-[60%] overflow-x-auto py-1 px-2">
            {sortedPages.map((page, idx) => {
              const isCurrent = idx === activeIndex;
              const isDone = page.status === 'done';
              const isReading = page.status === 'reading';
              const isFailed = page.status === 'failed';
              const isClickable = idx <= maxClickableIndex;

              let dotColor = 'bg-slate-600';
              if (isDone) dotColor = 'bg-emerald-400';
              else if (isReading) dotColor = 'bg-indigo-400 animate-pulse';
              else if (isFailed) dotColor = 'bg-rose-500';

              return (
                <button
                  key={page.n}
                  type="button"
                  data-testid={`page-dot-${page.n}`}
                  onClick={() => handlePageSelect(idx)}
                  disabled={!isClickable}
                  className={`transition-all rounded-full ${
                    isClickable ? 'cursor-pointer hover:scale-125' : 'cursor-not-allowed opacity-35'
                  } ${
                    isCurrent
                      ? 'w-6 h-2.5 ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-950 ' + dotColor
                      : 'w-2.5 h-2.5 opacity-70 hover:opacity-100 ' + dotColor
                  }`}
                  title={`Page ${page.n} (${page.status})${!isClickable ? ' - not yet read' : ''}`}
                />
              );
            })}
          </div>

          <button
            type="button"
            data-testid="btn-next-page"
            onClick={handleNext}
            disabled={activeIndex >= maxClickableIndex || isFlipping}
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/80 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Next page (Right Arrow)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
