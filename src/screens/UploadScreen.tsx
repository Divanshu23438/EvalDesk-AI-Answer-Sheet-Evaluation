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
  Sparkles,
  Zap,
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

      if (paperList.length > 0) {
        // If current paperId is valid, keep it; otherwise select most recent locked paper
        const currentSelected = paperList.find((p) => p.id === state.paperId);
        const targetPaper =
          currentSelected || paperList.find((p) => Boolean(p.is_locked)) || paperList[0];

        if (targetPaper && (!state.paperId || targetPaper.id !== state.paperId)) {
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

  // 2. Fetch paper details and questions count
  useEffect(() => {
    if (!state.paperId) return;

    let isMounted = true;
    const fetchPaperDetails = async () => {
      try {
        const details = await apiClient.get<any>(`/api/papers/${state.paperId}`);
        if (!isMounted) return;

        const paperObj = details.paper || details;
        const qCount = (details.questions || []).length;

        store.setPaper({
          id: paperObj.id,
          title: paperObj.title,
          totalMarks: paperObj.total_marks,
          questionCount: qCount,
          isLocked: Boolean(paperObj.is_locked),
        });
      } catch (err) {
        // Fallback silently if details fetch fails
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
    }, 1500);

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
      setUploadError('No question paper is selected. Please setup or select a paper first.');
      return;
    }

    if (!state.paperIsLocked) {
      setUploadError(
        'The question paper must be locked before uploading student answer sheets. Click "Open Paper Setup" to lock.'
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

  const handleStartProcessingOrOpen = () => {
    if (sheets.length === 0) return;
    const targetId = state.sheetId || sheets[0].id;
    store.setStep('evaluate', targetId);
  };

  const readyCount = sheets.filter((s) => ['evaluated', 'ready'].includes(s.status)).length;
  const flaggedCount = sheets.filter((s) => ['needs_review', 'flagged', 'needs_identity'].includes(s.status)).length;
  const failedCount = sheets.filter((s) => ['failed', 'error'].includes(s.status)).length;

  return (
    <div className="panel h-full min-h-0 bg-slate-50 p-4 md:p-6 overflow-hidden select-none">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full max-w-7xl mx-auto w-full min-h-0">
        {/* LEFT COLUMN: Student Answer Sheet Intake Card */}
        <section
          aria-label="Upload Intake"
          className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between h-full min-h-0"
        >
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {/* Header and Non-blocking Paper Context Status Banner */}
            <div className="flex items-start justify-between gap-2 shrink-0">
              <div>
                <h1 className="text-base font-bold text-slate-900 tracking-tight">
                  Upload Student Answer Sheets
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add scanned student scripts for AI bounding box matching and rubric evaluation
                </p>
              </div>
              <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-1 rounded-md border border-indigo-100 flex items-center gap-1 shrink-0">
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                V2 Engine
              </span>
            </div>

            {/* Decoupled Paper Status Pill / Warning Banner */}
            {state.paperIsLocked ? (
              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="text-xs text-slate-700 truncate">
                    <span className="font-bold text-emerald-900">Locked Paper Scheme:</span>{' '}
                    <span className="font-medium text-slate-800">{state.paperTitle || 'Assessment Paper'}</span>{' '}
                    <span className="text-slate-500 tabular-nums">
                      · {state.paperQuestionCount} Questions · {state.paperTotalMarks} Marks
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => store.setStep('setup')}
                  className="px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 hover:underline shrink-0 flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  <span>Setup / Change</span>
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/80 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-900 leading-tight">
                    <strong>No locked question paper.</strong> Configure and lock an assessment before evaluating sheets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => store.setStep('setup')}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition shadow-2xs shrink-0 flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  <span>Open Paper Setup</span>
                </button>
              </div>
            )}

            {/* Large Drag and Drop Target Area */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 flex flex-col items-center justify-center rounded-xl p-6 text-center select-none cursor-pointer transition-all min-h-[160px] group ${
                isDragOver
                  ? 'border-2 border-solid border-indigo-600 bg-indigo-50/60 scale-[1.01]'
                  : 'border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/30 hover:bg-indigo-50/50'
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

              <div className="w-14 h-14 rounded-full bg-indigo-100 group-hover:bg-indigo-200 group-hover:scale-105 text-indigo-600 flex items-center justify-center mb-3 transition shadow-xs">
                <UploadCloud className="w-7 h-7" />
              </div>

              <h2 className="text-sm font-semibold text-slate-800 mb-1">
                Drop handwritten student answer sheets here
              </h2>
              <p className="text-xs text-slate-500 mb-3 max-w-sm leading-normal">
                or click to browse · Supports multi-page PDF, JPG, PNG (up to 50MB per sheet)
              </p>

              <button
                type="button"
                className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg shadow-2xs transition flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>Select Files from Computer</span>
              </button>

              {/* Upload Progress Indicator */}
              {uploadingProgress !== null && (
                <div className="w-full max-w-xs mt-3 space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Uploading batch...</span>
                    <span className="tabular-nums font-semibold font-mono">{uploadingProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full transition-all duration-200"
                      style={{ width: `${uploadingProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Validation or Upload Error Banner */}
            {uploadError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
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
          </div>

          {/* Intake Settings & Feature Chips */}
          <div className="pt-3.5 border-t border-slate-200 space-y-2.5 shrink-0 mt-3">
            {/* Multi-page Toggle Switch */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700">
                  Treat each file as a separate sheet
                </span>
                <p className="text-[11px] text-slate-400">
                  When OFF, multiple selected images are compiled into 1 student booklet
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitFiles}
                  onChange={(e) => setSplitFiles(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
              </label>
            </div>

            {/* Feature Chips Row */}
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                Auto-detect Roll No. & Name: <strong className="text-emerald-700">ON</strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                Bilingual OCR: <strong className="text-slate-800">Hindi + English</strong>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                <Layers className="w-3 h-3 text-slate-500" />
                Skew Correction: <strong className="text-slate-800">Auto</strong>
              </span>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Uploaded Batch Queue Card */}
        <section
          aria-label="Upload Queue"
          className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-full overflow-hidden min-h-0"
        >
          {/* Queue Header */}
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-slate-900">Uploaded Batch Queue</h2>
              <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-0.5 rounded-full font-mono">
                {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'}
              </span>
              {isLoadingSheets && (
                <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={loadSheets}
                className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 transition"
                title="Refresh Queue"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable Queue Cards Area */}
          <div className="panel flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {sheets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <UploadCloud className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
                <p className="text-xs font-semibold text-slate-700">No sheets in queue</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                  Drop PDF or scanned answer sheets on the left to begin intake and automatic OCR evaluation.
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
                    // Open in evaluation workspace immediately
                    store.setStep('evaluate', sheet.id);
                  }}
                  onRefresh={loadSheets}
                  onError={(err) => {
                    store.setError(err);
                  }}
                />
              ))
            )}
          </div>

          {/* Bottom Summary & Start CTA */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center gap-1 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <strong className="font-semibold text-slate-900">{readyCount}</strong> Ready
              </span>
              {flaggedCount > 0 && (
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <strong className="font-semibold text-slate-900">{flaggedCount}</strong> Attention
                </span>
              )}
              {failedCount > 0 && (
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <strong className="font-semibold text-slate-900">{failedCount}</strong> Failed
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleStartProcessingOrOpen}
              disabled={sheets.length === 0 || !state.paperIsLocked}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-sm"
            >
              <span>Open Evaluation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
