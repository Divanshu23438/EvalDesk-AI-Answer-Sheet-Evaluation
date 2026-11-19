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
import { StrictnessChip } from './StrictnessChip';
import { RecheckPopover } from './RecheckPopover';

export interface KeyPointVerdict {
  point?: string;
  text?: string;
  verdict: 'full' | 'partial' | 'none';
  quote?: string;
  marks_available?: number;
  marks_awarded?: number;
  reason?: string;
}

export interface MarksCardProps {
  evalId: string;
  maxMarks: number;
  aiMarks: number;
  currentMarks: number;
  isCounted?: boolean;
  isResolved?: boolean;
  status: 'approved' | 'flagged' | 'pending' | 'failed' | string;
  flags?: Array<{ code: string; message: string; severity?: string }>;
  keyPointVerdicts?: KeyPointVerdict[];
  verdicts?: KeyPointVerdict[];
  strictnessUsed?: number;
  strictnessEffective?: number;
  strictnessSource?: 'question' | 'paper' | string;
  errorMessage?: string | null;
  previousFinalMarks?: number | null;
  onMarksChange?: (newMarks: number, isCounted: boolean, isResolved: boolean) => void;
  onRecheck?: (level?: number, persistOverride?: boolean) => Promise<void>;
  onUndo?: (oldMarks: number) => Promise<void> | void;
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
  verdicts = [],
  strictnessUsed,
  strictnessEffective,
  strictnessSource,
  errorMessage,
  previousFinalMarks = null,
  onMarksChange,
  onRecheck,
  onUndo,
  onError,
}) => {
  const [marks, setMarks] = useState(currentMarks !== undefined ? currentMarks : aiMarks);
  const [counted, setCounted] = useState(isCounted);
  const [isSaving, setIsSaving] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [undoMarks, setUndoMarks] = useState<number | null>(previousFinalMarks);

  useEffect(() => {
    setMarks(currentMarks !== undefined ? currentMarks : aiMarks);
  }, [currentMarks, aiMarks]);

  useEffect(() => {
    setCounted(isCounted);
  }, [isCounted]);

  useEffect(() => {
    if (previousFinalMarks !== undefined && previousFinalMarks !== null) {
      setUndoMarks(previousFinalMarks);
    }
  }, [previousFinalMarks]);

  const isFailed = status === 'failed';
  const hasChangedMarks = Math.abs(marks - aiMarks) > 0.001;
  const effectiveVerdicts = verdicts.length > 0 ? verdicts : keyPointVerdicts;
  const effectiveStrictness = strictnessUsed || strictnessEffective || 3;

  const handleStepMarks = (delta: number) => {
    const nextVal = Math.min(maxMarks, Math.max(0, Number((marks + delta).toFixed(1))));
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

  const handleExecuteRecheck = async (level: number, persistOverride: boolean) => {
    if (!onRecheck) return;
    setIsRechecking(true);
    setShowPopover(false);
    try {
      await onRecheck(level, persistOverride);
    } catch (err: any) {
      onError?.({
        code: err.code || 'RECHECK_FAILED',
        message: err.message || 'Live AI recheck failed.',
      });
    } finally {
      setIsRechecking(false);
    }
  };

  const handleUndo = async () => {
    if (undoMarks === null) return;
    const oldM = undoMarks;
    setIsSaving(true);
    try {
      await apiClient.post(`/api/evaluations/${evalId}/review`, {
        teacher_marks: oldM,
        accept_ai: false,
        is_counted: counted,
      });
      setMarks(oldM);
      setUndoMarks(null);
      onMarksChange?.(oldM, counted, true);
      onUndo?.(oldM);
    } catch (err: any) {
      onError?.({
        code: err.code || 'UNDO_FAILED',
        message: err.message || 'Failed to undo marks.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      aria-label="Evaluation Marks"
      className="border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-xl bg-white dark:bg-[#181B19] shadow-none dark:shadow-none flex flex-col h-full min-h-0 overflow-hidden relative"
    >
      {/* Header with Strictness Chip and Counted Toggle */}
      <div className="px-3.5 py-2 bg-[#F1F4F2] dark:bg-[#202422] border-b border-[#E2E8E4] dark:border-[#2F3532] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
          <h4 className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
            Marks & Why
          </h4>
          <StrictnessChip
            level={effectiveStrictness}
            source={strictnessSource}
            size="sm"
          />
        </div>

        {/* Counted in Total Score Toggle */}
        <button
          type="button"
          onClick={() => {
            const nextCounted = !counted;
            setCounted(nextCounted);
            onMarksChange?.(marks, nextCounted, isResolved);
          }}
          className="flex items-center gap-1 text-[11px] font-medium text-[#4B5563] dark:text-[#969E9A] hover:text-[#0F5132] dark:hover:text-[#7CC9A3]"
          title="Toggle whether this question counts toward final paper score (Section Choice Rules)"
        >
          {counted ? (
            <ToggleRight className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-[#6B7280] dark:text-[#68706C]" />
          )}
          <span>{counted ? 'Counted' : 'Not Counted'}</span>
        </button>
      </div>

      {/* Card Content: Stepper, Undo Banner, Flags, Verdicts */}
      <div className="p-3 overflow-y-auto space-y-2.5 text-xs flex-1 min-h-0">
        {/* Recheck Skeleton Overlay if rechecking */}
        {isRechecking ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-xs text-[#0F5132] dark:text-[#7CC9A3]">
            <Sparkles className="w-6 h-6 animate-spin mb-2" />
            <p className="font-semibold">Rechecking evaluation with AI...</p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#68706C]">Verifying rubric criteria and evidence quotes</p>
          </div>
        ) : isFailed ? (
          /* Failed Question Display */
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-[#2B191D] border border-rose-200 dark:border-[#45262C] text-rose-700 dark:text-[#E57D8A] space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-[#E57D8A]" />
              <span>Evaluation Failed</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {errorMessage || 'The AI marking model encountered an error evaluating this question.'}
            </p>
            <p className="text-[10px] text-[#6B7280] dark:text-[#68706C] italic">
              Use Recheck below or step manual marks to approve.
            </p>
          </div>
        ) : (
          <>
            {/* Marks Stepper Row */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#E2E8E4] dark:border-[#2F3532] bg-[#F1F4F2] dark:bg-[#202422]">
              <div>
                <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#68706C] uppercase tracking-wider block">
                  Score Awarded:
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-bold tabular-nums text-[#111827] dark:text-[#ECEEED] font-mono">
                    {marks}
                  </span>
                  <span className="text-xs text-[#6B7280] dark:text-[#68706C] tabular-nums">
                    / {maxMarks} Marks
                  </span>
                  {hasChangedMarks && (
                    <span className="text-[11px] text-amber-700 dark:text-[#E5B567] font-semibold ml-2">
                      (AI suggested {aiMarks})
                    </span>
                  )}
                </div>
              </div>

              {/* Stepper Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleStepMarks(-0.5)}
                  disabled={marks <= 0}
                  className="w-7 h-7 rounded-md border border-[#E2E8E4] dark:border-[#2F3532] bg-white dark:bg-[#181B19] hover:bg-slate-100 dark:hover:bg-[#282E2B] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-[#111827] dark:text-[#ECEEED] transition shadow-none font-bold"
                  title="Minus 0.5 Mark (-)"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStepMarks(0.5)}
                  disabled={marks >= maxMarks}
                  className="w-7 h-7 rounded-md border border-[#E2E8E4] dark:border-[#2F3532] bg-white dark:bg-[#181B19] hover:bg-slate-100 dark:hover:bg-[#282E2B] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-[#111827] dark:text-[#ECEEED] transition shadow-none font-bold"
                  title="Plus 0.5 Mark (+)"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Undo Banner after Recheck */}
            {undoMarks !== null && (
              <div className="p-2.5 rounded-lg bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#0F5132]/20 dark:border-[#294236] text-[#0F5132] dark:text-[#7CC9A3] text-xs flex items-center justify-between gap-2 animate-in fade-in">
                <span>
                  Score was <strong>{undoMarks} M</strong> before recheck
                </span>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={isSaving}
                  className="px-2.5 py-1 rounded-md bg-white dark:bg-[#181B19] border border-[#0F5132]/30 dark:border-[#294236] text-[#0F5132] dark:text-[#7CC9A3] hover:bg-[#E8F3EE] dark:hover:bg-[#202422] font-semibold text-[11px] flex items-center gap-1 shadow-none transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </button>
              </div>
            )}

            {/* Plain-English Coded Flags */}
            {flags.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-amber-800 dark:text-[#E5B567] uppercase tracking-wider block">
                  Attention Required ({flags.length}):
                </span>
                {flags.map((flg, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-amber-50 dark:bg-[#2B2416] border border-amber-200 dark:border-[#42361F] text-[11px] text-amber-900 dark:text-[#E5B567] flex items-start gap-2"
                  >
                    <Flag className="w-3.5 h-3.5 text-amber-600 dark:text-[#E5B567] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-semibold block">{flg.message || flg.code}</span>
                      <span className="text-[9px] font-mono text-amber-700/80 dark:text-[#E5B567]/80 uppercase">
                        [{flg.code}]
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Key Point Verdicts with Quotes & Reasons */}
            {effectiveVerdicts.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#68706C] uppercase tracking-wider block mb-1.5">
                  Rubric Point Breakdown:
                </span>
                <div className="space-y-1.5">
                  {effectiveVerdicts.map((v, i) => {
                    const isFull = v.verdict === 'full';
                    const isPartial = v.verdict === 'partial';
                    const pointText = v.text || v.point || `Point ${i + 1}`;
                    return (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg border border-[#E2E8E4] dark:border-[#2F3532] bg-[#F1F4F2]/50 dark:bg-[#202422]/50 text-[11px] space-y-1"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex-1">
                            <span className="font-semibold text-[#111827] dark:text-[#ECEEED]">
                              {pointText}
                            </span>
                            {v.marks_available !== undefined && (
                              <span className="text-[10px] text-[#6B7280] dark:text-[#68706C] font-mono ml-1.5 font-bold">
                                ({v.marks_awarded ?? 0}/{v.marks_available}M)
                              </span>
                            )}
                          </div>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 ${
                              isFull
                                ? 'bg-emerald-100 dark:bg-[#1A2B23] text-emerald-800 dark:text-[#7CC9A3] border border-transparent dark:border-[#294236]'
                                : isPartial
                                ? 'bg-amber-100 dark:bg-[#2B2416] text-amber-800 dark:text-[#E5B567] border border-transparent dark:border-[#42361F]'
                                : 'bg-rose-100 dark:bg-[#2B191D] text-rose-800 dark:text-[#E57D8A] border border-transparent dark:border-[#45262C]'
                            }`}
                          >
                            {v.verdict}
                          </span>
                        </div>
                        {v.reason && (
                          <p className="text-[10px] text-[#4B5563] dark:text-[#969E9A] leading-relaxed">
                            {v.reason}
                          </p>
                        )}
                        {v.quote && (
                          <div className="text-[10px] text-[#4B5563] dark:text-[#969E9A] italic font-mono bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] p-1.5 rounded">
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

      {/* Card Footer: Recheck & Approve Buttons - Always Pinned & Visible */}
      <div className="px-3.5 py-2 bg-[#F1F4F2] dark:bg-[#202422] border-t border-[#E2E8E4] dark:border-[#2F3532] flex items-center justify-between gap-2 shrink-0 z-10 shadow-none">
        {/* Recheck Popover */}
        <RecheckPopover
          isOpen={showPopover}
          initialLevel={effectiveStrictness}
          isSaving={isRechecking}
          onClose={() => setShowPopover(false)}
          onConfirm={handleExecuteRecheck}
        />

        <button
          type="button"
          onClick={() => setShowPopover((prev) => !prev)}
          disabled={isRechecking || isSaving}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E2E8E4] dark:border-[#2F3532] bg-white dark:bg-[#181B19] hover:bg-slate-100 dark:hover:bg-[#282E2B] text-[#4B5563] dark:text-[#969E9A] disabled:opacity-40 transition flex items-center gap-1.5 shadow-none"
          title="Recheck question with custom strictness (R)"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3]" />
          <span>Recheck...</span>
        </button>

        <button
          type="button"
          onClick={handleApprove}
          disabled={isSaving || (isFailed && !hasChangedMarks)}
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition flex items-center gap-1.5 shadow-none disabled:opacity-40 ${
            isResolved
              ? 'bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A]'
              : 'bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A]'
          }`}
          title="Approve marks for this question (A)"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{isResolved ? 'Approved ✓' : 'Approve'}</span>
        </button>
      </div>
    </section>
  );
};
