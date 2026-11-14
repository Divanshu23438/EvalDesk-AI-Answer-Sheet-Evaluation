import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FlaskConical,
  History,
  Lock,
  Plus,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import type { PaperMode, Question, QuestionType } from '../../types/eval';
import { evaluateAnswerAgainstRubric, validateRubricTotal } from '../../utils/gradingEngine';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ConfidenceBadge, ModeTag, PaperStatusBadge, VerdictBadge } from '../ui/StatusBadge';

export function AdminExamsPapers() {
  const {
    state,
    selectedPaperId,
    setSelectedPaperId,
    setActiveView,
    addExam,
    addPaper,
    updatePaper,
    saveQuestion,
    addQuestion,
    deleteQuestion,
    toggleRubricLock,
  } = useEval();

  const activePaper =
    state.papers.find((p) => p.id === selectedPaperId) ?? state.papers[0] ?? null;

  const paperQuestions = useMemo(
    () =>
      activePaper
        ? state.questions
            .filter((q) => q.paperId === activePaper.id)
            .sort((a, b) => a.number - b.number)
        : [],
    [state.questions, activePaper]
  );

  const [subTab, setSubTab] = useState<'settings' | 'rubric'>('rubric');
  const [showNewExam, setShowNewExam] = useState(false);
  const [examName, setExamName] = useState('');
  const [examStart, setExamStart] = useState('2026-12-01');
  const [examEnd, setExamEnd] = useState('2026-12-12');

  const [showNewPaper, setShowNewPaper] = useState(false);
  const [newExamId, setNewExamId] = useState('');
  const [newSubjId, setNewSubjId] = useState('');
  const [newClassId, setNewClassId] = useState('');
  const [newTotal, setNewTotal] = useState(20);
  const [newPass, setNewPass] = useState(8);
  const [newMode, setNewMode] = useState<PaperMode>('lenient');
  const [newAnon, setNewAnon] = useState(true);
  const [newSpot, setNewSpot] = useState(25);
  const [paperFormError, setPaperFormError] = useState('');

  const resolvedExamId = state.exams.some((e) => e.id === newExamId)
    ? newExamId
    : state.exams[0]?.id || '';
  const resolvedSubjId = state.subjects.some((s) => s.id === newSubjId)
    ? newSubjId
    : state.subjects[0]?.id || '';
  const resolvedClassId = state.classes.some((c) => c.id === newClassId)
    ? newClassId
    : state.classes[0]?.id || '';

  const [selectedQId, setSelectedQId] = useState<string | null>(null);
  const activeQ =
    paperQuestions.find((q) => q.id === selectedQId) ?? paperQuestions[0] ?? null;

  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Test grading panel state (A5)
  const [testSampleText, setTestSampleText] = useState('');
  const [testOutput, setTestOutput] = useState<ReturnType<typeof evaluateAnswerAgainstRubric> | null>(null);

  const rubricSumCheck = useMemo(
    () =>
      activePaper
        ? validateRubricTotal(paperQuestions, activePaper.totalMarks)
        : { valid: true, sum: 0, diff: 0 },
    [paperQuestions, activePaper]
  );

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName.trim()) return;
    addExam({ name: examName.trim(), startDate: examStart, endDate: examEnd, status: 'upcoming' });
    setExamName('');
    setShowNewExam(false);
  };

  const handleCreatePaper = (e: React.FormEvent) => {
    e.preventDefault();
    setPaperFormError('');
    if (!resolvedExamId || !resolvedSubjId || !resolvedClassId) {
      setPaperFormError('Create at least one Exam, Subject, and Class before creating a Paper.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const reqEnd = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const id = addPaper({
      examId: resolvedExamId,
      subjectId: resolvedSubjId,
      classId: resolvedClassId,
      date: today,
      totalMarks: newTotal,
      passingMarks: newPass,
      mode: newMode,
      anonymousEvaluation: newAnon,
      spotCheckPct: newSpot,
      status: 'draft',
      dueDate: due,
      rubricLocked: false,
      sourceKeyText: 'Paste or type official model answer key here.',
      questionPaperNotes: 'Standard examination instructions.',
      requestWindowEnd: reqEnd,
    });
    setSelectedPaperId(id);
    setSelectedQId(null);
    setShowNewPaper(false);
  };

  const handleUpdateKeyPoint = (q: Question, kpId: string, field: 'text' | 'marks' | 'alt', value: string) => {
    const updated: Question = {
      ...q,
      keyPoints: q.keyPoints.map((kp) => {
        if (kp.id !== kpId) return kp;
        if (field === 'marks') return { ...kp, marks: Number(value) || 0 };
        if (field === 'alt')
          return {
            ...kp,
            alternativeWordings: value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          };
        return { ...kp, text: value };
      }),
    };
    saveQuestion(updated);
  };

  const handleDeleteKeyPoint = (q: Question, kpId: string) => {
    if (q.keyPoints.length <= 1) return;
    saveQuestion({
      ...q,
      keyPoints: q.keyPoints.filter((kp) => kp.id !== kpId),
    });
  };

  const handleRunTestGrade = () => {
    if (!activeQ || !activePaper || !testSampleText.trim()) return;
    const res = evaluateAnswerAgainstRubric({
      ocrText: testSampleText,
      question: activeQ,
      paperMode: activePaper.mode,
      settings: state.settings,
    });
    setTestOutput(res);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0b1c30]">Exams, Papers & Answer Key Rubrics</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Configure exam windows, paper mode, anonymity, spot-check percentage, structured key-point rubrics, and test grading.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewExam((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#c1c6d4] bg-white hover:bg-slate-50 text-xs font-semibold text-[#0b1c30] whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Exam</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPaperFormError('');
              setShowNewPaper((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Paper</span>
          </button>
        </div>
      </div>

      {/* Inline New Exam form */}
      {showNewExam && (
        <form onSubmit={handleCreateExam} className="bg-white border border-[#e2e8f0] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Exam Name</label>
            <input
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              placeholder="End-Semester Examination — December 2026"
              className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Start Date</label>
            <input
              type="date"
              value={examStart}
              onChange={(e) => setExamStart(e.target.value)}
              className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0b1c30] mb-1">End Date</label>
            <input
              type="date"
              value={examEnd}
              onChange={(e) => setExamEnd(e.target.value)}
              className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3.5 py-1.5 rounded bg-[#005dac] text-white text-xs font-semibold">
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowNewExam(false)}
              className="px-3 py-1.5 rounded border border-[#c1c6d4] text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Inline New Paper form */}
      {showNewPaper && (
        <form onSubmit={handleCreatePaper} className="bg-white border border-[#e2e8f0] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[#0b1c30]">New Subject Paper</div>
            {(!resolvedExamId || !resolvedSubjId || !resolvedClassId) && (
              <div className="text-[11px] text-[#875200]">
                Missing prerequisite:{' '}
                {!resolvedExamId && 'create an Exam above · '}
                {(!resolvedSubjId || !resolvedClassId) && (
                  <button
                    type="button"
                    onClick={() => setActiveView('admin_subjects')}
                    className="text-[#005dac] font-semibold underline"
                  >
                    add Subject & Class first
                  </button>
                )}
              </div>
            )}
          </div>
          {paperFormError && (
            <div className="p-2.5 rounded bg-[#ffdad6] text-xs text-[#93000a]">{paperFormError}</div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-[#414752] mb-1">Exam</label>
              <select
                value={resolvedExamId}
                onChange={(e) => setNewExamId(e.target.value)}
                className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 text-xs bg-white"
              >
                {state.exams.length === 0 && <option value="">No exams</option>}
                {state.exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-[#414752] mb-1">Subject</label>
              <select
                value={resolvedSubjId}
                onChange={(e) => setNewSubjId(e.target.value)}
                className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 text-xs bg-white"
              >
                {state.subjects.length === 0 && <option value="">No subjects</option>}
                {state.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#414752] mb-1">Class</label>
              <select
                value={resolvedClassId}
                onChange={(e) => setNewClassId(e.target.value)}
                className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 text-xs bg-white"
              >
                {state.classes.length === 0 && <option value="">No classes</option>}
                {state.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#414752] mb-1">Paper Mode</label>
              <select
                value={newMode}
                onChange={(e) => setNewMode(e.target.value as PaperMode)}
                className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 text-xs bg-white"
              >
                <option value="lenient">Lenient</option>
                <option value="strict">Strict</option>
                <option value="maths">Maths</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#414752] mb-1">Total / Pass / Spot%</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  title="Total Marks"
                  value={newTotal}
                  onChange={(e) => setNewTotal(Number(e.target.value))}
                  className="w-1/3 rounded border border-[#c1c6d4] px-1.5 py-1.5 text-xs tabular-nums"
                />
                <input
                  type="number"
                  title="Passing Marks"
                  value={newPass}
                  onChange={(e) => setNewPass(Number(e.target.value))}
                  className="w-1/3 rounded border border-[#c1c6d4] px-1.5 py-1.5 text-xs tabular-nums"
                />
                <input
                  type="number"
                  title="Spot-check %"
                  min={0}
                  max={100}
                  value={newSpot}
                  onChange={(e) => setNewSpot(Number(e.target.value))}
                  className="w-1/3 rounded border border-[#c1c6d4] px-1.5 py-1.5 text-xs tabular-nums"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-[#0b1c30]">
              <input
                type="checkbox"
                checked={newAnon}
                onChange={(e) => setNewAnon(e.target.checked)}
              />
              <span>Anonymous evaluation (teachers see roll codes only)</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewPaper(false)}
                className="px-3 py-1.5 rounded border border-[#c1c6d4] text-xs font-semibold"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded bg-[#005dac] text-white text-xs font-semibold">
                Save Paper
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Paper Selector Strip */}
      {state.papers.length === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-8 text-center space-y-2">
          <div className="text-sm font-semibold text-[#0b1c30]">No examination papers configured yet</div>
          <p className="text-xs text-[#64748b]">
            {state.exams.length === 0
              ? 'Click "New Exam" above to create an exam cycle, then click "Add Paper" to define your questions and answer key rubric.'
              : 'Click "Add Paper" above to create your first subject paper and answer key rubric.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {state.papers.map((p) => {
            const subj = state.subjects.find((s) => s.id === p.subjectId);
            const selected = activePaper?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedPaperId(p.id);
                  setSelectedQId(null);
                  setTestOutput(null);
                }}
                className={`px-3.5 py-2 rounded-lg border text-left transition-colors ${
                  selected
                    ? 'bg-[#eff4ff] border-[#005dac] text-[#0b1c30]'
                    : 'bg-white border-[#e2e8f0] text-[#414752] hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{subj?.code}</span>
                  <ModeTag mode={p.mode} />
                  <PaperStatusBadge status={p.status} />
                </div>
                <div className="text-[11px] text-[#64748b] mt-0.5">{subj?.name}</div>
              </button>
            );
          })}
        </div>
      )}

      {activePaper && (
        <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
          {/* Paper Header & Mode Switch */}
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSubTab('rubric')}
                className={`px-3 py-1.5 rounded text-xs font-semibold ${
                  subTab === 'rubric' ? 'bg-[#005dac] text-white' : 'bg-white border border-[#c1c6d4] text-[#414752]'
                }`}
              >
                Answer Key & Rubric (A5)
              </button>
              <button
                type="button"
                onClick={() => setSubTab('settings')}
                className={`px-3 py-1.5 rounded text-xs font-semibold ${
                  subTab === 'settings' ? 'bg-[#005dac] text-white' : 'bg-white border border-[#c1c6d4] text-[#414752]'
                }`}
              >
                Paper Settings & Question Paper (A4)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748b] tabular-nums">
                Rubric v{activePaper.rubricVersion}
              </span>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#c1c6d4] bg-white text-xs font-medium text-[#0b1c30]"
              >
                <History className="w-3.5 h-3.5" />
                <span>History</span>
              </button>
              <button
                type="button"
                onClick={() => setLockConfirmOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold ${
                  activePaper.rubricLocked
                    ? 'bg-[#fff8e1] border border-[#ffb865] text-[#875200]'
                    : 'bg-[#196b22] text-white'
                }`}
              >
                {activePaper.rubricLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{activePaper.rubricLocked ? 'Locked (Unlock)' : 'Lock Key'}</span>
              </button>
            </div>
          </div>

          {showHistory && (
            <div className="px-4 py-3 bg-[#eff4ff] border-b border-[#e2e8f0] text-xs space-y-1.5">
              <div className="font-semibold text-[#0b1c30]">Rubric Version History</div>
              {activePaper.rubricHistory.map((h) => (
                <div key={h.version} className="flex items-center justify-between text-[#414752]">
                  <span>
                    <strong className="font-mono">v{h.version}</strong> · {h.reason}
                  </span>
                  <span className="text-[11px] text-[#64748b]">
                    {h.updatedBy} · {new Date(h.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {subTab === 'settings' ? (
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-[#0b1c30]">Paper Configuration</h2>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-[#414752] mb-1">Grading Mode</label>
                    <select
                      value={activePaper.mode}
                      onChange={(e) =>
                        updatePaper(activePaper.id, { mode: e.target.value as PaperMode }, `Changed mode to ${e.target.value}`)
                      }
                      className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 bg-white"
                    >
                      <option value="lenient">Lenient (Science / Tech)</option>
                      <option value="strict">Strict (Language)</option>
                      <option value="maths">Maths (Step Marks)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#414752] mb-1">Spot-Check %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={activePaper.spotCheckPct}
                      onChange={(e) =>
                        updatePaper(activePaper.id, { spotCheckPct: Number(e.target.value) }, 'Updated spot-check %')
                      }
                      className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#414752] mb-1">Total Marks</label>
                    <input
                      type="number"
                      value={activePaper.totalMarks}
                      onChange={(e) => updatePaper(activePaper.id, { totalMarks: Number(e.target.value) })}
                      className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#414752] mb-1">Passing Marks</label>
                    <input
                      type="number"
                      value={activePaper.passingMarks}
                      onChange={(e) => updatePaper(activePaper.id, { passingMarks: Number(e.target.value) })}
                      className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#414752] mb-1">Exam Date</label>
                    <input
                      type="date"
                      value={activePaper.date}
                      onChange={(e) => updatePaper(activePaper.id, { date: e.target.value })}
                      className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#414752] mb-1">Evaluation Due Date</label>
                    <input
                      type="date"
                      value={activePaper.dueDate}
                      onChange={(e) => updatePaper(activePaper.id, { dueDate: e.target.value })}
                      className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-semibold text-[#414752] mb-1">Student Request Window End</label>
                    <input
                      type="date"
                      value={activePaper.requestWindowEnd}
                      onChange={(e) => updatePaper(activePaper.id, { requestWindowEnd: e.target.value })}
                      className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-[#0b1c30]">
                  <input
                    type="checkbox"
                    checked={activePaper.anonymousEvaluation}
                    onChange={(e) =>
                      updatePaper(
                        activePaper.id,
                        { anonymousEvaluation: e.target.checked },
                        `Anonymous evaluation: ${e.target.checked}`
                      )
                    }
                  />
                  <span>Anonymous evaluation (teachers see roll codes instead of student names)</span>
                </label>

                <div>
                  <label className="block text-xs font-semibold text-[#414752] mb-1">Question Paper Instructions</label>
                  <textarea
                    rows={3}
                    value={activePaper.questionPaperNotes}
                    onChange={(e) => updatePaper(activePaper.id, { questionPaperNotes: e.target.value })}
                    className="w-full rounded border border-[#c1c6d4] p-2.5 text-xs"
                  />
                </div>
              </div>

              {/* Question Paper Preview */}
              <div className="border border-[#e2e8f0] rounded-lg bg-[#f8f9ff] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0b1c30]">
                    <Eye className="w-4 h-4 text-[#005dac]" />
                    <span>Question Paper Preview</span>
                  </div>
                  <span className="text-[11px] text-[#64748b] tabular-nums">
                    Max {activePaper.totalMarks} marks · Pass {activePaper.passingMarks}
                  </span>
                </div>
                <p className="text-xs text-[#414752] italic">{activePaper.questionPaperNotes}</p>
                <div className="space-y-2 pt-2 border-t border-[#e2e8f0]">
                  {paperQuestions.length === 0 ? (
                    <div className="text-xs text-[#64748b] py-4 text-center">
                      No questions added yet. Switch to Answer Key & Rubric (A5) to add questions.
                    </div>
                  ) : (
                    paperQuestions.map((q) => (
                      <div key={q.id} className="bg-white border border-[#e2e8f0] rounded p-3 text-xs">
                        <div className="flex justify-between font-semibold text-[#0b1c30]">
                          <span>
                            {q.label}. {q.text}
                          </span>
                          <span className="font-mono shrink-0 ml-2">[{q.marks}m]</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* A5 Answer Key & Rubric Split */
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Left: Source Answer Key beside Rubric */}
              <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#e2e8f0] p-4 space-y-4 bg-[#f8f9ff]">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[#0b1c30]">Source Answer Key</span>
                    <span className="text-[11px] text-[#64748b]">PDF / Typed Key</span>
                  </div>
                  <textarea
                    rows={7}
                    disabled={activePaper.rubricLocked}
                    value={activePaper.sourceKeyText}
                    onChange={(e) => updatePaper(activePaper.id, { sourceKeyText: e.target.value })}
                    className="w-full rounded border border-[#c1c6d4] bg-white p-2.5 text-xs leading-relaxed disabled:bg-slate-50"
                  />
                </div>

                {/* Sum validation banner */}
                <div
                  className={`p-3 rounded border text-xs flex items-start gap-2 ${
                    rubricSumCheck.valid
                      ? 'bg-[#e8f5e9] border-[#88d982] text-[#196b22]'
                      : 'bg-[#ffdad6] border-[#ba1a1a] text-[#93000a]'
                  }`}
                >
                  {rubricSumCheck.valid ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-semibold">
                      Question Sum: {rubricSumCheck.sum} / {activePaper.totalMarks} marks
                    </div>
                    {!rubricSumCheck.valid && (
                      <div className="mt-0.5">
                        Difference of {rubricSumCheck.diff} marks must be resolved to match paper total.
                      </div>
                    )}
                  </div>
                </div>

                {/* Question List Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0b1c30]">Questions</span>
                    {!activePaper.rubricLocked && (
                      <button
                        type="button"
                        onClick={() =>
                          addQuestion({
                            paperId: activePaper.id,
                            number: paperQuestions.length + 1,
                            label: `Q${paperQuestions.length + 1}`,
                            text: 'New question prompt',
                            type: 'short',
                            marks: 5,
                            modelAnswer: 'Model answer key.',
                            markingNotes: 'Key concepts required.',
                            commonWrongAnswers: [],
                            keyPoints: [
                              { id: `kp-${Date.now()}`, text: 'core concept', marks: 5, alternativeWordings: [] },
                            ],
                          })
                        }
                        className="text-[11px] font-semibold text-[#005dac] hover:underline"
                      >
                        + Add Question
                      </button>
                    )}
                  </div>
                  {paperQuestions.length === 0 ? (
                    <div className="p-3 rounded border border-dashed border-[#c1c6d4] text-xs text-[#64748b] text-center">
                      No questions yet. Click "+ Add Question" above.
                    </div>
                  ) : (
                    paperQuestions.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setSelectedQId(q.id);
                          setTestOutput(null);
                        }}
                        className={`w-full text-left p-2.5 rounded border text-xs flex items-center justify-between ${
                          activeQ?.id === q.id
                            ? 'bg-white border-[#005dac] text-[#0b1c30] font-semibold'
                            : 'bg-white/70 border-[#e2e8f0] text-[#414752] hover:bg-white'
                        }`}
                      >
                        <span className="truncate">
                          {q.label}: {q.text}
                        </span>
                        <span className="font-mono ml-2 shrink-0">{q.marks}m</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right: Structured Rubric Editor + Live Test Grading Panel */}
              <div className="lg:col-span-8 p-5 space-y-5">
                {activeQ ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-[#0b1c30]">
                          {activeQ.label} Rubric Configuration
                        </h2>
                        {activePaper.rubricLocked && (
                          <p className="text-[11px] text-[#875200] mt-0.5">
                            Key is locked because evaluation is active. Unlock with a reason to edit rubric fields.
                          </p>
                        )}
                      </div>
                      {!activePaper.rubricLocked && (
                        <button
                          type="button"
                          onClick={() => deleteQuestion(activeQ.id)}
                          aria-label={`Delete ${activeQ.label}`}
                          className="p-1.5 rounded border border-[#e2e8f0] text-[#ba1a1a] hover:bg-[#ffdad6]/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-[#414752] mb-1">Question Text</label>
                        <input
                          type="text"
                          disabled={activePaper.rubricLocked}
                          value={activeQ.text}
                          onChange={(e) => saveQuestion({ ...activeQ, text: e.target.value })}
                          className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 disabled:bg-slate-50"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#414752] mb-1">Type</label>
                        <select
                          disabled={activePaper.rubricLocked}
                          value={activeQ.type}
                          onChange={(e) => saveQuestion({ ...activeQ, type: e.target.value as QuestionType })}
                          className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 bg-white disabled:bg-slate-50"
                        >
                          <option value="mcq">MCQ</option>
                          <option value="one_word">One word</option>
                          <option value="short">Short</option>
                          <option value="long">Long</option>
                          <option value="maths">Maths</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-[#414752] mb-1">Marks & Mode Override</label>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            disabled={activePaper.rubricLocked}
                            value={activeQ.marks}
                            onChange={(e) => saveQuestion({ ...activeQ, marks: Number(e.target.value) })}
                            className="w-16 rounded border border-[#c1c6d4] px-2 py-1.5 tabular-nums disabled:bg-slate-50"
                          />
                          <select
                            disabled={activePaper.rubricLocked}
                            value={activeQ.modeOverride || ''}
                            onChange={(e) =>
                              saveQuestion({
                                ...activeQ,
                                modeOverride: (e.target.value || undefined) as PaperMode | undefined,
                              })
                            }
                            className="flex-1 rounded border border-[#c1c6d4] px-2 py-1.5 bg-white disabled:bg-slate-50"
                          >
                            <option value="">Paper default</option>
                            <option value="lenient">Lenient</option>
                            <option value="strict">Strict</option>
                            <option value="maths">Maths</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold text-[#414752] mb-1">Model Answer</label>
                        <textarea
                          rows={2}
                          disabled={activePaper.rubricLocked}
                          value={activeQ.modelAnswer}
                          onChange={(e) => saveQuestion({ ...activeQ, modelAnswer: e.target.value })}
                          className="w-full rounded border border-[#c1c6d4] p-2 disabled:bg-slate-50"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#414752] mb-1">Marking Notes (for Teachers)</label>
                        <textarea
                          rows={2}
                          disabled={activePaper.rubricLocked}
                          value={activeQ.markingNotes}
                          onChange={(e) => saveQuestion({ ...activeQ, markingNotes: e.target.value })}
                          className="w-full rounded border border-[#c1c6d4] p-2 disabled:bg-slate-50"
                        />
                      </div>
                    </div>

                    {/* Key Points */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#0b1c30]">Key Points & Alternative Wordings</span>
                        {!activePaper.rubricLocked && (
                          <button
                            type="button"
                            onClick={() =>
                              saveQuestion({
                                ...activeQ,
                                keyPoints: [
                                  ...activeQ.keyPoints,
                                  { id: `kp-${Date.now()}`, text: 'New key point', marks: 1, alternativeWordings: [] },
                                ],
                              })
                            }
                            className="text-xs font-semibold text-[#005dac] hover:underline"
                          >
                            + Add Key Point
                          </button>
                        )}
                      </div>
                      {activeQ.keyPoints.map((kp) => (
                        <div key={kp.id} className="p-3 rounded border border-[#e2e8f0] bg-[#f8f9ff] grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs items-end">
                          <div className="sm:col-span-5">
                            <label className="block text-[11px] text-[#64748b] mb-0.5">Key Point</label>
                            <input
                              type="text"
                              disabled={activePaper.rubricLocked}
                              value={kp.text}
                              onChange={(e) => handleUpdateKeyPoint(activeQ, kp.id, 'text', e.target.value)}
                              className="w-full rounded border border-[#c1c6d4] bg-white px-2.5 py-1 disabled:bg-slate-100"
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <label className="block text-[11px] text-[#64748b] mb-0.5">Alternative Wordings (comma-separated)</label>
                            <input
                              type="text"
                              disabled={activePaper.rubricLocked}
                              value={kp.alternativeWordings.join(', ')}
                              onChange={(e) => handleUpdateKeyPoint(activeQ, kp.id, 'alt', e.target.value)}
                              className="w-full rounded border border-[#c1c6d4] bg-white px-2.5 py-1 disabled:bg-slate-100"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] text-[#64748b] mb-0.5">Marks</label>
                            <input
                              type="number"
                              step="0.5"
                              disabled={activePaper.rubricLocked}
                              value={kp.marks}
                              onChange={(e) => handleUpdateKeyPoint(activeQ, kp.id, 'marks', e.target.value)}
                              className="w-full rounded border border-[#c1c6d4] bg-white px-2 py-1 tabular-nums disabled:bg-slate-100"
                            />
                          </div>
                          <div className="sm:col-span-1 flex justify-end">
                            {!activePaper.rubricLocked && activeQ.keyPoints.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteKeyPoint(activeQ, kp.id)}
                                aria-label="Delete key point"
                                className="p-1.5 rounded border border-[#e2e8f0] bg-white text-[#ba1a1a] hover:bg-[#ffdad6]/40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Common wrong answers */}
                    <div className="text-xs">
                      <label className="block font-semibold text-[#414752] mb-1">
                        Common Wrong Answers (comma-separated)
                      </label>
                      <input
                        type="text"
                        disabled={activePaper.rubricLocked}
                        value={activeQ.commonWrongAnswers.join(', ')}
                        onChange={(e) =>
                          saveQuestion({
                            ...activeQ,
                            commonWrongAnswers: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 disabled:bg-slate-50"
                      />
                    </div>

                    {/* Test Grading Panel (PRD A5) */}
                    <div className="border-t border-[#e2e8f0] pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0b1c30]">
                          <FlaskConical className="w-4 h-4 text-[#005dac]" />
                          <span>Test Grading Panel</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTestSampleText(activeQ.modelAnswer)}
                          className="text-[11px] font-medium text-[#005dac] hover:underline"
                        >
                          Fill sample answer
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <textarea
                          rows={2}
                          value={testSampleText}
                          onChange={(e) => setTestSampleText(e.target.value)}
                          placeholder={`Type a sample student answer for ${activeQ.label} to preview AI scoring...`}
                          className="flex-1 rounded border border-[#c1c6d4] p-2.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleRunTestGrade}
                          className="px-4 py-2 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold shrink-0 self-start"
                        >
                          Test Grade
                        </button>
                      </div>

                      {testOutput && (
                        <div className="p-3.5 rounded border border-[#c1c6d4] bg-[#eff4ff] space-y-2 text-xs">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="font-semibold text-[#0b1c30] tabular-nums">
                              Suggested: {testOutput.suggestedMarks} / {activeQ.marks} marks
                            </span>
                            <ConfidenceBadge level={testOutput.confidence} score={testOutput.confidenceScore} />
                          </div>
                          <div className="space-y-1">
                            {testOutput.keyPointResults.map((kr) => {
                              const kp = activeQ.keyPoints.find((k) => k.id === kr.keyPointId);
                              return (
                                <div key={kr.keyPointId} className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-[#e2e8f0]">
                                  <span className="truncate text-[#0b1c30]">{kp?.text}</span>
                                  <VerdictBadge verdict={kr.verdict} />
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-[#414752]">{testOutput.aiDraftFeedback}</div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-[#64748b] py-8 text-center">
                    No questions added to this paper yet. Click "+ Add Question" on the left to build the rubric.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={lockConfirmOpen}
        title={activePaper?.rubricLocked ? 'Unlock Answer Key & Rubric' : 'Lock Answer Key & Rubric'}
        description={
          activePaper?.rubricLocked
            ? 'Evaluation may already be underway. Provide a reason to unlock and log this change.'
            : rubricSumCheck.valid
            ? 'Locking the key records a version snapshot and marks this paper Ready for evaluation.'
            : `Warning: Question marks sum (${rubricSumCheck.sum}) does not equal paper total (${activePaper?.totalMarks}). Provide a reason to lock anyway.`
        }
        confirmLabel={activePaper?.rubricLocked ? 'Unlock Key' : 'Lock Key'}
        requireReason
        reasonPlaceholder="e.g., Answer key verified before sheet intake"
        onCancel={() => setLockConfirmOpen(false)}
        onConfirm={(reason) => {
          if (activePaper) {
            toggleRubricLock(activePaper.id, !activePaper.rubricLocked, reason);
          }
          setLockConfirmOpen(false);
        }}
      />
    </div>
  );
}
