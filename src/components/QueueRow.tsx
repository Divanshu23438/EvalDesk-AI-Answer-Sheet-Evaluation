import React, { useState } from 'react';
import {
  FileText,
  RefreshCw,
  Trash2,
  Check,
  AlertCircle,
  Eye,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { StatusChip, StatusType } from './StatusChip';
import { apiClient } from '../api/client';

export interface SheetQueueItem {
  id: string;
  filename: string;
  student_name: string;
  roll: string;
  status: string;
  stage: string;
  page_count: number;
  flags_open: number;
  updated_at: string;
  error_message?: string | null;
  uploadProgress?: number; // 0 to 100 if uploading
  pages_read?: number;
  pages_total?: number;
  questions_marked?: number;
  questions_total?: number;
  total_score?: number;
  max_marks?: number;
  stage_key?: string;
  pages?: Array<{
    n: number;
    status: 'pending' | 'reading' | 'done' | 'failed';
    image_url?: string | null;
    legibility?: number | null;
    error?: string | null;
  }>;
}

interface QueueRowProps {
  sheet: SheetQueueItem;
  isActive?: boolean;
  onSelect?: () => void;
  onRefresh?: () => void;
  onError?: (err: { code: string; message: string }) => void;
}

export const QueueRow: React.FC<QueueRowProps> = ({
  sheet,
  isActive = false,
  onSelect,
  onRefresh,
  onError,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const isProcessing = [
    'queued',
    'evaluating',
    'reading',
    'reading_identity',
    'matching',
    'marking',
    'flagging',
  ].includes(sheet.status);

  // Map sheet status to StatusChip configuration
  const getChipProps = (): { status: StatusType; label: string } => {
    switch (sheet.status) {
      case 'needs_identity':
        return { status: 'flagged', label: 'Name needed' };
      case 'queued':
        return { status: 'pending', label: 'Queued' };
      case 'reading_identity':
        return { status: 'current', label: 'Reading name' };
      case 'reading':
        return { status: 'current', label: 'Reading pages' };
      case 'matching':
        return { status: 'current', label: 'Matching' };
      case 'marking':
        return { status: 'current', label: 'Marking' };
      case 'flagging':
        return { status: 'current', label: 'Flagging' };
      case 'needs_review':
        return {
          status: 'flagged',
          label: sheet.flags_open > 0 ? `${sheet.flags_open} flagged` : 'Review needed',
        };
      case 'evaluated':
        return { status: 'approved', label: 'Evaluated' };
      case 'failed':
      case 'error':
        return { status: 'failed', label: 'Failed' };
      default:
        return { status: 'pending', label: sheet.stage || sheet.status };
    }
  };

  const handleCardClick = () => {
    if (sheet.status === 'needs_identity') {
      return; // user will interact with inline identity form
    }
    if (onSelect) {
      onSelect();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRetrying(true);
    try {
      await apiClient.post(`/api/sheets/${sheet.id}/retry`, {});
      if (onRefresh) onRefresh();
    } catch (err: any) {
      if (onError) {
        onError({
          code: err.code || 'RETRY_FAILED',
          message: err.message || 'Failed to retry sheet evaluation.',
        });
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete sheet "${sheet.filename}"?`)) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/sheets/${sheet.id}`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      if (onError) {
        onError({
          code: err.code || 'DELETE_FAILED',
          message: err.message || 'Failed to delete sheet.',
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const chipProps = getChipProps();
  const isUploading = sheet.uploadProgress !== undefined && sheet.uploadProgress < 100;
  const questionsMarked = sheet.questions_marked || 0;
  const questionsTotal = sheet.questions_total || 0;
  const canOpenReviewed = questionsMarked > 0 || ['evaluated', 'needs_review'].includes(sheet.status);

  // Compute 5-stage progress indicators
  const stageIndex = (() => {
    switch (sheet.status) {
      case 'reading_identity':
        return 0;
      case 'reading':
        return 1;
      case 'matching':
        return 2;
      case 'marking':
        return 3;
      case 'flagging':
        return 4;
      case 'needs_review':
      case 'evaluated':
        return 5;
      default:
        return 0;
    }
  })();

  const stages = [
    { label: 'Name', done: Boolean(sheet.student_name) || stageIndex > 0 },
    { label: 'Pages', done: stageIndex > 1 },
    { label: 'Match', done: stageIndex > 2 },
    { label: 'Mark', done: stageIndex > 3, active: stageIndex === 3 },
    { label: 'Flags', done: stageIndex > 4, active: stageIndex === 4 },
  ];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className={`border rounded-xl p-3.5 transition-all text-left select-none cursor-pointer shadow-xs ${
        isActive
          ? 'border-indigo-400 bg-indigo-50/40 ring-1 ring-indigo-300'
          : isProcessing
          ? 'border-indigo-200 bg-indigo-50/20 hover:border-indigo-300 hover:shadow-sm'
          : sheet.status === 'needs_identity'
          ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400'
          : sheet.status === 'failed'
          ? 'border-rose-200 bg-rose-50/20 hover:border-rose-300'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Page Thumbnail with optional scan-line sweep */}
        <div className="relative w-12 h-16 rounded-md border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
          {!thumbError && sheet.page_count > 0 ? (
            <img
              src={`/api/sheets/${sheet.id}/pages/1/image`}
              alt={`Page 1 of ${sheet.filename}`}
              className="w-full h-full object-cover"
              onError={() => setThumbError(true)}
              loading="lazy"
            />
          ) : (
            <FileText className="w-6 h-6 text-slate-400" />
          )}

          {/* Animated scan-line sweep when processing */}
          {isProcessing && <div className="scanline-sweep" />}

          {/* Page count badge */}
          {sheet.page_count > 0 && (
            <span className="absolute bottom-1 right-1 text-[9px] font-mono font-bold text-slate-600 bg-white/95 px-1 rounded shadow-2xs border border-slate-200">
              p.1{sheet.page_count > 1 ? `-${sheet.page_count}` : ''}
            </span>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4
              className="text-xs font-semibold text-slate-800 truncate"
              title={sheet.filename}
            >
              {sheet.filename}
            </h4>

            {/* Status Chip & Quick Actions */}
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <StatusChip status={chipProps.status} label={chipProps.label} size="sm" />

              {canOpenReviewed && onSelect && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                  }}
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 transition"
                  title="Open in Evaluation Workspace"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition"
                title="Delete Sheet"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Verified Student Details / Metadata */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-2 truncate">
            {sheet.student_name ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                <strong className="text-slate-800">{sheet.student_name}</strong>
                {sheet.roll && (
                  <span className="font-mono text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1 rounded">
                    ({sheet.roll})
                  </span>
                )}
              </span>
            ) : (
              <span>{sheet.page_count || 1} pages</span>
            )}

            {sheet.total_score !== undefined && sheet.total_score > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-mono font-semibold text-slate-700">
                  {sheet.total_score}M
                </span>
              </>
            )}
          </div>

          {/* Live Inline 5-Stage Processing Tracker */}
          {isProcessing && (
            <div className="mt-2 pt-2 border-t border-indigo-100 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-indigo-700 flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                  {sheet.stage || 'Processing student answer sheet...'}
                </span>
                {questionsTotal > 0 && (
                  <span className="font-mono text-[10px] text-indigo-900 font-semibold shrink-0">
                    {questionsMarked}/{questionsTotal} Qs
                  </span>
                )}
              </div>

              {/* 5-Step Progress Pills */}
              <div className="grid grid-cols-5 gap-1">
                {stages.map((st, i) => (
                  <div
                    key={st.label}
                    className={`h-1.5 rounded-full transition-all ${
                      st.done
                        ? 'bg-emerald-500'
                        : st.active
                        ? 'bg-indigo-600 animate-pulse'
                        : 'bg-slate-200'
                    }`}
                    title={`Stage ${i + 1}: ${st.label}`}
                  />
                ))}
              </div>

              {/* Shortcut: Open First Reviewed Question */}
              {canOpenReviewed && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelect) onSelect();
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    <span>Open first reviewed question</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Real Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1 mb-2">
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Uploading...</span>
                <span className="font-mono">{sheet.uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-200"
                  style={{ width: `${sheet.uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Failure message & Retry */}
          {sheet.status === 'failed' && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                <span className="truncate">{sheet.error_message || 'Evaluation failed'}</span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-2.5 py-0.5 text-[11px] font-semibold rounded bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 disabled:opacity-50 transition flex items-center gap-1 shrink-0 shadow-xs"
              >
                <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
