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
  Lock,
  Unlock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  FileUp,
} from 'lucide-react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { QueueRow, SheetQueueItem } from '../components/QueueRow';
import { PaperDetailsForm, type PaperMeta } from '../components/PaperDetailsForm';
import { StrictnessPicker } from '../components/StrictnessPicker';
import { IdentityForm } from '../components/IdentityForm';
import { PageFlipStrip, type SheetPageStatus } from '../components/PageFlipStrip';

interface PaperSummary {
  id: string;
  title: string;
  subject?: string;
  total_marks: number;
  is_locked: boolean | number;
  created_at?: string;
}

interface QuestionItem {
  id?: string;
  key?: string;
  q_no: string;
  question_text: string;
  max_marks: number;
  question_type: string;
  section_name: string;
  model_answer?: string;
  key_points?: any[];
  source?: string;
  strictness_override?: number | null;
}

// Per-page OCR status comes from the server (GET /api/papers/{id}/sheets -> sheets[].pages)
type SheetRow = SheetQueueItem & { pages?: SheetPageStatus[] };

const ACTIVE_STATUSES = ['queued', 'uploaded', 'evaluating', 'reading_identity', 'reading', 'matching', 'marking', 'flagging'];

interface SectionItem {
  id?: string;
  name: string;
  instructions: string;
  attempt_n: number;
  total_questions: number;
  marks_each: number;
  section_marks: number;
  policy: string;
}

