import { useState } from 'react';
import { CheckCircle2, Eye, Send, XCircle } from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import { RequestStatusBadge } from '../ui/StatusBadge';

const REASON_OPTIONS = [
  'Understand question-wise marking',
  'Suspected totaling or strict penalty discrepancy',
  'Re-evaluation inquiry',
  'Prepare for improvement / finals',
];

export function StudentRequests() {
  const {
    state,
    currentUser,
    submitStudentRequest,
    cancelStudentRequest,
    setSelectedSheetId,
    setActiveView,
  } = useEval();

  // Published papers where this student has a sheet
  const eligiblePapers = state.papers.filter(
    (p) =>
      p.status === 'published' &&
      state.sheets.some((s) => s.paperId === p.id && s.studentId === currentUser?.id)
  );

  const [paperId, setPaperId] = useState(eligiblePapers[0]?.id || '');
  const [reasonCategory, setReasonCategory] = useState(REASON_OPTIONS[0]);
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  if (!currentUser) return null;

  const effectivePaperId = eligiblePapers.some((p) => p.id === paperId)
    ? paperId
    : eligiblePapers[0]?.id || '';

  const myRequests = state.requests.filter((r) => r.studentId === currentUser.id);
  const selectedPaper = state.papers.find((p) => p.id === effectivePaperId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectivePaperId) {
      setFeedback({ type: 'err', text: 'Select a published paper first.' });
      return;
    }
    if (!confirmed) {
      setFeedback({ type: 'err', text: 'Please confirm the viewing terms checkbox before submitting.' });
      return;
    }
    const res = submitStudentRequest(effectivePaperId, reasonCategory, note.trim());
    if (res.ok) {
      setFeedback({
        type: 'ok',
        text: 'Request submitted. Estimated Examination Cell reply time: 2 working days.',
      });
      setNote('');
      setConfirmed(false);
    } else {
      setFeedback({ type: 'err', text: res.error || 'Could not submit request.' });
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0b1c30]">Evaluated Answer Sheet Requests</h1>
        <p className="text-xs text-[#64748b] mt-0.5">
          Request access to view your evaluated script for published papers, or open released sheets.
        </p>
      </div>

      {/* Request Form (S4) */}
      <form onSubmit={handleSubmit} className="bg-white border border-[#e2e8f0] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-[#0b1c30]">Request Evaluated Sheet (S4)</h2>
          <span className="text-[11px] text-[#64748b]">
            Estimated reply time: ~2 working days · 1 open request per paper
          </span>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded border text-xs flex items-center gap-2 ${
              feedback.type === 'ok'
                ? 'bg-[#e8f5e9] border-[#88d982] text-[#196b22]'
                : 'bg-[#ffdad6] border-[#ba1a1a] text-[#93000a]'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-[#0b1c30] mb-1">Published Paper</label>
            <select
              value={effectivePaperId}
              onChange={(e) => setPaperId(e.target.value)}
              className="w-full rounded border border-[#c1c6d4] px-3 py-2 bg-white"
            >
              {eligiblePapers.length === 0 && <option value="">No published papers eligible</option>}
              {eligiblePapers.map((p) => {
                const subj = state.subjects.find((s) => s.id === p.subjectId);
                return (
                  <option key={p.id} value={p.id}>
                    {subj?.code} — {subj?.name}
                  </option>
                );
              })}
            </select>
            {selectedPaper && (
              <div className="text-[11px] text-[#64748b] mt-1">
                Request window closes: {selectedPaper.requestWindowEnd}
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-[#0b1c30] mb-1">Reason</label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full rounded border border-[#c1c6d4] px-3 py-2 bg-white"
            >
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs">
          <label className="block font-semibold text-[#0b1c30] mb-1">Optional Note</label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Specify any question number or feedback you would like to review..."
            className="w-full rounded border border-[#c1c6d4] p-2.5"
          />
        </div>

        <label className="flex items-start gap-2 text-xs text-[#414752]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I understand that released evaluated sheets are watermarked with my identity and available only until the expiry date set by the Examination Cell.
          </span>
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={eligiblePapers.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#005dac] hover:bg-[#004786] disabled:opacity-40 text-white text-xs font-semibold"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit Request</span>
          </button>
        </div>
      </form>

      {/* My Requests Table (S5) */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e2e8f0] text-sm font-semibold text-[#0b1c30]">
          My Requests Tracker (S5)
        </div>
        {myRequests.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#64748b]">No sheet requests submitted yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#e2e8f0] text-[#64748b] uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Paper</th>
                  <th className="py-2.5 px-4">Status Tracker</th>
                  <th className="py-2.5 px-4">Timestamps / Expiry</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {myRequests.map((req) => {
                  const p = state.papers.find((x) => x.id === req.paperId);
                  const subj = state.subjects.find((s) => s.id === p?.subjectId);
                  return (
                    <tr key={req.id}>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#0b1c30]">{subj?.code} — {subj?.name}</div>
                        <div className="text-[11px] text-[#64748b]">{req.reasonCategory}</div>
                        {req.rejectionReason && (
                          <div className="text-[11px] text-[#ba1a1a] mt-0.5">
                            Reason: {req.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <RequestStatusBadge status={req.status} />
                      </td>
                      <td className="py-3 px-4 text-[#64748b] tabular-nums">
                        <div>Requested: {new Date(req.createdAt).toLocaleDateString()}</div>
                        {req.expiryDate && (
                          <div className="text-[#196b22] font-medium">Viewable until {req.expiryDate}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {req.status === 'requested' && (
                          <button
                            type="button"
                            onClick={() => cancelStudentRequest(req.id)}
                            className="px-3 py-1.5 rounded border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6]/40 font-semibold"
                          >
                            Cancel
                          </button>
                        )}
                        {req.status === 'released' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSheetId(req.sheetId);
                              setActiveView('student_sheet_viewer');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#005dac] text-white font-semibold"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Evaluated Sheet</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
