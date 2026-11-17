import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  RotateCw,
  AlertCircle,
  FileText,
  CornerDownRight,
} from 'lucide-react';

interface SheetViewerProps {
  sheetId: string;
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  bbox?: [number, number, number, number] | null;
  continuesPage?: number | null;
  notAttempted?: boolean;
}

export const SheetViewer: React.FC<SheetViewerProps> = ({
  sheetId,
  pageCount,
  currentPage,
  onPageChange,
  bbox,
  continuesPage,
  notAttempted = false,
}) => {
  const [zoom, setZoom] = useState(1); // 1 = fit width
  const canvasRef = useRef<HTMLDivElement>(null);

  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });
  const [imgError, setImgError] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);

  const handleRotatePage = async () => {
    if (isRotating) return;
    setIsRotating(true);
    try {
      const res = await fetch(`/api/sheets/${sheetId}/pages/${currentPage}/rotate`, {
        method: 'POST',
      });
      if (res.ok) {
        setImgKey((k) => k + 1);
      }
    } catch (err) {
      console.error('Failed to rotate page:', err);
    } finally {
      setIsRotating(false);
    }
  };

  const handleFitWidth = useCallback(() => {
    setZoom(1);
    canvasRef.current?.scrollTo({ top: 0, left: 0 });
  }, []);

  const handleFitHeight = useCallback(() => {
    const el = canvasRef.current;
    if (!el || !imgNaturalSize.width) return;
    const availW = el.clientWidth - 32;
    const availH = el.clientHeight - 32;
    const hAtFitW = (availW * imgNaturalSize.height) / imgNaturalSize.width;
    setZoom(Math.min(3, Math.max(0.3, availH / hAtFitW)));
    el.scrollTo({ top: 0, left: 0 });
  }, [imgNaturalSize]);

  useEffect(() => {
    setZoom(1);
    canvasRef.current?.scrollTo({ top: 0, left: 0 });
  }, [currentPage]);

  // Ctrl + Wheel to zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setZoom((prev) => Math.min(3, Math.max(0.3, prev + delta)));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Image load handler
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setImgError(false);
  };

  // Compute rendered bounding box overlay coordinates using percentages
  const renderBboxStyle = (): React.CSSProperties | null => {
    if (!bbox || bbox.some((v) => typeof v !== 'number' || Number.isNaN(v))) return null;
    const [x0, y0, x1, y1] = bbox;
    if (x1 <= x0 || y1 <= y0) return null;

    return {
      left: `${x0 * 100}%`,
      top: `${y0 * 100}%`,
      width: `${(x1 - x0) * 100}%`,
      height: `${(y1 - y0) * 100}%`,
    };
  };

  const bboxStyle = renderBboxStyle();
  const pageImageSrc = `/api/sheets/${sheetId}/pages/${currentPage}/image?t=${imgKey}`;

  return (
    <div
      aria-label="Sheet Viewer"
      className="flex flex-col min-h-0 h-full bg-[var(--surface-bg)] relative overflow-hidden select-none"
    >
      {/* Top Floating Controls Bar */}
      <div className="h-10 px-3 bg-[var(--surface-card)]/90 backdrop-blur-xs border-b border-[var(--surface-border)] flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded hover:bg-[var(--surface-subtle)] disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-medium tabular-nums">
            Page {currentPage} of {Math.max(1, pageCount)}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
            disabled={currentPage >= pageCount}
            className="p-1 rounded hover:bg-[var(--surface-subtle)] disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Continuation Chip */}
        {continuesPage && (
          <button
            type="button"
            onClick={() => onPageChange(continuesPage)}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--accent-indigo-subtle)] text-[var(--accent-indigo)] border border-[var(--accent-indigo-border)] text-[11px] font-semibold hover:bg-[var(--accent-indigo-border)] transition"
          >
            <CornerDownRight className="w-3 h-3" />
            Continues on p.{continuesPage}
          </button>
        )}

        {/* Zoom & Fit Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
            className="p-1 rounded hover:bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)] transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] tabular-nums font-mono text-[var(--ink-muted)] w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
            className="p-1 rounded hover:bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)] transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="h-3 w-[1px] bg-[var(--surface-border)] mx-1" />
          <button
            type="button"
            onClick={handleFitWidth}
            className="px-2 py-0.5 text-[11px] rounded hover:bg-[var(--surface-subtle)] text-[var(--ink-secondary)] font-medium transition"
          >
            Fit Width
          </button>
          <button
            type="button"
            onClick={handleFitHeight}
            className="px-2 py-0.5 text-[11px] rounded hover:bg-[var(--surface-subtle)] text-[var(--ink-secondary)] font-medium transition"
          >
            Fit Height
          </button>
          <div className="h-3 w-[1px] bg-[var(--surface-border)] mx-1" />
          <button
            type="button"
            onClick={handleRotatePage}
            disabled={isRotating}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded hover:bg-[var(--surface-subtle)] text-[var(--ink-secondary)] font-medium transition disabled:opacity-50"
            title="Rotate Page 90° Clockwise"
          >
            <RotateCw className={`w-3 h-3 ${isRotating ? 'animate-spin' : ''}`} />
            Rotate
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div
        ref={canvasRef}
        className="flex-1 min-h-0 relative overflow-auto p-4"
      >
        {imgError ? (
          <div className="p-6 bg-[var(--surface-card)] border border-[var(--status-failed-border)] rounded-lg text-center max-w-sm mx-auto my-12">
            <AlertCircle className="w-8 h-8 text-[var(--status-failed)] mx-auto mb-2" />
            <p className="text-xs font-semibold text-[var(--ink-primary)] mb-1">
              Failed to load sheet page
            </p>
            <p className="text-[11px] text-[var(--ink-muted)] mb-3">
              The scan for page {currentPage} could not be retrieved from the server.
            </p>
            <button
              type="button"
              onClick={() => {
                setImgError(false);
                setImgKey((k) => k + 1);
              }}
              className="px-3 py-1 text-xs font-semibold rounded bg-[var(--accent-indigo)] text-white hover:bg-[var(--accent-indigo-hover)] transition inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              Reload Page
            </button>
          </div>
        ) : (
          <div
            style={{ width: `${zoom * 100}%` }}
            className="relative mx-auto shadow-md rounded bg-white"
          >
            {/* Sheet Page Image */}
            <img
              ref={imgRef}
              src={pageImageSrc}
              alt={`Answer Sheet Page ${currentPage}`}
              onLoad={handleImageLoad}
              onError={() => setImgError(true)}
              className="block w-full h-auto select-none"
              draggable={false}
            />

            {/* Scaled Bounding Box Overlay */}
            {bboxStyle && !notAttempted && (
              <div
                style={bboxStyle}
                className="absolute border-2 border-[var(--accent-indigo)] bg-[var(--accent-indigo)]/15 shadow-[0_0_12px_rgba(79,70,229,0.35)] rounded pointer-events-none transition-all duration-200"
              >
                <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-[var(--accent-indigo)] text-white text-[10px] font-bold tracking-wider uppercase shadow-xs">
                  Answer
                </span>
              </div>
            )}

            {/* "No answer found for this question" Overlay */}
            {notAttempted && (
              <div className="absolute inset-x-4 top-8 p-3 rounded-md bg-[var(--surface-card)]/95 border border-[var(--status-flagged-border)] shadow-lg backdrop-blur-xs flex items-center justify-center gap-2 text-xs font-medium text-[var(--status-flagged)]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>No answer found for this question (unattempted or undetected).</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {pageCount > 1 && (
        <div className="h-14 px-3 bg-[var(--surface-card)]/90 backdrop-blur-xs border-t border-[var(--surface-border)] flex items-center gap-2 overflow-x-auto z-10 shrink-0">
          {Array.from({ length: pageCount }).map((_, i) => {
            const pageNum = i + 1;
            const isSelected = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`h-10 w-8 rounded border overflow-hidden shrink-0 relative transition ${
                  isSelected
                    ? 'border-2 border-[var(--accent-indigo)] shadow-xs scale-105'
                    : 'border-[var(--surface-border)] hover:border-[var(--ink-muted)] opacity-70 hover:opacity-100'
                }`}
                title={`Jump to Page ${pageNum}`}
              >
                <img
                  src={`/api/sheets/${sheetId}/pages/${pageNum}/image`}
                  alt={`Thumbnail p.${pageNum}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-bold text-center">
                  {pageNum}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
