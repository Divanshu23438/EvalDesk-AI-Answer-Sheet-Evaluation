import React from 'react';
import { AnnotationItem } from '../utils/useAnnotations';

export interface AnnotationLayerProps {
  pageNo: number;
  annotations: AnnotationItem[];
  isInteractive?: boolean;
  userRole?: 'teacher' | 'student';
  onSelectAnnotation?: (id: string) => void;
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

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  pageNo,
  annotations,
  isInteractive = false,
  userRole = 'teacher',
  onSelectAnnotation,
  className = '',
}) => {
  // Filter active annotations for this page
  const pageAnnotations = annotations.filter((a) => {
    if (a.page_no !== pageNo || a.deleted) return false;
    // Private annotations are NEVER displayed to students
    if (userRole === 'student' && a.visibility === 'private') return false;
    return true;
  });

  return (
    <svg
      data-testid={`annotation-layer-page-${pageNo}`}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      className={`absolute inset-0 w-full h-full ${
        isInteractive ? 'pointer-events-auto' : 'pointer-events-none'
      } ${className}`}
      style={{ zIndex: 22 }}
    >
      <defs>
        <filter id="evaldesk-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.25" />
        </filter>
      </defs>

      {pageAnnotations.map((anno) => {
        const { id, kind, data, color, width, visibility } = anno;
        const isPrivate = visibility === 'private';
        const strokeWidthSvg = Math.max(1, width * 3.5);

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
              strokeWidth={strokeWidthSvg}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: isPrivate ? '8,4' : undefined,
              }}
              className={isInteractive ? 'cursor-pointer hover:opacity-80' : ''}
              onClick={() => isInteractive && onSelectAnnotation?.(id)}
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
              }}
              className={isInteractive ? 'cursor-pointer hover:opacity-60' : ''}
              onClick={() => isInteractive && onSelectAnnotation?.(id)}
            />
          );
        }

        // 3. Tick Mark
        if (kind === 'tick') {
          const x = (data?.x ?? 0.5) * 1000;
          const y = (data?.y ?? 0.5) * 1000;
          // Clean tick mark path
          const tickPath = `M ${x - 16} ${y} L ${x - 4} ${y + 14} L ${x + 22} ${y - 16}`;

          return (
            <g
              key={id}
              data-testid={`anno-tick-${id}`}
              className={isInteractive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
              onClick={() => isInteractive && onSelectAnnotation?.(id)}
            >
              <circle cx={x} cy={y} r="26" fill="rgba(16, 185, 129, 0.12)" />
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
              onClick={() => isInteractive && onSelectAnnotation?.(id)}
            >
              <circle cx={x} cy={y} r="26" fill="rgba(239, 68, 68, 0.12)" />
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
              onClick={() => isInteractive && onSelectAnnotation?.(id)}
            >
              <div
                className={`p-2 rounded-md shadow-md text-slate-800 text-[11px] leading-tight select-none ${
                  isPrivate
                    ? 'bg-amber-50/95 border border-dashed border-amber-400 text-amber-900'
                    : 'bg-white/95 border border-slate-300 text-slate-900'
                }`}
                style={{
                  backdropFilter: 'blur(2px)',
                }}
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
    </svg>
  );
};
