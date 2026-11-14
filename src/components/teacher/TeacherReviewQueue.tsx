import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { STRINGS } from '../../i18n/strings';
import { useEval } from '../../store/EvalContext';
import type { ReviewFlagReason } from '../../types/eval';
import { formatStudentIdentity, hasUnresolvedFlags } from '../../utils/gradingEngine';
import { ConfidenceBadge } from '../ui/StatusBadge';

export function TeacherReviewQueue() {
  const {
    state,
    currentUser,
    setSelectedPaperId,
    setSelectedSheetId,
    setWorkspaceInitialQuestionId,
    setActiveView,
  } = useEval();

  if (!currentUser) return null;

  const mySheets = state.sheets.filter((s) => s.assignedTeacherId === currentUser.id);

  const grouped: Record<
    ReviewFlagReason,
    {
      sheetId: string;
      paperId: string;
      paperLabel: string;
      studentLabel: string;
      questionId: string;
      questionLabel: string;
      confidence: 'high' | 'medium' | 'low';
      score: number;
    }[]
  > = {
    low_ocr_confidence: [],
    checks_disagree: [],
    doubtful_crop: [],
    spelling_doubt: [],
  };

  for (const s of mySheets) {
    const paper = state.papers.find((p) => p.id === s.paperId);
    const subj = state.subjects.find((sub) => sub.id === paper?.subjectId);
    const student = state.users.find((u) => u.id === s.studentId);

    for (const a of s.answers) {
      if (!hasUnresolvedFlags(a)) continue;
      const q = state.questions.find((x) => x.id === a.questionId);
      for (const reason of a.reviewReasons) {
        grouped[reason].push({
          sheetId: s.id,
          paperId: s.paperId,
          paperLabel: `${subj?.code || s.paperId}`,
          studentLabel: formatStudentIdentity(student, Boolean(paper?.anonymousEvaluation)),
          questionId: a.questionId,
          questionLabel: q?.label || a.questionId,
          confidence: a.confidence,
          score: a.confidenceScore,
        });
      }
    }
  }

  const totalOpen = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#0b1c30]">Review Queue</h1>
        <p className="text-xs text-[#64748b] mt-0.5">
          All unresolved flagged questions across your assigned sheets, grouped by review reason.
        </p>
      </div>

      {totalOpen === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-8 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-[#196b22] mx-auto" />
          <div className="text-sm font-semibold text-[#0b1c30]">Review queue is clear</div>
          <p className="text-xs text-[#64748b]">All flagged questions in your assigned sheets have been resolved.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(Object.keys(grouped) as ReviewFlagReason[]).map((reason) => {
            const items = grouped[reason];
            return (
              <div key={reason} className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#875200]" />
                    <span className="text-xs font-semibold text-[#0b1c30]">
                      {STRINGS.statuses.flagReason[reason]}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-[#875200] tabular-nums">
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="p-4 text-xs text-[#64748b]">No items in this category.</div>
                ) : (
                  <div className="divide-y divide-[#e2e8f0]">
                    {items.map((item, idx) => (
                      <button
                        key={`${item.sheetId}-${item.questionId}-${idx}`}
                        type="button"
                        onClick={() => {
                          setSelectedPaperId(item.paperId);
                          setSelectedSheetId(item.sheetId);
                          setWorkspaceInitialQuestionId(item.questionId);
                          setActiveView('teacher_workspace');
                        }}
                        className="w-full text-left p-3.5 hover:bg-[#eff4ff] flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#0b1c30] truncate">
                            {item.paperLabel} · {item.questionLabel} · {item.studentLabel}
                          </div>
                          <div className="mt-1">
                            <ConfidenceBadge level={item.confidence} score={item.score} />
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#005dac] shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
