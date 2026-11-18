import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AnnotationItem, AnnotationKind, AnnotationVisibility } from '../utils/useAnnotations';
import type { AnnotationTool } from './AnnotationToolbar';
import { Check, X as CloseIcon, Lock, Globe } from 'lucide-react';

export interface AnnotationLayerProps {
  pageNo: number;
  annotations: AnnotationItem[];
  isInteractive?: boolean;
  activeTool?: AnnotationTool;
  activeColor?: string;
  activeWidth?: number;
  visibility?: AnnotationVisibility;
  userRole?: 'teacher' | 'student';
  selectedId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
  onUpsertAnnotation?: (
    item: Partial<AnnotationItem> & {
      id: string;
      page_no: number;
      kind: AnnotationKind;
      data: any;
    }
  ) => void;
  onDeleteAnnotation?: (id: string) => void;
  className?: string;
}

/**
 * Builds SVG path string from normalized points array [{x: 0..1, y: 0..1}].
 * Maps normalized 0..1 coordinates to SVG viewBox 0..1000.
 */
export function buildSvgPathFromPoints(points: Array<{ x: number; y: number }>): string {
  if (!points || points.length === 0) return '';
  const first = points[0];
  let d = `M ${first.x * 1000} ${first.y * 1000}`;
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    d += ` L ${pt.x * 1000} ${pt.y * 1000}`;
  }
  return d;
}

/**
 * Ramer-Douglas-Peucker stroke simplification to keep strokes under 200 points.
 */
export function simplifyPoints(
  points: Array<{ x: number; y: number }>,
  maxPoints = 200
): Array<{ x: number; y: number }> {
  if (points.length <= maxPoints) return points;

  function rdp(pts: Array<{ x: number; y: number }>, eps: number): Array<{ x: number; y: number }> {
    if (pts.length <= 2) return pts;
    let dmax = 0;
    let index = 0;
    const a = pts[0];
    const b = pts[pts.length - 1];

    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const num = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x);
      const den = Math.hypot(b.y - a.y, b.x - a.x);
      const d = den === 0 ? Math.hypot(p.x - a.x, p.y - a.y) : num / den;
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }

    if (dmax > eps) {
      const r1 = rdp(pts.slice(0, index + 1), eps);
      const r2 = rdp(pts.slice(index), eps);
      return r1.slice(0, r1.length - 1).concat(r2);
    }
    return [a, b];
  }

  let epsilon = 0.001;
  let simplified = points;
  while (simplified.length > maxPoints && epsilon < 0.05) {
    simplified = rdp(points, epsilon);
    epsilon *= 1.5;
  }
  return simplified;
}

