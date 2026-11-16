import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { useHotkeys } from '../hooks/useHotkeys';
import { QuestionSidebar, ReviewQuestionItem } from '../components/QuestionSidebar';
import { SheetViewer } from '../components/SheetViewer';
import { OcrCard } from '../components/OcrCard';
import { ReferenceCard } from '../components/ReferenceCard';
import { MarksCard } from '../components/MarksCard';
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
} from 'lucide-react';

interface ReviewResponse {
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
    strictness?: string;
  };
  sections: Array<{
    id: string;
    name: string;
    attempt_n: number;
    marks_each: number;
  }>;
  pages: Array<{ page_number: number; file_path: string }>;
  questions: ReviewQuestionItem[];
  all_resolved: boolean;
}

export const EvaluateScreen: React.FC = () => {
  const [state, store] = useSheetStore();

  const [reviewData, setReviewData] = useState<ReviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [isEditingOcrExternal, setIsEditingOcrExternal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showApproveAllModal, setShowApproveAllModal] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // 1. Fetch Review Data from GET /api/sheets/{id}/review
  const loadReviewData = useCallback(async () => {
    if (!state.sheetId) return;
    setIsLoading(true);
    try {
      const data = await apiClient.get<ReviewResponse>(`/api/sheets/${state.sheetId}/review`);
      setReviewData(data);

      const qList = data.questions || [];
      if (qList.length > 0) {
        // Retain current question if valid, or select the first question
        const currentValid = qList.find(
          (q) => (q.question_key || q.key) === (state.activeQuestionKey || activeKey)
        );
        const targetQ = currentValid || qList[0];
        const targetKey = targetQ.question_key || targetQ.key;
        setActiveKey(targetKey);
        store.setActiveQuestionKey(targetKey);

        // Jump viewer to the answer's primary page if available
        if (targetQ.page_numbers && targetQ.page_numbers.length > 0) {
          setActivePage(targetQ.page_numbers[0]);
        }
      }

      // Update paper title & student details in global store
      if (data.paper) {
        store.setPaper({
          id: data.paper.id,
          title: data.paper.title,
          totalMarks: data.paper.total_marks,
          questionCount: qList.length,
          isLocked: true,
        });
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

  const activeQuestion: ReviewQuestionItem | null =
    activeQuestionIndex >= 0 ? questions[activeQuestionIndex] : null;

  // Jump viewer to active question's page whenever activeQuestion changes
  useEffect(() => {
    if (activeQuestion?.page_numbers && activeQuestion.page_numbers.length > 0) {
      setActivePage(activeQuestion.page_numbers[0]);
    }
  }, [activeQuestion?.question_key, activeQuestion?.key]);

  // Compute Review Metrics & sync with store
  const metrics = useMemo(() => {
    const total = questions.length;
    const checked = questions.filter((q) => Boolean(q.resolved) && q.status !== 'failed').length;
    const flagged = questions.filter(
      (q) => (q.flags && q.flags.length > 0 && !q.resolved) || q.status === 'flagged'
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

  // Navigation handlers
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
    // Find next flagged question starting from current index + 1
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

  // Question selection handler from sidebar
  const handleSelectQuestion = (key: string) => {
    setActiveKey(key);
    store.setActiveQuestionKey(key);
    const q = questions.find((item) => (item.question_key || item.key) === key);
    if (q?.page_numbers && q.page_numbers.length > 0) {
      setActivePage(q.page_numbers[0]);
    }
  };

  // Live AI Recheck handler for active question
  const handleRecheckActiveQuestion = async () => {
    if (!activeQuestion) return;
    try {
      await apiClient.post(`/api/evaluations/${activeQuestion.eval_id}/recheck`, {
        edited_text: activeQuestion.ocr_text || activeQuestion.extracted_text,
      });
      await loadReviewData();
    } catch (err: any) {
      store.setError({
        code: err.code || 'RECHECK_FAILED',
        message: err.message || 'Live AI recheck call failed.',
      });
      throw err;
    }
  };

  // Marks update & approve handler
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
            status: isResolved ? ('approved' as const) : q.status,
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
    try {
      await apiClient.post(`/api/evaluations/${activeQuestion.eval_id}/review`, {
        teacher_marks: activeQuestion.final_marks !== undefined ? activeQuestion.final_marks : activeQuestion.ai_marks,
        accept_ai: true,
        is_counted: activeQuestion.is_counted !== undefined ? activeQuestion.is_counted : true,
      });
      handleMarksChange(
        activeQuestion.final_marks !== undefined ? activeQuestion.final_marks : activeQuestion.ai_marks,
        activeQuestion.is_counted !== undefined ? activeQuestion.is_counted : true,
        true
      );
      // Advance to next question automatically
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

  // Register Keyboard Shortcuts
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
    onRecheck: handleRecheckActiveQuestion,
    onEditOcr: () => setIsEditingOcrExternal((prev) => !prev),
    onToggleSidebar: () => store.toggleSidebar(),
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

  const pageCount = reviewData?.pages ? reviewData.pages.length : 1;
  const bbox = activeQuestion?.bbox || null;
  const isNotAttempted =
    Boolean(activeQuestion?.reason?.includes('not attempted')) ||
    (activeQuestion?.flags || []).some((f) => f.code === 'not_attempted');
  const continuesPage =
    activeQuestion?.page_numbers && activeQuestion.page_numbers.length > 1
      ? activeQuestion.page_numbers[1]
      : null;

  return (
    <div className="h-full flex flex-col min-h-0 relative select-none">
      {/* 3-Pane Zero-Scroll Layout */}
      <div
        className={`flex-1 grid min-h-0 transition-all duration-200 ${
          state.isSidebarCollapsed
            ? 'grid-cols-[56px_1fr_420px] 2xl:grid-cols-[56px_1fr_420px]'
            : 'grid-cols-[280px_1fr_380px] 2xl:grid-cols-[280px_1fr_420px]'
        }`}
      >
        {/* Pane 1 (Left): Question Sidebar */}
        <QuestionSidebar
          questions={questions}
          activeKey={activeKey}
          isCollapsed={state.isSidebarCollapsed}
          onToggleCollapse={() => store.toggleSidebar()}
          onSelectQuestion={handleSelectQuestion}
        />

        {/* Pane 2 (Centre): Fixed Sheet Viewer */}
        <SheetViewer
          sheetId={state.sheetId || ''}
          pageCount={pageCount}
          currentPage={activePage}
          onPageChange={setActivePage}
          bbox={bbox}
          continuesPage={continuesPage}
          notAttempted={isNotAttempted}
        />

        {/* Pane 3 (Right): Three Stacked Evaluation Cards */}
        <section
          aria-label="Evaluation Details"
          className="border-l border-[var(--surface-border)] bg-[var(--surface-card)] flex flex-col min-h-0 h-full p-2.5 gap-2.5 overflow-hidden"
        >
          {/* Card 1: OCR Detected (~35% height) */}
          <div className="flex-[35] min-h-0">
            <OcrCard
              evalId={activeQuestion?.eval_id || ''}
              ocrText={activeQuestion?.ocr_text || activeQuestion?.extracted_text || ''}
              evidenceQuotes={
                activeQuestion?.evidence_quote
                  ? [activeQuestion.evidence_quote]
                  : (activeQuestion?.key_point_verdicts || []).map((v) => v.quote)
              }
              legibility={activeQuestion?.legibility || activeQuestion?.legibility_score || 0.85}
              readerTexts={activeQuestion?.reader_texts || {}}
              isEditingExternal={isEditingOcrExternal}
              onTextSaved={(newTxt) => {
                if (!activeQuestion) return;
                setReviewData((prev) => {
                  if (!prev) return prev;
                  const updatedQuestions = prev.questions.map((q) =>
                    q.eval_id === activeQuestion.eval_id
                      ? { ...q, ocr_text: newTxt, extracted_text: newTxt }
                      : q
                  );
                  return { ...prev, questions: updatedQuestions };
                });
              }}
              onRequestRecheck={handleRecheckActiveQuestion}
              onError={(err) => store.setError(err)}
            />
          </div>

          {/* Card 2: Reference (~30% height) */}
          <div className="flex-[30] min-h-0">
            <ReferenceCard
              paperId={state.paperId || ''}
              questionKey={activeQuestion?.question_key || activeQuestion?.key || ''}
              reference={
                activeQuestion?.reference || {
                  model_answer: activeQuestion?.model_answer || '',
                  key_points: activeQuestion?.key_points || [],
                  source: 'ai_draft',
                }
              }
              questionType={activeQuestion?.options && activeQuestion.options.length > 0 ? 'mcq' : 'short'}
              options={activeQuestion?.options || []}
              strictness={reviewData?.paper?.strictness || 'lenient'}
              onReferenceUpdated={loadReviewData}
              onError={(err) => store.setError(err)}
            />
          </div>

          {/* Card 3: Marks & Evidence (~35% height) */}
          <div className="flex-[35] min-h-0">
            <MarksCard
              evalId={activeQuestion?.eval_id || ''}
              maxMarks={activeQuestion?.max_marks || 5}
              aiMarks={activeQuestion?.ai_marks || 0}
              currentMarks={
                activeQuestion?.final_marks !== undefined
                  ? activeQuestion.final_marks
                  : activeQuestion?.ai_marks || 0
              }
              isCounted={activeQuestion?.is_counted !== undefined ? activeQuestion.is_counted : true}
              isResolved={Boolean(activeQuestion?.resolved)}
              status={activeQuestion?.status || 'pending'}
              flags={activeQuestion?.flags || []}
              keyPointVerdicts={activeQuestion?.key_point_verdicts || []}
              errorMessage={activeQuestion?.error_message}
              onMarksChange={handleMarksChange}
              onRecheck={handleRecheckActiveQuestion}
              onError={(err) => store.setError(err)}
            />
          </div>
        </section>
      </div>

      {/* Confirmation Modal for "Approve All Unflagged" */}
      {showApproveAllModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-lg p-5 max-w-sm w-full shadow-xl">
            <h4 className="text-sm font-bold text-[var(--ink-primary)] mb-2">
              Approve All Unflagged Questions?
            </h4>
            <p className="text-xs text-[var(--ink-secondary)] mb-4 leading-relaxed">
              This will accept the AI suggestions for all unflagged questions that have not yet been manually approved. Flagged questions will remain open for your inspection.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowApproveAllModal(false)}
                className="px-3 py-1.5 text-xs rounded border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] text-[var(--ink-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveAllUnflagged}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-[var(--status-approved)] text-white hover:opacity-90"
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
          <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)] mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[var(--accent-indigo)]" />
                <h3 className="text-sm font-bold text-[var(--ink-primary)]">
                  Keyboard Shortcuts
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { key: '→ / ←', desc: 'Next / previous question' },
                { key: 'A', desc: 'Approve current question' },
                { key: 'F', desc: 'Jump to next flagged question' },
                { key: '+ / -', desc: 'Marks +0.5 / -0.5' },
                { key: 'R', desc: 'Recheck evaluation with AI' },
                { key: 'E', desc: 'Edit extracted OCR text' },
                { key: '[', desc: 'Toggle question sidebar collapse' },
                { key: '?', desc: 'Show this shortcut list' },
              ].map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 rounded hover:bg-[var(--surface-subtle)]"
                >
                  <span className="text-[var(--ink-secondary)]">{s.desc}</span>
                  <kbd className="px-2 py-0.5 rounded bg-[var(--surface-subtle)] border border-[var(--surface-border)] font-mono text-[11px] font-bold">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>

            <p className="mt-4 pt-3 border-t border-[var(--surface-border)] text-[11px] text-[var(--ink-muted)]">
              Shortcuts are automatically disabled while typing in any text input or editable box.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
