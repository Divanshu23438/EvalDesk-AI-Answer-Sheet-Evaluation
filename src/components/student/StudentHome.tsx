import { ArrowRight, Bell, CheckCircle2, FileCheck2, Inbox } from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import { computeSheetTotals } from '../../utils/gradingEngine';
import { RequestStatusBadge } from '../ui/StatusBadge';

export function StudentHome() {
  const { state, currentUser, setActiveView, setSelectedPaperId } = useEval();
  if (!currentUser) return null;

  const publishedSheets = state.sheets.filter(
    (s) => s.studentId === currentUser.id && s.status === 'published'
  );
  const myRequests = state.requests.filter((r) => r.studentId === currentUser.id);
  const myNotifs = state.notifications.filter((n) => n.userId === currentUser.id);

  const latestSheet = publishedSheets[0] ?? null;
  const latestPaper = latestSheet ? state.papers.find((p) => p.id === latestSheet.paperId) : null;
  const latestSubject = latestPaper
    ? state.subjects.find((s) => s.id === latestPaper.subjectId)
    : null;
  const latestTotals = latestSheet ? computeSheetTotals(latestSheet) : null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0b1c30]">Hello, {currentUser.name}</h1>
        <p className="text-xs text-[#64748b] mt-0.5 font-mono">
          Roll No: {currentUser.rollNumber} · Section {currentUser.section || 'A'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Latest Published Result */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#005dac]">
                <FileCheck2 className="w-4 h-4" />
                <span>Latest Published Result</span>
              </div>
              {latestSheet && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#196b22]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Published
                </span>
              )}
            </div>

            {latestSheet && latestPaper && latestTotals ? (
              <div className="pt-2">
                <div className="text-base font-semibold text-[#0b1c30]">
                  {latestSubject?.code} — {latestSubject?.name}
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-[#0b1c30] font-mono tabular-nums">
                    {latestTotals.finalTotal}
                  </span>
                  <span className="text-sm text-[#64748b] font-mono">/ {latestPaper.totalMarks} marks</span>
                </div>
                <div className="text-xs text-[#414752] mt-1">
                  Status:{' '}
                  <strong
                    className={
                      latestTotals.finalTotal >= latestPaper.passingMarks
                        ? 'text-[#196b22]'
                        : 'text-[#ba1a1a]'
                    }
                  >
                    {latestTotals.finalTotal >= latestPaper.passingMarks ? 'Pass' : 'Needs Improvement'}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#64748b] pt-2">
                No published exam results yet. Results appear here once finalized and published by the Examination Cell.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (latestPaper) setSelectedPaperId(latestPaper.id);
              setActiveView(latestPaper ? 'student_result_detail' : 'student_results');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#005dac] hover:underline self-start"
          >
            <span>{latestPaper ? 'View question-wise marks' : 'Go to My Results'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Open Sheet Requests */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#005dac]">
                <Inbox className="w-4 h-4" />
                <span>Evaluated Sheet Requests</span>
              </div>
              <span className="text-xs text-[#64748b] tabular-nums">{myRequests.length} total</span>
            </div>

            {myRequests.length === 0 ? (
              <p className="text-xs text-[#64748b]">
                You have not requested any evaluated answer sheets yet.
              </p>
            ) : (
              <div className="space-y-2">
                {myRequests.slice(0, 3).map((req) => {
                  const p = state.papers.find((x) => x.id === req.paperId);
                  const subj = state.subjects.find((s) => s.id === p?.subjectId);
                  return (
                    <div
                      key={req.id}
                      className="p-2.5 rounded border border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-medium text-[#0b1c30]">{subj?.code}</span>
                      <RequestStatusBadge status={req.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setActiveView('student_requests')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#005dac] hover:underline self-start"
          >
            <span>Manage or request sheet</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notifications Summary */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0b1c30]">
            <Bell className="w-4 h-4 text-[#005dac]" />
            <span>Recent Notifications</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('student_notifications')}
            className="text-xs font-medium text-[#005dac] hover:underline"
          >
            View all
          </button>
        </div>
        {myNotifs.length === 0 ? (
          <div className="p-5 text-xs text-[#64748b]">No new notifications.</div>
        ) : (
          <div className="divide-y divide-[#e2e8f0]">
            {myNotifs.slice(0, 4).map((n) => (
              <div key={n.id} className="px-4 py-3 text-xs">
                <div className="font-semibold text-[#0b1c30]">{n.title}</div>
                <div className="text-[#414752] mt-0.5">{n.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
