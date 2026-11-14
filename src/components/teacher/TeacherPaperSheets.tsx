import { useMemo, useState } from 'react';
import { CheckCheck, Eye, Play, ShieldCheck, X } from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import {
  computeSheetTotals,
  formatStudentIdentity,
  hasUnresolvedFlags,
} from '../../utils/gradingEngine';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ConfidenceBadge, ModeTag, SheetStatusBadge } from '../ui/StatusBadge';

export function TeacherPaperSheets() {
  const {
    state,
    currentUser,
    selectedPaperId,
    setSelectedPaperId,
    setSelectedSheetId,
    setWorkspaceInitialQuestionId,
    setActiveView,
    markSpotCheckCompleted,
    bulkAcceptClearQuestions,
  } = useEval();

  const [filter, setFilter] = useState<'all' | 'needs_review' | 'clear' | 'done'>('all');
  const [spotCheckSheetId, setSpotCheckSheetId] = useState<string | null>(null);
  const [bulkConfirmSheetId, setBulkConfirmSheetId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  if (!currentUser) return null;

  const mySheets = state.sheets.filter((s) => s.assignedTeacherId === currentUser.id);
  const myPaperIds = Array.from(new Set(mySheets.map((s) => s.paperId)));
  const activePaper =
    state.papers.find((p) => p.id === selectedPaperId && myPaperIds.includes(p.id)) ??
    state.papers.find((p) => myPaperIds.includes(p.id)) ??
    null;

  const paperSheets = useMemo(
    () => (activePaper ? mySheets.filter((s) => s.paperId === activePaper.id) : []),
    [mySheets, activePaper]
  );

  const filteredSheets = useMemo(() => {
    return paperSheets.filter((s) => {
      const totals = computeSheetTotals(s);
      const isDone = s.status === 'evaluated' || s.status === 'published';
      if (filter === 'needs_review') return !isDone && totals.unresolvedFlags > 0;
      if (filter === 'clear') return !isDone && totals.unresolvedFlags === 0;
      if (filter === 'done') return isDone;
      return true;
    });
  }, [paperSheets, filter]);

  const nextToEvaluate =
    paperSheets.find((s) => s.status === 'in_review' || s.status === 'reopened') ||
    paperSheets.find((s) => s.status === 'ready_for_review');

  const spotSheet = state.sheets.find((s) => s.id === spotCheckSheetId) ?? null;

  const openSheet = (sheetId: string) => {
    setSelectedSheetId(sheetId);
    setWorkspaceInitialQuestionId(null);
    setActiveView('teacher_workspace');
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0b1c30]">Paper Sheet List</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Inspect assigned scripts, complete required spot-check samples, and open the grading workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={activePaper?.id || ''}
            onChange={(e) => setSelectedPaperId(e.target.value)}
            aria-label="Select assigned paper"
            className="rounded border border-[#c1c6d4] px-3 py-2 text-xs bg-white font-medium"
          >
            {myPaperIds.map((pid) => {
              const p = state.papers.find((x) => x.id === pid);
              const subj = state.subjects.find((s) => s.id === p?.subjectId);
              return (
                <option key={pid} value={pid}>
                  {subj?.code} — {subj?.name}
                </option>
              );
            })}
          </select>

          {nextToEvaluate && (
            <button
              type="button"
              onClick={() => openSheet(nextToEvaluate.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Next</span>
            </button>
          )}
        </div>
      </div>

      {activePaper && (
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <ModeTag mode={activePaper.mode} />
            <span className="text-[#414752]">
              Spot-check sample required: <strong className="font-mono">{activePaper.spotCheckPct}%</strong>
            </span>
            <span className="text-[#c1c6d4]">·</span>
            <span className="text-[#414752]">
              Identity: <strong>{activePaper.anonymousEvaluation ? 'Anonymous Roll Code' : 'Name & Roll Visible'}</strong>
            </span>
          </div>

          <div className="inline-flex p-1 bg-slate-100 rounded-md">
            {(
              [
                { id: 'all', label: `All (${paperSheets.length})` },
                { id: 'needs_review', label: 'Needs review' },
                { id: 'clear', label: 'Clear (no flags)' },
                { id: 'done', label: 'Done' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  filter === f.id ? 'bg-white text-[#005dac] shadow-xs font-semibold' : 'text-[#414752]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {notice && (
        <div className="p-3 rounded border border-[#88d982] bg-[#e8f5e9] text-xs text-[#196b22]">
          {notice}
        </div>
      )}

      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-[#e2e8f0] text-[#64748b] uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-4">{activePaper?.anonymousEvaluation ? 'Roll Code' : 'Student'}</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Suggested / Final</th>
                <th className="py-2.5 px-4 text-right">Flags</th>
                <th className="py-2.5 px-4">Confidence</th>
                <th className="py-2.5 px-4 text-right">Time</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filteredSheets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#64748b]">
                    No sheets match this filter.
                  </td>
                </tr>
              ) : (
                filteredSheets.map((sheet) => {
                  const student = state.users.find((u) => u.id === sheet.studentId);
                  const totals = computeSheetTotals(sheet);
                  const lowestConf = sheet.answers.some((a) => a.confidence === 'low')
                    ? 'low'
                    : sheet.answers.some((a) => a.confidence === 'medium')
                    ? 'medium'
                    : 'high';
                  const hasClearUnaccepted = sheet.answers.some(
                    (a) => !hasUnresolvedFlags(a) && !a.acceptedByTeacher
                  );
                  const isLocked = sheet.status === 'evaluated' || sheet.status === 'published';

                  return (
                    <tr key={sheet.id} className="hover:bg-[#f8f9ff]">
                      <td className="py-2.5 px-4 font-semibold text-[#0b1c30] font-mono">
                        {formatStudentIdentity(student, Boolean(activePaper?.anonymousEvaluation))}
                      </td>
                      <td className="py-2.5 px-4">
                        <SheetStatusBadge status={sheet.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {totals.suggestedTotal} / <strong className="text-[#0b1c30]">{totals.finalTotal}</strong>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {totals.unresolvedFlags > 0 ? (
                          <span className="text-[#ba1a1a] font-semibold">{totals.unresolvedFlags}</span>
                        ) : (
                          <span className="text-[#196b22]">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <ConfidenceBadge level={lowestConf} />
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#64748b]">
                        {Math.floor(sheet.timeSpentSeconds / 60)}m {sheet.timeSpentSeconds % 60}s
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {!isLocked && hasClearUnaccepted && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!sheet.spotCheckCompleted) {
                                setSpotCheckSheetId(sheet.id);
                              } else {
                                setBulkConfirmSheetId(sheet.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#196b22] text-[#196b22] hover:bg-[#e8f5e9] font-semibold"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Bulk-accept clear</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openSheet(sheet.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#005dac] hover:bg-[#004786] text-white font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isLocked ? 'View' : 'Evaluate'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spot-Check Sample Gate Modal (PRD T2 & Behaviours) */}
      {spotSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-white border border-[#e2e8f0] rounded-lg shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#005dac]" />
                <h2 className="text-sm font-semibold text-[#0b1c30]">Spot-Check Sample Required Before Bulk Accept</h2>
              </div>
              <button type="button" onClick={() => setSpotCheckSheetId(null)} aria-label="Close">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-[#414752]">
                Policy requires reviewing a {activePaper?.spotCheckPct}% spot-check sample of clear answers before bulk-accepting them.
              </p>
              {spotSheet.answers
                .filter((a) => !hasUnresolvedFlags(a))
                .slice(0, 1)
                .map((ans) => {
                  const q = state.questions.find((x) => x.id === ans.questionId);
                  return (
                    <div key={ans.questionId} className="p-3.5 rounded border border-[#e2e8f0] bg-[#f8f9ff] space-y-2">
                      <div className="flex justify-between font-semibold text-[#0b1c30]">
                        <span>
                          {q?.label}: {q?.text}
                        </span>
                        <span className="font-mono shrink-0 ml-2">
                          {ans.suggestedMarks}/{q?.marks}m
                        </span>
                      </div>
                      <div className="text-[#414752] bg-white p-2.5 rounded border border-[#e2e8f0]">
                        {ans.ocrText}
                      </div>
                      <div className="text-[#196b22] font-medium">{ans.aiDraftFeedback}</div>
                    </div>
                  );
                })}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-[#e2e8f0] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSpotCheckSheetId(null)}
                className="px-3.5 py-2 rounded border border-[#c1c6d4] text-xs font-semibold text-[#414752]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  markSpotCheckCompleted(spotSheet.id);
                  setSpotCheckSheetId(null);
                  setBulkConfirmSheetId(spotSheet.id);
                }}
                className="px-4 py-2 rounded bg-[#005dac] text-white text-xs font-semibold"
              >
                Spot-Check Verified · Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(bulkConfirmSheetId)}
        title="Bulk-Accept Clear Questions"
        description="All unflagged questions in this sheet will be accepted at their AI-suggested marks. Flagged questions remain open for manual review."
        confirmLabel="Accept Clear Questions"
        onCancel={() => setBulkConfirmSheetId(null)}
        onConfirm={() => {
          if (bulkConfirmSheetId) {
            const res = bulkAcceptClearQuestions(bulkConfirmSheetId);
            setNotice(`Bulk-accepted ${res.count} clear question(s).`);
          }
          setBulkConfirmSheetId(null);
        }}
      />
    </div>
  );
}
