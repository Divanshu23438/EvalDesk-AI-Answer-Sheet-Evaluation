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
  Pencil,
} from 'lucide-react';
import { StatusChip, StatusType } from './StatusChip';
import { apiClient } from '../api/client';
import { IdentityForm } from './IdentityForm';

export interface SheetQueueItem {
  id: string;
  filename: string;
  student_name: string;
  roll: string;
  class_name?: string;
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
  onEditIdentity?: () => void;
}

export const QueueRow: React.FC<QueueRowProps> = ({
  sheet,
  isActive = false,
  onSelect,
  onRefresh,
  onError,
  onEditIdentity,
}) => {
  if (!sheet) return null;

  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);

  const isProcessing = [
    'queued',
    'evaluating',
    'reading',
    'reading_identity',
    'matching',
    'marking',
    'flagging',
  ].includes(sheet.status || '');

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
          label: (sheet.flags_open ?? 0) > 0 ? `${sheet.flags_open} flagged` : 'Review needed',
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
      className={`border rounded-xl p-3.5 transition-all text-left select-none cursor-pointer shadow-none dark:shadow-none ${
        isActive
          ? 'border-[#0F5132]/40 bg-[#E8F3EE]/40 ring-1 ring-[#0F5132]/30 dark:bg-[#1A2B23] dark:border-[#294236] dark:ring-[#294236]'
          : isProcessing
          ? 'border-[#0F5132]/20 bg-[#E8F3EE]/20 hover:border-[#0F5132]/30 hover:shadow-none dark:bg-[#1A2B23]/40 dark:border-[#294236]'
          : sheet.status === 'needs_identity'
          ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400 dark:bg-[#2B2416]/40 dark:border-[#42361F]'
          : sheet.status === 'failed'
          ? 'border-rose-200 bg-rose-50/20 hover:border-rose-300 dark:bg-[#2B191D]/40 dark:border-[#45262C]'
          : 'border-slate-200 dark:border-[#2A2F2C] bg-white dark:bg-[#181B19] hover:border-slate-300 dark:hover:border-[#3D4440] hover:shadow-none'
      }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Page Thumbnail with optional scan-line sweep */}
        <div className="relative w-12 h-16 rounded-md border border-slate-200 dark:border-[#2F3532] bg-slate-100 dark:bg-[#202422] overflow-hidden shrink-0 flex items-center justify-center shadow-none">
          {!thumbError && sheet.page_count > 0 ? (
            <img
              src={`/api/sheets/${sheet.id}/pages/1/image`}
              alt={`Page 1 of ${sheet.filename}`}
              className="w-full h-full object-cover"
              onError={() => setThumbError(true)}
              loading="lazy"
            />
          ) : (
            <FileText className="w-6 h-6 text-slate-400 dark:text-[#68706C]" />
          )}

          {/* Animated scan-line sweep when processing */}
          {isProcessing && <div className="scanline-sweep" />}

          {/* Page count badge */}
          {sheet.page_count > 0 && (
            <span className="absolute bottom-1 right-1 text-[9px] font-mono font-bold text-slate-600 dark:text-[#969E9A] bg-white/95 dark:bg-[#202422] px-1 rounded shadow-none border border-slate-200 dark:border-[#2F3532]">
              p.1{sheet.page_count > 1 ? `-${sheet.page_count}` : ''}
            </span>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4
              className="text-xs font-semibold text-slate-800 dark:text-[#ECEEED] truncate"
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
                  className="p-1 text-slate-400 hover:text-[#0F5132] dark:hover:text-[#7CC9A3] rounded hover:bg-slate-100 dark:hover:bg-[#202422] transition"
                  title="Open in Evaluation Workspace"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-[#E57D8A] rounded hover:bg-slate-100 dark:hover:bg-[#202422] transition"
                title="Delete Sheet"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Verified Student Details / Metadata */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#969E9A] mb-2 truncate">
            {sheet.student_name ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-[#7CC9A3] font-medium">
                <Check className="w-3 h-3 text-emerald-600 dark:text-[#7CC9A3] shrink-0" />
                <strong className="text-slate-800 dark:text-[#ECEEED]">{sheet.student_name}</strong>
                {sheet.roll && (
                  <span className="font-mono text-[10px] text-emerald-800 dark:text-[#7CC9A3] bg-emerald-50 dark:bg-[#1A2B23] border border-emerald-200 dark:border-[#294236] px-1 rounded">
                    ({sheet.roll})
                  </span>
                )}
                {sheet.class_name && (
                  <span className="text-[10px] text-[#0B3D26] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#0F5132]/20 dark:border-[#294236] px-1 rounded font-medium">
                    {sheet.class_name}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditIdentity) {
                      onEditIdentity();
                    } else {
                      setIsEditingIdentity((prev) => !prev);
                    }
                  }}
                  className="p-0.5 ml-0.5 text-slate-400 hover:text-[#0F5132] dark:hover:text-[#7CC9A3] rounded hover:bg-slate-100 dark:hover:bg-[#202422] transition inline-flex items-center"
                  title="Edit student name & roll number (✎)"
                  aria-label="Edit student identity"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span>{sheet.page_count || 1} pages</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditIdentity) {
                      onEditIdentity();
                    } else {
                      setIsEditingIdentity((prev) => !prev);
                    }
                  }}
                  className="p-0.5 ml-0.5 text-slate-400 hover:text-[#0F5132] dark:hover:text-[#7CC9A3] rounded hover:bg-slate-100 dark:hover:bg-[#202422] transition inline-flex items-center"
                  title="Enter student name & roll number (✎)"
                  aria-label="Edit student identity"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </span>
            )}

            {sheet.total_score !== undefined && sheet.total_score > 0 && (
              <>
                <span className="text-slate-300 dark:text-[#2A2F2C]">·</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-[#ECEEED]">
                  {sheet.total_score}M
                </span>
              </>
            )}
          </div>

          {/* Self-contained Inline Identity Editor if not handled by parent */}
          {isEditingIdentity && !onEditIdentity && (
            <div className="mb-2" onClick={(e) => e.stopPropagation()}>
              <IdentityForm
                sheetId={sheet.id}
                initialName={sheet.student_name || ''}
                initialRoll={sheet.roll || ''}
                initialClass={sheet.class_name || ''}
                onSaved={() => {
                  setIsEditingIdentity(false);
                  if (onRefresh) onRefresh();
                }}
                onCancel={() => setIsEditingIdentity(false)}
              />
            </div>
          )}

          {/* Live Inline 5-Stage Processing Tracker */}
          {isProcessing && (
            <div className="mt-2 pt-2 border-t border-[#E8F3EE] dark:border-[#2A2F2C] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-[#0B3D26] dark:text-[#7CC9A3] flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-[#0F5132] dark:bg-[#7CC9A3] animate-pulse" />
                  {sheet.stage || 'Processing student answer sheet...'}
                </span>
                {questionsTotal > 0 && (
                  <span className="font-mono text-[10px] text-[#0F5132] dark:text-[#7CC9A3] font-semibold shrink-0">
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
                        ? 'bg-emerald-500 dark:bg-[#2D8A61]'
                        : st.active
                        ? 'bg-[#0F5132] dark:bg-[#1F6E4A] animate-pulse'
                        : 'bg-slate-200 dark:bg-[#202422]'
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
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F5132] dark:text-[#7CC9A3] hover:underline"
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
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-[#969E9A]">
                <span>Uploading...</span>
                <span className="font-mono">{sheet.uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-[#202422] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#0F5132] dark:bg-[#1F6E4A] h-full transition-all duration-200"
                  style={{ width: `${sheet.uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Failure message & Retry */}
          {sheet.status === 'failed' && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-[#2B191D] border border-rose-200 dark:border-[#45262C] text-[11px] text-rose-700 dark:text-[#E57D8A] flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-[#E57D8A]" />
                <span className="truncate">{sheet.error_message || 'Evaluation failed'}</span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-2.5 py-0.5 text-[11px] font-semibold rounded bg-white dark:bg-[#202422] text-rose-700 dark:text-[#E57D8A] border border-rose-300 dark:border-[#45262C] hover:bg-rose-50 dark:hover:bg-[#2A2F2C] disabled:opacity-50 transition flex items-center gap-1 shrink-0 shadow-none"
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
