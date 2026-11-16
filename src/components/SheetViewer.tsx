import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });
  const [imgRenderedSize, setImgRenderedSize] = useState({ width: 0, height: 0 });
  const [imgError, setImgError] = useState(false);
  const [imgKey, setImgKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset zoom & pan on page change or fit
  const handleFitWidth = useCallback(() => {
    if (!containerRef.current || !imgNaturalSize.width) return;
    const containerWidth = containerRef.current.clientWidth - 48; // padding
    const scale = Math.min(2.5, Math.max(0.4, containerWidth / imgNaturalSize.width));
    setZoom(scale);
    setPan({ x: 0, y: 0 });
  }, [imgNaturalSize]);

  const handleFitHeight = useCallback(() => {
    if (!containerRef.current || !imgNaturalSize.height) return;
    const containerHeight = containerRef.current.clientHeight - 80;
    const scale = Math.min(2.5, Math.max(0.4, containerHeight / imgNaturalSize.height));
    setZoom(scale);
    setPan({ x: 0, y: 0 });
  }, [imgNaturalSize]);

  // Update rendered dimensions when image loads or resizes
  const updateRenderedDimensions = useCallback(() => {
    if (imgRef.current) {
      setImgRenderedSize({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateRenderedDimensions);
    return () => window.removeEventListener('resize', updateRenderedDimensions);
  }, [updateRenderedDimensions]);

  // Ctrl + Wheel to zoom
  useEffect(() => {
    const el = containerRef.current;
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

  // Mouse pan drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click drag
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Image load handler
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setImgError(false);
    updateRenderedDimensions();
  };

  // Compute rendered bounding box overlay coordinates
  const renderBboxStyle = (): React.CSSProperties | null => {
    if (!bbox || !imgRenderedSize.width || !imgRenderedSize.height) return null;
    const [x0, y0, x1, y1] = bbox;
    const left = Math.round(x0 * imgRenderedSize.width);
    const top = Math.round(y0 * imgRenderedSize.height);
    const width = Math.round((x1 - x0) * imgRenderedSize.width);
    const height = Math.round((y1 - y0) * imgRenderedSize.height);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  };

  const bboxStyle = renderBboxStyle();
  const pageImageSrc = `/api/sheets/${sheetId}/pages/${currentPage}/image?t=${imgKey}`;

  return (
    <div
      ref={containerRef}
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
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 relative overflow-hidden flex items-center justify-center p-4 cursor-${
          isDragging ? 'grabbing' : 'grab'
        }`}
      >
        {imgError ? (
          <div className="p-6 bg-[var(--surface-card)] border border-[var(--status-failed-border)] rounded-lg text-center max-w-sm">
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
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 100ms ease-out',
            }}
            className="relative inline-block max-w-none shadow-md rounded overflow-hidden bg-white"
          >
            {/* Sheet Page Image */}
            <img
              ref={imgRef}
              src={pageImageSrc}
              alt={`Answer Sheet Page ${currentPage}`}
              onLoad={handleImageLoad}
              onError={() => setImgError(true)}
              className="block max-w-none pointer-events-none"
              style={{
                width: imgNaturalSize.width ? `${imgNaturalSize.width}px` : 'auto',
                maxHeight: 'none',
              }}
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
