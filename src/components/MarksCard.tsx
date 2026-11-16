import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  Minus,
  Check,
  RotateCcw,
  AlertCircle,
  Flag,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { apiClient } from '../api/client';

export interface KeyPointVerdict {
  point: string;
  verdict: 'full' | 'partial' | 'none';
  quote: string;
}

interface MarksCardProps {
  evalId: string;
  maxMarks: number;
  aiMarks: number;
  currentMarks: number;
  isCounted?: boolean;
  isResolved?: boolean;
  status: 'approved' | 'flagged' | 'pending' | 'failed';
  flags?: Array<{ code: string; message: string }>;
  keyPointVerdicts?: KeyPointVerdict[];
  errorMessage?: string | null;
  onMarksChange?: (newMarks: number, isCounted: boolean, isResolved: boolean) => void;
  onRecheck?: () => Promise<void>;
  onError?: (err: { code: string; message: string }) => void;
}

export const MarksCard: React.FC<MarksCardProps> = ({
  evalId,
  maxMarks,
  aiMarks,
  currentMarks,
  isCounted = true,
  isResolved = false,
  status,
  flags = [],
  keyPointVerdicts = [],
  errorMessage,
  onMarksChange,
  onRecheck,
  onError,
}) => {
  const [marks, setMarks] = useState(currentMarks !== undefined ? currentMarks : aiMarks);
  const [counted, setCounted] = useState(isCounted);
  const [isSaving, setIsSaving] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);

  useEffect(() => {
    setMarks(currentMarks !== undefined ? currentMarks : aiMarks);
  }, [currentMarks, aiMarks]);

  useEffect(() => {
    setCounted(isCounted);
  }, [isCounted]);

  const isFailed = status === 'failed';
  const hasChangedMarks = Math.abs(marks - aiMarks) > 0.001;

  const handleStepMarks = (delta: number) => {
    const nextVal = Math.min(maxMarks, Math.max(0, marks + delta));
    setMarks(nextVal);
  };

  const handleApprove = async () => {
    setIsSaving(true);
    try {
      await apiClient.post(`/api/evaluations/${evalId}/review`, {
        teacher_marks: marks,
        accept_ai: !hasChangedMarks,
        is_counted: counted,
      });
      onMarksChange?.(marks, counted, true);
    } catch (err: any) {
      onError?.({
        code: err.code || 'APPROVE_FAILED',
        message: err.message || 'Failed to approve evaluation.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerRecheck = async () => {
    if (!onRecheck) return;
    setIsRechecking(true);
    try {
      await onRecheck();
    } catch (err: any) {
      onError?.({
        code: err.code || 'RECHECK_FAILED',
        message: err.message || 'Live AI recheck failed.',
      });
    } finally {
      setIsRechecking(false);
    }
  };

  return (
    <div className="border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)] flex flex-col min-h-0 h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-[var(--surface-canvas)] border-b border-[var(--surface-border)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Award className="w-3.5 h-3.5 text-[var(--accent-indigo)]" />
          <h4 className="text-xs font-semibold text-[var(--ink-primary)] uppercase tracking-wider">
            3. Marks & Evidence
          </h4>
        </div>

        {/* Counted in Total Score Toggle */}
        <button
          type="button"
          onClick={() => {
            const nextCounted = !counted;
            setCounted(nextCounted);
            onMarksChange?.(marks, nextCounted, isResolved);
          }}
          className="flex items-center gap-1 text-[11px] font-medium text-[var(--ink-secondary)] hover:text-[var(--accent-indigo)]"
          title="Toggle whether this question counts toward final paper score (Section Choice Rules)"
        >
          {counted ? (
            <ToggleRight className="w-4 h-4 text-[var(--status-approved)]" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-[var(--ink-muted)]" />
          )}
          <span>{counted ? 'Counted' : 'Not Counted'}</span>
        </button>
      </div>

      {/* Card Content: Stepper, Verdicts, Flags */}
      <div className="panel flex-1 p-3 overflow-y-auto space-y-3 text-xs">
        {/* Recheck Skeleton Overlay if rechecking */}
        {isRechecking ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-xs text-[var(--accent-indigo)]">
            <Sparkles className="w-6 h-6 animate-spin mb-2" />
            <p className="font-semibold">Rechecking evaluation with AI...</p>
            <p className="text-[11px] text-[var(--ink-muted)]">Verifying rubric criteria and evidence quotes</p>
          </div>
        ) : isFailed ? (
          /* Failed Question Display */
          <div className="p-3 rounded-lg bg-[var(--status-failed-bg)] border border-[var(--status-failed-border)] text-[var(--status-failed)] space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>Evaluation Execution Failed</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {errorMessage || 'The AI marking model encountered an error evaluating this question.'}
            </p>
            <p className="text-[10px] text-[var(--ink-muted)] italic">
              Use Retry below or enter manual marks to resolve.
            </p>
          </div>
        ) : (
          <>
            {/* Marks Stepper Row */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-canvas)]">
              <div>
                <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider block">
                  Score Awarded:
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-bold tabular-nums text-[var(--ink-primary)]">
                    {marks}
                  </span>
                  <span className="text-xs text-[var(--ink-muted)] tabular-nums">
                    / {maxMarks} Marks
                  </span>
                  {hasChangedMarks && (
                    <span className="text-[11px] text-[var(--status-flagged)] font-semibold ml-2">
                      (AI suggested {aiMarks})
                    </span>
                  )}
                </div>
              </div>

              {/* Stepper Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStepMarks(-0.5)}
                  disabled={marks <= 0}
                  className="w-7 h-7 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-[var(--ink-primary)] transition"
                  title="Minus 0.5 Mark (-)"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStepMarks(0.5)}
                  disabled={marks >= maxMarks}
                  className="w-7 h-7 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-[var(--ink-primary)] transition"
                  title="Plus 0.5 Mark (+)"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Plain-English Flags */}
            {flags.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[var(--status-flagged)] uppercase tracking-wider block">
                  Attention Required:
                </span>
                {flags.map((flg, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-[var(--status-flagged-bg)] border border-[var(--status-flagged-border)] text-[11px] text-[var(--status-flagged)] flex items-start gap-1.5"
                  >
                    <Flag className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{flg.message || flg.code}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Key Point Verdicts with Quotes */}
            {keyPointVerdicts.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wider block mb-1.5">
                  Rubric Point Verdicts:
                </span>
                <div className="space-y-1.5">
                  {keyPointVerdicts.map((v, i) => {
                    const isFull = v.verdict === 'full';
                    const isPartial = v.verdict === 'partial';
                    return (
                      <div
                        key={i}
                        className="p-2 rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[11px] space-y-1"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-medium text-[var(--ink-primary)]">
                            {v.point}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 ${
                              isFull
                                ? 'bg-[var(--status-approved-bg)] text-[var(--status-approved)]'
                                : isPartial
                                ? 'bg-[var(--status-flagged-bg)] text-[var(--status-flagged)]'
                                : 'bg-[var(--status-failed-bg)] text-[var(--status-failed)]'
                            }`}
                          >
                            {v.verdict}
                          </span>
                        </div>
                        {v.quote && (
                          <div className="text-[10px] text-[var(--ink-muted)] italic font-mono bg-[var(--surface-subtle)] p-1 rounded">
                            "{v.quote}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Card Footer: Recheck & Approve Buttons */}
      <div className="px-3 py-2 bg-[var(--surface-canvas)] border-t border-[var(--surface-border)] flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={handleTriggerRecheck}
          disabled={isRechecking || isSaving}
          className="px-2.5 py-1.5 text-xs font-medium rounded border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] text-[var(--ink-secondary)] disabled:opacity-40 transition flex items-center gap-1.5"
          title="Recheck question with AI (R)"
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-indigo)]" />
          <span>Recheck</span>
        </button>

        <button
          type="button"
          onClick={handleApprove}
          disabled={isSaving || (isFailed && !hasChangedMarks)}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded text-white transition flex items-center gap-1.5 shadow-sm disabled:opacity-40 ${
            isResolved
              ? 'bg-[var(--status-approved)] hover:opacity-90'
              : 'bg-[var(--accent-indigo)] hover:bg-[var(--accent-indigo-hover)]'
          }`}
          title="Approve marks for this question (A)"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{isResolved ? 'Approved ✓' : 'Approve'}</span>
        </button>
      </div>
    </div>
  );
};
