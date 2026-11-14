import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  EyeOff,
  Printer,
  RotateCcw,
  Send,
} from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import { canPublishPaper, computeSheetTotals, generateCsvDownload } from '../../utils/gradingEngine';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PaperStatusBadge, SheetStatusBadge } from '../ui/StatusBadge';

export function AdminResults() {
  const { state, publishPaperResults, unpublishPaperResults, reopenSheet } = useEval();
  const [paperId, setPaperId] = useState(state.papers[0]?.id || '');
  const [moderationMode, setModerationMode] = useState(false);

  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [unpublishConfirmOpen, setUnpublishConfirmOpen] = useState(false);
  const [reopenSheetId, setReopenSheetId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const activePaper = state.papers.find((p) => p.id === paperId) ?? state.papers[0] ?? null;
  const effectivePaperId = activePaper?.id || '';

  const paperSheets = useMemo(
    () => state.sheets.filter((s) => s.paperId === activePaper?.id),
    [state.sheets, activePaper]
  );

  const publishCheck = useMemo(() => canPublishPaper(paperSheets), [paperSheets]);

  const handlePublish = () => {
    if (!activePaper) return;
    const res = publishPaperResults(activePaper.id);
    if (res.ok) {
      setBanner({ type: 'ok', text: 'Results published and students notified.' });
    } else {
      setBanner({ type: 'err', text: res.reasons?.join(' ') || 'Publishing blocked.' });
    }
    setPublishConfirmOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0b1c30]">Results, Moderation & Publishing</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Verify all sheets are evaluated with zero open flags before publishing to students.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModerationMode((v) => !v)}
            className={`px-3 py-2 rounded border text-xs font-semibold ${
              moderationMode
                ? 'bg-[#eff4ff] border-[#005dac] text-[#005dac]'
                : 'bg-white border-[#c1c6d4] text-[#0b1c30]'
            }`}
          >
            {moderationMode ? 'Standard Table' : 'Moderation View (AI vs Teacher)'}
          </button>

          <button
            type="button"
            disabled={!activePaper || paperSheets.length === 0}
            onClick={() =>
              generateCsvDownload(
                `results-${activePaper?.id}.csv`,
                ['Roll Number', 'Student Name', 'Status', 'AI Suggested', 'Teacher Final', 'Out Of'],
                paperSheets.map((s) => {
                  const st = state.users.find((u) => u.id === s.studentId);
                  const t = computeSheetTotals(s);
                  return [
                    st?.rollNumber || '',
                    st?.name || '',
                    s.status,
                    t.suggestedTotal,
                    t.finalTotal,
                    activePaper?.totalMarks || 0,
                  ];
                })
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#c1c6d4] bg-white disabled:opacity-40 text-xs font-semibold text-[#0b1c30]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#c1c6d4] bg-white text-xs font-semibold text-[#0b1c30]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Paper Selector + Readiness Gate */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={effectivePaperId}
            onChange={(e) => {
              setPaperId(e.target.value);
              setBanner(null);
            }}
            aria-label="Select paper for results"
            className="rounded border border-[#c1c6d4] px-3 py-2 text-xs bg-white font-medium"
          >
            {state.papers.length === 0 && <option value="">No papers available</option>}
            {state.papers.map((p) => {
              const subj = state.subjects.find((s) => s.id === p.subjectId);
              return (
                <option key={p.id} value={p.id}>
                  {subj?.code} — {subj?.name}
                </option>
              );
            })}
          </select>
          {activePaper && <PaperStatusBadge status={activePaper.status} />}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {publishCheck.allowed ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#196b22]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Ready to publish (all sheets evaluated, 0 open flags)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#875200]">
              <AlertTriangle className="w-4 h-4" />
              <span>{publishCheck.reasons[0]}</span>
            </span>
          )}

          {activePaper?.status === 'published' ? (
            <button
              type="button"
              onClick={() => setUnpublishConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6]/40 text-xs font-semibold"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Unpublish</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!activePaper || !publishCheck.allowed}
              onClick={() => setPublishConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#005dac] hover:bg-[#004786] disabled:opacity-40 text-white text-xs font-semibold"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publish All Results</span>
            </button>
          )}
        </div>
      </div>

      {banner && (
        <div
          className={`p-3 rounded border text-xs ${
            banner.type === 'ok'
              ? 'bg-[#e8f5e9] border-[#88d982] text-[#196b22]'
              : 'bg-[#ffdad6] border-[#ba1a1a] text-[#93000a]'
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* Results / Moderation Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-[#e2e8f0] text-[#64748b] uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Roll No</th>
                <th className="py-2.5 px-4">Student</th>
                <th className="py-2.5 px-4">Status</th>
                {moderationMode && <th className="py-2.5 px-4 text-right">AI Suggested</th>}
                <th className="py-2.5 px-4 text-right">Final Marks</th>
                {moderationMode && <th className="py-2.5 px-4 text-right">Delta / Overrides</th>}
                <th className="py-2.5 px-4 text-right">Flags</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {paperSheets.length === 0 ? (
                <tr>
                  <td colSpan={moderationMode ? 8 : 6} className="py-8 text-center text-[#64748b]">
                    {activePaper
                      ? 'No answer sheets uploaded for this paper yet.'
                      : 'Create a paper and upload evaluated sheets to review and publish results.'}
                  </td>
                </tr>
              ) : (
                paperSheets.map((s) => {
                  const st = state.users.find((u) => u.id === s.studentId);
                  const totals = computeSheetTotals(s);
                  const delta = totals.finalTotal - totals.suggestedTotal;
                  const pass = activePaper ? totals.finalTotal >= activePaper.passingMarks : true;

                  return (
                    <tr key={s.id} className="hover:bg-[#f8f9ff]">
                      <td className="py-2.5 px-4 font-mono text-[#0b1c30]">{st?.rollNumber}</td>
                      <td className="py-2.5 px-4 font-semibold text-[#0b1c30]">{st?.name}</td>
                      <td className="py-2.5 px-4">
                        <SheetStatusBadge status={s.status} />
                      </td>
                      {moderationMode && (
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#64748b]">
                          {totals.suggestedTotal} / {activePaper?.totalMarks}
                        </td>
                      )}
                      <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums">
                        <span className={pass ? 'text-[#196b22]' : 'text-[#ba1a1a]'}>
                          {totals.finalTotal} / {activePaper?.totalMarks}
                        </span>
                      </td>
                      {moderationMode && (
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {delta === 0 ? '0' : delta > 0 ? `+${delta}` : delta} ({totals.overrideCount} overrides)
                        </td>
                      )}
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {totals.unresolvedFlags > 0 ? (
                          <span className="text-[#ba1a1a] font-semibold">{totals.unresolvedFlags} open</span>
                        ) : (
                          <span className="text-[#64748b]">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {(s.status === 'evaluated' || s.status === 'published') && (
                          <button
                            type="button"
                            onClick={() => setReopenSheetId(s.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#c1c6d4] text-[#0b1c30] hover:bg-slate-50 font-medium"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Re-open</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={publishConfirmOpen}
        title="Publish Paper Results"
        description="Published teacher-confirmed marks will immediately become visible to students and notifications will be sent."
        confirmLabel="Publish Results"
        onCancel={() => setPublishConfirmOpen(false)}
        onConfirm={handlePublish}
      />

      <ConfirmDialog
        open={unpublishConfirmOpen}
        title="Unpublish Paper Results"
        description="Results will be hidden from students until published again. Provide a reason for the audit log."
        confirmLabel="Unpublish"
        danger
        requireReason
        onCancel={() => setUnpublishConfirmOpen(false)}
        onConfirm={(reason) => {
          if (activePaper) unpublishPaperResults(activePaper.id, reason);
          setUnpublishConfirmOpen(false);
        }}
      />

      <ConfirmDialog
        open={Boolean(reopenSheetId)}
        title="Re-open Locked Sheet"
        description="Unlocking this sheet returns it to the assigned teacher for review. A reason is required."
        confirmLabel="Re-open Sheet"
        requireReason
        onCancel={() => setReopenSheetId(null)}
        onConfirm={(reason) => {
          if (reopenSheetId) reopenSheet(reopenSheetId, reason);
          setReopenSheetId(null);
        }}
      />
    </div>
  );
}
