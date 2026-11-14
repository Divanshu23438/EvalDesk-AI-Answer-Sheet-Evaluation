import { useState } from 'react';
import { Clock, Forward, Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import type { RequestStatus } from '../../types/eval';
import { computeSheetTotals } from '../../utils/gradingEngine';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { RequestStatusBadge } from '../ui/StatusBadge';

export function AdminRequests() {
  const { state, decideStudentRequest } = useEval();
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('all');
  const [selectedReqId, setSelectedReqId] = useState<string | null>(state.requests[0]?.id || null);

  const [viewDays, setViewDays] = useState(state.settings.defaultRequestViewDays);
  const [allowDownload, setAllowDownload] = useState(false);
  const [forwardTeacherId, setForwardTeacherId] = useState(
    state.users.find((u) => u.role === 'teacher')?.id || ''
  );
  const [rejectOpen, setRejectOpen] = useState(false);

  const teachers = state.users.filter((u) => u.role === 'teacher' && u.status === 'active');

  const filtered = state.requests.filter((r) =>
    statusFilter === 'all' ? true : r.status === statusFilter
  );
  const activeReq = state.requests.find((r) => r.id === selectedReqId) ?? filtered[0] ?? null;

  const isOverdue = (createdAt: string, status: RequestStatus) => {
    if (status !== 'requested' && status !== 'under_review') return false;
    const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000;
    return ageDays >= 3;
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0b1c30]">Student Evaluated Sheet Requests</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Review, approve, forward for re-evaluation, reject with reason, or release evaluated answer sheets.
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | RequestStatus)}
          aria-label="Filter requests by status"
          className="rounded border border-[#c1c6d4] px-3 py-1.5 text-xs bg-white self-start"
        >
          <option value="all">All Statuses</option>
          <option value="requested">Requested</option>
          <option value="under_review">Under review</option>
          <option value="approved">Approved</option>
          <option value="released">Released</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Queue table */}
        <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-[#e2e8f0] text-[#64748b] uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Student</th>
                <th className="py-2.5 px-4">Paper</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#64748b]">
                    No requests match the selected filter.
                  </td>
                </tr>
              ) : (
                filtered.map((req) => {
                  const student = state.users.find((u) => u.id === req.studentId);
                  const paper = state.papers.find((p) => p.id === req.paperId);
                  const subj = state.subjects.find((s) => s.id === paper?.subjectId);
                  const overdue = isOverdue(req.createdAt, req.status);
                  const selected = activeReq?.id === req.id;
                  return (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedReqId(req.id)}
                      className={`cursor-pointer transition-colors ${
                        selected ? 'bg-[#eff4ff]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#0b1c30]">{student?.name}</div>
                        <div className="text-[11px] font-mono text-[#64748b]">{student?.rollNumber}</div>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-[#0b1c30]">{subj?.code}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <RequestStatusBadge status={req.status} />
                          {overdue && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#ffdad6] text-[#93000a] text-[10px] font-semibold">
                              <Clock className="w-3 h-3" />
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-[#64748b] tabular-nums">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Detail & Decision Pane */}
        <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-lg p-5">
          {!activeReq ? (
            <div className="text-xs text-[#64748b] text-center py-8">Select a request to inspect details.</div>
          ) : (
            (() => {
              const student = state.users.find((u) => u.id === activeReq.studentId);
              const paper = state.papers.find((p) => p.id === activeReq.paperId);
              const subj = state.subjects.find((s) => s.id === paper?.subjectId);
              const sheet = state.sheets.find((s) => s.id === activeReq.sheetId);
              const totals = sheet ? computeSheetTotals(sheet) : { finalTotal: 0 };

              return (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#e2e8f0]">
                    <div>
                      <h2 className="text-sm font-semibold text-[#0b1c30]">
                        {student?.name} ({student?.rollNumber})
                      </h2>
                      <p className="text-xs text-[#64748b] mt-0.5">
                        {subj?.code} — {subj?.name}
                      </p>
                    </div>
                    <RequestStatusBadge status={activeReq.status} />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Current Marks</span>
                      <span className="font-mono font-semibold text-[#0b1c30] tabular-nums">
                        {totals.finalTotal} / {paper?.totalMarks}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Reason Category</span>
                      <span className="font-medium text-[#0b1c30]">{activeReq.reasonCategory}</span>
                    </div>
                    <div className="p-3 rounded bg-[#f8f9ff] border border-[#e2e8f0] text-[#414752]">
                      "{activeReq.note || 'No additional note provided.'}"
                    </div>
                    {activeReq.reevalCompleted && (
                      <div className="p-2.5 rounded bg-[#e8f5e9] border border-[#88d982] text-[#196b22]">
                        Teacher Re-evaluation Note: {activeReq.reevalSummary}
                      </div>
                    )}
                    {activeReq.rejectionReason && (
                      <div className="p-2.5 rounded bg-[#ffdad6] border border-[#ba1a1a] text-[#93000a]">
                        Rejected: {activeReq.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Release / Approval options */}
                  <div className="pt-3 border-t border-[#e2e8f0] space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-[#414752] mb-1">View Duration (Days)</label>
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={viewDays}
                          onChange={(e) => setViewDays(Number(e.target.value))}
                          className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 tabular-nums"
                        />
                      </div>
                      <div className="flex items-end pb-1.5">
                        <label className="inline-flex items-center gap-1.5 font-medium text-[#0b1c30]">
                          <input
                            type="checkbox"
                            checked={allowDownload}
                            onChange={(e) => setAllowDownload(e.target.checked)}
                          />
                          <span>Allow download</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          decideStudentRequest(activeReq.id, 'approved', {
                            viewDurationDays: viewDays,
                            allowDownload,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#196b22] text-[#196b22] hover:bg-[#e8f5e9] font-semibold"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          decideStudentRequest(activeReq.id, 'released', {
                            viewDurationDays: viewDays,
                            allowDownload,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#005dac] hover:bg-[#004786] text-white font-semibold"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Release to Student</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRejectOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6]/40 font-semibold"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>

                    {/* Phase 2 Forward to teacher for re-evaluation */}
                    <div className="pt-2 border-t border-[#e2e8f0] flex items-center gap-2">
                      <select
                        value={forwardTeacherId}
                        onChange={(e) => setForwardTeacherId(e.target.value)}
                        aria-label="Select teacher for re-evaluation"
                        className="flex-1 rounded border border-[#c1c6d4] px-2 py-1.5 bg-white"
                      >
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          decideStudentRequest(activeReq.id, 'under_review', {
                            forwardedToTeacherId: forwardTeacherId,
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#c1c6d4] hover:bg-slate-50 font-semibold text-[#0b1c30] whitespace-nowrap"
                      >
                        <Forward className="w-3.5 h-3.5" />
                        <span>Forward for Re-eval</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>

      <ConfirmDialog
        open={rejectOpen}
        title="Reject Student Request"
        description="A reason is required and will be visible to the student."
        confirmLabel="Reject Request"
        danger
        requireReason
        reasonLabel="Rejection Reason"
        onCancel={() => setRejectOpen(false)}
        onConfirm={(reason) => {
          if (activeReq) {
            decideStudentRequest(activeReq.id, 'rejected', { rejectionReason: reason });
          }
          setRejectOpen(false);
        }}
      />
    </div>
  );
}
