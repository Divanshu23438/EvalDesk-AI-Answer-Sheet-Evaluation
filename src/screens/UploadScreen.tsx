import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Layers,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { QueueRow, SheetQueueItem } from '../components/QueueRow';

interface PaperSummary {
  id: string;
  title: string;
  total_marks: number;
  is_locked: boolean | number;
  created_at?: string;
}

export const UploadScreen: React.FC = () => {
  const [state, store] = useSheetStore();

  // Local component state
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [sheets, setSheets] = useState<SheetQueueItem[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [splitFiles, setSplitFiles] = useState(false); // "Treat each file as a separate sheet"
  const [uploadingProgress, setUploadingProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch available papers and select the active locked paper
  const loadPapers = useCallback(async () => {
    try {
      const data = await apiClient.get<{ papers: PaperSummary[] }>('/api/papers');
      const paperList = data.papers || [];
      setPapers(paperList);

      if (paperList.length > 0) {
        // If no paper selected or current paperId not in list, pick the most recent locked paper (or first)
        const currentSelected = paperList.find((p) => p.id === state.paperId);
        const targetPaper = currentSelected || paperList.find((p) => Boolean(p.is_locked)) || paperList[0];

        if (targetPaper && targetPaper.id !== state.paperId) {
          store.setPaper({
            id: targetPaper.id,
            title: targetPaper.title,
            totalMarks: targetPaper.total_marks,
            isLocked: Boolean(targetPaper.is_locked),
          });
        }
      }
    } catch (err: any) {
      store.setError({
        code: err.code || 'PAPERS_FETCH_FAILED',
        message: err.message || 'Could not fetch papers from server.',
      });
    }
  }, [state.paperId, store]);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  // 2. Fetch paper questions count if paper is selected
  useEffect(() => {
    if (!state.paperId) return;

    let isMounted = true;
    const fetchPaperDetails = async () => {
      try {
        const details = await apiClient.get<any>(`/api/papers/${state.paperId}`);
        if (!isMounted) return;
        const qCount = details.questions ? details.questions.length : 0;
        store.setPaper({
          id: details.id,
          title: details.title,
          totalMarks: details.total_marks,
          questionCount: qCount,
          isLocked: Boolean(details.is_locked),
        });
      } catch (err) {
        // Fallback silently if paper details fetch fails
      }
    };

    fetchPaperDetails();
    return () => {
      isMounted = false;
    };
  }, [state.paperId, store]);

  // 3. Fetch sheets for current paper
  const loadSheets = useCallback(async () => {
    if (!state.paperId) return;
    setIsLoadingSheets(true);
    try {
      const data = await apiClient.get<{ sheets: SheetQueueItem[] }>(
        `/api/papers/${state.paperId}/sheets`
      );
      const fetched = data.sheets || [];
      setSheets(fetched);

      // If store has no sheetId or selected sheet is not in batch, select the first sheet
      if (fetched.length > 0 && !state.sheetId) {
        store.setSheet(fetched[0].id, fetched[0].student_name, fetched[0].roll);
      }
    } catch (err: any) {
      // Don't overwrite banner unless persistent
    } finally {
      setIsLoadingSheets(false);
    }
  }, [state.paperId, state.sheetId, store]);

  useEffect(() => {
    loadSheets();
  }, [loadSheets]);

  // 4. Polling for queue rows in transient states
  useEffect(() => {
    if (!state.paperId) return;

    const hasActiveJobs = sheets.some((s) =>
      ['queued', 'uploaded', 'reading_identity', 'reading', 'matching', 'marking', 'flagging'].includes(
        s.status
      )
    );

    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      loadSheets();
    }, 2000);

    return () => clearInterval(interval);
  }, [state.paperId, sheets, loadSheets]);

  // 5. File Validation & Upload Handling
  const validateFiles = (files: File[]): string | null => {
    if (files.length === 0) return 'No files selected.';

    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const maxSizeBytes = 50 * 1024 * 1024; // 50MB
    const minSizeBytes = 500; // 500 bytes

    for (const f of files) {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return `File "${f.name}" has an unsupported format. Only PDF, JPG, and PNG are allowed.`;
      }
      if (f.size > maxSizeBytes) {
        return `File "${f.name}" exceeds the maximum allowed size of 50MB.`;
      }
      if (f.size < minSizeBytes) {
        return `File "${f.name}" is too small or empty (min 500 bytes).`;
      }
    }
    return null;
  };

  const handleUploadFiles = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    setUploadError(null);

    const validationErr = validateFiles(rawFiles);
    if (validationErr) {
      setUploadError(validationErr);
      return;
    }

    if (!state.paperId) {
      setUploadError('No question paper is selected.');
      return;
    }

    if (!state.paperIsLocked) {
      setUploadError(
        'The question paper must be locked before uploading student answer sheets.'
      );
      return;
    }

    try {
      if (splitFiles) {
        // Upload each file as a separate sheet sequentially
        for (let i = 0; i < rawFiles.length; i++) {
          const file = rawFiles[i];
          const formData = new FormData();
          formData.append('files', file);

          await apiClient.uploadWithProgress(
            `/api/papers/${state.paperId}/sheets`,
            formData,
            (pct) => {
              const overall = Math.round(((i + pct / 100) / rawFiles.length) * 100);
              setUploadingProgress(overall);
            }
          );
        }
      } else {
        // Group all files into a single multi-page sheet
        const formData = new FormData();
        rawFiles.forEach((file) => {
          formData.append('files', file);
        });

        await apiClient.uploadWithProgress(
          `/api/papers/${state.paperId}/sheets`,
          formData,
          (pct) => setUploadingProgress(pct)
        );
      }

      setUploadingProgress(null);
      await loadSheets();
    } catch (err: any) {
      setUploadingProgress(null);
      setUploadError(err.message || 'Failed to upload answer sheets.');
    }
  };

  // Drag and drop event handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleSelectPaper = (paperId: string) => {
    const p = papers.find((item) => item.id === paperId);
    if (p) {
      store.setPaper({
        id: p.id,
        title: p.title,
        totalMarks: p.total_marks,
        isLocked: Boolean(p.is_locked),
      });
      store.setSheet(null);
    }
  };

  const handleStartProcessing = () => {
    if (sheets.length > 0) {
      const firstSheetId = state.sheetId || sheets[0].id;
      store.setStep('processing', firstSheetId);
    }
  };

  return (
    <div className="panel grid grid-cols-1 md:grid-cols-2 gap-4 p-4 h-full min-h-0">
      {/* LEFT COLUMN: Paper status & Drop zone */}
      <section
        aria-label="Upload Intake"
        className="flex flex-col gap-3 min-h-0 h-full"
      >
        {/* Paper Selector & Lock State Banner */}
        <div className="p-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-card)] shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--ink-secondary)] uppercase tracking-wider">
              Target Question Paper
            </span>
            {state.paperIsLocked ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--status-approved)] bg-[var(--status-approved-bg)] border border-[var(--status-approved-border)] px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3.5 h-3.5" /> Locked ✓
              </span>
            ) : (
              <a
                href="#/setup"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--status-flagged)] bg-[var(--status-flagged-bg)] border border-[var(--status-flagged-border)] px-2 py-0.5 rounded-full hover:underline"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Unlocked (Click to Setup)
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={state.paperId || ''}
              onChange={(e) => handleSelectPaper(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-xs rounded-md border border-[var(--surface-border)] bg-[var(--surface-bg)] text-[var(--ink-primary)] font-medium focus:outline-none focus:border-[var(--accent-indigo)]"
            >
              {papers.length === 0 ? (
                <option value="">No papers available</option>
              ) : (
                papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.total_marks}M) {p.is_locked ? '· Locked' : '· Draft'}
                  </option>
                ))
              )}
            </select>
            <a
              href="#/setup"
              className="px-2 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:text-[var(--accent-indigo)] border border-[var(--surface-border)] rounded-md hover:bg-[var(--surface-subtle)] transition flex items-center gap-1"
              title="Configure Paper"
            >
              <Settings className="w-3.5 h-3.5" />
            </a>
          </div>

          {state.paperQuestionCount > 0 && (
            <p className="text-[11px] text-[var(--ink-muted)]">
              {state.paperQuestionCount} questions detected · {state.paperTotalMarks} total marks
            </p>
          )}
        </div>

        {/* Large Drag and Drop Zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 flex flex-col items-center justify-center rounded-lg p-6 text-center select-none cursor-pointer transition-all min-h-[180px] ${
            isDragOver
              ? 'border-2 border-solid border-[var(--accent-indigo)] bg-[var(--accent-indigo-subtle)]/30 scale-[1.02]'
              : 'border-2 border-dashed border-[var(--surface-border)] bg-[var(--surface-card)] hover:border-[var(--accent-indigo)] hover:bg-[var(--accent-indigo-subtle)]/10'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleUploadFiles(e.target.files);
              }
            }}
            multiple
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="hidden"
          />

          <div className="w-12 h-12 rounded-full bg-[var(--accent-indigo-subtle)] text-[var(--accent-indigo)] flex items-center justify-center mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>

          <h2 className="text-sm font-semibold text-[var(--ink-primary)] mb-1">
            Drop student sheets here
          </h2>
          <p className="text-xs text-[var(--ink-muted)] mb-3 max-w-xs leading-normal">
            or click to browse · Accepts PDF, JPG, PNG (multi-page)
          </p>

          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-indigo)] bg-[var(--accent-indigo-subtle)] px-3 py-1 rounded-md">
            <FileText className="w-3.5 h-3.5" />
            Browse files
          </span>

          {/* Upload Progress Indicator */}
          {uploadingProgress !== null && (
            <div className="w-full max-w-xs mt-4 space-y-1">
              <div className="flex justify-between text-xs text-[var(--ink-secondary)]">
                <span>Uploading batch...</span>
                <span className="tabular-nums font-semibold">{uploadingProgress}%</span>
              </div>
              <div className="w-full bg-[var(--surface-subtle)] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[var(--accent-indigo)] h-full transition-all duration-200"
                  style={{ width: `${uploadingProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Validation or Upload Error Banner */}
        {uploadError && (
          <div className="p-2.5 rounded-lg bg-[var(--status-failed-bg)] border border-[var(--status-failed-border)] text-xs text-[var(--status-failed)] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-[10px] font-bold uppercase underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Grouping Toggle Control */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-card)] shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--ink-muted)]" />
            <span className="text-xs text-[var(--ink-secondary)]">
              Treat each file as a separate sheet
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={splitFiles}
              onChange={(e) => setSplitFiles(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[var(--surface-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-indigo)]" />
          </label>
        </div>
      </section>

      {/* RIGHT COLUMN: Live Batch Queue */}
      <section
        aria-label="Upload Queue"
        className="flex flex-col border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)] p-4 min-h-0 h-full"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)] mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--ink-primary)]">
              Upload Queue (This Batch)
            </h3>
            {isLoadingSheets && (
              <RefreshCw className="w-3.5 h-3.5 text-[var(--ink-muted)] animate-spin" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--ink-muted)] tabular-nums">
              {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'}
            </span>
            <button
              type="button"
              onClick={loadSheets}
              className="p-1 text-[var(--ink-muted)] hover:text-[var(--accent-indigo)] rounded hover:bg-[var(--surface-subtle)]"
              title="Refresh Queue"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable list of queue rows */}
        <div className="panel flex-1 space-y-2.5 overflow-y-auto pr-1">
          {sheets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--ink-muted)]">
              <UploadCloud className="w-8 h-8 mb-2 stroke-1 text-[var(--ink-faint)]" />
              <p className="text-xs font-medium text-[var(--ink-secondary)]">No sheets in queue</p>
              <p className="text-[11px] text-[var(--ink-muted)] mt-1">
                Drop PDF or image files on the left to begin batch intake.
              </p>
            </div>
          ) : (
            sheets.map((sheet) => (
              <QueueRow
                key={sheet.id}
                sheet={sheet}
                isActive={sheet.id === state.sheetId}
                onSelect={() => {
                  store.setSheet(sheet.id, sheet.student_name, sheet.roll);
                }}
                onRefresh={loadSheets}
                onError={(err) => {
                  store.setError(err);
                }}
              />
            ))
          )}
        </div>

        {/* Bottom Start Action Button within Queue */}
        <div className="pt-3 mt-3 border-t border-[var(--surface-border)] flex items-center justify-between shrink-0">
          <div className="text-xs text-[var(--ink-muted)]">
            {sheets.length > 0
              ? `${sheets.length} sheets queued for evaluation`
              : 'Upload sheets to enable processing'}
          </div>
          <button
            type="button"
            onClick={handleStartProcessing}
            disabled={sheets.length === 0 || !state.paperIsLocked}
            className="px-4 py-1.5 text-xs font-semibold rounded-md bg-[var(--accent-indigo)] text-white hover:bg-[var(--accent-indigo-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-sm"
          >
            Start Processing <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
};
