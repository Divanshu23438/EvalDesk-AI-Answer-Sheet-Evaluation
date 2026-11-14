import { useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, KeyRound, RefreshCw } from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import { computeSheetTotals } from '../../utils/gradingEngine';

export function TeacherReevalTasks() {
  const { state, currentUser, submitReevaluationDecision } = useEval();
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [newMarksMap, setNewMarksMap] = useState<Record<string, number>>({});
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!currentUser) return null;

  const tasks = state.requests.filter(
    (r) => r.forwardedToTeacherId === currentUser.id && r.status === 'under_review'
  );
  const activeReq = tasks.find((t) => t.id === selectedReqId) ?? tasks[0] ?? null;
  const activeSheet = activeReq ? state.sheets.find((s) => s.id === activeReq.sheetId) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReq || !activeSheet) return;

    const updates: { questionId: string; newMarks: number; reason: string }[] = [];
    for (const a of activeSheet.answers) {
      const updated = newMarksMap[a.questionId];
      if (typeof updated === 'number' && updated !== a.finalMarks) {
        const reason = (reasonMap[a.questionId] || '').trim();
        if (!reason) {
          setError(`A reason is required for changing marks on ${a.questionId}.`);
          return;
        }
        updates.push({ questionId: a.questionId, newMarks: updated, reason });
      }
    }

    if (updates.length === 0) {
      updates.push({
        questionId: activeSheet.answers[0]?.questionId || 'q1',
        newMarks: activeSheet.answers[0]?.finalMarks || 0,
        reason: 'Reviewed; original marks confirmed without change.',
      });
    }

    submitReevaluationDecision(activeReq.id, activeSheet.id, updates);
    setError('');
    setSuccessMsg('Re-evaluation comparison saved and sent back to Admin.');
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#0b1c30]">Re-evaluation Tasks</h1>
        <p className="text-xs text-[#64748b] mt-0.5">
          Sheets forwarded by Admin following a student request. Any mark change requires a written reason.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 rounded bg-[#e8f5e9] border border-[#88d982] text-xs text-[#196b22] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-8 text-center text-xs text-[#64748b]">
          No re-evaluation tasks are currently forwarded to you.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 bg-white border border-[#e2e8f0] rounded-lg divide-y divide-[#e2e8f0]">
            {tasks.map((t) => {
              const student = state.users.find((u) => u.id === t.studentId);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedReqId(t.id)}
                  className={`w-full text-left p-4 text-xs ${
                    activeReq?.id === t.id ? 'bg-[#eff4ff]' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-[#0b1c30]">
                    {student?.name} ({student?.rollNumber})
                  </div>
                  <div className="text-[#64748b] mt-0.5">{t.reasonCategory}</div>
                  {t.reevalCompleted && (
                    <span className="inline-block mt-1 text-[#196b22] font-semibold">Completed</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-lg p-5">
            {activeReq && activeSheet && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 rounded bg-[#f8f9ff] border border-[#e2e8f0] text-xs">
                  <div className="font-semibold text-[#0b1c30]">Student Reason: {activeReq.reasonCategory}</div>
                  <div className="text-[#414752] mt-1">"{activeReq.note}"</div>
                </div>

                {error && <div className="p-2.5 rounded bg-[#ffdad6] text-xs text-[#93000a]">{error}</div>}

                <div className="space-y-3">
                  {activeSheet.answers.map((a) => {
                    const q = state.questions.find((x) => x.id === a.questionId);
                    const draftMark = newMarksMap[a.questionId] ?? a.finalMarks;
                    return (
                      <div key={a.questionId} className="p-3.5 rounded border border-[#e2e8f0] text-xs space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[#0b1c30]">
                            {q?.label}: {q?.text}
                          </span>
                          <span className="font-mono text-[#64748b] shrink-0">Max {q?.marks}m</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                          <div>
                            <span className="text-[#64748b]">Old Marks: </span>
                            <strong className="font-mono">{a.finalMarks}</strong>
                          </div>
                          <div>
                            <label className="text-[#414752] mr-2">New Marks:</label>
                            <input
                              type="number"
                              step="0.5"
                              min={0}
                              max={q?.marks || 10}
                              value={draftMark}
                              onChange={(e) =>
                                setNewMarksMap((m) => ({ ...m, [a.questionId]: Number(e.target.value) }))
                              }
                              className="w-20 rounded border border-[#c1c6d4] px-2 py-1 font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={reasonMap[a.questionId] || ''}
                              onChange={(e) =>
                                setReasonMap((r) => ({ ...r, [a.questionId]: e.target.value }))
                              }
                              placeholder="Reason if marks changed *"
                              className="w-full rounded border border-[#c1c6d4] px-2.5 py-1"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#005dac] text-white text-xs font-semibold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Save Re-evaluation Comparison</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TeacherReports() {
  const { state, currentUser } = useEval();
  if (!currentUser) return null;

  const mySheets = state.sheets.filter((s) => s.assignedTeacherId === currentUser.id);
  const myPaperIds = Array.from(new Set(mySheets.map((s) => s.paperId)));

  const stats = useMemo(() => {
    return myPaperIds.map((pid) => {
      const paper = state.papers.find((p) => p.id === pid);
      const subj = state.subjects.find((s) => s.id === paper?.subjectId);
      const sheets = mySheets.filter((s) => s.paperId === pid);
      const avgTime =
        sheets.length > 0
          ? Math.round(sheets.reduce((sum, s) => sum + s.timeSpentSeconds, 0) / sheets.length)
          : 0;
      const totalAns = sheets.reduce((sum, s) => sum + s.answers.length, 0);
      const overrides = sheets.reduce(
        (sum, s) => sum + s.answers.filter((a) => a.teacherOverride).length,
        0
      );
      const flagCounts: Record<string, number> = {};
      for (const s of sheets) {
        for (const a of s.answers) {
          if (a.reviewReasons.length > 0) {
            const q = state.questions.find((x) => x.id === a.questionId);
            const lbl = q?.label || a.questionId;
            flagCounts[lbl] = (flagCounts[lbl] || 0) + 1;
          }
        }
      }
      const distribution = sheets.map((s) => computeSheetTotals(s).finalTotal);
      return {
        pid,
        title: `${subj?.code} — ${subj?.name}`,
        totalMarks: paper?.totalMarks || 15,
        sheetCount: sheets.length,
        avgTime,
        overridePct: totalAns > 0 ? Math.round((overrides / totalAns) * 100) : 0,
        flagCounts,
        distribution,
      };
    });
  }, [myPaperIds, mySheets, state.papers, state.subjects, state.questions]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#0b1c30]">My Evaluation Reports</h1>
        <p className="text-xs text-[#64748b] mt-0.5">
          Per-paper marks distribution, average review time, override frequency, and high-flag questions.
        </p>
      </div>

      {stats.map((st) => (
        <div key={st.pid} className="bg-white border border-[#e2e8f0] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#005dac]" />
              <h2 className="text-sm font-semibold text-[#0b1c30]">{st.title}</h2>
            </div>
            <span className="text-xs text-[#64748b] tabular-nums">{st.sheetCount} sheets</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded bg-[#f8f9ff] border border-[#e2e8f0]">
              <div className="text-[#64748b]">Average Time / Sheet</div>
              <div className="text-lg font-semibold text-[#0b1c30] tabular-nums mt-0.5">{st.avgTime}s</div>
            </div>
            <div className="p-3 rounded bg-[#f8f9ff] border border-[#e2e8f0]">
              <div className="text-[#64748b]">Suggested Marks Override Rate</div>
              <div className="text-lg font-semibold text-[#875200] tabular-nums mt-0.5">{st.overridePct}%</div>
            </div>
            <div className="p-3 rounded bg-[#f8f9ff] border border-[#e2e8f0]">
              <div className="text-[#64748b]">Questions with Most Flags</div>
              <div className="text-sm font-semibold text-[#0b1c30] mt-1 font-mono">
                {Object.entries(st.flagCounts).length > 0
                  ? Object.entries(st.flagCounts)
                      .map(([k, v]) => `${k} (${v})`)
                      .join(', ')
                  : 'None'}
              </div>
            </div>
          </div>

          {/* Simple clean bar chart of sheet scores */}
          <div>
            <div className="text-xs font-semibold text-[#414752] mb-2">Marks Distribution (out of {st.totalMarks})</div>
            <div className="space-y-1.5">
              {st.distribution.map((score, i) => {
                const pct = Math.min(100, Math.round((score / st.totalMarks) * 100));
                return (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="w-16 font-mono text-[#64748b]">Sheet {i + 1}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                      <div className="h-full bg-[#005dac]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-14 text-right font-mono font-semibold tabular-nums">
                      {score}/{st.totalMarks}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TeacherPreferencesView() {
  const { state, currentUser, updateTeacherPreferences, changeOwnPassword } = useEval();
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');

  if (!currentUser) return null;
  const prefs = state.teacherPreferences[currentUser.id] ?? {
    defaultZoomPct: 100,
    enableKeyboardShortcuts: true,
    notifyOnAssignment: true,
    notifyOnReopen: true,
    notifyOnReeval: true,
  };

  const handlePwd = (e: React.FormEvent) => {
    e.preventDefault();
    const res = changeOwnPassword(curPwd, newPwd);
    if (res.ok) {
      setPwdMsg('Password updated.');
      setCurPwd('');
      setNewPwd('');
    } else {
      setPwdMsg(res.error || 'Failed to update password.');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0b1c30]">Profile & Workspace Preferences</h1>
        <p className="text-xs text-[#64748b] mt-0.5">
          Configure keyboard shortcuts, default sheet zoom, notifications, and password.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 space-y-4 text-xs">
          <h2 className="text-sm font-semibold text-[#0b1c30]">Workspace Settings</h2>
          <div>
            <label className="block font-semibold text-[#414752] mb-1">Default Sheet Zoom (%)</label>
            <select
              value={prefs.defaultZoomPct}
              onChange={(e) => updateTeacherPreferences({ defaultZoomPct: Number(e.target.value) })}
              className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 bg-white"
            >
              <option value={80}>80%</option>
              <option value={100}>100% (Fit width)</option>
              <option value={125}>125%</option>
              <option value={150}>150%</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-[#0b1c30]">
            <input
              type="checkbox"
              checked={prefs.enableKeyboardShortcuts}
              onChange={(e) => updateTeacherPreferences({ enableKeyboardShortcuts: e.target.checked })}
            />
            <span>Enable workspace keyboard shortcuts (J/K, A, F, +/-, R)</span>
          </label>

          <label className="flex items-center gap-2 text-[#0b1c30]">
            <input
              type="checkbox"
              checked={prefs.notifyOnAssignment}
              onChange={(e) => updateTeacherPreferences({ notifyOnAssignment: e.target.checked })}
            />
            <span>Notify on new paper assignments</span>
          </label>

          <label className="flex items-center gap-2 text-[#0b1c30]">
            <input
              type="checkbox"
              checked={prefs.notifyOnReopen}
              onChange={(e) => updateTeacherPreferences({ notifyOnReopen: e.target.checked })}
            />
            <span>Notify when Admin re-opens a sheet</span>
          </label>

          <div className="pt-3 border-t border-[#e2e8f0]">
            <div className="font-semibold text-[#0b1c30] mb-1.5">Keyboard Shortcut Reference</div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-[#414752] font-mono">
              <span>J / K : Next / Prev question</span>
              <span>A : Accept suggested marks</span>
              <span>F : Toggle flag resolved</span>
              <span>+ / - : Zoom scan</span>
              <span>R : Toggle reference panel</span>
            </div>
          </div>
        </div>

        <form onSubmit={handlePwd} className="bg-white border border-[#e2e8f0] rounded-lg p-5 space-y-3.5 text-xs">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#005dac]" />
            <h2 className="text-sm font-semibold text-[#0b1c30]">Change Password</h2>
          </div>
          <div>
            <label className="block font-semibold text-[#414752] mb-1">Current Password</label>
            <input
              type="password"
              value={curPwd}
              onChange={(e) => setCurPwd(e.target.value)}
              className="w-full rounded border border-[#c1c6d4] px-3 py-1.5"
            />
          </div>
          <div>
            <label className="block font-semibold text-[#414752] mb-1">New Password</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="w-full rounded border border-[#c1c6d4] px-3 py-1.5"
            />
          </div>
          {pwdMsg && <div className="text-[#005dac] font-medium">{pwdMsg}</div>}
          <button type="submit" className="px-4 py-2 rounded bg-[#005dac] text-white font-semibold">
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}
