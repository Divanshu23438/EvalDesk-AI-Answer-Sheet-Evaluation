import React, { useState, useEffect, useCallback } from 'react';
import {
  Check,
  Dot,
  Circle,
  X,
  RefreshCw,
  Clock,
  ArrowRight,
  FileText,
  AlertTriangle,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { StatusChip, StatusType } from '../components/StatusChip';

interface SheetStatusResponse {
  id: string;
  paper_id: string;
  student_name: string;
  roll_number: string;
  status: string;
  current_stage: string;
  pages_read: number;
  pages_total: number;
  questions_marked: number;
  questions_total: number;
  failed_stage: string | null;
  error_message: string | null;
  retry_at: string | null;
  history: Array<{ stage: string; at: string }>;
}

interface BatchSheetItem {
  id: string;
  filename: string;
  student_name: string;
  roll: string;
  status: string;
  stage: string;
  page_count: number;
  flags_open: number;
}

export const ProcessingScreen: React.FC = () => {
  const [state, store] = useSheetStore();

  // Batch sheet list for left selector
  const [batchSheets, setBatchSheets] = useState<BatchSheetItem[]>([]);
  const [activeSheet, setActiveSheet] = useState<SheetStatusResponse | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  // Identity form state if needs_identity
  const [nameInput, setNameInput] = useState('');
  const [rollInput, setRollInput] = useState('');
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);

  // Retry state
  const [isRetrying, setIsRetrying] = useState(false);

  // Quota countdown
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  // 1. Fetch batch sheets list for paper
  const loadBatchSheets = useCallback(async () => {
    if (!state.paperId) return;
    try {
      const data = await apiClient.get<{ sheets: BatchSheetItem[] }>(
        `/api/papers/${state.paperId}/sheets`
      );
      const list = data.sheets || [];
      setBatchSheets(list);

      // If no active sheetId in store, pick the first sheet from batch
      if (!state.sheetId && list.length > 0) {
        store.setSheet(list[0].id, list[0].student_name, list[0].roll);
      }
    } catch {
      // Non-fatal batch list failure
    }
  }, [state.paperId, state.sheetId, store]);

  useEffect(() => {
    loadBatchSheets();
  }, [loadBatchSheets]);

  // 2. Poll active sheet status every 1 second (no poll limit, stops only on terminal status or unmount)
  const pollActiveSheet = useCallback(async () => {
    if (!state.sheetId) return;

    try {
      const data = await apiClient.get<SheetStatusResponse>(`/api/sheets/${state.sheetId}`);
      setActiveSheet(data);

      // Populate identity inputs if empty
      if (data.student_name && !nameInput) setNameInput(data.student_name);
      if (data.roll_number && !rollInput) setRollInput(data.roll_number);

      // Check quota retry_at
      if (data.retry_at) {
        const retryTime = new Date(data.retry_at).getTime();
        const diffSecs = Math.max(0, Math.ceil((retryTime - Date.now()) / 1000));
        setCountdownSeconds(diffSecs);
      } else {
        setCountdownSeconds(null);
      }

      // Auto-advance to evaluate if terminal successful state reached
      if (data.status === 'needs_review' || data.status === 'evaluated') {
        setIsPolling(false);
        // Seamlessly update store and auto-advance
        store.setSheet(data.id, data.student_name, data.roll_number);
        // Small delay so user sees full completion before routing
        const timer = setTimeout(() => {
          store.setStep('evaluate', data.id);
        }, 1200);
        return () => clearTimeout(timer);
      }

      if (data.status === 'failed') {
        setIsPolling(false);
      }
    } catch (err: any) {
      // If error occurs, keep attempting or surface if persistent
    }
  }, [state.sheetId, nameInput, rollInput, store]);

  useEffect(() => {
    setIsPolling(true);
    pollActiveSheet();

    const interval = setInterval(() => {
      if (isPolling) {
        pollActiveSheet();
        loadBatchSheets();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [pollActiveSheet, loadBatchSheets, isPolling]);

  // Quota Countdown timer decrement
  useEffect(() => {
    if (countdownSeconds === null || countdownSeconds <= 0) return;
    const t = setInterval(() => {
      setCountdownSeconds((prev) => (prev && prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [countdownSeconds]);

  // Handle saving identity inline
  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !rollInput.trim() || !state.sheetId) return;

    setIsSavingIdentity(true);
    try {
      await apiClient.post(`/api/sheets/${state.sheetId}/identity`, {
        student_name: nameInput.trim(),
        roll_number: rollInput.trim(),
      });
      setIsPolling(true);
      await pollActiveSheet();
      await loadBatchSheets();
    } catch (err: any) {
      store.setError({
        code: err.code || 'IDENTITY_SAVE_FAILED',
        message: err.message || 'Failed to save student identity.',
      });
    } finally {
      setIsSavingIdentity(false);
    }
  };

  // Handle Retry on failure
  const handleRetry = async () => {
    if (!state.sheetId) return;
    setIsRetrying(true);
    try {
      await apiClient.post(`/api/sheets/${state.sheetId}/retry`, {});
      setIsPolling(true);
      await pollActiveSheet();
      await loadBatchSheets();
    } catch (err: any) {
      store.setError({
        code: err.code || 'RETRY_FAILED',
        message: err.message || 'Failed to retry evaluation.',
      });
    } finally {
      setIsRetrying(false);
    }
  };

  // Determine stage progression
  const currentStatus = activeSheet?.status || 'queued';
  const isFailed = currentStatus === 'failed';
  const isNeedsIdentity = currentStatus === 'needs_identity';

  interface StageDef {
    key: string;
    label: string;
    stageIndex: number;
  }

  const STAGES: StageDef[] = [
    { key: 'reading_identity', label: 'Reading name', stageIndex: 1 },
    { key: 'reading', label: 'Reading pages', stageIndex: 2 },
    { key: 'matching', label: 'Matching', stageIndex: 3 },
    { key: 'marking', label: 'Marking', stageIndex: 4 },
    { key: 'flagging', label: 'Flagging', stageIndex: 5 },
  ];

  const getStageCurrentIndex = (status: string): number => {
    switch (status) {
      case 'uploaded':
      case 'queued':
        return 0;
      case 'reading_identity':
        return 1;
      case 'reading':
        return 2;
      case 'matching':
        return 3;
      case 'marking':
        return 4;
      case 'flagging':
        return 5;
      case 'needs_review':
      case 'evaluated':
        return 6;
      default:
        return 1;
    }
  };

  const activeStageIdx = getStageCurrentIndex(currentStatus);

  const getStageStatus = (stage: StageDef) => {
    if (isFailed && activeSheet?.failed_stage === stage.key) {
      return 'failed';
    }
    if (activeStageIdx > stage.stageIndex) {
      return 'completed';
    }
    if (activeStageIdx === stage.stageIndex) {
      return isFailed ? 'failed' : 'active';
    }
    return 'pending';
  };

  const pagesRead = activeSheet?.pages_read || 0;
  const pagesTotal = activeSheet?.pages_total || 1;
  const questionsMarked = activeSheet?.questions_marked || 0;
  const questionsTotal = activeSheet?.questions_total || 0;

  // Has marking started?
  const markingStarted =
    activeStageIdx >= 4 ||
    questionsMarked > 0 ||
    ['marking', 'flagging', 'needs_review', 'evaluated'].includes(currentStatus);

  return (
    <div className="panel grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 p-4 h-full min-h-0">
      {/* LEFT COLUMN: Slim Multi-Sheet Selector List */}
      <aside
        aria-label="Batch Sheets List"
        className="flex flex-col border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)] p-3 min-h-0 h-full"
      >
        <div className="flex items-center justify-between pb-2 border-b border-[var(--surface-border)] mb-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[var(--accent-indigo)]" />
            <span className="text-xs font-semibold text-[var(--ink-primary)]">Batch Sheets</span>
          </div>
          <span className="text-[11px] text-[var(--ink-muted)] tabular-nums">
            {batchSheets.length}
          </span>
        </div>

        <div className="panel flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {batchSheets.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--ink-muted)]">
              No sheets in this batch.
            </div>
          ) : (
            batchSheets.map((s) => {
              const isSelected = s.id === state.sheetId;
              const isDone = s.status === 'evaluated' || s.status === 'needs_review';
              const isCurr = ['reading_identity', 'reading', 'matching', 'marking', 'flagging'].includes(
                s.status
              );

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    store.setSheet(s.id, s.student_name, s.roll);
                  }}
                  className={`w-full text-left p-2 rounded-md border text-xs transition flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo-subtle)]/30 font-medium'
                      : 'border-[var(--surface-border)] bg-[var(--surface-subtle)]/50 hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[var(--ink-primary)] font-medium">
                      {s.student_name || s.filename}
                    </p>
                    <p className="text-[10px] text-[var(--ink-muted)] truncate">
                      {s.roll ? `Roll ${s.roll} · ` : ''}
                      {s.page_count}p
                    </p>
                  </div>

                  <div className="shrink-0">
                    {isDone ? (
                      <span className="w-5 h-5 rounded-full bg-[var(--status-approved-bg)] text-[var(--status-approved)] flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : s.status === 'failed' ? (
                      <span className="w-5 h-5 rounded-full bg-[var(--status-failed-bg)] text-[var(--status-failed)] flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </span>
                    ) : isCurr ? (
                      <span className="w-5 h-5 rounded-full bg-[var(--accent-indigo-subtle)] text-[var(--accent-indigo)] flex items-center justify-center animate-pulse">
                        <Dot className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-[var(--surface-subtle)] text-[var(--ink-muted)] flex items-center justify-center">
                        <Circle className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT COLUMN: Real-Time Stage Tracker & Scan-Line Animation */}
      <section
        aria-label="Processing View"
        className="flex flex-col items-center justify-center border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)] p-6 min-h-0 h-full relative"
      >
        <div className="max-w-xl w-full flex flex-col items-center text-center">
          {/* Quota Wait Alert Banner */}
          {countdownSeconds !== null && countdownSeconds > 0 && (
            <div className="w-full mb-4 p-3 rounded-lg bg-[var(--status-flagged-bg)] border border-[var(--status-flagged-border)] text-xs text-[var(--status-flagged)] flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 animate-spin" />
              <span>
                Quota reached, continuing automatically in{' '}
                <strong className="tabular-nums">{countdownSeconds}s</strong>
              </span>
            </div>
          )}

          {/* Page Thumbnail with 1.6s CSS Gradient Scan-Line Sweep */}
          <div className="relative w-32 h-44 rounded-lg border-2 border-[var(--surface-border)] bg-[var(--surface-subtle)] overflow-hidden shadow-sm mb-6 flex items-center justify-center">
            {state.sheetId ? (
              <img
                src={`/api/sheets/${state.sheetId}/pages/1/image`}
                alt="Processing scan preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <FileText className="w-10 h-10 text-[var(--ink-muted)]" />
            )}

            {/* Scan-Line Sweep (Active only when running, stopped on failure) */}
            {!isFailed && !isNeedsIdentity && currentStatus !== 'evaluated' && (
              <div className="scanline-sweep" aria-hidden="true" />
            )}

            {/* Failed Overlay */}
            {isFailed && (
              <div className="absolute inset-0 bg-[var(--status-failed-bg)]/80 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-[var(--status-failed)]">
                <X className="w-8 h-8 mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Halted</span>
              </div>
            )}
          </div>

          {/* Student Info / Sheet ID */}
          <h2 className="text-base font-semibold text-[var(--ink-primary)] mb-1">
            {activeSheet?.student_name ? activeSheet.student_name : 'Processing Answer Sheet'}
          </h2>
          <p className="text-xs text-[var(--ink-muted)] mb-5 tabular-nums">
            {activeSheet?.roll_number ? `Roll No: ${activeSheet.roll_number} · ` : ''}
            {state.sheetId ? `Sheet ID: ${state.sheetId.slice(0, 8)}...` : ''}
          </p>

          {/* Inline Name/Roll form if needs_identity */}
          {isNeedsIdentity ? (
            <div className="w-full max-w-sm mb-6 p-4 rounded-lg bg-[var(--status-flagged-bg)] border border-[var(--status-flagged-border)] text-left">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[var(--status-flagged)]">
                <AlertTriangle className="w-4 h-4" />
                <span>Student Identity Required</span>
              </div>
              <p className="text-[11px] text-[var(--ink-secondary)] mb-3">
                Could not read student details with high confidence. Enter name and roll number to continue:
              </p>
              <form onSubmit={handleSaveIdentity} className="space-y-2">
                <input
                  type="text"
                  placeholder="Student Full Name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--ink-primary)]"
                  required
                />
                <input
                  type="text"
                  placeholder="Roll Number"
                  value={rollInput}
                  onChange={(e) => setRollInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--ink-primary)]"
                  required
                />
                <button
                  type="submit"
                  disabled={isSavingIdentity}
                  className="w-full py-1.5 text-xs font-semibold rounded bg-[var(--accent-indigo)] text-white hover:bg-[var(--accent-indigo-hover)] disabled:opacity-50 transition"
                >
                  {isSavingIdentity ? 'Saving & Queuing...' : 'Save & Resume Evaluation'}
                </button>
              </form>
            </div>
          ) : (
            /* Live Stage Pipeline Strip */
            <div className="w-full flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-6">
              {STAGES.map((st, idx) => {
                const sStatus = getStageStatus(st);
                return (
                  <React.Fragment key={st.key}>
                    {idx > 0 && (
                      <span className="text-[var(--ink-faint)] text-xs font-light px-0.5">→</span>
                    )}
                    <div
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        sStatus === 'completed'
                          ? 'bg-[var(--status-approved-bg)] border-[var(--status-approved-border)] text-[var(--status-approved)]'
                          : sStatus === 'active'
                          ? 'bg-[var(--accent-indigo-subtle)] border-[var(--accent-indigo-border)] text-[var(--accent-indigo)] shadow-xs animate-pulse'
                          : sStatus === 'failed'
                          ? 'bg-[var(--status-failed-bg)] border-[var(--status-failed-border)] text-[var(--status-failed)] font-semibold'
                          : 'bg-[var(--surface-subtle)] border-[var(--surface-border)] text-[var(--ink-muted)]'
                      }`}
                    >
                      {sStatus === 'completed' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : sStatus === 'active' ? (
                        <Dot className="w-4 h-4 animate-ping" />
                      ) : sStatus === 'failed' ? (
                        <X className="w-3.5 h-3.5" />
                      ) : (
                        <Circle className="w-2.5 h-2.5" />
                      )}
                      <span>
                        {st.label}
                        {st.key === 'reading' && sStatus === 'active' && pagesTotal > 0
                          ? ` (${pagesRead}/${pagesTotal})`
                          : ''}
                        {st.key === 'marking' && sStatus === 'active' && questionsTotal > 0
                          ? ` (${questionsMarked}/${questionsTotal})`
                          : ''}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Current Stage Description */}
          <p className="text-xs text-[var(--ink-secondary)] mb-6 font-medium">
            {activeSheet?.current_stage || 'Preparing evaluation pipeline...'}
          </p>

          {/* Failure message & Retry button */}
          {isFailed && (
            <div className="w-full max-w-md p-3 mb-6 rounded-lg bg-[var(--status-failed-bg)] border border-[var(--status-failed-border)] text-xs text-[var(--status-failed)] flex items-center justify-between gap-3">
              <div className="text-left">
                <p className="font-semibold">Processing Failed</p>
                <p className="text-[11px] mt-0.5">{activeSheet?.error_message || 'Evaluation error'}</p>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-white text-[var(--status-failed)] border border-[var(--status-failed-border)] hover:bg-[var(--status-failed-bg)] disabled:opacity-50 transition flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry
              </button>
            </div>
          )}

          {/* "Open first reviewed question" button (appears at marking) */}
          {markingStarted && !isFailed && (
            <button
              type="button"
              onClick={() => {
                if (state.sheetId) {
                  store.setStep('evaluate', state.sheetId);
                }
              }}
              className="px-4 py-2 rounded-md bg-[var(--accent-indigo)] text-white text-xs font-semibold hover:bg-[var(--accent-indigo-hover)] transition flex items-center gap-2 shadow-sm animate-fade-in"
            >
              <span>Open first reviewed question</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
