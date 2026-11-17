import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  FileText,
  Crop,
  Layers,
  AlertCircle,
} from 'lucide-react';

interface SheetImageViewerProps {
  sheetId: string;
  evalId: string;
  cropUrl?: string | null;
  qNo?: string;
  pageNumbers: number[];
  allPagesCount?: number;
  bbox?: any;
  notAttempted?: boolean;
}

export const SheetImageViewer: React.FC<SheetImageViewerProps> = ({
  sheetId,
  evalId,
  cropUrl,
  qNo,
  pageNumbers = [1],
  allPagesCount = 1,
  bbox,
  notAttempted = false,
}) => {
  // Default to crop view
  const [viewMode, setViewMode] = useState<'crop' | 'full'>('crop');
  const [activePage, setActivePage] = useState<number>(pageNumbers[0] || 1);
  const [zoom, setZoom] = useState<number>(1);
  const [imgKey, setImgKey] = useState<number>(0);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [cropFailed, setCropFailed] = useState<boolean>(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Sync active page when question changes
  useEffect(() => {
    if (pageNumbers.length > 0) {
      setActivePage(pageNumbers[0]);
    }
    setZoom(1);
    setCropFailed(false);
  }, [evalId, pageNumbers]);

  const handleRotate = async () => {
    if (isRotating || viewMode !== 'full') return;
    setIsRotating(true);
    try {
      const res = await fetch(`/api/sheets/${sheetId}/pages/${activePage}/rotate`, {
        method: 'POST',
      });
      if (res.ok) {
        setImgKey((k) => k + 1);
      }
    } catch (err) {
      console.error('Failed to rotate:', err);
    } finally {
      setIsRotating(false);
    }
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(3, Math.max(0.4, Number((prev + delta).toFixed(2)))));
  };

  const resetZoom = () => {
    setZoom(1);
    canvasRef.current?.scrollTo({ top: 0, left: 0 });
  };

  // Extract bbox for activePage
  // Bbox format is normalized [ymin, xmin, ymax, xmax] in 0..1 coordinates
  const activeBbox = (() => {
    if (!bbox) return null;
    let b = bbox;
    const pageIdx = pageNumbers.indexOf(activePage);
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

  const effectiveCropUrl = cropUrl || `/api/sheets/${sheetId}/crop/${evalId}`;
  const fullPageUrl = `/api/sheets/${sheetId}/pages/${activePage}/image?v=${imgKey}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col min-h-[300px]">
      {/* Viewer Toolbar */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* View Mode Toggle: Crop vs Full Page */}
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
          <button
            type="button"
            onClick={() => setViewMode('crop')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'crop'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Crop className="w-3.5 h-3.5" />
            <span>Answer Crop</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('full')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'full'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Full Sheet + Box</span>
          </button>
        </div>

        {/* Multi-page chips when answer spans multiple pages (or full view) */}
        {viewMode === 'full' && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-500 font-medium">Page:</span>
            {Array.from({ length: allPagesCount || 1 }, (_, i) => i + 1).map((pNum) => {
              const isAnswerPage = pageNumbers.includes(pNum);
              const isActive = activePage === pNum;
              return (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => setActivePage(pNum)}
                  className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isAnswerPage
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                  title={isAnswerPage ? `Page ${pNum} (Answer written here)` : `Page ${pNum}`}
                >
                  p.{pNum} {isAnswerPage && '•'}
                </button>
              );
            })}
          </div>
        )}

        {/* Multi-page continuation indicator in Crop mode */}
        {viewMode === 'crop' && pageNumbers.length > 1 && (
          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
            Answer spans Pages {pageNumbers.join(', ')}
          </span>
        )}

        {/* Zoom & Rotate Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleZoom(-0.15)}
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-600 hover:bg-slate-200/60 rounded"
            title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => handleZoom(0.15)}
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {viewMode === 'full' && (
            <button
              type="button"
              onClick={handleRotate}
              disabled={isRotating}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-40 ml-1"
              title="Rotate page 90° clockwise"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Viewer Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 min-h-[260px] max-h-[460px] overflow-auto p-4 bg-slate-100 flex items-start justify-center"
      >
        {notAttempted ? (
          <div className="m-auto text-center p-6 bg-white rounded-xl border border-slate-200 max-w-sm space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-xs font-bold text-slate-800">Question Not Attempted</p>
            <p className="text-[11px] text-slate-500">
              The student left this question blank or omitted it. No submission crop is available.
            </p>
          </div>
        ) : viewMode === 'crop' && !cropFailed ? (
          /* Answer Crop View */
          <div
            style={{ width: `${zoom * 100}%` }}
            className="relative mx-auto bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden"
          >
            <img
              src={effectiveCropUrl}
              alt={`Submission crop for Question ${qNo || ''}`}
              onError={() => setCropFailed(true)}
              className="block w-full h-auto object-contain select-none"
            />
          </div>
        ) : (
          /* Full Sheet View with Highlight Bounding Box Overlay */
          <div
            style={{ width: `${zoom * 100}%` }}
            className="relative mx-auto bg-white rounded-lg shadow-md border border-slate-200 select-none"
          >
            <img
              src={fullPageUrl}
              alt={`Full sheet page ${activePage}`}
              className="block w-full h-auto object-contain"
            />
            {/* Normalized Bounding Box Overlay */}
            {activeBbox && (
              <div
                style={{
                  position: 'absolute',
                  top: `${activeBbox.top}%`,
                  left: `${activeBbox.left}%`,
                  width: `${activeBbox.width}%`,
                  height: `${activeBbox.height}%`,
                }}
                className="border-2 border-indigo-600 bg-indigo-500/15 rounded ring-2 ring-indigo-400/40 pointer-events-none transition-all duration-150"
              >
                <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-600 text-white shadow-xs whitespace-nowrap">
                  Answer {qNo ? `Q.${qNo}` : ''}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