// Generate client UUID for instant offline drawing
function generateClientUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  pageNo,
  annotations,
  isInteractive = false,
  activeTool = 'select',
  activeColor = '#ef4444',
  activeWidth = 2.0,
  visibility = 'student',
  userRole = 'teacher',
  selectedId = null,
  onSelectAnnotation,
  onUpsertAnnotation,
  onDeleteAnnotation,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // In-progress drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Array<{ x: number; y: number }>>([]);

  // Inline text note input modal
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const [textInputVisibility, setTextInputVisibility] = useState<AnnotationVisibility>(visibility);

  // Filter active annotations for this page
  const pageAnnotations = annotations.filter((a) => {
    if (a.page_no !== pageNo || a.deleted) return false;
    // Private annotations are NEVER displayed to students
    if (userRole === 'student' && a.visibility === 'private') return false;
    return true;
  });

  // Calculate normalized 0..1 coordinates from pointer event
  const getNormalizedPoint = useCallback((e: React.PointerEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  // Delete key shortcut for selected annotation
  useEffect(() => {
    if (!isInteractive || !selectedId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault();
        onDeleteAnnotation?.(selectedId);
        onSelectAnnotation?.(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInteractive, selectedId, onDeleteAnnotation, onSelectAnnotation]);

  // Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isInteractive) return;

    const pt = getNormalizedPoint(e);
    if (!pt) return;

    // Eraser Tool
    if (activeTool === 'eraser') {
      return; // handled by element click
    }

    // Select Tool
    if (activeTool === 'select') {
      if ((e.target as Element).tagName.toLowerCase() === 'svg') {
        onSelectAnnotation?.(null);
      }
      return;
    }

    // Tick Tool: one click places a tick
    if (activeTool === 'tick') {
      const id = generateClientUuid();
      onUpsertAnnotation?.({
        id,
        page_no: pageNo,
        kind: 'tick',
        data: { x: pt.x, y: pt.y },
        color: activeColor || '#10b981',
        width: activeWidth || 2.0,
        visibility,
      });
      return;
    }

    // Cross Tool: one click places a cross
    if (activeTool === 'cross') {
      const id = generateClientUuid();
      onUpsertAnnotation?.({
        id,
        page_no: pageNo,
        kind: 'cross',
        data: { x: pt.x, y: pt.y },
        color: activeColor || '#ef4444',
        width: activeWidth || 2.0,
        visibility,
      });
      return;
    }

    // Text Note Tool: click opens note creator at clicked position
    if (activeTool === 'text') {
      setTextInputPos(pt);
      setTextInputValue('');
      setTextInputVisibility(visibility);
      return;
    }

    // Freehand Pen / Highlighter
    if (activeTool === 'pen' || activeTool === 'highlight') {
      setIsDrawing(true);
      setCurrentPoints([pt]);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  // Pointer Move Handler
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || !isInteractive) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;

    setCurrentPoints((prev) => [...prev, pt]);
  };

  // Pointer Up Handler
  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (currentPoints.length >= 2) {
      const simplified = simplifyPoints(currentPoints, 200);
      const id = generateClientUuid();
      onUpsertAnnotation?.({
        id,
        page_no: pageNo,
        kind: activeTool === 'highlight' ? 'highlight' : 'pen',
        data: { points: simplified },
        color: activeColor,
        width: activeWidth,
        visibility,
      });
    }

    setCurrentPoints([]);
  };

  // Submit Text Note Modal
  const handleSaveTextNote = () => {
    if (!textInputPos || !textInputValue.trim()) {
      setTextInputPos(null);
      return;
    }
    const id = generateClientUuid();
    onUpsertAnnotation?.({
      id,
      page_no: pageNo,
      kind: 'text',
      data: {
        x: textInputPos.x,
        y: textInputPos.y,
        text: textInputValue.trim(),
      },
      color: activeColor || '#f59e0b',
      width: 1.0,
      visibility: textInputVisibility,
    });
    setTextInputPos(null);
    setTextInputValue('');
  };

  const cursorClass = !isInteractive
    ? 'pointer-events-none'
    : activeTool === 'select'
    ? 'cursor-default pointer-events-auto'
    : activeTool === 'pen'
    ? 'cursor-crosshair pointer-events-auto'
    : activeTool === 'highlight'
    ? 'cursor-crosshair pointer-events-auto'
    : activeTool === 'tick' || activeTool === 'cross' || activeTool === 'text'
    ? 'cursor-cell pointer-events-auto'
    : activeTool === 'eraser'
    ? 'cursor-pointer pointer-events-auto'
    : 'pointer-events-auto';

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none" style={{ touchAction: 'none' }}>
      <svg
        ref={svgRef}
        data-testid={`annotation-layer-page-${pageNo}`}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          setIsDrawing(false);
          setCurrentPoints([]);
        }}
        className={`absolute inset-0 w-full h-full ${cursorClass} ${className}`}
        style={{ zIndex: 22, pointerEvents: isInteractive ? 'auto' : 'none' }}
      >
        <defs>
          <filter id="evaldesk-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Transparent background hitbox to capture all pointer events anywhere on canvas */}
        <rect
          data-testid={`annotation-canvas-hitbox-${pageNo}`}
          x="0"
          y="0"
          width="1000"
          height="1000"
          fill="transparent"
          style={{ pointerEvents: isInteractive ? 'all' : 'none' }}
        />

        {/* Existing active annotations on this page */}
        {pageAnnotations.map((anno) => {
          const { id, kind, data, color, width, visibility: itemVis } = anno;
          const isPrivate = itemVis === 'private';
          const isSelected = selectedId === id;
          const strokeWidthSvg = Math.max(1, width * 3.5);

          const handleClickAnnotation = (e: React.MouseEvent) => {
            if (!isInteractive) return;
            e.stopPropagation();
            if (activeTool === 'eraser') {
              onDeleteAnnotation?.(id);
            } else {
              onSelectAnnotation?.(id);
            }
          };

          // 1. Pen Stroke
          if (kind === 'pen') {
            const points = data?.points || [];
            const pathD = buildSvgPathFromPoints(points);
            if (!pathD) return null;

            return (
              <path
                key={id}
                data-testid={`anno-pen-${id}`}
                d={pathD}
                fill="none"
                stroke={color || '#ef4444'}
                strokeWidth={isSelected ? strokeWidthSvg + 2 : strokeWidthSvg}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: isPrivate ? '8,4' : undefined,
                  filter: isSelected ? 'drop-shadow(0 0 3px rgba(99,102,241,0.8))' : undefined,
                }}
                className={isInteractive ? 'cursor-pointer hover:opacity-80' : ''}
                onClick={handleClickAnnotation}
              />
            );
          }

          // 2. Highlighter
          if (kind === 'highlight') {
            const points = data?.points || [];
            const pathD = buildSvgPathFromPoints(points);
            if (!pathD) return null;

            return (
              <path
                key={id}
                data-testid={`anno-highlight-${id}`}
                d={pathD}
                fill="none"
                stroke={color || '#fef08a'}
                strokeWidth={strokeWidthSvg * 3.5}
                strokeLinecap="square"
                strokeLinejoin="round"
                opacity={0.45}
                style={{
                  mixBlendMode: 'multiply',
                  filter: isSelected ? 'drop-shadow(0 0 4px rgba(99,102,241,0.9))' : undefined,
                }}
                className={isInteractive ? 'cursor-pointer hover:opacity-60' : ''}
                onClick={handleClickAnnotation}
              />
            );
          }

          // 3. Tick Mark
          if (kind === 'tick') {
            const x = (data?.x ?? 0.5) * 1000;
            const y = (data?.y ?? 0.5) * 1000;
            const tickPath = `M ${x - 16} ${y} L ${x - 4} ${y + 14} L ${x + 22} ${y - 16}`;

            return (
              <g
                key={id}
                data-testid={`anno-tick-${id}`}
                className={isInteractive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
                onClick={handleClickAnnotation}
              >
                <circle
                  cx={x}
                  cy={y}
                  r="26"
                  fill={isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.12)'}
                  stroke={isSelected ? '#6366f1' : 'none'}
                  strokeWidth="2"
                />
                <path
                  d={tickPath}
                  fill="none"
                  stroke={color || '#10b981'}
                  strokeWidth={strokeWidthSvg + 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#evaldesk-shadow)"
                />
              </g>
            );
          }

          // 4. Cross Mark
          if (kind === 'cross') {
            const x = (data?.x ?? 0.5) * 1000;
            const y = (data?.y ?? 0.5) * 1000;
            const cross1 = `M ${x - 14} ${y - 14} L ${x + 14} ${y + 14}`;
            const cross2 = `M ${x + 14} ${y - 14} L ${x - 14} ${y + 14}`;

            return (
              <g
                key={id}
                data-testid={`anno-cross-${id}`}
                className={isInteractive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
                onClick={handleClickAnnotation}
              >
                <circle
                  cx={x}
                  cy={y}
                  r="26"
                  fill={isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(239, 68, 68, 0.12)'}
                  stroke={isSelected ? '#6366f1' : 'none'}
                  strokeWidth="2"
                />
                <path
                  d={cross1}
                  fill="none"
                  stroke={color || '#ef4444'}
                  strokeWidth={strokeWidthSvg + 2}
                  strokeLinecap="round"
                  filter="url(#evaldesk-shadow)"
                />
                <path
                  d={cross2}
                  fill="none"
                  stroke={color || '#ef4444'}
                  strokeWidth={strokeWidthSvg + 2}
                  strokeLinecap="round"
                  filter="url(#evaldesk-shadow)"
                />
              </g>
            );
          }

          // 5. Text Note
          if (kind === 'text') {
            const x = (data?.x ?? 0.5) * 1000;
            const y = (data?.y ?? 0.5) * 1000;
            const textContent = data?.text || 'Note';

            return (
              <foreignObject
                key={id}
                data-testid={`anno-text-${id}`}
                x={Math.min(x, 750)}
                y={Math.min(y, 900)}
                width="240"
                height="80"
                className={isInteractive ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}
                onClick={handleClickAnnotation}
              >
                <div
                  className={`p-2 rounded-md shadow-md text-slate-800 text-[11px] leading-tight select-none transition-all ${
                    isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
                  } ${
                    isPrivate
                      ? 'bg-amber-50/95 border border-dashed border-amber-400 text-amber-900'
                      : 'bg-white/95 border border-slate-300 text-slate-900'
                  }`}
                  style={{ backdropFilter: 'blur(2px)' }}
                >
                  {isPrivate && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 block mb-0.5">
                      Private Note
                    </span>
                  )}
                  <span className="line-clamp-3 font-sans font-medium">{textContent}</span>
                </div>
              </foreignObject>
            );
          }

          return null;
        })}

        {/* Live in-progress stroke preview */}
        {isDrawing && currentPoints.length > 1 && (
          <path
            data-testid="anno-live-preview"
            d={buildSvgPathFromPoints(currentPoints)}
            fill="none"
            stroke={activeColor || '#ef4444'}
            strokeWidth={activeTool === 'highlight' ? Math.max(1, activeWidth * 3.5) * 3.5 : Math.max(1, activeWidth * 3.5)}
            strokeLinecap={activeTool === 'highlight' ? 'square' : 'round'}
            strokeLinejoin="round"
            opacity={activeTool === 'highlight' ? 0.45 : 0.85}
            style={{
              mixBlendMode: activeTool === 'highlight' ? 'multiply' : 'normal',
              pointerEvents: 'none',
            }}
          />
        )}
      </svg>

      {/* Inline Text Note Creation Popover */}
      {textInputPos && isInteractive && (
        <div
          data-testid="text-note-popover"
          className="absolute z-50 bg-white/98 backdrop-blur-md rounded-xl p-3 shadow-2xl border border-slate-300 w-72 flex flex-col gap-2 pointer-events-auto"
          style={{
            left: `${Math.min(70, Math.max(5, textInputPos.x * 100))}%`,
            top: `${Math.min(75, Math.max(5, textInputPos.y * 100))}%`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 border-b border-slate-100 pb-1.5">
            <span>Add Annotation Note</span>
            <button
              type="button"
              onClick={() => setTextInputPos(null)}
              className="p-1 rounded text-slate-400 hover:text-slate-700"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <textarea
            autoFocus
            data-testid="input-note-text"
            value={textInputValue}
            onChange={(e) => setTextInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSaveTextNote();
              }
            }}
            placeholder="Type your comment or feedback..."
            rows={3}
            className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />

          {/* Visibility Switch */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              data-testid="btn-note-visibility-toggle"
              onClick={() =>
                setTextInputVisibility((prev) => (prev === 'student' ? 'private' : 'student'))
              }
              className={`text-[11px] font-medium px-2 py-1 rounded-md border flex items-center gap-1 transition ${
                textInputVisibility === 'private'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {textInputVisibility === 'private' ? (
                <>
                  <Lock className="w-3 h-3 text-amber-600" />
                  <span>Private</span>
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3 text-slate-500" />
                  <span>For student</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="btn-save-note"
              onClick={handleSaveTextNote}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