export const UploadScreen: React.FC = () => {
  const [state, store] = useSheetStore();

  // Papers and sheets list
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [sheets, setSheets] = useState<SheetRow[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);

  // Card A: Question Paper & Answer Key state
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [hasAnswerKey, setHasAnswerKey] = useState(false);
  const [isExtractingPaper, setIsExtractingPaper] = useState(false);
  const [isExtractingKey, setIsExtractingKey] = useState(false);
  const [isPaperDrawerOpen, setIsPaperDrawerOpen] = useState(false);
  const [isPaperDragOver, setIsPaperDragOver] = useState(false);
  const [isKeyDragOver, setIsKeyDragOver] = useState(false);
  const [isGeneratingRubric, setIsGeneratingRubric] = useState(false);
  const [paperMessage, setPaperMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [newPaperTitle, setNewPaperTitle] = useState('');
  const [isCreatingNewPaper, setIsCreatingNewPaper] = useState(false);
  const [paperMeta, setPaperMeta] = useState<PaperMeta | null>(null);
  const [newPaperMeta, setNewPaperMeta] = useState<PaperMeta>({
    title: '',
    subject: '',
    subject_code: '',
    exam_name: '',
    strictness_level: 3,
    subject_domain: 'general',
  });
  const [editingIdentitySheetIds, setEditingIdentitySheetIds] = useState<Set<string>>(new Set());

  // Card B: Student Sheets state
  const [isSheetDragOver, setIsSheetDragOver] = useState(false);
  const [splitFiles, setSplitFiles] = useState(false); // "Treat each file as a separate sheet"
  const [uploadingProgress, setUploadingProgress] = useState<number | null>(null);
  const [sheetUploadError, setSheetUploadError] = useState<string | null>(null);

  // File input refs (strictly isolated)
  const paperFileInputRef = useRef<HTMLInputElement>(null);
  const keyFileInputRef = useRef<HTMLInputElement>(null);
  const sheetFileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch available papers and select the active locked paper
  const loadPapers = useCallback(async () => {
    try {
      const data = await apiClient.get<{ papers: PaperSummary[] }>('/api/papers');
      const paperList = data.papers || [];
      setPapers(paperList);

      if (paperList.length > 0) {
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

  // 2. Fetch paper details and questions list
  const loadPaperDetails = useCallback(async (paperId: string) => {
    try {
      const details = await apiClient.get<any>(`/api/papers/${paperId}`);
      const paperObj = details.paper || details;

      const qList: QuestionItem[] = (details.questions || []).map((q: any) => ({
        id: q.id,
        key: q.key || q.q_no,
        q_no: q.q_no,
        question_text: q.question_text || q.text || '',
        max_marks: q.max_marks || q.marks || 1,
        question_type: q.question_type || q.type || 'short',
        section_name: q.section_name || q.section || 'Part I',
        strictness_override: q.strictness_override ?? null,
      }));

      // Match references if present
      const refMap = new Map<string, any>();
      let hasTeacherKey = Boolean(paperObj.has_answer_key);
      (details.references || []).forEach((r: any) => {
        if (r.key) refMap.set(r.key, r);
        if (r.question_id) refMap.set(r.question_id, r);
        if (r.source === 'teacher_key') hasTeacherKey = true;
      });

      const enriched = qList.map((q) => {
        const ref =
          (q.key ? refMap.get(q.key) : undefined) ||
          (q.id ? refMap.get(q.id) : undefined) ||
          (q.q_no ? refMap.get(q.q_no) : undefined);
        return {
          ...q,
          model_answer: ref ? ref.model_answer : '',
          key_points: ref ? ref.key_points || [] : [],
          source: ref ? ref.source : undefined,
        };
      });

      setQuestions(enriched);
      setSections(details.sections || []);
      setHasAnswerKey(hasTeacherKey);

      store.setPaper({
        id: paperObj.id,
        title: paperObj.title,
        totalMarks: paperObj.total_marks,
        questionCount: enriched.length,
        isLocked: Boolean(paperObj.is_locked),
      });

      setPaperMeta({
        title: paperObj.title ?? '',
        subject: paperObj.subject ?? '',
        subject_code: paperObj.subject_code ?? '',
        exam_name: paperObj.exam_name ?? '',
        strictness_level: Number(paperObj.strictness_level) || 3,
        subject_domain: paperObj.subject_domain || 'general',
      });
    } catch (err: any) {
      setPaperMessage({ type: 'error', text: err.message || 'Could not load paper details.' });
    }
  }, [store]);

  useEffect(() => {
    if (state.paperId) {
      setPaperMeta(null);
      loadPaperDetails(state.paperId);
    }
  }, [state.paperId, loadPaperDetails]);

  // 3. Fetch sheets for current paper
  const loadSheets = useCallback(async () => {
    if (!state.paperId) return;
    setIsLoadingSheets(true);
    try {
      const data = await apiClient.get<{ sheets: SheetRow[] }>(
        `/api/papers/${state.paperId}/sheets`
      );
      const fetched = data.sheets || [];
      setSheets(fetched);

      if (fetched.length > 0 && !state.sheetId) {
        store.setSheet(fetched[0].id, fetched[0].student_name, fetched[0].roll);
      }
    } catch (err: any) {
      // Don't overwrite unless persistent
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

    const hasActiveJobs = sheets.some((s) => ACTIVE_STATUSES.includes(s.status));

    if (!hasActiveJobs) return;

    const hasReading = sheets.some(
      (s: any) => s.stage_key === 'reading' || (s.pages && s.pages.some((p: any) => p.status === 'reading'))
    );
    const intervalTime = hasReading ? 1000 : 1500;

    const interval = setInterval(() => {
      loadSheets();
    }, intervalTime);

    return () => clearInterval(interval);
  }, [state.paperId, sheets, loadSheets]);

  // ----------------------------------------------------
  // CARD A ACTIONS: Question Paper Intake, Lock, Edit
  // ----------------------------------------------------

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
    } else {
      store.setPaper({ id: paperId });
      store.setSheet(null);
    }
  };

  const savePaperMeta = async (patch: Partial<PaperMeta>) => {
    if (!state.paperId || !paperMeta) return;
    const previous = Object.fromEntries(
      Object.keys(patch).map((k) => [k, paperMeta[k as keyof PaperMeta]])
    ) as Partial<PaperMeta>;
    setPaperMeta((m) => (m ? { ...m, ...patch } : m));
    try {
      await apiClient.patch(`/api/papers/${state.paperId}`, patch);
      if (patch.title) {
        store.setPaper({ id: state.paperId, title: patch.title });
        await loadPapers();
      }
    } catch (err: any) {
      setPaperMeta((m) => (m ? { ...m, ...previous } : m));
      setPaperMessage({ type: 'error', text: err.message || 'Could not save paper details.' });
    }
  };

  const handleCreatePaper = async () => {
    const title = (newPaperMeta.title || newPaperTitle).trim();
    if (!title) {
      setPaperMessage({ type: 'error', text: 'Please enter an assessment title.' });
      return;
    }
    try {
      const res = await apiClient.post<any>('/api/papers', {
        title,
        subject: newPaperMeta.subject.trim(),
        subject_code: newPaperMeta.subject_code.trim(),
        exam_name: newPaperMeta.exam_name.trim(),
        strictness_level: newPaperMeta.strictness_level || 3,
        subject_domain: newPaperMeta.subject_domain || 'general',
        checking_medium: 'ai_reference',
      });
      setNewPaperTitle('');
      setNewPaperMeta({
        title: '',
        subject: '',
        subject_code: '',
        exam_name: '',
        strictness_level: 3,
        subject_domain: 'general',
      });
      setIsCreatingNewPaper(false);
      setPaperMessage({ type: 'success', text: 'Created new assessment paper.' });
      const createdId = res.id || res.paper_id;
      if (createdId) {
        store.setPaper({
          id: createdId,
          title: res.title || title,
          totalMarks: 0,
          questionCount: 0,
          isLocked: false,
        });
        store.setSheet(null);
        await loadPaperDetails(createdId);
      }
      await loadPapers();
    } catch (err: any) {
      setPaperMessage({ type: 'error', text: err.message || 'Failed to create paper.' });
    }
  };

  const handleUploadPaperFile = async (fileOrEvent: React.ChangeEvent<HTMLInputElement> | File) => {
    let file: File | undefined;
    if ('target' in fileOrEvent) {
      file = fileOrEvent.target.files?.[0];
    } else {
      file = fileOrEvent;
    }
    if (!file) return;

    // Validate file type & size
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (!allowed.includes(ext)) {
      setPaperMessage({
        type: 'error',
        text: `File "${file.name}" has an unsupported format. Please upload a PDF, JPG, or PNG document.`,
      });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setPaperMessage({
        type: 'error',
        text: `File "${file.name}" exceeds the maximum allowed size of 50MB.`,
      });
      return;
    }

    setIsExtractingPaper(true);
    setPaperMessage(null);
    try {
      let targetPaperId: string = state.paperId || '';
      const defaultTitle = file.name.replace(/\.[^/.]+$/, '').trim() || 'New Assessment';

      // Auto-create a draft paper first if none selected
      if (!targetPaperId) {
        const createRes = await apiClient.post<any>('/api/papers', {
          title: defaultTitle,
          subject: '',
          strictness_level: 3,
          subject_domain: 'general',
          checking_medium: 'ai_reference',
        });
        targetPaperId = String(createRes.paper_id);
        store.setPaper({
          id: targetPaperId,
          title: defaultTitle,
          totalMarks: 0,
          isLocked: false,
        });
        store.setSheet(null);
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('paper_file', file);

      const res = await apiClient.post<any>(`/api/papers/${targetPaperId}/upload`, formData);

      store.setPaper({
        id: targetPaperId,
        title: res.paper_title || defaultTitle,
        totalMarks: res.total_marks || 0,
        questionCount: res.questions_count || res.questions?.length || 0,
        isLocked: false,
      });

      setPaperMessage({
        type: 'success',
        text: `Extracted ${res.questions_count || res.questions?.length || 0} questions from "${file.name}".`,
      });

      await loadPapers();
      if (targetPaperId) {
        await loadPaperDetails(targetPaperId);
      }
    } catch (err: any) {
      setPaperMessage({
        type: 'error',
        text: err.message || 'Failed to extract questions from uploaded document.',
      });
    } finally {
      setIsExtractingPaper(false);
      if (paperFileInputRef.current) paperFileInputRef.current.value = '';
    }
  };

  const handleUploadKeyFile = async (fileOrEvent: React.ChangeEvent<HTMLInputElement> | File) => {
    let file: File | undefined;
    if ('target' in fileOrEvent) {
      file = fileOrEvent.target.files?.[0];
    } else {
      file = fileOrEvent;
    }
    if (!file) return;

    if (!state.paperId || questions.length === 0) {
      setPaperMessage({
        type: 'error',
        text: 'Please upload the Question Paper first so the answer key can be mapped to its questions.',
      });
      return;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
    if (!allowed.includes(ext)) {
      setPaperMessage({
        type: 'error',
        text: `File "${file.name}" has an unsupported format. Please upload a PDF, JPG, PNG, or DOCX document.`,
      });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setPaperMessage({
        type: 'error',
        text: `File "${file.name}" exceeds the maximum allowed size of 50MB.`,
      });
      return;
    }

    setIsExtractingKey(true);
    setPaperMessage(null);
    try {
      const formData = new FormData();
      formData.append('answer_key_file', file);
      formData.append('file', file);

      const res = await apiClient.post<any>(`/api/papers/${state.paperId}/answer-key`, formData);
      setHasAnswerKey(true);
      setPaperMessage({
        type: 'success',
        text: `Answer Key parsed and linked (${res.references?.length || questions.length} questions mapped).`,
      });
      await loadPaperDetails(state.paperId);
      await loadPapers();
    } catch (err: any) {
      setPaperMessage({
        type: 'error',
        text: err.message || 'Failed to parse teacher answer key.',
      });
    } finally {
      setIsExtractingKey(false);
      if (keyFileInputRef.current) keyFileInputRef.current.value = '';
    }
  };

  const handleLockPaper = async () => {
    if (!state.paperId) return;
    if (questions.length === 0) {
      setPaperMessage({
        type: 'error',
        text: 'Cannot lock paper with 0 questions. Please upload a question paper or add questions first.',
      });
      return;
    }

    try {
      let res: any;
      try {
        res = await apiClient.post<any>(`/api/papers/${state.paperId}/lock`, {});
      } catch (lockErr: any) {
        if (lockErr.message && lockErr.message.toLowerCase().includes('reference')) {
          setPaperMessage({ type: 'info', text: 'Generating answer references before locking...' });
          await apiClient.post(`/api/papers/${state.paperId}/reference/generate`, {});
          res = await apiClient.post<any>(`/api/papers/${state.paperId}/lock`, {});
        } else {
          throw lockErr;
        }
      }

      setPaperMessage({
        type: 'success',
        text: `Paper locked with ${res.questions_count || questions.length} questions. Ready for student sheets!`,
      });

      store.setPaper({
        id: state.paperId,
        title: res.title || state.paperTitle,
        totalMarks: res.total_marks || state.paperTotalMarks,
        questionCount: res.questions_count || questions.length,
        isLocked: true,
      });

      await loadPaperDetails(state.paperId);
      setIsPaperDrawerOpen(false);
    } catch (err: any) {
      setPaperMessage({
        type: 'error',
        text: err.message || 'Failed to lock paper.',
      });
    }
  };

  const handleUnlockPaper = async () => {
    if (!state.paperId) return;
    if (!window.confirm('Unlocking will reset any evaluated sheets for this paper. Continue?')) {
      return;
    }

    try {
      await apiClient.post(`/api/papers/${state.paperId}/unlock`, {});
      setPaperMessage({
        type: 'success',
        text: 'Paper unlocked for editing.',
      });

      store.setPaper({
        id: state.paperId,
        isLocked: false,
      });

      await loadPaperDetails(state.paperId);
    } catch (err: any) {
      setPaperMessage({
        type: 'error',
        text: err.message || 'Failed to unlock paper.',
      });
    }
  };

  const handleSaveQuestionsDrawer = async () => {
    if (!state.paperId) return;
    try {
      await apiClient.put(`/api/papers/${state.paperId}/questions`, {
        questions: questions.map((q, idx) => ({
          id: q.id,
          q_no: q.q_no || String(idx + 1),
          question_text: q.question_text,
          max_marks: Number(q.max_marks) || 1,
          question_type: q.question_type || 'short',
          section_name: q.section_name || 'Part I',
          strictness_override: q.strictness_override ?? null,
        })),
        sections: sections.map((s) => ({
          id: s.id,
          name: s.name,
          instructions: s.instructions,
          attempt_n: Number(s.attempt_n) || 0,
          total_questions: Number(s.total_questions) || 0,
          marks_each: Number(s.marks_each) || 0,
          section_marks: Number(s.section_marks) || 0,
          policy: s.policy || 'best_n',
        })),
      });

      setPaperMessage({ type: 'success', text: 'Questions and rubric saved successfully.' });
      await loadPaperDetails(state.paperId);
    } catch (err: any) {
      setPaperMessage({ type: 'error', text: err.message || 'Failed to save question edits.' });
    }
  };

  const handleGenerateRubric = async () => {
    if (!state.paperId) return;
    setIsGeneratingRubric(true);
    try {
      await apiClient.post(`/api/papers/${state.paperId}/reference/generate`, {});
      setPaperMessage({ type: 'success', text: 'AI rubric references generated.' });
      await loadPaperDetails(state.paperId);
    } catch (err: any) {
      setPaperMessage({ type: 'error', text: err.message || 'Rubric generation failed.' });
    } finally {
      setIsGeneratingRubric(false);
    }
  };

  // ----------------------------------------------------
  // CARD B ACTIONS: Student Answer Sheets Intake
  // ----------------------------------------------------

  const validateFiles = (files: File[]): string | null => {
    if (files.length === 0) return 'No files selected.';

    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const maxSizeBytes = 50 * 1024 * 1024;
    const minSizeBytes = 500;

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

  const handleUploadSheetFiles = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    setSheetUploadError(null);

    const validationErr = validateFiles(rawFiles);
    if (validationErr) {
      setSheetUploadError(validationErr);
      return;
    }

    if (!state.paperId) {
      setSheetUploadError('No question paper is selected. Select or upload an exam paper above first.');
      return;
    }

    if (!state.paperIsLocked) {
      setSheetUploadError('Please lock the Question Paper above before uploading student answer sheets.');
      return;
    }

    try {
      if (splitFiles) {
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
      setSheetUploadError(err.message || 'Failed to upload student answer sheets.');
    }
  };

  const onSheetDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSheetDragOver(true);
  };

  const onSheetDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSheetDragOver(false);
  };

  const onSheetDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSheetDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadSheetFiles(e.dataTransfer.files);
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
    <div className="panel h-full min-h-0 bg-slate-50 p-3 overflow-hidden select-none relative">
      <div className="grid grid-cols-1 lg:grid-cols-[36%_28%_36%] gap-3 h-full w-full min-h-0 overflow-hidden">
        
        {/* ==================================================================== */}
        {/* COLUMN 1: Step 1A · Question Paper & Rubric Configuration             */}
        {/* ==================================================================== */}
        <section
          aria-label="Target Question Paper"
          className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3 flex flex-col justify-between h-full min-h-0 overflow-hidden select-none"
        >
            {/* Header: Paper selector, New Paper button, and Lock status badge */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Step 1A · Question Paper
                </span>
                {state.paperIsLocked ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-full">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    Locked ✓
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.2 rounded-full">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Draft (Unlocked)
                  </span>
                )}
              </div>

              {/* Lock / Unlock Toggle Button */}
              <div className="flex items-center gap-1.5">
                {state.paperIsLocked ? (
                  <button
                    type="button"
                    onClick={handleUnlockPaper}
                    className="px-2 py-0.5 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition flex items-center gap-1"
                    title="Unlock Paper for editing"
                  >
                    <Unlock className="w-3 h-3 text-amber-600" />
                    <span>Unlock / Edit</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLockPaper}
                    disabled={questions.length === 0}
                    className="px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition flex items-center gap-1 shadow-2xs"
                    title="Lock Paper and enable student intake"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Lock Paper</span>
                  </button>
                )}
              </div>
            </div>

            {/* Paper Selection Bar & Inline Create */}
            <div className="flex items-center gap-2 mb-2.5">
              {isCreatingNewPaper ? (
                <div className="flex-1 flex items-center justify-between text-xs font-semibold text-indigo-900 bg-indigo-50/70 border border-indigo-200 px-3 py-1.5 rounded-md">
                  <span>Create New Assessment Paper</span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewPaper(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    title="Cancel create"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-2">
                  <select
                    value={state.paperId || ''}
                    onChange={(e) => handleSelectPaper(e.target.value)}
                    className="flex-1 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 focus:outline-none focus:border-indigo-500"
                  >
                    {papers.length === 0 ? (
                      <option value="">No papers available</option>
                    ) : (
                      papers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.total_marks}M) {Boolean(p.is_locked) ? '· Locked ✓' : '· Draft'}
                        </option>
                      ))
                    )}
                  </select>
                  {!state.paperIsLocked && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewPaper(true)}
                      className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 border border-slate-200 hover:bg-slate-50 rounded-md transition flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Paper details (title, subject, code, exam, domain) + strictness 1-5 */}
            {isCreatingNewPaper ? (
              <div className="space-y-2">
                <PaperDetailsForm
                  meta={newPaperMeta}
                  hasTeacherKey={false}
                  onSave={(patch) => setNewPaperMeta((prev) => ({ ...prev, ...patch }))}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewPaper(false)}
                    className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800 rounded-md border border-slate-300 bg-white hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreatePaper}
                    disabled={!newPaperMeta.title.trim() && !newPaperTitle.trim()}
                    className="px-3.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Assessment</span>
                  </button>
                </div>
              </div>
            ) : paperMeta ? (
              <PaperDetailsForm
                key={state.paperId}
                meta={paperMeta}
                hasTeacherKey={hasAnswerKey}
                onSave={savePaperMeta}
              />
            ) : null}

            {/* When Unlocked: Show 2-Column Upload Grid (QP & AK), Status Chips, Section Summary, and Actions */}
            {!state.paperIsLocked ? (
              <div className="space-y-2">
                {/* 2-Column Responsive Upload Grid: QP on Left, AK on Right */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Left: Question Paper Drop Zone */}
                  <input
                    type="file"
                    ref={paperFileInputRef}
                    onChange={handleUploadPaperFile}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                  />
                  <div
                    onClick={() => !isExtractingPaper && paperFileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsPaperDragOver(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsPaperDragOver(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsPaperDragOver(false);
                      const dropped = e.dataTransfer.files?.[0];
                      if (dropped) handleUploadPaperFile(dropped);
                    }}
                    className={`p-2.5 rounded-lg border border-dashed text-xs font-semibold transition flex flex-col items-center justify-center gap-1 cursor-pointer select-none min-h-[64px] ${
                      isPaperDragOver
                        ? 'border-indigo-600 bg-indigo-100/70 text-indigo-900 scale-[1.01]'
                        : questions.length > 0
                        ? 'border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50 text-indigo-800'
                        : 'border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 hover:bg-indigo-50/50 text-indigo-700'
                    }`}
                  >
                    {isExtractingPaper ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                        <span className="font-semibold text-indigo-950">Extracting Questions...</span>
                      </>
                    ) : (
                      <>
                        <FileUp className="w-4 h-4 text-indigo-600" />
                        <span>{questions.length > 0 ? 'Replace Question Paper' : 'Upload Question Paper'}</span>
                        <span className="text-[10px] text-slate-500 font-normal">PDF or Image (Required)</span>
                      </>
                    )}
                  </div>

                  {/* Right: Teacher Answer Key Drop Zone (Optional) */}
                  <input
                    type="file"
                    ref={keyFileInputRef}
                    onChange={handleUploadKeyFile}
                    accept=".pdf,.jpg,.jpeg,.png,.docx"
                    className="hidden"
                  />
                  <div
                    onClick={() => !isExtractingKey && keyFileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsKeyDragOver(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsKeyDragOver(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsKeyDragOver(false);
                      const dropped = e.dataTransfer.files?.[0];
                      if (dropped) handleUploadKeyFile(dropped);
                    }}
                    className={`p-2.5 rounded-lg border border-dashed text-xs font-semibold transition flex flex-col items-center justify-center gap-1 cursor-pointer select-none min-h-[64px] ${
                      isKeyDragOver
                        ? 'border-emerald-600 bg-emerald-100/70 text-emerald-900 scale-[1.01]'
                        : hasAnswerKey
                        ? 'border-emerald-300 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-100/60 text-slate-600'
                    }`}
                  >
                    {isExtractingKey ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                        <span className="font-semibold text-emerald-950">Parsing Answer Key...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className={`w-4 h-4 ${hasAnswerKey ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span>{hasAnswerKey ? 'Replace Answer Key' : 'Upload Teacher Answer Key'}</span>
                        <span className="text-[10px] text-slate-500 font-normal">PDF, Image, DOCX (Optional)</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Chips Row */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
                  {questions.length > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>Question Paper Extracted ({questions.length} Qs · {state.paperTotalMarks}M)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium">
                      <span>No question paper uploaded</span>
                    </span>
                  )}

                  {hasAnswerKey ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>Teacher Answer Key Linked</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">
                      <span>No Answer Key (AI will draft references)</span>
                    </span>
                  )}
                </div>

                {/* Extracted Sections Summary Pills */}
                {sections && sections.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    {sections.map((s, idx) => {
                      const qCount = s.total_questions || questions.filter(q => q.section_name?.toLowerCase() === s.name.toLowerCase()).length;
                      return (
                        <span
                          key={s.id || idx}
                          className="text-[10px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded border border-slate-200"
                        >
                          {s.name}: {qCount} Qs · {s.section_marks || 0}M
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Actions & Drawer Trigger */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 text-[11px]">
                    {questions.length > 0
                      ? 'Review questions & rubric before locking'
                      : 'Upload a question paper to begin'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPaperDrawerOpen(true)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Edit Questions & Rubric</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLockPaper}
                      disabled={questions.length === 0}
                      className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-md transition shadow-2xs flex items-center gap-1"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Lock Paper</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* When Locked: Compact summary display giving room to Card B */
              <div className="flex items-center justify-between text-xs text-slate-600 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">
                    Locked ✓ {state.paperQuestionCount} questions · {state.paperTotalMarks} marks
                  </span>
                  {hasAnswerKey ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                      Teacher Key Linked
                    </span>
                  ) : (
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium">
                      AI Reference Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPaperDrawerOpen(true)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    View Rubric
                  </button>
                  <button
                    type="button"
                    onClick={handleUnlockPaper}
                    className="text-xs font-semibold text-slate-500 hover:text-rose-600 hover:underline flex items-center gap-0.5"
                  >
                    <Unlock className="w-3 h-3" />
                    <span>Unlock</span>
                  </button>
                </div>
              </div>
            )}

            {/* Paper Feedback Message */}
            {paperMessage && (
              <div
                className={`mt-2 p-2 rounded-lg text-xs flex items-center justify-between ${
                  paperMessage.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : paperMessage.type === 'info'
                    ? 'bg-blue-50 border border-blue-200 text-blue-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                <span>{paperMessage.text}</span>
                <button
                  type="button"
                  onClick={() => setPaperMessage(null)}
                  className="text-[10px] font-bold uppercase underline"
                >
                  ✕
                </button>
              </div>
            )}
          </section>

        {/* ==================================================================== */}
        {/* COLUMN 2: Step 1B · Student Answer Sheets Intake                     */}
        {/* ==================================================================== */}
        <section
          aria-label="Student Answer Sheets"
          className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 flex flex-col justify-between h-full min-h-0 overflow-hidden select-none"
        >
            <div className="flex flex-col gap-2.5 min-h-0 flex-1">
              <div className="flex items-start justify-between gap-2 shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    Step 1B · Student Answer Sheets
                  </h2>
                  <p className="text-xs text-slate-500">
                    Add student answer scripts for OCR bounding box alignment and grading
                  </p>
                </div>
                <span className="text-[11px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded border border-slate-200 shrink-0">
                  Fast V2
                </span>
              </div>

              {/* Dedicated Drag-and-Drop Intake Zone for Student Answer Sheets */}
              <div
                onDragOver={onSheetDragOver}
                onDragLeave={onSheetDragLeave}
                onDrop={onSheetDrop}
                onClick={() => {
                  if (state.paperIsLocked) {
                    sheetFileInputRef.current?.click();
                  }
                }}
                className={`flex-1 flex flex-col items-center justify-center rounded-xl p-5 text-center select-none transition-all min-h-[140px] group ${
                  !state.paperIsLocked
                    ? 'border-2 border-dashed border-slate-200 bg-slate-50/50 cursor-not-allowed opacity-75'
                    : isSheetDragOver
                    ? 'border-2 border-solid border-indigo-600 bg-indigo-50/60 scale-[1.01] cursor-pointer'
                    : 'border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/30 hover:bg-indigo-50/50 cursor-pointer'
                }`}
              >
                <input
                  type="file"
                  ref={sheetFileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleUploadSheetFiles(e.target.files);
                    }
                  }}
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  disabled={!state.paperIsLocked}
                />

                <div className="w-12 h-12 rounded-full bg-indigo-100 group-hover:bg-indigo-200 group-hover:scale-105 text-indigo-600 flex items-center justify-center mb-2.5 transition shadow-xs">
                  <UploadCloud className="w-6 h-6" />
                </div>

                <h3 className="text-xs font-semibold text-slate-800 mb-0.5">
                  {state.paperIsLocked
                    ? 'Drop handwritten student answer sheets here'
                    : 'Lock the Question Paper above to enable sheet upload'}
                </h3>
                <p className="text-[11px] text-slate-500 mb-2.5 max-w-xs leading-normal">
                  {state.paperIsLocked
                    ? 'or click to browse · Supports multi-page PDF, JPG, PNG (up to 50MB)'
                    : 'Question paper must be locked before student answer scripts can be evaluated.'}
                </p>

                {state.paperIsLocked && (
                  <button
                    type="button"
                    className="px-3 py-1 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg shadow-2xs transition flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Select Student Scripts</span>
                  </button>
                )}

                {/* Upload Progress Bar */}
                {uploadingProgress !== null && (
                  <div className="w-full max-w-xs mt-3 space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-600">
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

              {/* Sheet Upload Error Banner */}
              {sheetUploadError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{sheetUploadError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheetUploadError(null)}
                    className="text-[10px] font-bold uppercase underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Intake Settings & Feature Chips */}
            <div className="pt-3 border-t border-slate-200 space-y-2 shrink-0 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-700">
                    Treat each file as a separate sheet
                  </span>
                  <p className="text-[10px] text-slate-400">
                    When OFF, multiple images compile into 1 student booklet
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={splitFiles}
                    onChange={(e) => setSplitFiles(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  Auto-detect Roll No. & Name: <strong className="text-emerald-700">ON</strong>
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                  OCR: <strong className="text-slate-800">Hindi + English</strong>
                </span>
              </div>
            </div>
          </section>

        {/* ==================================================================== */}
        {/* COLUMN 3: Uploaded Batch Queue                                       */}
        {/* ==================================================================== */}
        <aside
          aria-label="Uploaded Batch Queue"
          className="bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col h-full min-h-0 overflow-hidden"
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
                  Drop scanned answer sheets on the left to begin intake and automatic OCR evaluation.
                </p>
              </div>
            ) : (
              sheets.map((sheet) => (
                <div key={sheet.id} className="space-y-1.5">
                  <QueueRow
                    sheet={sheet}
                    isActive={sheet.id === state.sheetId}
                    onSelect={() => {
                      store.setSheet(sheet.id, sheet.student_name, sheet.roll);
                      store.setStep('evaluate', sheet.id);
                    }}
                    onRefresh={loadSheets}
                    onError={(err) => {
                      store.setError(err);
                    }}
                    onEditIdentity={() => {
                      setEditingIdentitySheetIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(sheet.id)) next.delete(sheet.id);
                        else next.add(sheet.id);
                        return next;
                      });
                    }}
                  />
                  {(sheet.status === 'needs_identity' || editingIdentitySheetIds.has(sheet.id)) && (
                    <IdentityForm
                      sheetId={sheet.id}
                      initialName={sheet.student_name || ''}
                      initialRoll={sheet.roll || ''}
                      onSaved={() => {
                        setEditingIdentitySheetIds((prev) => {
                          const next = new Set(prev);
                          next.delete(sheet.id);
                          return next;
                        });
                        loadSheets();
                      }}
                      onCancel={() => {
                        setEditingIdentitySheetIds((prev) => {
                          const next = new Set(prev);
                          next.delete(sheet.id);
                          return next;
                        });
                      }}
                    />
                  )}
                  {((ACTIVE_STATUSES.includes(sheet.status) || sheet.status === 'needs_identity' || sheet.status === 'failed') && sheet.pages && sheet.pages.length > 0) && (
                    <PageFlipStrip pages={sheet.pages} />
                  )}
                </div>
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
        </aside>
      </div>

      {/* ==================================================================== */}
      {/* INLINE QUESTION & RUBRIC EDITOR DRAWER (Slide-over on #/upload)       */}
      {/* ==================================================================== */}
      {isPaperDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-2xs">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col min-h-0 border-l border-slate-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Questions & Rubric Reference</span>
                  {state.paperIsLocked ? (
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded-full">
                      Locked ✓
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.2 rounded-full">
                      Draft
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {questions.length} questions · {state.paperTotalMarks} total marks
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaperDrawerOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body: Questions List */}
            <div className="panel flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  disabled={state.paperIsLocked || isGeneratingRubric}
                  onClick={handleGenerateRubric}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Generate AI Rubric References</span>
                </button>

                {!state.paperIsLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextQ = String(questions.length + 1);
                      setQuestions([
                        ...questions,
                        {
                          q_no: nextQ,
                          question_text: '',
                          max_marks: 2.0,
                          question_type: 'short',
                          section_name: 'Part I',
                        },
                      ]);
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Question</span>
                  </button>
                )}
              </div>

              {questions.map((q, idx) => (
                <div key={q.key || idx} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-slate-200 text-slate-800 font-mono font-bold text-xs flex items-center justify-center">
                        {q.q_no}
                      </span>
                      <input
                        type="text"
                        value={q.section_name}
                        disabled={state.paperIsLocked}
                        onChange={(e) => {
                          const copy = [...questions];
                          copy[idx] = { ...copy[idx], section_name: e.target.value };
                          setQuestions(copy);
                        }}
                        placeholder="Section"
                        className="w-20 text-[11px] px-2 py-0.5 rounded border border-slate-300 bg-white"
                      />
                      {q.source === 'teacher_key' ? (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded border border-emerald-200">
                          Teacher Key
                        </span>
                      ) : q.model_answer ? (
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-1.5 py-0.5 rounded border border-indigo-200">
                          AI Reference
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded border border-amber-200">
                          Pending Rubric
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500">Marks:</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={q.max_marks}
                        disabled={state.paperIsLocked}
                        onChange={(e) => {
                          const copy = [...questions];
                          copy[idx] = { ...copy[idx], max_marks: parseFloat(e.target.value) || 1 };
                          setQuestions(copy);
                        }}
                        className="w-14 text-xs font-mono font-bold text-center px-1 py-0.5 rounded border border-slate-300 bg-white"
                      />
                      {!state.paperIsLocked && (
                        <button
                          type="button"
                          onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Remove question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={q.question_text}
                    disabled={state.paperIsLocked}
                    onChange={(e) => {
                      const copy = [...questions];
                      copy[idx] = { ...copy[idx], question_text: e.target.value };
                      setQuestions(copy);
                    }}
                    placeholder="Question prompt in English or Hindi..."
                    className="w-full text-xs p-2 rounded border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-indigo-500 font-sans"
                  />

                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="shrink-0">Strictness:</span>
                    <StrictnessPicker
                      compact
                      disabled={state.paperIsLocked}
                      value={q.strictness_override ?? null}
                      inheritLabel={`Paper (${paperMeta?.strictness_level ?? 3})`}
                      onChange={(level) => {
                        const copy = [...questions];
                        copy[idx] = { ...copy[idx], strictness_override: level };
                        setQuestions(copy);
                      }}
                    />
                  </div>

                  {q.model_answer && (
                    <div className="text-[11px] text-slate-700 bg-white border border-slate-200 p-2 rounded space-y-1">
                      <strong className="text-slate-900 block font-semibold">Model Answer:</strong>
                      <p className="whitespace-pre-wrap">{q.model_answer}</p>
                    </div>
                  )}

                  {q.key_points && q.key_points.length > 0 && (
                    <div className="text-[11px] text-slate-600 bg-indigo-50/50 border border-indigo-100 p-2 rounded">
                      <strong className="text-indigo-900 block mb-1">Key Points ({q.key_points.length}):</strong>
                      <ul className="list-disc list-inside space-y-0.5">
                        {q.key_points.map((kp, kIdx) => (
                          <li key={kIdx} className="truncate">
                            {typeof kp === 'object' && kp !== null ? `${kp.text || ''} (${kp.marks || 0}M)` : String(kp)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsPaperDrawerOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {!state.paperIsLocked && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveQuestionsDrawer}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={handleLockPaper}
                      disabled={questions.length === 0}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-lg transition shadow-2xs"
                    >
                      Lock Paper
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
