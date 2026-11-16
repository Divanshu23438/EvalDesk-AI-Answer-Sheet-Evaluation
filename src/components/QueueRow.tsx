import React, { useState } from 'react';
import { FileText, RefreshCw, Trash2, Check, AlertCircle, Eye } from 'lucide-react';
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
  const [nameInput, setNameInput] = useState(sheet.student_name || '');
  const [rollInput, setRollInput] = useState(sheet.roll || '');
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  // Map sheet status to StatusChip configuration
  const getChipProps = (): { status: StatusType; label: string } => {
    switch (sheet.status) {
      case 'needs_identity':
        return { status: 'flagged', label: 'Name needed' };
      case 'queued':
      case 'uploaded':
      case 'pending':
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

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !rollInput.trim()) {
      if (onError) {
        onError({
          code: 'VALIDATION_ERROR',
          message: 'Both student name and roll number are required.',
        });
      }
      return;
    }

    setIsSavingIdentity(true);
    try {
      await apiClient.post(`/api/sheets/${sheet.id}/identity`, {
        student_name: nameInput.trim(),
        roll_number: rollInput.trim(),
      });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      if (onError) {
        onError({
          code: err.code || 'IDENTITY_SAVE_FAILED',
          message: err.message || 'Failed to save student identity.',
        });
      }
    } finally {
      setIsSavingIdentity(false);
    }
  };

  const handleRetry = async () => {
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

  const handleDelete = async () => {
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

  return (
    <div
      className={`border rounded-lg p-3 transition-colors ${
        isActive
          ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo-subtle)]/20'
          : 'border-[var(--surface-border)] bg-[var(--surface-card)] hover:border-[var(--surface-hover)]'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Page Thumbnail */}
        <div className="w-10 h-14 rounded border border-[var(--surface-border)] bg-[var(--surface-subtle)] overflow-hidden shrink-0 flex items-center justify-center relative">
          {!thumbError && sheet.page_count > 0 ? (
            <img
              src={`/api/sheets/${sheet.id}/pages/1/image`}
              alt={`Page 1 of ${sheet.filename}`}
              className="w-full h-full object-cover"
              onError={() => setThumbError(true)}
              loading="lazy"
            />
          ) : (
            <FileText className="w-5 h-5 text-[var(--ink-muted)]" />
          )}
        </div>

        {/* Info & Status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4
              className="text-xs font-semibold text-[var(--ink-primary)] truncate"
              title={sheet.filename}
            >
              {sheet.filename}
            </h4>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusChip status={chipProps.status} label={chipProps.label} size="sm" />
              {onSelect && (
                <button
                  type="button"
                  onClick={onSelect}
                  className="p-1 text-[var(--ink-muted)] hover:text-[var(--accent-indigo)] rounded hover:bg-[var(--surface-subtle)] transition"
                  title="View Sheet"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1 text-[var(--ink-muted)] hover:text-[var(--status-failed)] rounded hover:bg-[var(--surface-subtle)] transition"
                title="Delete Sheet"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Metadata line */}
          <div className="flex items-center gap-2 text-[11px] text-[var(--ink-muted)] mb-2">
            <span className="tabular-nums">
              {sheet.page_count > 0 ? `${sheet.page_count} ${sheet.page_count === 1 ? 'page' : 'pages'}` : 'Processing...'}
            </span>
            {sheet.student_name && (
              <>
                <span>·</span>
                <span className="text-[var(--ink-secondary)] font-medium truncate">
                  {sheet.student_name}
                </span>
              </>
            )}
            {sheet.roll && (
              <>
                <span>·</span>
                <span className="tabular-nums">Roll: {sheet.roll}</span>
              </>
            )}
          </div>

          {/* Real Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1 mb-2">
              <div className="flex justify-between text-[10px] text-[var(--ink-muted)]">
                <span>Uploading...</span>
                <span>{sheet.uploadProgress}%</span>
              </div>
              <div className="w-full bg-[var(--surface-subtle)] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[var(--accent-indigo)] h-full transition-all duration-200"
                  style={{ width: `${sheet.uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Inline Identity Form for needs_identity */}
          {sheet.status === 'needs_identity' && (
            <form
              onSubmit={handleSaveIdentity}
              className="mt-2 p-2 rounded bg-[var(--surface-subtle)] border border-[var(--status-flagged-border)] flex flex-wrap sm:flex-nowrap items-center gap-2"
            >
              <div className="flex-1 min-w-[120px]">
                <label className="sr-only">Student Name</label>
                <input
                  type="text"
                  placeholder="Student Name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-indigo)]"
                  required
                />
              </div>
              <div className="w-24 shrink-0">
                <label className="sr-only">Roll Number</label>
                <input
                  type="text"
                  placeholder="Roll"
                  value={rollInput}
                  onChange={(e) => setRollInput(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--ink-primary)] focus:outline-none focus:border-[var(--accent-indigo)]"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSavingIdentity}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-[var(--accent-indigo)] text-white hover:bg-[var(--accent-indigo-hover)] disabled:opacity-50 transition flex items-center gap-1 shrink-0"
              >
                {isSavingIdentity ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Save
              </button>
            </form>
          )}

          {/* Failure message & Retry */}
          {sheet.status === 'failed' && (
            <div className="mt-2 p-2 rounded bg-[var(--status-failed-bg)] border border-[var(--status-failed-border)] text-[11px] text-[var(--status-failed)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{sheet.error_message || 'Evaluation failed'}</span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-2 py-0.5 text-[11px] font-semibold rounded bg-white text-[var(--status-failed)] border border-[var(--status-failed-border)] hover:bg-[var(--status-failed-bg)] disabled:opacity-50 transition flex items-center gap-1 shrink-0"
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
