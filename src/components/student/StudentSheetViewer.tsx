import { ArrowLeft, Download, Lock } from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import { computeSheetTotals } from '../../utils/gradingEngine';

export function StudentSheetViewer() {
  const { state, currentUser, selectedSheetId, setActiveView, logSheetDownload } = useEval();
  if (!currentUser) return null;

  const sheet = state.sheets.find((s) => s.id === selectedSheetId && s.studentId === currentUser.id);
  const req = state.requests.find(
    (r) => r.sheetId === sheet?.id && r.studentId === currentUser.id && r.status === 'released'
  );
  const paper = sheet ? state.papers.find((p) => p.id === sheet.paperId) : null;
  const subj = paper ? state.subjects.find((s) => s.id === paper.subjectId) : null;

  if (!sheet || !req || !paper) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => setActiveView('student_requests')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#005dac] mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Requests</span>
        </button>
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-8 text-center text-xs text-[#64748b]">
          This evaluated sheet is not currently released or has expired.
        </div>
      </div>
    );
  }

  const isExpired = req.expiryDate ? new Date(req.expiryDate) < new Date() : false;
  const totals = computeSheetTotals(sheet);

  const handleDownload = () => {
    if (!req.allowDownload) return;
    logSheetDownload(sheet.id);
    const a = document.createElement('a');
    a.href = sheet.pages[0];
    a.download = `${currentUser.rollNumber}-${subj?.code || 'sheet'}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setActiveView('student_requests')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#005dac] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Requests</span>
        </button>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#64748b]">Access expires: {req.expiryDate}</span>
          {req.allowDownload ? (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#005dac] text-white font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Sheet</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#e2e8f0] bg-slate-50 text-[#64748b] font-medium">
              <Lock className="w-3 h-3" />
              <span>View-only (download disabled)</span>
            </span>
          )}
        </div>
      </div>

      {isExpired ? (
        <div className="bg-white border border-[#ba1a1a] rounded-lg p-8 text-center text-xs text-[#93000a]">
          Access to this evaluated answer sheet expired on {req.expiryDate}.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Watermarked Scanned Pages */}
          <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-lg p-4 space-y-4">
            <div className="text-xs font-semibold text-[#0b1c30]">
              {subj?.code} — Scanned Answer Script (Watermarked · {sheet.pages.length} page{sheet.pages.length === 1 ? '' : 's'})
            </div>
            {sheet.pages.map((pageSrc, pageIndex) => (
              <div key={pageIndex} className="relative border border-[#c1c6d4] rounded overflow-hidden select-none">
                <img
                  src={pageSrc}
                  alt={`Evaluated answer sheet page ${pageIndex + 1} for ${currentUser.name}`}
                  className="w-full h-auto block"
                  onContextMenu={(e) => {
                    if (!req.allowDownload) e.preventDefault();
                  }}
                />
                {/* Student Name & Roll Watermark Overlay (PRD S6) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 grid grid-cols-2 grid-rows-3 place-items-center overflow-hidden opacity-25"
                >
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="-rotate-25 text-sm sm:text-base font-mono font-semibold text-[#004786] whitespace-nowrap"
                    >
                      {currentUser.name} · {currentUser.rollNumber}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Teacher Marks & Comments */}
          <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-lg p-5 space-y-4 self-start">
            <div className="pb-3 border-b border-[#e2e8f0] flex items-center justify-between">
              <div>
                <h1 className="text-base font-semibold text-[#0b1c30]">Teacher Marks & Comments</h1>
                <p className="text-xs text-[#64748b]">{subj?.name}</p>
              </div>
              <div className="text-right font-mono">
                <div className="text-lg font-semibold text-[#005dac] tabular-nums">
                  {totals.finalTotal} / {paper.totalMarks}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {sheet.answers.map((ans) => {
                const q = state.questions.find((x) => x.id === ans.questionId);
                return (
                  <div key={ans.questionId} className="p-3 rounded border border-[#e2e8f0] bg-[#f8f9ff] text-xs space-y-1.5">
                    <div className="flex justify-between font-semibold text-[#0b1c30]">
                      <span>
                        {q?.label}. {q?.text}
                      </span>
                      <span className="font-mono shrink-0 ml-2">
                        {ans.finalMarks}/{q?.marks}
                      </span>
                    </div>
                    {ans.feedback && (
                      <div className="text-[#414752]">
                        <strong>Comment:</strong> {ans.feedback}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
