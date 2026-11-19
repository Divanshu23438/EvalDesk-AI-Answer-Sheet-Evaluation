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
      className="border border-slate-200 rounded-xl bg-white shadow-xs flex flex-col h-full min-h-0 overflow-hidden relative"
    >
      {/* Header with Strictness Chip and Counted Toggle */}
      <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[#0F5132]" />
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
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
          className="flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-[#0F5132]"
          title="Toggle whether this question counts toward final paper score (Section Choice Rules)"
        >
          {counted ? (
            <ToggleRight className="w-4 h-4 text-emerald-600" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-slate-400" />
          )}
          <span>{counted ? 'Counted' : 'Not Counted'}</span>
        </button>
      </div>

      {/* Card Content: Stepper, Undo Banner, Flags, Verdicts */}
      <div className="p-3 overflow-y-auto space-y-2.5 text-xs flex-1 min-h-0">
        {/* Recheck Skeleton Overlay if rechecking */}
        {isRechecking ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-xs text-[#0F5132]">
            <Sparkles className="w-6 h-6 animate-spin mb-2" />
            <p className="font-semibold">Rechecking evaluation with AI...</p>
            <p className="text-[11px] text-slate-500">Verifying rubric criteria and evidence quotes</p>
          </div>
        ) : isFailed ? (
          /* Failed Question Display */
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Evaluation Failed</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {errorMessage || 'The AI marking model encountered an error evaluating this question.'}
            </p>
            <p className="text-[10px] text-slate-500 italic">
              Use Recheck below or step manual marks to approve.
            </p>
          </div>
        ) : (
          <>
            {/* Marks Stepper Row */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Score Awarded:
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-bold tabular-nums text-slate-900 font-mono">
                    {marks}
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    / {maxMarks} Marks
                  </span>
                  {hasChangedMarks && (
                    <span className="text-[11px] text-amber-700 font-semibold ml-2">
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
                  className="w-7 h-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-800 transition shadow-2xs font-bold"
                  title="Minus 0.5 Mark (-)"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStepMarks(0.5)}
                  disabled={marks >= maxMarks}
                  className="w-7 h-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-800 transition shadow-2xs font-bold"
                  title="Plus 0.5 Mark (+)"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Undo Banner after Recheck */}
            {undoMarks !== null && (
              <div className="p-2.5 rounded-lg bg-[#E8F3EE] border border-[#0F5132]/20 text-[#0F5132] text-xs flex items-center justify-between gap-2 animate-in fade-in">
                <span>
                  Score was <strong>{undoMarks} M</strong> before recheck
                </span>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={isSaving}
                  className="px-2.5 py-1 rounded-md bg-white border border-[#0F5132]/30 text-[#0B3D26] hover:bg-[#E8F3EE] font-semibold text-[11px] flex items-center gap-1 shadow-2xs transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </button>
              </div>
            )}

            {/* Plain-English Coded Flags */}
            {flags.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                  Attention Required ({flags.length}):
                </span>
                {flags.map((flg, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2"
                  >
                    <Flag className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-semibold block">{flg.message || flg.code}</span>
                      <span className="text-[9px] font-mono text-amber-700/80 uppercase">
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
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
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
                        className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 text-[11px] space-y-1"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex-1">
                            <span className="font-semibold text-slate-800">
                              {pointText}
                            </span>
                            {v.marks_available !== undefined && (
                              <span className="text-[10px] text-slate-500 font-mono ml-1.5 font-bold">
                                ({v.marks_awarded ?? 0}/{v.marks_available}M)
                              </span>
                            )}
                          </div>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 ${
                              isFull
                                ? 'bg-emerald-100 text-emerald-800'
                                : isPartial
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {v.verdict}
                          </span>
                        </div>
                        {v.reason && (
                          <p className="text-[10px] text-slate-600 leading-relaxed">
                            {v.reason}
                          </p>
                        )}
                        {v.quote && (
                          <div className="text-[10px] text-slate-600 italic font-mono bg-white border border-slate-200 p-1.5 rounded">
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
      <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 z-10 shadow-2xs">
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
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-white text-slate-700 disabled:opacity-40 transition flex items-center gap-1.5 shadow-2xs"
          title="Recheck question with custom strictness (R)"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#0F5132]" />
          <span>Recheck...</span>
        </button>

        <button
          type="button"
          onClick={handleApprove}
          disabled={isSaving || (isFailed && !hasChangedMarks)}
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition flex items-center gap-1.5 shadow-xs disabled:opacity-40 ${
            isResolved
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-[#0F5132] hover:bg-[#0B3D26]'
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
