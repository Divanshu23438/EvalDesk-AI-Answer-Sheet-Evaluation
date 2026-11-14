import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, UserCheck } from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import { SheetStatusBadge } from '../ui/StatusBadge';

export function AdminAssignments() {
  const { state, assignSheets } = useEval();
  const [paperId, setPaperId] = useState(state.papers[0]?.id || '');
  const [teacherId, setTeacherId] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
  const [splitMode, setSplitMode] = useState<'all' | 'count' | 'range'>('all');
  const [splitCount, setSplitCount] = useState(2);
  const [rollPrefix, setRollPrefix] = useState('2026CS101-2026CS199');
  const [overrideWarningConfirmed, setOverrideWarningConfirmed] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const teachers = state.users.filter((u) => u.role === 'teacher' && u.status === 'active');
  const effectivePaperId = state.papers.some((p) => p.id === paperId) ? paperId : state.papers[0]?.id || '';
  const effectiveTeacherId = teachers.some((t) => t.id === teacherId) ? teacherId : teachers[0]?.id || '';

  const activePaper = state.papers.find((p) => p.id === effectivePaperId);
  const selectedTeacher = teachers.find((t) => t.id === effectiveTeacherId);
  const paperSheets = state.sheets.filter((s) => s.paperId === effectivePaperId);

  const subjectMismatch = Boolean(
    activePaper &&
      selectedTeacher &&
      !(selectedTeacher.subjects || []).includes(activePaper.subjectId)
  );

  const workload = useMemo(() => {
    return teachers.map((t) => {
      const assigned = state.sheets.filter((s) => s.assignedTeacherId === t.id);
      const done = assigned.filter((s) => s.status === 'evaluated' || s.status === 'published').length;
      return {
        teacher: t,
        assigned: assigned.length,
        done,
        pending: assigned.length - done,
      };
    });
  }, [teachers, state.sheets]);

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectivePaperId || !effectiveTeacherId) {
      setFeedbackMsg('Select both a valid paper and an active teacher.');
      return;
    }
    if (subjectMismatch && !overrideWarningConfirmed) {
      return;
    }

    let targetSheetIds: string[] = [];
    if (splitMode === 'all') {
      targetSheetIds = paperSheets.map((s) => s.id);
    } else if (splitMode === 'count') {
      targetSheetIds = paperSheets.slice(0, Math.max(1, splitCount)).map((s) => s.id);
    } else {
      const [startRoll, endRoll] = rollPrefix.split('-').map((x) => x.trim().toUpperCase());
      targetSheetIds = paperSheets
        .filter((s) => {
          const st = state.users.find((u) => u.id === s.studentId);
          const r = (st?.rollNumber || '').toUpperCase();
          return (!startRoll || r >= startRoll) && (!endRoll || r <= endRoll);
        })
        .map((s) => s.id);
    }

    if (targetSheetIds.length === 0) {
      setFeedbackMsg('No uploaded sheets matched the selected split criteria.');
      return;
    }

    assignSheets(effectivePaperId, effectiveTeacherId, targetSheetIds, dueDate);
    setFeedbackMsg(`Assigned ${targetSheetIds.length} sheet(s) to ${selectedTeacher?.name} (Due ${dueDate}).`);
    setOverrideWarningConfirmed(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0b1c30]">Teacher Assignments & Workload</h1>
        <p className="text-xs text-[#64748b] mt-0.5">
          Assign papers or split sheets across teachers by roll range or count, with subject-match safeguards.
        </p>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded border border-[#88d982] bg-[#e8f5e9] text-xs text-[#196b22] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Assignment Builder */}
        <form onSubmit={handleAssign} className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0b1c30]">
            <UserCheck className="w-4 h-4 text-[#005dac]" />
            <span>Assign / Reassign Sheets</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-[#414752] mb-1">Paper</label>
              <select
                value={effectivePaperId}
                onChange={(e) => {
                  setPaperId(e.target.value);
                  setOverrideWarningConfirmed(false);
                }}
                className="w-full rounded border border-[#c1c6d4] px-2.5 py-2 bg-white"
              >
                {state.papers.length === 0 && <option value="">No papers created yet</option>}
                {state.papers.map((p) => {
                  const subj = state.subjects.find((s) => s.id === p.subjectId);
                  return (
                    <option key={p.id} value={p.id}>
                      {subj?.code} — {subj?.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#414752] mb-1">Teacher</label>
              <select
                value={effectiveTeacherId}
                onChange={(e) => {
                  setTeacherId(e.target.value);
                  setOverrideWarningConfirmed(false);
                }}
                className="w-full rounded border border-[#c1c6d4] px-2.5 py-2 bg-white"
              >
                {teachers.length === 0 && <option value="">No active teachers created yet</option>}
                {teachers.map((t) => {
                  const codes = (t.subjects || [])
                    .map((sid) => state.subjects.find((s) => s.id === sid)?.code)
                    .join(', ');
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} ({codes || 'No subjects'})
                    </option>
                  );
                })}
              </select>
            </div>

            {subjectMismatch && (
              <div className="p-3 rounded border border-[#ffb865] bg-[#fff8e1] text-xs text-[#875200] space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Rule warning: {selectedTeacher?.name} is not mapped to this paper's subject. Admin override is required.
                  </span>
                </div>
                <label className="inline-flex items-center gap-1.5 font-semibold">
                  <input
                    type="checkbox"
                    checked={overrideWarningConfirmed}
                    onChange={(e) => setOverrideWarningConfirmed(e.target.checked)}
                  />
                  <span>Override subject restriction for this assignment</span>
                </label>
              </div>
            )}

            <div>
              <label className="block font-semibold text-[#414752] mb-1">Sheet Selection / Split</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['all', 'count', 'range'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSplitMode(m)}
                    className={`py-1.5 rounded border text-xs font-medium ${
                      splitMode === m
                        ? 'bg-[#eff4ff] border-[#005dac] text-[#005dac]'
                        : 'bg-white border-[#c1c6d4] text-[#414752]'
                    }`}
                  >
                    {m === 'all' ? 'All Sheets' : m === 'count' ? 'By Count' : 'Roll Range'}
                  </button>
                ))}
              </div>
            </div>

            {splitMode === 'count' && (
              <div>
                <label className="block font-semibold text-[#414752] mb-1">First N Sheets</label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, paperSheets.length)}
                  value={splitCount}
                  onChange={(e) => setSplitCount(Number(e.target.value))}
                  className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 tabular-nums"
                />
              </div>
            )}

            {splitMode === 'range' && (
              <div>
                <label className="block font-semibold text-[#414752] mb-1">Roll Range (start-end)</label>
                <input
                  type="text"
                  value={rollPrefix}
                  onChange={(e) => setRollPrefix(e.target.value)}
                  className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 font-mono"
                />
              </div>
            )}

            <div>
              <label className="block font-semibold text-[#414752] mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!effectivePaperId || !effectiveTeacherId || (subjectMismatch && !overrideWarningConfirmed)}
            className="w-full py-2 rounded bg-[#005dac] hover:bg-[#004786] disabled:opacity-40 text-white text-xs font-semibold"
          >
            Assign Sheets
          </button>
        </form>

        {/* Right: Workload View & Paper Sheet Map */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] text-sm font-semibold text-[#0b1c30]">
              Teacher Workload Overview
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#e2e8f0] text-[#64748b] uppercase text-[11px]">
                <tr>
                  <th className="py-2 px-4">Teacher</th>
                  <th className="py-2 px-4 text-right">Assigned</th>
                  <th className="py-2 px-4 text-right">Done</th>
                  <th className="py-2 px-4 text-right">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {workload.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#64748b]">
                      No active teachers found. Add teachers under Users Directory first.
                    </td>
                  </tr>
                ) : (
                  workload.map((w) => (
                    <tr key={w.teacher.id}>
                      <td className="py-2.5 px-4 font-semibold text-[#0b1c30]">{w.teacher.name}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{w.assigned}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#196b22]">{w.done}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#875200]">{w.pending}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] text-sm font-semibold text-[#0b1c30]">
              Sheets in Selected Paper ({paperSheets.length})
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#e2e8f0] text-[#64748b] uppercase text-[11px]">
                <tr>
                  <th className="py-2 px-4">Student Roll</th>
                  <th className="py-2 px-4">Assigned Teacher</th>
                  <th className="py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {paperSheets.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-[#64748b]">
                      No sheets uploaded for this paper yet.
                    </td>
                  </tr>
                ) : (
                  paperSheets.map((s) => {
                    const st = state.users.find((u) => u.id === s.studentId);
                    const teach = state.users.find((u) => u.id === s.assignedTeacherId);
                    return (
                      <tr key={s.id}>
                        <td className="py-2 px-4 font-mono">{st?.rollNumber}</td>
                        <td className="py-2 px-4 text-[#414752]">{teach?.name || 'Unassigned'}</td>
                        <td className="py-2 px-4">
                          <SheetStatusBadge status={s.status} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
