import React, { useState, useEffect } from 'react';
import { Edit3, Check, X, Sparkles, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { apiClient } from '../api/client';

interface OcrCardProps {
  evalId: string;
  ocrText: string;
  evidenceQuotes?: string[];
  legibility?: number;
  readerTexts?: Record<string, string>;
  isEditingExternal?: boolean;
  onTextSaved?: (newText: string) => void;
  onRequestRecheck?: () => void;
  onError?: (err: { code: string; message: string }) => void;
}

export const OcrCard: React.FC<OcrCardProps> = ({
  evalId,
  ocrText,
  evidenceQuotes = [],
  legibility = 0.85,
  readerTexts = {},
  isEditingExternal = false,
  onTextSaved,
  onRequestRecheck,
  onError,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(ocrText);
  const [isSaving, setIsSaving] = useState(false);
  const [showReaderDiff, setShowReaderDiff] = useState(false);

  useEffect(() => {
    setEditText(ocrText);
  }, [ocrText]);

  useEffect(() => {
    if (isEditingExternal) {
      setIsEditing(true);
    }
  }, [isEditingExternal]);

  // Legibility Badge Color & Label
  const getLegibilityBadge = () => {
    const score = legibility !== undefined ? legibility : 0.85;
    if (score >= 0.8) {
      return {
        label: `Legibility ${(score * 100).toFixed(0)}%`,
        className: 'bg-[var(--status-approved-bg)] text-[var(--status-approved)] border-[var(--status-approved-border)]',
      };
    }
    if (score >= 0.5) {
      return {
        label: `Legibility ${(score * 100).toFixed(0)}%`,
        className: 'bg-[var(--status-flagged-bg)] text-[var(--status-flagged)] border-[var(--status-flagged-border)]',
      };
    }
    return {
      label: `Low Legibility ${(score * 100).toFixed(0)}%`,
      className: 'bg-[var(--status-failed-bg)] text-[var(--status-failed)] border-[var(--status-failed-border)]',
    };
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      await apiClient.post(`/api/evaluations/${evalId}/review`, {
        ocr_text: editText.trim(),
        accept_ai: true,
      });
      setIsEditing(false);
      onTextSaved?.(editText.trim());
    } catch (err: any) {
      onError?.({
        code: err.code || 'OCR_SAVE_FAILED',
        message: err.message || 'Failed to save OCR text edit.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyReaderText = async (readerKey: string, textVal: string) => {
    setEditText(textVal);
    setIsSaving(true);
    try {
      await apiClient.post(`/api/evaluations/${evalId}/review`, {
        ocr_text: textVal.trim(),
        accept_ai: true,
      });
      setIsEditing(false);
      setShowReaderDiff(false);
      onTextSaved?.(textVal.trim());
    } catch (err: any) {
      onError?.({
        code: err.code || 'READER_APPLY_FAILED',
        message: err.message || `Failed to apply text from ${readerKey}.`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Highlight evidence quotes inside text
  const renderHighlightedText = (text: string) => {
    if (!text) {
      return <span className="text-[var(--ink-muted)] italic">No extracted text for this answer.</span>;
    }

    const validQuotes = evidenceQuotes.filter((q) => q && q.length > 3 && text.includes(q));
    if (validQuotes.length === 0) {
      return <span>{text}</span>;
    }

    // Replace first occurrence with highlighted mark
    let parts: React.ReactNode[] = [text];
    validQuotes.forEach((quote, qIdx) => {
      const newParts: React.ReactNode[] = [];
      parts.forEach((part, pIdx) => {
        if (typeof part === 'string' && part.includes(quote)) {
          const split = part.split(quote);
          for (let i = 0; i < split.length; i++) {
            if (split[i]) newParts.push(split[i]);
            if (i < split.length - 1) {
              newParts.push(
                <mark
                  key={`quote-${qIdx}-${pIdx}-${i}`}
                  className="bg-[var(--accent-indigo-subtle)] text-[var(--accent-indigo)] font-semibold px-1 py-0.5 rounded"
                  title="Evidence quote matching rubric point"
                >
                  {quote}
                </mark>
              );
            }
          }
        } else {
          newParts.push(part);
        }
      });
      parts = newParts;
    });

    return <>{parts}</>;
  };

  const legBadge = getLegibilityBadge();
  const readerKeys = Object.keys(readerTexts || {});
  const hasMultipleReaders = readerKeys.length > 1;

  return (
    <section
      aria-label="Student Transcript"
      className="border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)] flex flex-col min-h-0 h-full overflow-hidden"
    >
      {/* Card Header */}
      <div className="px-3 py-2 bg-[var(--surface-canvas)] border-b border-[var(--surface-border)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-[var(--accent-indigo)]" />
          <h4 className="text-xs font-semibold text-[var(--ink-primary)] uppercase tracking-wider">
            1. OCR Detected
          </h4>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${legBadge.className}`}
          >
            {legBadge.label}
          </span>

          {hasMultipleReaders && (
            <button
              type="button"
              onClick={() => setShowReaderDiff(!showReaderDiff)}
              className="text-[10px] font-medium text-[var(--accent-indigo)] hover:underline px-1.5 py-0.5"
            >
              {showReaderDiff ? 'Hide Diff' : 'Compare Readers'}
            </button>
          )}

          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-1 rounded text-[var(--ink-muted)] hover:text-[var(--accent-indigo)] hover:bg-[var(--surface-subtle)] transition"
              title="Edit extracted text (E)"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="p-1 rounded text-[var(--status-approved)] hover:bg-[var(--status-approved-bg)] transition"
                title="Save Edit"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditText(ocrText);
                  setIsEditing(false);
                }}
                disabled={isSaving}
                className="p-1 rounded text-[var(--status-failed)] hover:bg-[var(--status-failed-bg)] transition"
                title="Cancel Edit"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reader Diff Panel (if toggled) */}
      {showReaderDiff && hasMultipleReaders && (
        <div className="p-2.5 bg-[var(--surface-subtle)] border-b border-[var(--surface-border)] text-xs space-y-2 shrink-0">
          <div className="text-[11px] font-semibold text-[var(--ink-secondary)]">
            Reader Comparison (Dual Vision AI):
          </div>
          <div className="grid grid-cols-2 gap-2">
            {readerKeys.map((rKey) => (
              <div key={rKey} className="p-2 bg-[var(--surface-card)] border rounded text-[11px]">
                <div className="flex items-center justify-between mb-1 font-semibold text-[var(--ink-muted)]">
                  <span>{rKey.toUpperCase()}</span>
                  <button
                    type="button"
                    onClick={() => handleApplyReaderText(rKey, readerTexts[rKey])}
                    className="text-[10px] text-[var(--accent-indigo)] hover:underline"
                  >
                    Use this
                  </button>
                </div>
                <p className="line-clamp-4 text-[var(--ink-primary)] leading-normal">
                  {readerTexts[rKey]}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card Body: Transcript Display or Textarea */}
      <div className="panel flex-1 p-3 overflow-y-auto text-xs leading-relaxed text-[var(--ink-primary)]">
        {isEditing ? (
          <div className="h-full flex flex-col gap-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full flex-1 p-2 text-xs rounded border border-[var(--accent-indigo)] bg-[var(--surface-bg)] text-[var(--ink-primary)] font-mono resize-none focus:outline-none"
              placeholder="Edit student extracted text character-by-character..."
              autoFocus
            />
            <div className="flex items-center justify-between pt-1 shrink-0">
              <span className="text-[10px] text-[var(--ink-muted)]">
                Press Save to persist changes to SQLite.
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-[var(--accent-indigo)] text-white hover:bg-[var(--accent-indigo-hover)] transition flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Save Edit
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap font-sans">
            {renderHighlightedText(ocrText)}
          </div>
        )}
      </div>

      {/* Recheck Offer Footer after edit */}
      {!isEditing && editText !== ocrText && onRequestRecheck && (
        <div className="px-3 py-1.5 bg-[var(--accent-indigo-subtle)] border-t border-[var(--accent-indigo-border)] flex items-center justify-between shrink-0 text-xs text-[var(--accent-indigo)] font-medium">
          <span>Text modified · Recheck recommended</span>
          <button
            type="button"
            onClick={onRequestRecheck}
            className="inline-flex items-center gap-1 text-[11px] font-bold underline hover:opacity-80"
          >
            <Sparkles className="w-3 h-3" />
            Recheck AI
          </button>
        </div>
      )}
    </section>
  );
};
