import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Flag,
  History,
  Lock,
  RefreshCw,
  RotateCw,
  Save,
  Send,
  ShieldAlert,
  SkipForward,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { STRINGS } from '../../i18n/strings';
import { useEval } from '../../store/EvalContext';
import type { ProblemReport } from '../../types/eval';
import {
  canSubmitSheet,
  computeSheetTotals,
  formatStudentIdentity,
  hasUnresolvedFlags,
  sortAnswersFlaggedFirst,
} from '../../utils/gradingEngine';
import {
  ConfidenceBadge,
  FlagReasonTag,
  ModeTag,
  SheetStatusBadge,
  VerdictBadge,
} from '../ui/StatusBadge';

const FEEDBACK_TEMPLATES = [
  'Clear explanation covering all required key points.',
  'Good attempt; minor formula or unit detail missing.',
  'Partial credit awarded for intermediate steps.',
  'Handwriting verified manually; core concept accurate.',
];

export function TeacherWorkspace() {
  const {
    state,
    currentUser,
    selectedSheetId,
    setActiveView,
    workspaceInitialQuestionId,
    lastSavedAt,
    updateAnswerEvaluation,
    recheckAnswerFromOcr,
    submitEvaluatedSheet,
    reportSheetProblem,
  } = useEval();

  const sheet = state.sheets.find((s) => s.id === selectedSheetId) ?? state.sheets[0] ?? null;
  const paper = sheet ? state.papers.find((p) => p.id === sheet.paperId) ?? null : null;
  const subject = paper ? state.subjects.find((s) => s.id === paper.subjectId) ?? null : null;
  const student = sheet ? state.users.find((u) => u.id === sheet.studentId) : undefined;
  const prefs = currentUser ? state.teacherPreferences[currentUser.id] : undefined;

  const [flaggedFirstOrder, setFlaggedFirstOrder] = useState(true);
  const orderedAnswers = useMemo(() => {
    if (!sheet) return [];
    return flaggedFirstOrder ? sortAnswersFlaggedFirst(sheet.answers) : sheet.answers;
  }, [sheet, flaggedFirstOrder]);

  const [activeQId, setActiveQId] = useState<string>(
    workspaceInitialQuestionId || orderedAnswers[0]?.questionId || ''
  );

  // Sync active question if navigated from Review Queue
  useEffect(() => {
    if (workspaceInitialQuestionId) {
      setActiveQId(workspaceInitialQuestionId);
    } else if (orderedAnswers.length > 0 && !orderedAnswers.some((a) => a.questionId === activeQId)) {
      setActiveQId(orderedAnswers[0].questionId);
    }
  }, [workspaceInitialQuestionId, orderedAnswers, activeQId]);

  const activeAnswer =
    sheet?.answers.find((a) => a.questionId === activeQId) ?? orderedAnswers[0] ?? null;
  const activeQuestion = activeAnswer
    ? state.questions.find((q) => q.id === activeAnswer.questionId) ?? null
    : null;

  // Sheet viewer controls
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [zoom, setZoom] = useState(prefs?.defaultZoomPct ?? 100);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  // Tablet/mobile responsive pane switch
  const [mobilePane, setMobilePane] = useState<'scan' | 'question' | 'reference'>('question');
  const [showReferenceDesktop, setShowReferenceDesktop] = useState(true);

  // Local OCR draft & recheck diff
  const [ocrDraft, setOcrDraft] = useState('');
  const [recheckBanner, setRecheckBanner] = useState<{
    oldSuggested: number;
    newSuggested: number;
    oldFlags: string[];
    newFlags: string[];
  } | null>(null);
  const [marksError, setMarksError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Timer
  const [elapsedSec, setElapsedSec] = useState(sheet?.timeSpentSeconds || 0);
  useEffect(() => {
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [sheet?.id]);

  // Preload sheet scan images (PRD Section 17)
  useEffect(() => {
    if (!sheet) return;
    sheet.pages.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [sheet]);

  // Sync OCR draft when question changes
  useEffect(() => {
    if (activeAnswer) {
      setOcrDraft(activeAnswer.ocrText);
      setActivePageIdx(activeAnswer.boundingBox.pageIndex || 0);
      setRecheckBanner(null);
      setMarksError('');
      setShowHistory(false);
    }
  }, [activeAnswer?.questionId, sheet?.id]);

  // Modals
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [problemCat, setProblemCat] = useState<ProblemReport['category']>('bad_scan');
  const [problemDesc, setProblemDesc] = useState('');
  const [flagAdminOpen, setFlagAdminOpen] = useState(false);
  const [flagAdminNote, setFlagAdminNote] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(''), 2500);
  };

  const isLocked = sheet?.status === 'evaluated' || sheet?.status === 'published';

  const currentIdx = orderedAnswers.findIndex((a) => a.questionId === activeAnswer?.questionId);

  const goRelative = (delta: number) => {
    if (orderedAnswers.length === 0) return;
    const nextIdx = Math.max(0, Math.min(orderedAnswers.length - 1, currentIdx + delta));
    setActiveQId(orderedAnswers[nextIdx].questionId);
  };

  const goNextFlagged = () => {
    const remaining = orderedAnswers.slice(currentIdx + 1).concat(orderedAnswers.slice(0, currentIdx + 1));
    const nextFlag = remaining.find((a) => hasUnresolvedFlags(a));
    if (nextFlag) {
      setActiveQId(nextFlag.questionId);
    } else {
      showToast('No unresolved flagged questions left.');
    }
  };

  const handleAcceptSuggested = () => {
    if (!sheet || !activeAnswer || isLocked) return;
    updateAnswerEvaluation(sheet.id, activeAnswer.questionId, (prev) => ({
      ...prev,
      finalMarks: prev.suggestedMarks,
      source: 'ai',
      teacherOverride: false,
      acceptedByTeacher: true,
      flagResolved: true,
      changedBy: currentUser?.name,
      changedAt: new Date().toISOString(),
    }));
    showToast(`Accepted ${activeAnswer.suggestedMarks} marks.`);
  };

  const handleToggleFlagResolved = () => {
    if (!sheet || !activeAnswer || isLocked) return;
    updateAnswerEvaluation(sheet.id, activeAnswer.questionId, (prev) => ({
      ...prev,
      flagResolved: !prev.flagResolved,
    }));
  };

  // Keyboard shortcuts (PRD T3 & T8)
  useEffect(() => {
    if (prefs?.enableKeyboardShortcuts === false) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        goRelative(1);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        goRelative(-1);
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleAcceptSuggested();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleFlagResolved();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoom((z) => Math.min(225, z + 15));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom((z) => Math.max(60, z - 15));
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setShowReferenceDesktop((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!sheet || !paper || !activeAnswer || !activeQuestion) {
    return (
      <div className="p-8 text-center text-xs text-[#64748b]">
        No sheet selected. Return to Assigned Papers to pick a sheet.
      </div>
    );
  }

  const totals = computeSheetTotals(sheet);
  const submitCheck = canSubmitSheet(sheet.answers);
  const effectiveMode = activeQuestion.modeOverride ?? paper.mode;

  const handleMarksChange = (rawVal: string) => {
    if (isLocked) return;
    const num = Number(rawVal);
    if (Number.isNaN(num) || num < 0 || num > activeQuestion.marks) {
      setMarksError(`Marks must be between 0 and ${activeQuestion.marks}.`);
      return;
    }
    setMarksError('');
    updateAnswerEvaluation(
      sheet.id,
      activeAnswer.questionId,
      (prev) => ({
        ...prev,
        finalMarks: num,
        source: 'teacher',
        teacherOverride: Math.abs(num - prev.suggestedMarks) > 0.001,
        acceptedByTeacher: true,
        flagResolved: true,
        changedBy: currentUser?.name,
        changedAt: new Date().toISOString(),
        history: [
          {
            id: `hist-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorName: currentUser?.name || 'Teacher',
            actorRole: 'teacher',
            previousMarks: prev.finalMarks,
            newMarks: num,
            reason: prev.overrideReason,
            note: 'Teacher mark adjustment',
          },
          ...prev.history,
        ],
      }),
      {
        action: 'Mark Override',
        oldValue: `${activeAnswer.finalMarks}`,
        newValue: `${num}`,
      }
    );
  };

  const handleUndoLastMark = () => {
    if (isLocked || activeAnswer.history.length === 0) return;
    const latest = activeAnswer.history[0];
    updateAnswerEvaluation(sheet.id, activeAnswer.questionId, (prev) => ({
      ...prev,
      finalMarks: latest.previousMarks,
      teacherOverride: Math.abs(latest.previousMarks - prev.suggestedMarks) > 0.001,
      history: prev.history.slice(1),
    }));
    showToast(`Reverted marks to ${latest.previousMarks}.`);
  };

  const handleRecheck = () => {
    if (isLocked) return;
    const diff = recheckAnswerFromOcr(sheet.id, activeAnswer.questionId, ocrDraft);
    if (diff) {
      setRecheckBanner(diff);
    }
  };

  const renderHighlightedOcrPreview = () => {
    const words = activeAnswer.ocrText.split(/(\s+)/);
    const lowSet = new Set(activeAnswer.lowConfidenceWords.map((w) => w.toLowerCase()));
    return (
      <div className="p-2.5 rounded bg-[#f8f9ff] border border-[#e2e8f0] text-xs leading-relaxed text-[#0b1c30]">
        {words.map((token, idx) => {
          const clean = token.toLowerCase().replace(/[^\w^/()]/g, '');
          const isLow = clean && (lowSet.has(token.toLowerCase()) || lowSet.has(clean));
          if (isLow) {
            return (
              <span
                key={idx}
                title="Low OCR confidence word — verify against handwriting above"
                className="underline decoration-wavy decoration-[#ba1a1a] bg-[#ffdad6]/50 px-0.5 rounded-xs font-medium"
              >
                {token}
              </span>
            );
          }
          return <span key={idx}>{token}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-[#f8f9ff] overflow-hidden">
      {/* Fixed Workspace Top Bar */}
      <div className="bg-white border-b border-[#e2e8f0] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setActiveView('teacher_paper_sheets')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#e2e8f0] text-xs font-medium text-[#414752] hover:bg-slate-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sheets</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[#0b1c30] truncate">
                {subject?.code} · {formatStudentIdentity(student, paper.anonymousEvaluation)}
              </span>
              <SheetStatusBadge status={sheet.status} />
              {isLocked && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#196b22]">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs shrink-0 flex-wrap">
          <span className="font-mono tabular-nums text-[#414752]">
            {currentIdx + 1} of {orderedAnswers.length} Qs
          </span>
          <span className="text-[#c1c6d4]" aria-hidden="true">
            |
          </span>
          <span className="font-mono tabular-nums">
            My Total: <strong className="text-[#005dac]">{totals.finalTotal}</strong>
            <span className="text-[#64748b]"> / AI: {totals.suggestedTotal}</span>
            <span className="text-[#64748b]"> ({paper.totalMarks}m)</span>
          </span>
          <span className="hidden md:inline text-[#196b22] font-medium">
            {lastSavedAt ? `Autosaved ${lastSavedAt}` : 'Autosaved'}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 font-mono tabular-nums text-[#64748b]">
            <Clock className="w-3.5 h-3.5" />
            {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => setFlagAdminOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#ffb865] bg-[#fff8e1] text-[#875200] font-semibold hover:bg-[#ffddba]"
          >
            <Flag className="w-3 h-3" />
            <span className="hidden sm:inline">{STRINGS.workspace.flagAdminBtn}</span>
          </button>
        </div>
      </div>

      {/* Tablet/Mobile Segmented Pane Toggle (< 1280px) */}
      <div className="xl:hidden bg-white border-b border-[#e2e8f0] px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
        <div className="inline-flex p-0.5 bg-slate-100 rounded-md w-full">
          {(
            [
              { id: 'scan', label: 'Sheet Scan' },
              { id: 'question', label: 'Question & Marks' },
              { id: 'reference', label: 'Key & Rubric' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMobilePane(t.id)}
              className={`flex-1 py-1.5 rounded text-xs font-semibold ${
                mobilePane === t.id ? 'bg-white text-[#005dac] shadow-xs' : 'text-[#414752]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Three-Pane Main Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 overflow-hidden">
        {/* LEFT PANE: Scanned Sheet Viewer (4 cols on xl) */}
        <section
          aria-label="Scanned answer sheet viewer"
          className={`xl:col-span-4 border-r border-[#e2e8f0] bg-slate-100 flex-col min-h-0 ${
            mobilePane === 'scan' ? 'flex' : 'hidden xl:flex'
          }`}
        >
          {/* Viewer Toolbar */}
          <div className="px-3 py-2 bg-white border-b border-[#e2e8f0] flex items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(60, z - 15))}
                aria-label="Zoom out"
                className="p-1.5 rounded border border-[#e2e8f0] hover:bg-slate-50"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="w-12 text-center font-mono tabular-nums">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(225, z + 15))}
                aria-label="Zoom in"
                className="p-1.5 rounded border border-[#e2e8f0] hover:bg-slate-50"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                aria-label="Rotate page 90 degrees"
                className="p-1.5 rounded border border-[#e2e8f0] hover:bg-slate-50 ml-1"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(100);
                  setRotation(0);
                  setPan({ x: 0, y: 0 });
                }}
                className="px-2 py-1 rounded border border-[#e2e8f0] hover:bg-slate-50 text-[11px] font-medium ml-1"
              >
                Reset
              </button>
            </div>

            <span className="text-[11px] text-[#64748b] hidden sm:inline">
              Click any highlighted box to jump
            </span>
          </div>

          {/* Interactive Pan/Zoom Sheet Canvas */}
          <div
            className="flex-1 overflow-auto p-4 flex items-start justify-center cursor-grab active:cursor-grabbing select-none"
            onMouseDown={(e) => {
              draggingRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                origX: pan.x,
                origY: pan.y,
              };
            }}
            onMouseMove={(e) => {
              if (!draggingRef.current.active) return;
              setPan({
                x: draggingRef.current.origX + (e.clientX - draggingRef.current.startX),
                y: draggingRef.current.origY + (e.clientY - draggingRef.current.startY),
              });
            }}
            onMouseUp={() => {
              draggingRef.current.active = false;
            }}
            onMouseLeave={() => {
              draggingRef.current.active = false;
            }}
          >
            <div
              className="relative bg-white shadow-md border border-[#c1c6d4] transition-transform duration-75 origin-top"
              style={{
                width: `${zoom}%`,
                maxWidth: 'none',
                transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg)`,
              }}
            >
              <img
                src={sheet.pages[activePageIdx] || sheet.pages[0]}
                alt={`Scanned answer sheet page ${activePageIdx + 1}`}
                draggable={false}
                className="w-full h-auto block"
              />

              {/* Clickable Question Bounding Boxes */}
              {sheet.answers
                .filter((a) => a.boundingBox.pageIndex === activePageIdx)
                .map((ans) => {
                  const q = state.questions.find((x) => x.id === ans.questionId);
                  const isCurrent = ans.questionId === activeAnswer.questionId;
                  const isFlagged = hasUnresolvedFlags(ans);
                  return (
                    <button
                      key={ans.questionId}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveQId(ans.questionId);
                        setMobilePane('question');
                      }}
                      aria-label={`Jump to ${q?.label || ans.questionId}`}
                      style={{
                        top: `${ans.boundingBox.topPct}%`,
                        left: `${ans.boundingBox.leftPct}%`,
                        width: `${ans.boundingBox.widthPct}%`,
                        height: `${ans.boundingBox.heightPct}%`,
                      }}
                      className={`absolute rounded transition-all text-left ${
                        isCurrent
                          ? 'border-2 border-[#005dac] bg-[#005dac]/10 ring-2 ring-[#005dac]/25'
                          : isFlagged
                          ? 'border-2 border-dashed border-[#f89c00] bg-[#f89c00]/10 hover:bg-[#f89c00]/20'
                          : 'border border-dashed border-slate-400/70 hover:border-[#005dac] hover:bg-[#005dac]/5'
                      }`}
                    >
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded-br ${
                          isCurrent
                            ? 'bg-[#005dac] text-white'
                            : isFlagged
                            ? 'bg-[#f89c00] text-white'
                            : 'bg-slate-800/80 text-white'
                        }`}
                      >
                        {q?.label}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Page Thumbnails Strip */}
          <div className="px-3 py-2 bg-white border-t border-[#e2e8f0] flex items-center gap-2 overflow-x-auto shrink-0">
            {sheet.pages.map((pSrc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActivePageIdx(idx)}
                className={`flex items-center gap-1.5 p-1 rounded border text-[11px] font-mono ${
                  activePageIdx === idx
                    ? 'border-[#005dac] bg-[#eff4ff] text-[#005dac] font-semibold'
                    : 'border-[#e2e8f0] text-[#414752]'
                }`}
              >
                <img src={pSrc} alt={`Thumbnail page ${idx + 1}`} className="w-7 h-9 object-cover rounded-xs" />
                <span>P{idx + 1}</span>
              </button>
            ))}
          </div>
        </section>

        {/* CENTRE PANE: Question List Rail + Active Question Evaluation Panel */}
        <section
          aria-label="Question evaluation panel"
          className={`${
            showReferenceDesktop ? 'xl:col-span-5' : 'xl:col-span-8'
          } border-r border-[#e2e8f0] bg-white flex min-h-0 overflow-hidden ${
            mobilePane === 'question' ? 'flex' : 'hidden xl:flex'
          }`}
        >
          {/* Side Question Navigation Dots Rail */}
          <div className="w-16 sm:w-20 border-r border-[#e2e8f0] bg-[#f8f9ff] flex flex-col shrink-0">
            <button
              type="button"
              onClick={() => setFlaggedFirstOrder((v) => !v)}
              title="Toggle flagged-first or paper question order"
              className="px-1.5 py-2 border-b border-[#e2e8f0] text-[10px] font-semibold text-[#005dac] hover:bg-[#eff4ff] text-center"
            >
              {flaggedFirstOrder ? 'Flag 1st' : 'Q Order'}
            </button>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {orderedAnswers.map((ans) => {
                const q = state.questions.find((x) => x.id === ans.questionId);
                const isActive = ans.questionId === activeAnswer.questionId;
                const unresolved = hasUnresolvedFlags(ans);
                const dotColor = unresolved
                  ? 'bg-[#ba1a1a]'
                  : ans.acceptedByTeacher
                  ? 'bg-[#196b22]'
                  : 'bg-[#f89c00]';

                return (
                  <button
                    key={ans.questionId}
                    type="button"
                    onClick={() => setActiveQId(ans.questionId)}
                    className={`w-full py-2 px-1.5 rounded border text-xs font-mono flex items-center justify-between gap-1 ${
                      isActive
                        ? 'bg-white border-[#005dac] text-[#005dac] font-semibold shadow-2xs'
                        : 'border-transparent hover:bg-white text-[#414752]'
                    }`}
                  >
                    <span>{q?.label}</span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Question Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {toastMsg && (
              <div className="p-2 rounded bg-[#e8f5e9] border border-[#88d982] text-xs text-[#196b22] font-medium">
                {toastMsg}
              </div>
            )}

            {/* Question prompt & marks */}
            <div className="space-y-1.5 pb-3 border-b border-[#e2e8f0]">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#0b1c30]">
                  {activeQuestion.label}. {activeQuestion.text}
                </h2>
                <span className="font-mono text-xs font-semibold text-[#005dac] shrink-0 bg-[#eff4ff] px-2 py-0.5 rounded">
                  {activeQuestion.marks}m
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <ConfidenceBadge level={activeAnswer.confidence} score={activeAnswer.confidenceScore} />
                <ModeTag mode={effectiveMode} />
                {activeAnswer.reviewReasons.map((r) => (
                  <FlagReasonTag key={r} reason={r} />
                ))}
                {activeAnswer.teacherOverride && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#eff4ff] border border-[#a5c8ff] text-[#004786] text-[11px] font-semibold">
                    Teacher override
                  </span>
                )}
              </div>
            </div>

            {/* Resolve Flag Banner if unresolved */}
            {hasUnresolvedFlags(activeAnswer) && !isLocked && (
              <div className="p-2.5 rounded border border-[#ffb865] bg-[#fff8e1] flex items-center justify-between gap-2 text-xs">
                <span className="text-[#875200] font-medium">
                  Flagged for human check. Verify OCR & marks, then resolve flag.
                </span>
                <button
                  type="button"
                  onClick={handleToggleFlagResolved}
                  className="px-2.5 py-1 rounded bg-[#875200] text-white font-semibold shrink-0"
                >
                  Mark Flag Resolved
                </button>
              </div>
            )}

            {/* Handwriting Line Crop + Editable OCR Text */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#0b1c30]">
                  Handwriting Crop & Editable OCR Text
                </span>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={handleRecheck}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#eff4ff] border border-[#a5c8ff] hover:bg-[#d4e3ff] text-[#004786] text-[11px] font-semibold whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-3 h-3 shrink-0" />
                    <span>{STRINGS.workspace.recheckBtn}</span>
                  </button>
                )}
              </div>

              {/* Handwriting line crop strip right above text */}
              <div className="relative h-24 rounded border border-[#c1c6d4] overflow-hidden bg-white">
                <img
                  src={sheet.pages[activeAnswer.boundingBox.pageIndex] || sheet.pages[0]}
                  alt={`Handwriting crop for ${activeQuestion.label}`}
                  className="w-full h-auto block"
                  style={{
                    transform: `translateY(-${Math.max(0, activeAnswer.boundingBox.topPct - 1)}%)`,
                  }}
                />
                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-slate-900/75 text-white font-mono text-[10px]">
                  {activeQuestion.label} crop
                </span>
              </div>

              {/* Underlined low-confidence preview */}
              {activeAnswer.lowConfidenceWords.length > 0 && renderHighlightedOcrPreview()}

              <textarea
                rows={3}
                disabled={isLocked}
                aria-label="Editable OCR student answer text"
                value={ocrDraft}
                onChange={(e) => setOcrDraft(e.target.value)}
                className="w-full rounded border border-[#c1c6d4] p-2.5 text-xs font-mono text-[#0b1c30] focus:outline-none focus:border-[#005dac] disabled:bg-slate-50"
              />

              {recheckBanner && (
                <div className="p-2.5 rounded border border-[#88d982] bg-[#e8f5e9] text-xs text-[#196b22]">
                  <strong>Re-check complete:</strong> Suggested marks updated from{' '}
                  <span className="font-mono">{recheckBanner.oldSuggested}</span> →{' '}
                  <span className="font-mono font-semibold">{recheckBanner.newSuggested}</span>. Flags:{' '}
                  {recheckBanner.oldFlags.length} → {recheckBanner.newFlags.length}.
                </div>
              )}
            </div>

            {/* Key-Point Checklist from Rubric */}
            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#0b1c30]">Key-Point Checklist & Evidence</span>
                <span className="text-[11px] text-[#64748b] font-mono">
                  Judge: {activeAnswer.checks.aiJudge} · NLI: {activeAnswer.checks.contradictionCheck.replace('_', ' ')} · Votes: {activeAnswer.checks.votes}
                </span>
              </div>

              <div className="space-y-2">
                {activeAnswer.keyPointResults.map((kr) => {
                  const kp = activeQuestion.keyPoints.find((k) => k.id === kr.keyPointId);
                  return (
                    <div key={kr.keyPointId} className="p-2.5 rounded border border-[#e2e8f0] bg-[#f8f9ff] text-xs space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-[#0b1c30]">
                          {kp?.text}{' '}
                          <span className="font-mono text-[#64748b]">({kr.marksAwarded}/{kp?.marks}m)</span>
                        </span>
                        <VerdictBadge verdict={kr.verdict} />
                      </div>
                      {kr.evidenceSentence && (
                        <div className="px-2 py-1 rounded bg-[#fff8e1]/70 border border-[#ffddba] text-[11px] text-[#0b1c30]">
                          <strong>Student words:</strong> "{kr.evidenceSentence}"
                        </div>
                      )}
                      <div className="text-[11px] text-[#64748b]">{kr.reason}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Strict Mode Split if applicable */}
            {effectiveMode === 'strict' && activeAnswer.strictBreakdown && (
              <div className="p-2.5 rounded border border-[#e2e8f0] bg-slate-50 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-[11px] text-[#64748b]">Content</div>
                  <div className="font-mono font-semibold">{activeAnswer.strictBreakdown.content}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[#64748b]">Grammar</div>
                  <div className="font-mono font-semibold">{activeAnswer.strictBreakdown.grammar}</div>
                </div>
                <div>
                  <div className="text-[11px] text-[#64748b]">Spelling</div>
                  <div className="font-mono font-semibold">{activeAnswer.strictBreakdown.spelling}</div>
                </div>
              </div>
            )}

            {/* Marks Box + Override Reason + History */}
            <div className="p-3.5 rounded border border-[#c1c6d4] bg-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <label htmlFor="workspace-marks-input" className="text-xs font-semibold text-[#0b1c30]">
                    Marks Awarded
                  </label>
                  <input
                    id="workspace-marks-input"
                    type="number"
                    step="0.5"
                    min={0}
                    max={activeQuestion.marks}
                    disabled={isLocked}
                    value={activeAnswer.finalMarks}
                    onChange={(e) => handleMarksChange(e.target.value)}
                    className="w-20 h-9 rounded border border-[#005dac] px-2.5 text-right text-sm font-mono font-semibold text-[#0b1c30] tabular-nums disabled:bg-slate-100"
                  />
                  <span className="text-xs font-mono text-[#64748b]">
                    / {activeQuestion.marks} (AI: {activeAnswer.suggestedMarks})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isLocked || activeAnswer.history.length === 0}
                    onClick={handleUndoLastMark}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#c1c6d4] text-[11px] font-medium text-[#414752] disabled:opacity-40 hover:bg-slate-50"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Undo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHistory((v) => !v)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#c1c6d4] text-[11px] font-medium text-[#414752] hover:bg-slate-50"
                  >
                    <History className="w-3 h-3" />
                    <span>History ({activeAnswer.history.length})</span>
                  </button>
                </div>
              </div>

              {marksError && <div className="text-xs text-[#ba1a1a]">{marksError}</div>}

              {activeAnswer.teacherOverride && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#414752] mb-1">
                    Override Reason (optional, recommended)
                  </label>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={activeAnswer.overrideReason || ''}
                    onChange={(e) =>
                      updateAnswerEvaluation(sheet.id, activeAnswer.questionId, (prev) => ({
                        ...prev,
                        overrideReason: e.target.value,
                      }))
                    }
                    placeholder="e.g., Awarded step credit for handwritten derivation"
                    className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 text-xs"
                  />
                </div>
              )}

              {showHistory && (
                <div className="pt-2 border-t border-[#e2e8f0] space-y-1 text-[11px] text-[#414752]">
                  {activeAnswer.history.length === 0 ? (
                    <div>No mark edits recorded for this question yet.</div>
                  ) : (
                    activeAnswer.history.map((h) => (
                      <div key={h.id} className="flex justify-between gap-2">
                        <span>
                          {h.actorName}: <strong className="font-mono">{h.previousMarks} → {h.newMarks}</strong> ({h.note})
                        </span>
                        <span className="text-[#64748b]">{new Date(h.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Feedback Templates & Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="workspace-feedback" className="text-xs font-semibold text-[#0b1c30]">
                  Teacher Feedback (Visible to student if enabled)
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FEEDBACK_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    disabled={isLocked}
                    onClick={() =>
                      updateAnswerEvaluation(sheet.id, activeAnswer.questionId, (prev) => ({
                        ...prev,
                        feedback: tpl,
                      }))
                    }
                    className="px-2 py-1 rounded border border-[#e2e8f0] bg-[#f8f9ff] hover:bg-[#eff4ff] text-[11px] text-[#414752]"
                  >
                    + {tpl.slice(0, 28)}...
                  </button>
                ))}
              </div>
              <textarea
                id="workspace-feedback"
                rows={2}
                disabled={isLocked}
                value={activeAnswer.feedback}
                onChange={(e) =>
                  updateAnswerEvaluation(sheet.id, activeAnswer.questionId, (prev) => ({
                    ...prev,
                    feedback: e.target.value,
                  }))
                }
                className="w-full rounded border border-[#c1c6d4] p-2.5 text-xs"
              />
            </div>
          </div>
        </section>

        {/* RIGHT PANE: Reference Panel (Question Paper, Model Key, Rubric, Notes) */}
        {showReferenceDesktop && (
          <aside
            aria-label="Reference answer key and rubric"
            className={`xl:col-span-3 bg-[#f8f9ff] flex-col min-h-0 overflow-y-auto p-4 space-y-4 ${
              mobilePane === 'reference' ? 'flex' : 'hidden xl:flex'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0b1c30]">
                <Eye className="w-4 h-4 text-[#005dac]" />
                <span>Reference Key & Rubric</span>
              </div>
              <button
                type="button"
                onClick={() => setShowReferenceDesktop(false)}
                className="hidden xl:inline text-[11px] text-[#64748b] hover:text-[#0b1c30]"
              >
                Hide (R)
              </button>
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-lg p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-[#0b1c30]">Model Answer ({activeQuestion.label})</div>
              <p className="text-[#414752] leading-relaxed">{activeQuestion.modelAnswer}</p>
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-lg p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-[#0b1c30]">Marking Notes & Mode</div>
              <ModeTag mode={effectiveMode} />
              <p className="text-[#414752] leading-relaxed">{activeQuestion.markingNotes}</p>
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-lg p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-[#0b1c30]">Rubric Points</div>
              <ul className="space-y-1.5">
                {activeQuestion.keyPoints.map((kp) => (
                  <li key={kp.id} className="text-[#414752] flex justify-between gap-2">
                    <span>• {kp.text}</span>
                    <span className="font-mono font-semibold shrink-0">{kp.marks}m</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-lg p-3.5 space-y-1.5 text-xs">
              <div className="font-semibold text-[#0b1c30]">Question Paper Instructions</div>
              <p className="text-[#64748b]">{paper.questionPaperNotes}</p>
            </div>
          </aside>
        )}
      </div>

      {/* Fixed Workspace Bottom Action Bar */}
      <footer className="bg-white border-t border-[#e2e8f0] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentIdx <= 0}
            onClick={() => goRelative(-1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#c1c6d4] text-xs font-semibold text-[#0b1c30] disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{STRINGS.workspace.prevBtn}</span>
          </button>

          <button
            type="button"
            disabled={currentIdx >= orderedAnswers.length - 1}
            onClick={() => goRelative(1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#c1c6d4] text-xs font-semibold text-[#0b1c30] disabled:opacity-40 hover:bg-slate-50"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setProblemModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e2e8f0] text-xs font-medium text-[#ba1a1a] hover:bg-[#ffdad6]/30"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{STRINGS.workspace.reportProblemBtn}</span>
          </button>

          {!showReferenceDesktop && (
            <button
              type="button"
              onClick={() => setShowReferenceDesktop(true)}
              className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#c1c6d4] text-xs font-medium text-[#005dac]"
            >
              Show Reference (R)
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isLocked && (
            <>
              <button
                type="button"
                onClick={handleAcceptSuggested}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#196b22] text-[#196b22] hover:bg-[#e8f5e9] text-xs font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{STRINGS.workspace.acceptSuggestedBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  updateAnswerEvaluation(sheet.id, activeAnswer.questionId, (prev) => ({
                    ...prev,
                    acceptedByTeacher: true,
                    changedBy: currentUser?.name,
                    changedAt: new Date().toISOString(),
                  }));
                  showToast('Question saved.');
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#c1c6d4] text-[#0b1c30] hover:bg-slate-50 text-xs font-semibold"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{STRINGS.workspace.saveBtn}</span>
              </button>

              <button
                type="button"
                onClick={goNextFlagged}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[#ffb865] bg-[#fff8e1] text-[#875200] hover:bg-[#ffddba] text-xs font-semibold"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{STRINGS.workspace.nextFlaggedBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  updateAnswerEvaluation(sheet.id, activeAnswer.questionId, (prev) => ({
                    ...prev,
                    skippedForLater: true,
                  }));
                  goRelative(1);
                }}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#e2e8f0] text-[#414752] hover:bg-slate-50 text-xs font-medium"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>{STRINGS.workspace.skipBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSubmitError('');
                  setSubmitModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{STRINGS.workspace.submitSheetBtn}</span>
              </button>
            </>
          )}
        </div>
      </footer>

      {/* Submit Sheet Summary Modal */}
      {submitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-white border border-[#e2e8f0] rounded-lg shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0b1c30]">Submit Sheet Summary</h2>
              <button type="button" onClick={() => setSubmitModalOpen(false)} aria-label="Close">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 rounded bg-[#f8f9ff] border border-[#e2e8f0]">
                  <div className="text-[#64748b]">Final Total</div>
                  <div className="text-base font-mono font-semibold text-[#0b1c30] mt-0.5">
                    {totals.finalTotal} / {paper.totalMarks}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-[#f8f9ff] border border-[#e2e8f0]">
                  <div className="text-[#64748b]">Overrides</div>
                  <div className="text-base font-mono font-semibold text-[#005dac] mt-0.5">
                    {totals.overrideCount}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-[#f8f9ff] border border-[#e2e8f0]">
                  <div className="text-[#64748b]">Unresolved Flags</div>
                  <div
                    className={`text-base font-mono font-semibold mt-0.5 ${
                      submitCheck.unresolvedCount > 0 ? 'text-[#ba1a1a]' : 'text-[#196b22]'
                    }`}
                  >
                    {submitCheck.unresolvedCount}
                  </div>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto border border-[#e2e8f0] rounded divide-y divide-[#e2e8f0]">
                {sheet.answers.map((a) => {
                  const q = state.questions.find((x) => x.id === a.questionId);
                  const unresolved = hasUnresolvedFlags(a);
                  return (
                    <div key={a.questionId} className="px-3 py-2 flex items-center justify-between">
                      <span className="font-medium text-[#0b1c30]">
                        {q?.label}: {q?.text.slice(0, 42)}...
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {unresolved && <span className="text-[#ba1a1a] font-semibold">Unresolved flag</span>}
                        <span className="font-mono font-semibold">
                          {a.finalMarks}/{q?.marks}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(submitError || !submitCheck.allowed) && (
                <div className="p-2.5 rounded border border-[#ba1a1a] bg-[#ffdad6] text-[#93000a]">
                  {submitError ||
                    `Submission is blocked while ${submitCheck.unresolvedCount} flagged question(s) remain unresolved.`}
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-[#e2e8f0] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="px-3.5 py-2 rounded border border-[#c1c6d4] text-xs font-semibold text-[#414752]"
              >
                Back to Workspace
              </button>
              <button
                type="button"
                disabled={!submitCheck.allowed}
                onClick={() => {
                  const res = submitEvaluatedSheet(sheet.id);
                  if (res.ok) {
                    setSubmitModalOpen(false);
                    setActiveView('teacher_paper_sheets');
                  } else {
                    setSubmitError(res.error || 'Submission blocked.');
                  }
                }}
                className="px-4 py-2 rounded bg-[#196b22] hover:bg-[#005312] disabled:opacity-40 text-white text-xs font-semibold"
              >
                Confirm & Lock Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report a Problem Modal */}
      {problemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-lg shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0b1c30]">Report Sheet Problem to Admin</h2>
              <button type="button" onClick={() => setProblemModalOpen(false)} aria-label="Close">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">Issue Category</label>
                <select
                  value={problemCat}
                  onChange={(e) => setProblemCat(e.target.value as ProblemReport['category'])}
                  className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 bg-white"
                >
                  <option value="bad_scan">Bad scan / illegible image</option>
                  <option value="wrong_student">Wrong student matched</option>
                  <option value="missing_page">Missing page</option>
                  <option value="other">Other issue</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">Details</label>
                <textarea
                  rows={3}
                  value={problemDesc}
                  onChange={(e) => setProblemDesc(e.target.value)}
                  placeholder="Describe the issue so Admin can re-upload or reassign..."
                  className="w-full rounded border border-[#c1c6d4] p-2.5"
                />
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-[#e2e8f0] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setProblemModalOpen(false)}
                className="px-3.5 py-2 rounded border border-[#c1c6d4] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  reportSheetProblem(sheet.id, problemCat, problemDesc || 'Reported from workspace');
                  setProblemModalOpen(false);
                  setProblemDesc('');
                  showToast('Problem reported to Admin.');
                }}
                className="px-4 py-2 rounded bg-[#ba1a1a] text-white text-xs font-semibold"
              >
                Send Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag for Admin Modal */}
      {flagAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-lg shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0b1c30]">Flag Question for Admin</h2>
              <button type="button" onClick={() => setFlagAdminOpen(false)} aria-label="Close">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-[#414752]">
                Escalate {activeQuestion.label} if the rubric key or question paper has an ambiguity.
              </p>
              <textarea
                rows={3}
                value={flagAdminNote}
                onChange={(e) => setFlagAdminNote(e.target.value)}
                placeholder="Note for Examination Cell..."
                className="w-full rounded border border-[#c1c6d4] p-2.5"
              />
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-[#e2e8f0] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFlagAdminOpen(false)}
                className="px-3.5 py-2 rounded border border-[#c1c6d4] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  reportSheetProblem(sheet.id, 'other', `${activeQuestion.label}: ${flagAdminNote}`);
                  setFlagAdminOpen(false);
                  setFlagAdminNote('');
                  showToast('Flagged for Admin review.');
                }}
                className="px-4 py-2 rounded bg-[#875200] text-white text-xs font-semibold"
              >
                Escalate to Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
