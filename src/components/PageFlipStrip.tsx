import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';

export type PageOcrStatus = 'pending' | 'reading' | 'done' | 'failed';

export interface SheetPageStatus {
  n: number;
  status: PageOcrStatus;
  image_url?: string | null;
}

const CSS = `
@keyframes evalScan { from { top: 0%; } to { top: 100%; } }
.eval-scan-line {
  position: absolute; left: 0; right: 0; height: 2px;
  background: rgba(79,70,229,.85); box-shadow: 0 0 8px rgba(79,70,229,.7);
  animation: evalScan 1.1s linear infinite alternate;
}
@media (prefers-reduced-motion: reduce) {
  .eval-flip { transition: none !important; }
  .eval-scan-line { animation: none; top: 50%; }
}
`;

const FACE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  borderRadius: 6,
  overflow: 'hidden',
};

const LINED: React.CSSProperties = {
  background: 'repeating-linear-gradient(#fff, #fff 9px, #e2e8f0 9px, #e2e8f0 10px)',
};

const PageCard: React.FC<{ page: SheetPageStatus }> = ({ page }) => {
  const flipped = page.status === 'done';
  const reading = page.status === 'reading';
  const failed = page.status === 'failed';

  return (
    <div style={{ width: 52, height: 72, perspective: 700 }} className="shrink-0">
      <div
        className="eval-flip relative w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 700ms cubic-bezier(.4,.2,.2,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front: the page being read */}
        <div
          style={{ ...FACE, ...(page.image_url ? {} : LINED) }}
          className={`border ${
            failed
              ? 'border-rose-300 bg-rose-50'
              : reading
              ? 'border-indigo-400 ring-2 ring-indigo-300'
              : 'border-slate-200 opacity-70'
          }`}
        >
          {page.image_url && (
            <img src={page.image_url} alt={`Page ${page.n}`} loading="lazy" className="w-full h-full object-cover" />
          )}
          {reading && <div className="eval-scan-line" />}
          {failed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
          )}
          <span className="absolute bottom-0.5 right-1 text-[9px] font-mono font-bold text-slate-500 bg-white/80 rounded px-0.5">
            {page.n}
          </span>
        </div>

        {/* Back: shown after the flip when OCR finished */}
        <div
          style={{ ...FACE, transform: 'rotateY(180deg)' }}
          className="border border-emerald-300 bg-emerald-50 flex flex-col items-center justify-center gap-0.5"
        >
          <Check className="w-5 h-5 text-emerald-600" />
          <span className="text-[9px] font-semibold text-emerald-800">Page {page.n}</span>
        </div>
      </div>
    </div>
  );
};

export const PageFlipStrip: React.FC<{ pages: SheetPageStatus[] }> = ({ pages }) => {
  const sorted = [...pages].sort((a, b) => a.n - b.n);
  const done = sorted.filter((p) => p.status === 'done').length;
  const failedPage = sorted.find((p) => p.status === 'failed');
  const current = sorted.find((p) => p.status === 'reading');

  const label = failedPage
    ? `Page ${failedPage.n} failed to read`
    : current
    ? `Reading page ${current.n} of ${sorted.length}`
    : `${done} of ${sorted.length} pages read`;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-1.5">
      <style>{CSS}</style>
      <div className="flex items-center justify-between text-[11px]" aria-live="polite">
        <span className={`font-semibold ${failedPage ? 'text-rose-700' : 'text-slate-700'}`}>{label}</span>
        <span className="font-mono text-slate-500">
          {done}/{sorted.length}
        </span>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {sorted.map((p) => (
          <PageCard key={p.n} page={p} />
        ))}
      </div>
    </div>
  );
};
