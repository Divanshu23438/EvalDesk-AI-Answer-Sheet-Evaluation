import { AlertCircle, ArrowRight, ClipboardCheck, Clock, Play } from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import { hasUnresolvedFlags } from '../../utils/gradingEngine';
import { ModeTag, PaperStatusBadge } from '../ui/StatusBadge';

export function TeacherDashboard() {
  const {
    state,
    currentUser,
    setActiveView,
    setSelectedPaperId,
    setSelectedSheetId,
    setWorkspaceInitialQuestionId,
  } = useEval();

  if (!currentUser) return null;

  const mySheets = state.sheets.filter((s) => s.assignedTeacherId === currentUser.id);
  const myPaperIds = Array.from(new Set(mySheets.map((s) => s.paperId)));
  const myPapers = state.papers.filter((p) => myPaperIds.includes(p.id));

  const reviewQueueCount = mySheets.reduce(
    (sum, s) => sum + s.answers.filter((a) => hasUnresolvedFlags(a)).length,
    0
  );

  // Resume target: first in_review or reopened or ready_for_review sheet
  const resumeSheet =
    mySheets.find((s) => s.status === 'in_review') ||
    mySheets.find((s) => s.status === 'reopened') ||
    mySheets.find((s) => s.status === 'ready_for_review') ||
    mySheets[0];

  const assignmentNotices = state.notifications.filter(
    (n) => n.userId === currentUser.id && !n.read
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0b1c30]">Welcome, {currentUser.name}</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Assigned examination papers, flagged items waiting for your review, and quick resume.
          </p>
        </div>

        {resumeSheet && (
          <button
            type="button"
            onClick={() => {
              setSelectedPaperId(resumeSheet.paperId);
              setSelectedSheetId(resumeSheet.id);
              setWorkspaceInitialQuestionId(null);
              setActiveView('teacher_workspace');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold whitespace-nowrap self-start"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Resume where I stopped</span>
          </button>
        )}
      </div>

      {/* Notice for new assignments */}
      {assignmentNotices.length > 0 && (
        <div className="bg-[#eff4ff] border border-[#a5c8ff] rounded-lg p-3.5 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#005dac] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[#0b1c30]">{assignmentNotices[0].title}</div>
              <div className="text-[#414752] mt-0.5">{assignmentNotices[0].message}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('teacher_papers')}
            className="text-[#005dac] font-semibold hover:underline shrink-0"
          >
            Open papers
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
          <div className="text-xs text-[#64748b]">Assigned Sheets</div>
          <div className="text-2xl font-semibold text-[#0b1c30] tabular-nums mt-1">{mySheets.length}</div>
          <div className="text-[11px] text-[#64748b] mt-0.5">Across {myPapers.length} paper(s)</div>
        </div>

        <button
          type="button"
          onClick={() => setActiveView('teacher_queue')}
          className="text-left bg-white border border-[#e2e8f0] hover:border-[#005dac] rounded-lg p-4 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748b]">My Review Queue</span>
            <ClipboardCheck className="w-4 h-4 text-[#875200]" />
          </div>
          <div className="text-2xl font-semibold text-[#875200] tabular-nums mt-1">
            {reviewQueueCount}
          </div>
          <div className="text-[11px] text-[#005dac] mt-0.5 font-medium">Flagged questions needing check →</div>
        </button>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748b]">Evaluated & Submitted</span>
            <Clock className="w-4 h-4 text-[#196b22]" />
          </div>
          <div className="text-2xl font-semibold text-[#196b22] tabular-nums mt-1">
            {mySheets.filter((s) => s.status === 'evaluated' || s.status === 'published').length}
          </div>
          <div className="text-[11px] text-[#64748b] mt-0.5">Locked & confirmed</div>
        </div>
      </div>

      {/* My Papers with Progress (Ready, In review, Evaluated) */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0b1c30]">My Assigned Papers</h2>
          <span className="text-xs text-[#64748b]">{myPapers.length} active</span>
        </div>

        {myPapers.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748b]">
            No papers are currently assigned to you. Check back when the Exam Cell assigns scripts.
          </div>
        ) : (
          <div className="divide-y divide-[#e2e8f0]">
            {myPapers.map((paper) => {
              const subj = state.subjects.find((s) => s.id === paper.subjectId);
              const sheetsForPaper = mySheets.filter((s) => s.paperId === paper.id);
              const readyCount = sheetsForPaper.filter((s) => s.status === 'ready_for_review').length;
              const inReviewCount = sheetsForPaper.filter(
                (s) => s.status === 'in_review' || s.status === 'reopened'
              ).length;
              const evalCount = sheetsForPaper.filter(
                (s) => s.status === 'evaluated' || s.status === 'published'
              ).length;

              return (
                <div key={paper.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#0b1c30]">
                        {subj?.code} — {subj?.name}
                      </span>
                      <ModeTag mode={paper.mode} />
                      <PaperStatusBadge status={paper.status} />
                      {paper.anonymousEvaluation && (
                        <span className="text-[11px] text-[#414752] font-medium">· Anonymous roll codes</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748b] tabular-nums">
                      <span>Due {paper.dueDate}</span>
                      <span>·</span>
                      <span className="text-[#875200] font-medium">Ready: {readyCount}</span>
                      <span>·</span>
                      <span className="text-[#005dac] font-medium">In review: {inReviewCount}</span>
                      <span>·</span>
                      <span className="text-[#196b22] font-medium">Evaluated: {evalCount}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPaperId(paper.id);
                      setActiveView('teacher_paper_sheets');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#eff4ff] border border-[#a5c8ff] hover:bg-[#d4e3ff] text-[#004786] text-xs font-semibold shrink-0 self-start md:self-center"
                  >
                    <span>Open Sheet List ({sheetsForPaper.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
