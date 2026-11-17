import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { useHotkeys } from '../hooks/useHotkeys';
import { QuestionPanel } from '../components/QuestionPanel';
import { SheetImageViewer } from '../components/SheetImageViewer';
import { OcrCard } from '../components/OcrCard';
import { ReferenceCard } from '../components/ReferenceCard';
import { MarksCard } from '../components/MarksCard';
import { StrictnessChip } from '../components/StrictnessChip';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  X,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Users,
} from 'lucide-react';

export interface ReviewResponse {
  sheet: {
    id: string;
    student_name: string;
    roll_number: string;
    total_score: number;
    max_marks: number;
    percentage: number;
    grade: string;
    status: string;
  };
  paper: {
    id: string;
    title: string;
    total_marks: number;
    strictness_level?: number;
    subject_domain?: string;
  };
  sections: Array<{
    id: string;
    name: string;
    attempt_n: number;
    marks_each: number;
  }>;
  pages: Array<{ page_number: number; file_path: string; url?: string }>;
  questions: any[];
  all_resolved: boolean;
}

export const EvaluateScreen: React.FC = () => {
  const [state, store] = useSheetStore();

  const [reviewData, setReviewData] = useState<ReviewResponse | null>(null);
  const [paperSheets, setPaperSheets] = useState<Array<{ id: string; student_name: string; roll: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isEditingOcrExternal, setIsEditingOcrExternal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showApproveAllModal, setShowApproveAllModal] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isReferenceExpanded, setIsReferenceExpanded] = useState(false);
  const [previousFinalMarksMap, setPreviousFinalMarksMap] = useState<Record<string, number>>({});

  // Collapsible Question Panel state with localStorage persistence
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('evaldesk_question_panel_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const togglePanel = useCallback(() => {
    setIsPanelCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('evaldesk_question_panel_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // 1. Fetch Review Data from GET /api/sheets/{id}/review
  const loadReviewData = useCallback(async () => {
    if (!state.sheetId) return;
    setIsLoading(true);
    try {
      const data = await apiClient.get<ReviewResponse>(`/api/sheets/${state.sheetId}/review`);
      setReviewData(data);

      const qList = data.questions || [];
      if (qList.length > 0) {
        // Selection rule: select the first flagged question on initial load!
        // If already selected a valid question, keep it.
        const currentValid = qList.find(
          (q) => (q.question_key || q.key) === (state.activeQuestionKey || activeKey)
        );
        const firstFlagged = qList.find(
          (q) => (q.flags && q.flags.length > 0 && !q.resolved) || q.status === 'flagged' || q.status === 'failed'
        );
        const targetQ = currentValid || firstFlagged || qList[0];
        const targetKey = targetQ.question_key || targetQ.key;
        setActiveKey(targetKey);
        store.setActiveQuestionKey(targetKey);
      }

      // Sync paper & student details
      if (data.paper) {
        store.setPaper({
          id: data.paper.id,
          title: data.paper.title,
          totalMarks: data.paper.total_marks,
          questionCount: qList.length,
          isLocked: true,
        });

        // Load all sheets for this paper for Prev/Next sheet navigation
        try {
          const sheetsRes = await apiClient.get<{ sheets: any[] }>(`/api/papers/${data.paper.id}/sheets`);
          setPaperSheets(
            (sheetsRes.sheets || []).map((s: any) => ({
              id: s.id,
              student_name: s.student_name,
              roll: s.roll || s.roll_number,
            }))
          );
        } catch {}
      }

      if (data.sheet) {
        store.setSheet(data.sheet.id, data.sheet.student_name, data.sheet.roll_number);
      }
    } catch (err: any) {
      store.setError({
        code: err.code || 'REVIEW_FETCH_FAILED',
        message: err.message || 'Failed to fetch evaluation review data.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [state.sheetId, state.activeQuestionKey, activeKey, store]);

  useEffect(() => {
    loadReviewData();
  }, [loadReviewData]);

  const questions = reviewData?.questions || [];
  const activeQuestionIndex = useMemo(() => {
    return questions.findIndex((q) => (q.question_key || q.key) === activeKey);
  }, [questions, activeKey]);

  const activeQuestion = activeQuestionIndex >= 0 ? questions[activeQuestionIndex] : null;

  // Sheet Navigation: Prev / Next Sheet in paper
  const currentSheetIndex = paperSheets.findIndex((s) => s.id === state.sheetId);
  const handlePrevSheet = () => {
    if (currentSheetIndex > 0) {
      const prevId = paperSheets[currentSheetIndex - 1].id;
      store.setStep('evaluate', prevId);
    }
  };
  const handleNextSheet = () => {
    if (currentSheetIndex >= 0 && currentSheetIndex < paperSheets.length - 1) {
      const nextId = paperSheets[currentSheetIndex + 1].id;
      store.setStep('evaluate', nextId);
    }
  };

  // Compute Review Metrics & sync with store
  const metrics = useMemo(() => {
    const total = questions.length;
    const checked = questions.filter((q) => Boolean(q.resolved) && q.status !== 'failed').length;
    const flagged = questions.filter(
      (q) => (q.flags && q.flags.length > 0 && !q.resolved) || q.status === 'flagged' || q.status === 'failed'
    ).length;
    const failed = questions.filter((q) => q.status === 'failed').length;
    const allResolved = total > 0 && flagged === 0 && failed === 0 && checked === total;

    return {
      total,
      checked,
      flagged,
      failed,
      currentIndex: activeQuestionIndex >= 0 ? activeQuestionIndex + 1 : 1,
      allResolved,
    };
  }, [questions, activeQuestionIndex]);

  useEffect(() => {
    store.setReviewMetrics(metrics);
  }, [metrics, store]);

  // Navigation handlers (J / K / Arrow)
  const handleNextQuestion = useCallback(() => {
    if (questions.length === 0) return;
    const nextIdx = (activeQuestionIndex + 1) % questions.length;
    const nextQ = questions[nextIdx];
    const key = nextQ.question_key || nextQ.key;
    setActiveKey(key);
    store.setActiveQuestionKey(key);
  }, [questions, activeQuestionIndex, store]);

  const handlePrevQuestion = useCallback(() => {
    if (questions.length === 0) return;
    const prevIdx = (activeQuestionIndex - 1 + questions.length) % questions.length;
    const prevQ = questions[prevIdx];
    const key = prevQ.question_key || prevQ.key;
    setActiveKey(key);
    store.setActiveQuestionKey(key);
  }, [questions, activeQuestionIndex, store]);

  const handleNextFlagged = useCallback(() => {
    if (questions.length === 0) return;
    for (let i = 1; i <= questions.length; i++) {
      const idx = (activeQuestionIndex + i) % questions.length;
      const q = questions[idx];
      const isFlg = (q.flags && q.flags.length > 0 && !q.resolved) || q.status === 'flagged' || q.status === 'failed';
      if (isFlg) {
        const key = q.question_key || q.key;
        setActiveKey(key);
        store.setActiveQuestionKey(key);
        return;
      }
    }
  }, [questions, activeQuestionIndex, store]);

  const handleSelectQuestion = (key: string) => {
    setActiveKey(key);
    store.setActiveQuestionKey(key);
  };

  // Recheck handler with custom strictness & in-place update (Rule: Data only GET /review, replace in place)
  const handleRecheckQuestion = async (level?: number, persistOverride?: boolean) => {
    if (!activeQuestion) return;
    try {
      const res = await apiClient.post<any>(`/api/evaluations/${activeQuestion.eval_id}/recheck`, {
        edited_text: activeQuestion.ocr_text || activeQuestion.extracted_text,
        strictness: level,
        persist_override: persistOverride,
      });

      // Save previous marks for Undo
      if (res.previous_final_marks !== undefined) {
        setPreviousFinalMarksMap((prev) => ({
          ...prev,
          [activeQuestion.eval_id]: res.previous_final_marks,
        }));
      }

      // Replace this one evaluation and sheet totals in place (no full reload!)
      setReviewData((prev) => {
        if (!prev) return prev;
        const updatedQuestions = prev.questions.map((q) => {
          if (q.eval_id === activeQuestion.eval_id) {
            const evalObj = res.evaluation || res;
            return { ...q, ...evalObj };
          }
          return q;
        });
        return {
          ...prev,
          sheet: {
            ...prev.sheet,
            total_score: res.new_total ?? prev.sheet.total_score,
            percentage: res.percentage ?? prev.sheet.percentage,
            grade: res.grade ?? prev.sheet.grade,
          },
          questions: updatedQuestions,
        };
      });
    } catch (err: any) {
      store.setError({
        code: err.code || 'RECHECK_FAILED',
        message: err.message || 'Live AI recheck call failed.',
      });
      throw err;
    }
  };

  // Marks update & approve handler (in-place replacement)
  const handleMarksChange = (newMarks: number, isCounted: boolean, isResolved: boolean) => {
    if (!activeQuestion) return;
    setReviewData((prev) => {
      if (!prev) return prev;
      const updatedQuestions = prev.questions.map((q) => {
        if (q.eval_id === activeQuestion.eval_id) {
          return {
            ...q,
            final_marks: newMarks,
            is_counted: isCounted,
            resolved: isResolved ? 1 : 0,
            status: isResolved ? 'approved' : q.status,
          };
        }
        return q;
      });
      return { ...prev, questions: updatedQuestions };
    });
  };

  // Approve current question via keyboard shortcut 'A'
  const handleApproveCurrent = async () => {
    if (!activeQuestion) return;
    const currentM = activeQuestion.final_marks !== undefined ? activeQuestion.final_marks : activeQuestion.ai_marks;
    try {
      const res = await apiClient.post<any>(`/api/evaluations/${activeQuestion.eval_id}/review`, {
        teacher_marks: currentM,
        accept_ai: true,
        is_counted: activeQuestion.is_counted !== undefined ? activeQuestion.is_counted : true,
      });

      handleMarksChange(
        currentM,
        activeQuestion.is_counted !== undefined ? activeQuestion.is_counted : true,
        true
      );

      // Update sheet score in place
      if (res.new_total !== undefined) {
        setReviewData((prev) =>
          prev
            ? {
                ...prev,
                sheet: {
                  ...prev.sheet,
                  total_score: res.new_total,
                  percentage: res.percentage ?? prev.sheet.percentage,
                  grade: res.grade ?? prev.sheet.grade,
                },
              }
            : prev
        );
      }

      handleNextQuestion();
    } catch (err: any) {
      store.setError({
        code: err.code || 'APPROVE_FAILED',
        message: err.message || 'Failed to approve question.',
      });
    }
  };

  // Approve all unflagged questions
  const handleApproveAllUnflagged = async () => {
    if (!state.sheetId) return;
    try {
      await apiClient.post(`/api/sheets/${state.sheetId}/approve-unflagged`, {});
      setShowApproveAllModal(false);
      await loadReviewData();
    } catch (err: any) {
      store.setError({
        code: err.code || 'APPROVE_ALL_FAILED',
        message: err.message || 'Failed to approve unflagged questions.',
      });
    }
  };

  // Finalize sheet & proceed to Report screen
  const handleFinishAndProceedToReport = async () => {
    if (!state.sheetId) return;
    if (!metrics.allResolved) {
      handleNextFlagged();
      return;
    }

    setIsFinishing(true);
    try {
      await apiClient.post(`/api/sheets/${state.sheetId}/finish`, {});
      store.setStep('report', state.sheetId);
    } catch (err: any) {
      store.setError({
        code: err.code || 'FINISH_FAILED',
        message: err.message || 'Cannot finalize sheet with unresolved flags.',
      });
    } finally {
      setIsFinishing(false);
    }
  };

  // Register Keyboard Shortcuts (J/K next/prev, A approve, R recheck, [ toggle panel, +/- marks)
  useHotkeys({
    onNext: handleNextQuestion,
    onPrev: handlePrevQuestion,
    onApprove: handleApproveCurrent,
    onNextFlag: handleNextFlagged,
    onMarksStep: (delta) => {
      if (!activeQuestion) return;
      const currentVal = activeQuestion.final_marks !== undefined ? activeQuestion.final_marks : activeQuestion.ai_marks;
      const nextVal = Math.min(activeQuestion.max_marks, Math.max(0, currentVal + delta));
      handleMarksChange(nextVal, activeQuestion.is_counted !== undefined ? activeQuestion.is_counted : true, false);
    },
    onRecheck: () => handleRecheckQuestion(),
    onEditOcr: () => setIsEditingOcrExternal((prev) => !prev),
    onToggleSidebar: togglePanel,
    onHelp: () => setShowHelpModal((prev) => !prev),
  });

  // Listen to bottom ActionBar custom events from Shell
  useEffect(() => {
    const handleNavPrev = () => handlePrevQuestion();
    const handleNavNext = () => handleNextQuestion();
    const handleApproveAll = () => setShowApproveAllModal(true);
    const handleFinish = () => handleFinishAndProceedToReport();
    const handleHelp = () => setShowHelpModal(true);

    window.addEventListener('evaldesk:prev', handleNavPrev);
    window.addEventListener('evaldesk:next', handleNavNext);
    window.addEventListener('evaldesk:approve-all', handleApproveAll);
    window.addEventListener('evaldesk:finish', handleFinish);
    window.addEventListener('evaldesk:help', handleHelp);

    return () => {
      window.removeEventListener('evaldesk:prev', handleNavPrev);
      window.removeEventListener('evaldesk:next', handleNavNext);
      window.removeEventListener('evaldesk:approve-all', handleApproveAll);
      window.removeEventListener('evaldesk:finish', handleFinish);
      window.removeEventListener('evaldesk:help', handleHelp);
    };
  }, [handlePrevQuestion, handleNextQuestion, handleFinishAndProceedToReport]);

  const sheet = reviewData?.sheet;
  const paper = reviewData?.paper;
  const isNotAttempted =
    activeQuestion?.status === 'not_attempted' ||
    Boolean(activeQuestion?.reason?.toLowerCase().includes('not attempted')) ||
    (activeQuestion?.flags || []).some((f: any) => f.code === 'not_attempted');

  return (
    <section aria-label="Evaluation Workspace" className="h-[100dvh] max-h-[100dvh] flex flex-col min-h-0 bg-slate-50 select-none overflow-hidden">
      {/* ==================================================================== */}
      {/* 1. TOP HEADER: Paper · Student · Score/Max · Grade · Navigation · Actions */}
      {/* ==================================================================== */}
      <header className="px-4 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-900 truncate flex items-center gap-2">
              <span>{paper?.title || state.paperTitle || 'Assessment Evaluation'}</span>
              <span className="text-slate-300 font-normal">|</span>
              <span className="text-indigo-700 font-semibold truncate">
                {sheet?.student_name || state.studentName || 'Student Sheet'}
                {(sheet?.roll_number || state.rollNumber) && (
                  <span className="text-slate-500 font-mono text-[11px] ml-1">
                    ({sheet?.roll_number || state.rollNumber})
                  </span>
                )}
              </span>
            </h2>
          </div>
        </div>

        {/* Center: Score & Grade KPI Badge */}
        {sheet && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg font-mono text-xs shadow-2xs">
            <span className="text-slate-500 text-[11px]">Score:</span>
            <strong className="text-slate-900 font-bold text-sm">
              {sheet.total_score}
            </strong>
            <span className="text-slate-400">/ {sheet.max_marks} M</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded text-[10px]">
              {sheet.grade || 'Evaluated'}
            </span>
          </div>
        )}

        {/* Right: Prev/Next Sheet Navigation + Action CTAs */}
        <div className="flex items-center gap-2">
          {paperSheets.length > 1 && (
            <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={handlePrevSheet}
                disabled={currentSheetIndex <= 0}
                className="p-1 rounded text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous Student Sheet"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono px-1 font-semibold text-slate-600">
                {currentSheetIndex + 1}/{paperSheets.length}
              </span>
              <button
                type="button"
                onClick={handleNextSheet}
                disabled={currentSheetIndex >= paperSheets.length - 1}
                className="p-1 rounded text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next Student Sheet"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowApproveAllModal(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 shadow-2xs"
            title="Approve all questions without unresolved flags"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Approve All Unflagged</span>
          </button>

          <button
            type="button"
            onClick={handleFinishAndProceedToReport}
            disabled={isFinishing}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm text-white ${
              metrics.allResolved
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
            title={metrics.allResolved ? 'Finalize sheet and view report' : 'Resolve all flags before finalizing'}
          >
            {isFinishing ? (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileCheck2 className="w-3.5 h-3.5" />
            )}
            <span>{metrics.allResolved ? 'Finish & View Report' : 'Review Remaining'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* 2. MAIN BODY (2 Columns): Left = Question Details, Right = Question Panel */}
      {/* ==================================================================== */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* MAIN LEFT AREA (1fr, 2 side-by-side sub-columns): Question Details + Image on Left, OCR + Marks on Right */}
        <main className="flex-1 min-h-0 h-full p-2.5 overflow-hidden">
          {activeQuestion ? (
            <div className="grid grid-cols-2 gap-2.5 h-full min-h-0 overflow-hidden">
              {/* SUB-COLUMN 1: Selected Question Prompt on top + SheetImageViewer filling rest of height */}
              <div className="flex flex-col h-full min-h-0 overflow-hidden gap-2">
                {/* 1. Question Prompt Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-1.5 shrink-0 max-h-[35%] overflow-y-auto">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        Q.{activeQuestion.q_no}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[11px] font-medium text-slate-600 truncate max-w-[140px]">
                        {activeQuestion.section_name || 'General Section'}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs font-mono font-bold text-indigo-700">
                        {activeQuestion.max_marks} Marks
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <StrictnessChip
                        level={activeQuestion.strictness_used || activeQuestion.strictness_effective || paper?.strictness_level || 3}
                        source={activeQuestion.strictness_source}
                      />
                      <button
                        type="button"
                        onClick={() => setIsReferenceExpanded((prev) => !prev)}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                          isReferenceExpanded
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                        title="View Model Answer & Rubric Criteria"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                        <span>Rubric</span>
                      </button>
                    </div>
                  </div>

                  {/* Question Prompt Text */}
                  <div className="text-xs text-slate-800 leading-relaxed font-sans">
                    {activeQuestion.question_text || activeQuestion.text || 'Question Prompt'}
                  </div>

                  {/* MCQ Options (if any) */}
                  {activeQuestion.options && activeQuestion.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 border-t border-slate-100 text-xs">
                      {activeQuestion.options.map((opt: string, idx: number) => (
                        <div
                          key={idx}
                          className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-700 font-mono text-[10px]"
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline Reference Card Dropdown if toggled */}
                  {isReferenceExpanded && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <ReferenceCard
                        paperId={state.paperId || ''}
                        questionKey={activeQuestion.question_key || activeQuestion.key || ''}
                        reference={
                          activeQuestion.reference || {
                            model_answer: activeQuestion.model_answer || '',
                            key_points: activeQuestion.key_points || [],
                            source: 'ai_draft',
                          }
                        }
                        questionType={activeQuestion.options && activeQuestion.options.length > 0 ? 'mcq' : 'short'}
                        options={activeQuestion.options || []}
                        strictness={String(paper?.strictness_level || 3)}
                        onReferenceUpdated={loadReviewData}
                        onError={(err) => store.setError(err)}
                      />
                    </div>
                  )}
                </div>

                {/* 2. Answer Sheet Viewer: Crop (default) / Full page + box filling rest of height */}
                <div className="flex-1 min-h-0 h-full overflow-hidden">
                  <SheetImageViewer
                    sheetId={state.sheetId || ''}
                    evalId={activeQuestion.eval_id}
                    cropUrl={activeQuestion.crop_url}
                    qNo={activeQuestion.q_no}
                    pageNumbers={activeQuestion.page_numbers || [1]}
                    allPagesCount={reviewData?.pages?.length || 1}
                    bbox={activeQuestion.bbox}
                    notAttempted={isNotAttempted}
                  />
                </div>
              </div>

              {/* SUB-COLUMN 2: OCR Card on top + MarksCard filling bottom */}
              <div className="flex flex-col h-full min-h-0 overflow-hidden gap-2">
                {/* 1. OCR Text Card (editable + legibility bar + reader diff) */}
                <div className="shrink-0 max-h-[38%] flex flex-col min-h-0 overflow-hidden">
                  <OcrCard
                    evalId={activeQuestion.eval_id}
                    ocrText={activeQuestion.ocr_text || activeQuestion.extracted_text || ''}
                    evidenceQuotes={
                      activeQuestion.evidence_quote
                        ? [activeQuestion.evidence_quote]
                        : (activeQuestion.verdicts || []).map((v: any) => v.quote).filter(Boolean)
                    }
                    legibility={activeQuestion.legibility ?? activeQuestion.legibility_score ?? 0.85}
                    readerTexts={activeQuestion.reader_texts || {}}
                    isEditingExternal={isEditingOcrExternal}
                    onTextSaved={(newTxt) => {
                      setReviewData((prev) => {
                        if (!prev) return prev;
                        const updated = prev.questions.map((q) =>
                          q.eval_id === activeQuestion.eval_id
                            ? { ...q, ocr_text: newTxt, extracted_text: newTxt }
                            : q
                        );
                        return { ...prev, questions: updated };
                      });
                    }}
                    onRequestRecheck={() => handleRecheckQuestion()}
                    onError={(err) => store.setError(err)}
                  />
                </div>

                {/* 2. Marks and Why (MarksCard): marks stepper, per-point verdicts, coded flags */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <MarksCard
                    evalId={activeQuestion.eval_id}
                    maxMarks={activeQuestion.max_marks || 5}
                    aiMarks={activeQuestion.ai_marks || 0}
                    currentMarks={
                      activeQuestion.final_marks !== undefined
                        ? activeQuestion.final_marks
                        : activeQuestion.ai_marks || 0
                    }
                    isCounted={activeQuestion.is_counted !== undefined ? activeQuestion.is_counted : true}
                    isResolved={Boolean(activeQuestion.resolved)}
                    status={activeQuestion.status || (activeQuestion.flags?.length ? 'flagged' : 'pending')}
                    flags={activeQuestion.flags || []}
                    verdicts={activeQuestion.verdicts || []}
                    strictnessUsed={activeQuestion.strictness_used}
                    strictnessEffective={activeQuestion.strictness_effective || paper?.strictness_level || 3}
                    strictnessSource={activeQuestion.strictness_source}
                    previousFinalMarks={previousFinalMarksMap[activeQuestion.eval_id]}
                    errorMessage={activeQuestion.error_message}
                    onMarksChange={handleMarksChange}
                    onRecheck={(lvl, persist) => handleRecheckQuestion(lvl, persist)}
                    onError={(err) => store.setError(err)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="m-auto text-center p-8 bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
              No questions found in evaluation.
            </div>
          )}
        </main>

        {/* RIGHT COLUMN: Question Panel (Collapsible Rail with localStorage) */}
        <QuestionPanel
          questions={questions}
          activeKey={activeKey}
          isCollapsed={isPanelCollapsed}
          onToggleCollapse={togglePanel}
          onSelectQuestion={handleSelectQuestion}
        />
      </div>

      {/* Confirmation Modal for "Approve All Unflagged" */}
      {showApproveAllModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-3">
            <h4 className="text-sm font-bold text-slate-900">
              Approve All Unflagged Questions?
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will accept the AI suggestions for all unflagged questions that have not yet been manually approved. Flagged questions will remain open for your inspection.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveAllModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveAllUnflagged}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
              >
                Approve Unflagged
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shortcut Help Modal Overlay */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Keyboard Shortcuts
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { key: 'J / ↓ / →', desc: 'Next question' },
                { key: 'K / ↑ / ←', desc: 'Previous question' },
                { key: 'A', desc: 'Approve current question' },
                { key: 'F', desc: 'Jump to next flagged question' },
                { key: '+ / -', desc: 'Marks +0.5 / -0.5' },
                { key: 'R', desc: 'Recheck evaluation with AI' },
                { key: 'E', desc: 'Edit extracted OCR text' },
                { key: '[', desc: 'Toggle question panel collapse' },
                { key: '?', desc: 'Show this shortcut list' },
              ].map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50"
                >
                  <span className="text-slate-600">{s.desc}</span>
                  <kbd className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] font-bold text-slate-800">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>

            <p className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              Shortcuts are automatically disabled while typing in any text input.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
