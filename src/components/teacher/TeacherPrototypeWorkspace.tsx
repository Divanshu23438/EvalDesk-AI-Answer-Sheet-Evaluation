import { useMemo, useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileKey2,
  FileText,
  Flag,
  LockKeyhole,
  Printer,
  RotateCw,
  Sparkles,
  Upload,
  X,
  Database,
  Archive,
  Download,
  Settings,
  HelpCircle,
  Eye,
  RefreshCw,
  Trash2,
  Unlock,
  ZoomIn,
  ZoomOut,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Search,
  Filter,
  Layers,
} from 'lucide-react';
import {
  callEvaluateSheetApi,
  type GeneratedAnswerKey,
  type ServerEvaluateSheetResult,
  type EvaluatedPaperSummary,
  type EvaluatedReviewItem,
  applySectionChoiceRules,
} from '../../utils/apiOcr';

type CheckingMode = 'strict' | 'lenient' | 'maths';
type SetupStep = 'setup' | 'upload' | 'status' | 'review' | 'report' | 'library' | 'verify';

const modeLabels: Record<CheckingMode, string> = {
  strict: 'Strict (Grammar & spelling count)',
  lenient: 'Lenient (Meaning counts, spelling ignored)',
  maths: 'Maths (Method marks + final answer)',
};

function formatBytes(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const formatQNo = (qNo?: string | number): string => {
  if (!qNo) return '';
  const s = String(qNo).trim();
  const cleaned = s.replace(/^(?:Q\.?)+/i, '').trim();
  return `Q.${cleaned}`;
};

interface SavedPaper {
  id: string;
  title: string;
  subject: string;
  total_marks: number;
  strictness: string;
  checking_medium: string;
  has_answer_key: number;
  is_locked: number;
  created_at: string;
}

interface TrainingLine {
  id: string;
  sheet_id: string;
  line_index: number;
  image_path: string;
  ai_text: string;
  verified_text: string;
  provenance: string;
  is_sample: number;
  student_name?: string;
  roll_number?: string;
}

interface UISectionRule {
  id?: string;
  name: string;
  instructions?: string;
  attempt_n: number;
  total_questions: number;
  marks_each: number;
  section_marks: number;
  policy: 'best_n' | 'first_n_answered';
}

interface UIQuestion {
  key: string;
  q_no: string;
  question_text: string;
  max_marks: number;
  question_type: string;
  section_name: string;
  section_id?: string;
  options: string[];
  word_limit?: number;
}

interface UIKeyPoint {
  text: string;
  marks: number;
  accept_if?: string;
  reject_if?: string;
}

interface UIReferenceItem {
  id?: string;
  key: string;
  question_id?: string;
  model_answer: string;
  word_count?: number;
  key_points: UIKeyPoint[];
  accepted_alternatives?: string[];
  common_mistakes?: string[];
  correct_option?: string | null;
  confidence?: number;
  source?: string;
  disagreements?: string[];
}

interface UISheetSummary {
  id: string;
  student_name: string;
  roll_number: string;
  status: string;
  total_score: number;
  max_marks: number;
  percentage: number;
  grade: string;
  unresolved_flags_count: number;
  total_flags_count: number;
  created_at: string;
}

export function TeacherPrototypeWorkspace() {
  const [step, setStep] = useState<SetupStep>('setup');
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [studentFiles, setStudentFiles] = useState<File[]>([]);
  const [activeStudentIdx, setActiveStudentIdx] = useState(0);

  const [paperTitle, setPaperTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [mode, setMode] = useState<CheckingMode>('lenient');
  const [overrides, setOverrides] = useState<Record<string, CheckingMode>>({});
  const [answerKey, setAnswerKey] = useState<GeneratedAnswerKey | null>(null);
  const [basis, setBasis] = useState<'Answer Key' | 'AI-Generated Reference'>('AI-Generated Reference');
  const [setupSaved, setSetupSaved] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [approved, setApproved] = useState(false);

  // Editable Question Setup Table (empty initial state)
  const [editableQuestions, setEditableQuestions] = useState<UIQuestion[]>([]);
  const [sections, setSections] = useState<UISectionRule[]>([]);
  const [draftId, setDraftId] = useState<string>('');
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [extractionSource, setExtractionSource] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [instructions, setInstructions] = useState<string>('');
  const [paperTotalMarks, setPaperTotalMarks] = useState<number>(0);

  // Reference Review & Approval State
  const [references, setReferences] = useState<UIReferenceItem[]>([]);
  const [disagreements, setDisagreements] = useState<string[]>([]);
  const [isGeneratingRef, setIsGeneratingRef] = useState<boolean>(false);

  // Upload Screen State
  const [hasConsent, setHasConsent] = useState(false);
  const [readNamesWithAi, setReadNamesWithAi] = useState(true);
  const [studentName, setStudentName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [nameConfidenceLow, setNameConfidenceLow] = useState(false);
  const [isUploadingSheet, setIsUploadingSheet] = useState(false);
  const [needsIdentityPrompt, setNeedsIdentityPrompt] = useState(false);
  const [headerConfidence, setHeaderConfidence] = useState<number | null>(null);

  // Status Screen State
  const [evalStage, setEvalStage] = useState<'idle' | 'reading' | 'matching' | 'marking' | 'checking' | 'done' | 'error'>('idle');
  const [stageProgress, setStageProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [liveStageText, setLiveStageText] = useState('');
  const [sheetStatus, setSheetStatus] = useState('');
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);

  // Review & Split View State
  const [paperRotation, setPaperRotation] = useState(0);
  const [studentRotation, setStudentRotation] = useState(0);
  const [reviewItems, setReviewItems] = useState<EvaluatedReviewItem[]>([]);
  const [activeReview, setActiveReview] = useState<EvaluatedReviewItem | null>(null);
  const [teacherComment, setTeacherComment] = useState('');
  const [paperSummary, setPaperSummary] = useState<EvaluatedPaperSummary | null>(null);
  const [result, setResult] = useState<ServerEvaluateSheetResult | null>(null);

  // Phase C: Per-Question Reference Regeneration & Expansion State
  const [generatingKeys, setGeneratingKeys] = useState<Record<string, boolean>>({});

  // Phase D: 3-Pane Teacher Review & Shortcuts State
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [flaggedOnlyFilter, setFlaggedOnlyFilter] = useState<boolean>(false);
  const [editTranscript, setEditTranscript] = useState<string>('');
  const [overrideMarks, setOverrideMarks] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isCountedOverride, setIsCountedOverride] = useState<boolean>(true);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);

  // Phase D: Batch Sheets State
  const [sheetsList, setSheetsList] = useState<UISheetSummary[]>([]);
  const [sheetStatusFilter, setSheetStatusFilter] = useState<string>('all');
  const [sheetSearchQuery, setSheetSearchQuery] = useState<string>('');
  const [isBulkFinalizing, setIsBulkFinalizing] = useState<boolean>(false);

  // Library & Training Verify State
  const [currentPaperId, setCurrentPaperId] = useState<string>('');
  const [currentSheetId, setCurrentSheetId] = useState<string>('');
  const [reportData, setReportData] = useState<{
    paper_title?: string;
    total_students?: number;
    average_score?: number;
    max_marks?: number;
    excel_report_url?: string;
    paper_summary_pdf_url?: string;
    student_reports?: Array<{ type: string; student_name: string; roll_number: string; url: string }>;
  } | null>(null);
  const [savedPapers, setSavedPapers] = useState<SavedPaper[]>([]);
  const [trainingLines, setTrainingLines] = useState<TrainingLine[]>([]);
  const [activeLine, setActiveLine] = useState<TrainingLine | null>(null);
  const [verifiedText, setVerifiedText] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [paperPages, setPaperPages] = useState<string[]>([]);
  const [sheetPages, setSheetPages] = useState<string[]>([]);
  const [activePaperPage, setActivePaperPage] = useState<number>(0);
  const [activeSheetPage, setActiveSheetPage] = useState<number>(0);

  useEffect(() => {
    if (currentPaperId) localStorage.setItem('evaldesk_paper_id', currentPaperId);
  }, [currentPaperId]);

  useEffect(() => {
    if (currentSheetId) localStorage.setItem('evaldesk_sheet_id', currentSheetId);
  }, [currentSheetId]);

  useEffect(() => {
    localStorage.setItem('evaldesk_step', step);
  }, [step]);

  const paperPreview = paperFile ? URL.createObjectURL(paperFile) : '';
  const currentStudentFile = studentFiles[activeStudentIdx] || null;
  const studentPreview = currentStudentFile ? URL.createObjectURL(currentStudentFile) : '';

  const calculatedQuestionTotal = useMemo(
    () => editableQuestions.reduce((sum, q) => sum + (Number(q.max_marks) || 0), 0),
    [editableQuestions]
  );
  const paperTotalMismatch = paperTotalMarks > 0 ? calculatedQuestionTotal !== paperTotalMarks : false;

  // Selected item and batch sheets loader for Phase D
  const selectedReviewItem = useMemo(() => {
    if (!reviewItems || reviewItems.length === 0) return null;
    if (selectedKey) {
      const match = reviewItems.find(
        (it) => it.q_no === selectedKey || it.question_key === selectedKey || it.eval_id === selectedKey
      );
      if (match) return match;
    }
    return reviewItems[0];
  }, [reviewItems, selectedKey]);

  useEffect(() => {
    if (!selectedReviewItem) return;
    setEditTranscript(selectedReviewItem.transcribed_text || '');
    setOverrideMarks(
      selectedReviewItem.finalMarks !== undefined
        ? selectedReviewItem.finalMarks
        : (selectedReviewItem.suggested_marks || 0)
    );
    setOverrideReason(selectedReviewItem.teacher_override_reason || '');
    setIsCountedOverride(
      selectedReviewItem.isCounted !== undefined ? selectedReviewItem.isCounted : true
    );

    if (
      selectedReviewItem.page_numbers &&
      Array.isArray(selectedReviewItem.page_numbers) &&
      selectedReviewItem.page_numbers.length > 0
    ) {
      const p = selectedReviewItem.page_numbers[0];
      if (typeof p === 'number' && p >= 0) {
        setActiveSheetPage(p);
      }
    }
  }, [selectedReviewItem?.eval_id, selectedReviewItem?.q_no]);

  const loadSheetsList = async (paperId?: string) => {
    const pid = paperId || currentPaperId;
    if (!pid) return;
    try {
      const res = await fetch(`/api/papers/${pid}/sheets`);
      if (res.ok) {
        const data = await res.json();
        setSheetsList(data.sheets || []);
      }
    } catch {
      // Offline fallback
    }
  };

  const filteredSheets = useMemo(() => {
    return sheetsList.filter((s) => {
      if (sheetStatusFilter === 'flagged' && s.unresolved_flags_count === 0) return false;
      if (sheetStatusFilter === 'completed' && s.status !== 'completed') return false;
      if (sheetStatusFilter === 'queued' && s.status !== 'queued' && s.status !== 'reading' && s.status !== 'marking') return false;
      if (sheetSearchQuery.trim()) {
        const q = sheetSearchQuery.toLowerCase();
        const nameMatch = (s.student_name || '').toLowerCase().includes(q);
        const rollMatch = (s.roll_number || '').toLowerCase().includes(q);
        if (!nameMatch && !rollMatch) return false;
      }
      return true;
    });
  }, [sheetsList, sheetStatusFilter, sheetSearchQuery]);

  useEffect(() => {
    if (currentPaperId) {
      loadSheetsList(currentPaperId);
    }
  }, [currentPaperId, step]);

  // Load saved papers from SQLite Library
  const loadSavedPapers = async () => {
    try {
      const res = await fetch('/api/papers');
      if (res.ok) {
        const data = await res.json();
        setSavedPapers(data.papers || []);
      }
    } catch {
      // Offline fallback
    }
  };

  // Load training lines for Verify Mode
  const loadTrainingLines = async () => {
    try {
      const res = await fetch('/api/training/lines');
      if (res.ok) {
        const data = await res.json();
        setTrainingLines(data.lines || []);
        if (data.lines && data.lines.length > 0) {
          setActiveLine(data.lines[0]);
          setVerifiedText(data.lines[0].verified_text || data.lines[0].ai_text);
        }
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    loadSavedPapers();
  }, []);

  const handlePaperUpload = async (file: File) => {
    setPaperFile(file);
    setError('');
    setIsExtracting(true);
    setStatus(`Extracting questions from ${file.name}...`);
    setEditableQuestions([]);
    setExtractionWarnings([]);
    setReferences([]);
    setDisagreements([]);
    setSetupSaved(false);
    setIsLocked(false);

    try {
      const form = new FormData();
      form.append('paper_file', file);
      const res = await fetch('/api/papers/extract', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (HTTP ${res.status}) extracting questions.`);
      }
      const data = await res.json();
      setDraftId(data.draft_id);
      setExtractionSource(data.source);
      setExtractionWarnings(data.warnings || []);
      setInstructions(data.instructions || '');
      setPaperTotalMarks(data.total_marks || 0);
      setSections(data.sections || []);
      if (!paperTitle) {
        setPaperTitle(file.name.replace(/\.[^/.]+$/, ''));
      }

      const mapped: UIQuestion[] = (data.questions || []).map((q: any) => ({
        key: q.key,
        q_no: q.q_no,
        question_text: q.text,
        max_marks: Number(q.marks) || 1,
        question_type: q.type || 'short',
        section_name: q.section || 'General',
        section_id: q.section_id,
        options: q.options || [],
      }));
      setEditableQuestions(mapped);
      setStatus(
        `Successfully detected ${mapped.length} questions from question paper (${
          data.source === 'pdf_text' ? 'PDF Text Layer' : 'Vision Extraction'
        }).`
      );
    } catch (err) {
      setStatus('');
      const msg = err instanceof Error ? err.message : 'Question extraction failed.';
      setError(msg);
      setRetryAction(() => () => handlePaperUpload(file));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveSetup = async () => {
    if (editableQuestions.length === 0) {
      setError('Please upload a question paper and ensure at least one question is detected.');
      return;
    }
    setError('');
    setIsGeneratingRef(true);
    setStatus('Creating paper and preparing rubric reference...');

    try {
      // 1. Create Paper via POST /api/papers (JSON)
      const paperPayload = {
        draft_id: draftId || undefined,
        title: paperTitle || 'Exam Paper',
        subject: subject || '',
        strictness: mode,
        checking_medium: answerKeyFile ? 'answer_key' : 'ai_reference',
        total_marks: paperTotalMarks || calculatedQuestionTotal,
        instructions: instructions,
        sections: sections.map((s) => ({
          id: s.id,
          name: s.name,
          instructions: s.instructions || '',
          attempt_n: Number(s.attempt_n) || 0,
          total_questions: Number(s.total_questions) || 0,
          marks_each: Number(s.marks_each) || 0,
          section_marks: Number(s.section_marks) || 0,
          policy: s.policy || 'best_n',
        })),
        questions: editableQuestions.map((q) => ({
          key: q.key,
          q_no: q.q_no,
          question_text: q.question_text,
          max_marks: q.max_marks,
          question_type: q.question_type,
          section_name: q.section_name,
          section_id: q.section_id,
          options: q.options,
          strictness_override: overrides[q.q_no] || undefined,
        })),
      };

      const pRes = await fetch('/api/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paperPayload),
      });
      if (!pRes.ok) {
        const errData = await pRes.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (HTTP ${pRes.status}) creating paper.`);
      }
      const pData = await pRes.json();
      const paperId = pData.paper_id;
      setCurrentPaperId(paperId);

      // 2. Parse answer key OR generate AI reference
      if (answerKeyFile) {
        setStatus('Parsing uploaded answer key...');
        const keyForm = new FormData();
        keyForm.append('answer_key_file', answerKeyFile);
        const kRes = await fetch(`/api/papers/${paperId}/answer-key`, {
          method: 'POST',
          body: keyForm,
        });
        if (!kRes.ok) {
          const errData = await kRes.json().catch(() => ({}));
          throw new Error(errData.detail || `Server error (HTTP ${kRes.status}) parsing answer key.`);
        }
        const kData = await kRes.json();
        setReferences(kData.references || []);
        setBasis('Answer Key');
        setStatus('Answer key parsed successfully. Review reference items below and click Approve & Lock.');
      } else {
        setStatus('AI is drafting rubric reference (running dual-draft cross check)...');
        const rRes = await fetch(`/api/papers/${paperId}/reference/generate`, {
          method: 'POST',
        });
        if (!rRes.ok) {
          const errData = await rRes.json().catch(() => ({}));
          throw new Error(errData.detail || `Server error (HTTP ${rRes.status}) generating AI reference.`);
        }
        const rData = await rRes.json();
        setReferences(rData.references || []);
        setDisagreements(rData.disagreements || []);
        setBasis('AI-Generated Reference');
        setStatus('AI reference generated. Review model answers & rubric key points below and click Approve & Lock.');
      }

      setAnswerKey({
        paper_max_marks: calculatedQuestionTotal,
        sections: [],
        questions: editableQuestions.map((q) => ({
          q_no: q.q_no,
          section_name: q.section_name || 'General',
          max_marks: q.max_marks,
          model_answer: '',
          key_points: [],
        })),
      });

      setSetupSaved(true);
    } catch (err) {
      setStatus('');
      const msg = err instanceof Error ? err.message : 'Failed to save paper setup.';
      setError(msg);
      setRetryAction(() => () => handleSaveSetup());
    } finally {
      setIsGeneratingRef(false);
    }
  };

  const handleUpdateReferences = async () => {
    if (!currentPaperId || references.length === 0) return;
    setError('');
    setStatus('Saving reference edits...');
    try {
      const res = await fetch(`/api/papers/${currentPaperId}/reference`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ references }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (HTTP ${res.status}) updating reference.`);
      }
      setStatus('Reference edits saved successfully.');
    } catch (err) {
      setStatus('');
      const msg = err instanceof Error ? err.message : 'Failed to update reference.';
      setError(msg);
    }
  };

  const handleLockPaper = async () => {
    if (!currentPaperId) {
      setError('Paper must be saved before locking.');
      return;
    }
    setError('');
    setStatus('Validating and locking paper...');
    try {
      if (references.length > 0) {
        await fetch(`/api/papers/${currentPaperId}/reference`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ references }),
        });
      }

      const lockRes = await fetch(`/api/papers/${currentPaperId}/lock`, { method: 'POST' });
      if (!lockRes.ok) {
        const errData = await lockRes.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (HTTP ${lockRes.status}) locking paper.`);
      }

      setIsLocked(true);
      setApproved(true);
      setStatus('Paper approved and locked! Step 2 (Upload Answer Sheets) is now unlocked.');
    } catch (err) {
      setStatus('');
      const msg = err instanceof Error ? err.message : 'Failed to lock paper.';
      setError(msg);
      setRetryAction(() => () => handleLockPaper());
    }
  };

  const handleNavigateStep = (targetStep: SetupStep) => {
    if (targetStep === 'upload' && !isLocked) {
      setError('You must approve and lock the question paper setup before uploading student answer sheets.');
      return;
    }
    setError('');
    setStep(targetStep);
  };

  const unlockPaperWithConfirmation = () => {
    if (window.confirm('Editing paper setup will unlock the rubric and reset already evaluated student sheets. Proceed?')) {
      setIsLocked(false);
      setSetupSaved(false);
      setReviewItems([]);
      setResult(null);
      setPaperSummary(null);
      setStep('setup');
    }
  };

  const loadSheetReview = async (sheetId: string) => {
    try {
      const revRes = await fetch(`/api/sheets/${sheetId}/review`);
      if (!revRes.ok) return;
      const revData = await revRes.json();

      if (revData.sheet) {
        setStudentName(revData.sheet.student_name || '');
        setRollNo(revData.sheet.roll_number || '');
      }

      if (revData.sheet_pages && Array.isArray(revData.sheet_pages) && revData.sheet_pages.length > 0) {
        setSheetPages(revData.sheet_pages.map((p: any) => p.url));
      }
      if (revData.paper_pages && Array.isArray(revData.paper_pages) && revData.paper_pages.length > 0) {
        setPaperPages(revData.paper_pages);
      }

      if (revData.sections && Array.isArray(revData.sections) && revData.sections.length > 0) {
        setSections(revData.sections);
      }

      const allEvals = [...(revData.checked_questions || []), ...(revData.flagged_questions || [])];
      if (allEvals.length > 0) {
        const mapped: EvaluatedReviewItem[] = allEvals.map((e: any) => ({
          eval_id: e.eval_id || e.id,
          question_id: e.question_id,
          question_key: e.question_key || e.key || String(e.q_no),
          question_text: e.question_text || '',
          q_no: String(e.q_no),
          section_name: e.section_name || 'General',
          transcribed_text: e.extracted_text || '',
          diagram_notes: '',
          confidence: (e.flags && e.flags.length > 0) ? 'low' : 'high',
          suggested_marks: e.ai_marks !== undefined ? e.ai_marks : e.final_marks,
          finalMarks: e.final_marks !== undefined ? e.final_marks : (e.ai_marks || 0),
          max_marks: e.max_marks || 5,
          feedback: e.reason || 'Graded by rubric standard.',
          reason: Array.isArray(e.flags) && e.flags.length > 0 ? e.flags.join('; ') : (e.reason || ''),
          resolved: Boolean(e.resolved),
          attempted: Boolean(e.attempted ?? true),
          isCounted: e.is_counted !== undefined ? Boolean(e.is_counted) : true,
          statusLabel: (e.is_counted === 0 || e.is_counted === false)
            ? 'Optional / Extra — Not Counted'
            : (e.resolved ? 'Checked' : 'Flagged'),
          evidence_quote: e.evidence_quote || '',
          page_numbers: Array.isArray(e.page_numbers) ? e.page_numbers : (typeof e.page_numbers === 'string' ? JSON.parse(e.page_numbers || '[]') : []),
          bbox_json: e.bbox_json,
          model_answer: e.model_answer || '',
          key_points: e.key_points || [],
          flags: e.flags || [],
        }));
        setReviewItems(mapped);
        if (!selectedKey && mapped.length > 0) {
          setSelectedKey(mapped[0].question_key || mapped[0].q_no);
        }
      }
    } catch (err) {
      console.error('Error loading sheet review:', err);
    }
  };

  useEffect(() => {
    const savedPaperId = localStorage.getItem('evaldesk_paper_id');
    const savedSheetId = localStorage.getItem('evaldesk_sheet_id');
    const savedStep = localStorage.getItem('evaldesk_step');
    if (savedPaperId) {
      setCurrentPaperId(savedPaperId);
    }
    if (savedSheetId) {
      setCurrentSheetId(savedSheetId);
      if (savedStep === 'review' || savedStep === 'report') {
        setStep(savedStep as any);
        loadSheetReview(savedSheetId);
      }
    }
  }, []);

  // Continuous 2-second polling on Screen 3 without premature timeouts
  useEffect(() => {
    if (step !== 'status' || !currentSheetId) return;

    let isMounted = true;
    let inFlight = false;

    const poll = async () => {
      if (inFlight || !isMounted) return;
      inFlight = true;
      try {
        const stRes = await fetch(`/api/sheets/${currentSheetId}`);
        if (!stRes.ok || !isMounted) return;
        const stData = await stRes.json();
        setSheetStatus(stData.status || '');

        if (stData.student_name && !studentName) setStudentName(stData.student_name);
        if (stData.roll_number && !rollNo) setRollNo(stData.roll_number);

        if (stData.current_stage) {
          setLiveStageText(stData.current_stage);
          const stLower = String(stData.current_stage).toLowerCase();
          if (stLower.includes('queued')) {
            setEvalStage('reading');
            setStageProgress(15);
          } else if (stLower.includes('read')) {
            setEvalStage('reading');
            setStageProgress(35);
          } else if (stLower.includes('match')) {
            setEvalStage('matching');
            setStageProgress(55);
          } else if (stLower.includes('mark')) {
            setEvalStage('marking');
            setStageProgress(75);
          } else if (stLower.includes('flag') || stLower.includes('check') || stLower.includes('total')) {
            setEvalStage('checking');
            setStageProgress(90);
          }
        }

        if (stData.status === 'evaluated' || stData.status === 'needs_review') {
          setEvalStage('done');
          setStageProgress(100);
          await loadSheetReview(currentSheetId);
          if (isMounted) {
            setStep('review');
          }
        } else if (stData.status === 'failed' || stData.status === 'error') {
          setEvalStage('error');
          setErrorMessage(stData.error_message || 'Evaluation pipeline encountered an error.');
          setRetryAction(() => () => handleRetryEvaluation(currentSheetId));
        }
      } catch (err) {
        console.error('Status poll error:', err);
      } finally {
        inFlight = false;
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [step, currentSheetId]);

  const pollSheetStatus = async (_sheetId: string) => {
    // Kept for backward compatibility; continuous polling useEffect handles polling without timeout
  };

  const handleRetryEvaluation = async (sheetId: string) => {
    setError('');
    setErrorMessage('');
    setSheetStatus('queued');
    setEvalStage('reading');
    setLiveStageText('Queuing evaluation retry...');
    setStageProgress(20);
    try {
      const res = await fetch(`/api/sheets/${sheetId}/retry`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to retry evaluation.');
      }
    } catch (err) {
      setEvalStage('error');
      setSheetStatus('failed');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to retry evaluation.');
    }
  };

  const handleStudentSheetUpload = async (files: File[]) => {
    if (!currentPaperId) {
      setError('Please create and lock a question paper first.');
      return;
    }
    if (!isLocked) {
      setError('Question paper must be approved and locked before uploading student answer sheets.');
      return;
    }
    if (!hasConsent) {
      setError('You must confirm consent to process student answer sheets.');
      return;
    }

    setCurrentSheetId('');
    setNeedsIdentityPrompt(false);
    setStudentFiles(files);
    setError('');
    setIsUploadingSheet(true);
    setStatus(`Uploading and processing ${files.length} answer sheet file(s)...`);

    try {
      const form = new FormData();
      form.append('consent_flag', hasConsent ? '1' : '0');
      for (const f of files) {
        form.append('files', f);
      }

      const res = await fetch(`/api/papers/${currentPaperId}/sheets`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (HTTP ${res.status}) uploading sheet.`);
      }

      const data = await res.json();
      const sheetId = data.sheet_id;
      if (!sheetId) {
        throw new Error('Server did not return a valid sheet ID.');
      }
      setCurrentSheetId(sheetId);
      setHeaderConfidence(data.confidence ?? null);

      if (data.student_name) setStudentName(data.student_name);
      if (data.roll_number) setRollNo(data.roll_number);

      if (!data.needs_manual_name && data.status === 'queued') {
        // High confidence header! Evaluation auto-queued!
        setNeedsIdentityPrompt(false);
        setStatus(`Header read successfully (${data.student_name}, ${data.roll_number}). Evaluation auto-queued!`);
        setStep('status');
        setEvalStage('reading');
        setStageProgress(20);
        pollSheetStatus(sheetId);
      } else if (data.status === 'needs_identity') {
        // Low confidence or missing header, but sheet was created successfully
        setNeedsIdentityPrompt(true);
        setStatus('Header requires manual confirmation or entry before evaluation can start.');
      } else {
        setNeedsIdentityPrompt(false);
        setStatus(data.current_stage || 'Sheet processed.');
      }
    } catch (err) {
      setCurrentSheetId('');
      setNeedsIdentityPrompt(false);
      setStatus('');
      const msg = err instanceof Error ? err.message : 'Failed to upload answer sheet.';
      setError(msg);
      setRetryAction(() => () => handleStudentSheetUpload(files));
    } finally {
      setIsUploadingSheet(false);
    }
  };

  const handleSaveIdentityAndStart = async () => {
    if (!currentSheetId) {
      setError('No active student sheet found.');
      return;
    }
    if (!studentName.trim() || !rollNo.trim()) {
      setError('Both Student Name and Roll Number are required.');
      return;
    }

    setError('');
    setStatus('Saving student identity and starting evaluation...');
    try {
      const idRes = await fetch(`/api/sheets/${currentSheetId}/identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: studentName.trim(),
          roll_number: rollNo.trim(),
        }),
      });

      if (!idRes.ok) {
        const errData = await idRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to set student identity.');
      }

      setNeedsIdentityPrompt(false);
      setStatus('Identity saved. Evaluation automatically queued!');
      setStep('status');
      setEvalStage('reading');
      setStageProgress(20);
      pollSheetStatus(currentSheetId);
    } catch (err) {
      setStatus('');
      const msg = err instanceof Error ? err.message : 'Failed to save student identity.';
      setError(msg);
    }
  };

  const startEvaluationPipeline = async () => {
    if (studentFiles.length > 0) {
      await handleStudentSheetUpload(studentFiles);
    } else if (currentSheetId && studentName.trim() && rollNo.trim()) {
      await handleSaveIdentityAndStart();
    } else {
      setError('Please choose a student answer sheet file.');
    }
  };

  const handleDeleteSheet = async (sheetId: string) => {
    if (!sheetId) return;
    const confirmDelete = window.confirm(
      'Are you sure you want to permanently delete this student answer sheet and all associated evaluation data? This action cannot be undone.'
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/sheets/${sheetId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error (HTTP ${res.status}) deleting sheet.`);
      }

      // Reset all sheet state
      setCurrentSheetId('');
      localStorage.removeItem('evaldesk_sheet_id');
      setStudentFiles([]);
      setStudentName('');
      setRollNo('');
      setHeaderConfidence(null);
      setNeedsIdentityPrompt(false);
      setEvalStage('idle');
      setErrorMessage('');
      setReviewItems([]);
      setActiveReview(null);
      setPaperSummary(null);
      setResult(null);
      setSheetPages([]);
      setActiveSheetPage(0);
      setStep('upload');
      setStatus('Answer sheet permanently deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sheet.');
    }
  };

  const handleConfirmReview = async (item: EvaluatedReviewItem, overrideMarks?: number) => {
    const finalVal = overrideMarks !== undefined ? overrideMarks : item.finalMarks;
    const updated = reviewItems.map((cur) =>
      cur.q_no === item.q_no
        ? {
            ...cur,
            finalMarks: finalVal,
            resolved: true,
            statusLabel: 'Checked',
            reason: teacherComment ? `Teacher note: ${teacherComment}` : cur.reason,
          }
        : cur
    );
    setReviewItems(updated);
    if (answerKey) {
      const summary = applySectionChoiceRules(answerKey, updated);
      setPaperSummary(summary);
    }

    if (item.eval_id) {
      try {
        const res = await fetch(`/api/evaluations/${item.eval_id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_marks: finalVal,
            comment: teacherComment || '',
            accept_ai: overrideMarks !== undefined,
            is_counted: item.isCounted,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to submit review override');
        }
        if (currentSheetId) {
          await loadSheetReview(currentSheetId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit review override');
      }
    }

    setActiveReview(null);
    setTeacherComment('');
  };

  const handleRecheck = async () => {
    if (!activeReview?.eval_id) return;
    setStatus('Re-checking student answer with AI rubric...');
    try {
      const res = await fetch(`/api/evaluations/${activeReview.eval_id}/recheck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edited_text: activeReview.transcribed_text }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedItem: EvaluatedReviewItem = {
          ...activeReview,
          suggested_marks: data.ai_marks,
          finalMarks: data.final_marks,
          reason: Array.isArray(data.flags) && data.flags.length > 0 ? data.flags.join('; ') : data.reason,
          resolved: Boolean(data.resolved),
          statusLabel: data.resolved ? 'Checked' : 'Flagged',
          feedback: data.reason,
          evidence_quote: data.evidence_quote || '',
        };
        setActiveReview(updatedItem);
        setReviewItems((items) => items.map((it) => (it.q_no === activeReview.q_no ? updatedItem : it)));
        if (currentSheetId) {
          await loadSheetReview(currentSheetId);
        }
        setStatus('Re-check completed successfully!');
        setTimeout(() => setStatus(''), 2000);
      } else {
        throw new Error('Re-check request failed.');
      }
    } catch (e) {
      setStatus('');
      setError(e instanceof Error ? e.message : 'Re-check failed.');
    }
  };

  // Phase C: Per-Question Reference Regeneration & Expansion
  const handleRegenerateQuestion = async (qKey: string) => {
    if (!currentPaperId) return;
    setGeneratingKeys((prev) => ({ ...prev, [qKey]: true }));
    setError('');
    setStatus(`Regenerating reference for ${formatQNo(qKey)}...`);
    try {
      const res = await fetch(`/api/papers/${currentPaperId}/questions/${encodeURIComponent(qKey)}/reference/regenerate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to regenerate reference for ${qKey}`);
      }
      const data = await res.json();
      const updatedRef = data.reference;
      setReferences((prev) =>
        prev.map((r) => (r.key === qKey ? { ...r, ...updatedRef } : r))
      );
      setStatus(`Reference for ${formatQNo(qKey)} regenerated successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setGeneratingKeys((prev) => ({ ...prev, [qKey]: false }));
    }
  };

  const handleExpandQuestion = async (qKey: string) => {
    if (!currentPaperId) return;
    setGeneratingKeys((prev) => ({ ...prev, [qKey]: true }));
    setError('');
    setStatus(`Critiquing & expanding reference for ${formatQNo(qKey)}...`);
    try {
      const res = await fetch(`/api/papers/${currentPaperId}/questions/${encodeURIComponent(qKey)}/reference/expand`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to expand reference for ${qKey}`);
      }
      const data = await res.json();
      const updatedRef = data.reference;
      setReferences((prev) =>
        prev.map((r) => (r.key === qKey ? { ...r, ...updatedRef } : r))
      );
      setStatus(`Reference for ${formatQNo(qKey)} expanded successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Expansion failed');
    } finally {
      setGeneratingKeys((prev) => ({ ...prev, [qKey]: false }));
    }
  };

  // Phase D: Navigation & Keyboard Shortcuts
  const selectNextQuestion = (direction: 1 | -1) => {
    if (!reviewItems || reviewItems.length === 0) return;
    const currentIdx = reviewItems.findIndex(
      (it) => it.q_no === selectedKey || it.question_key === selectedKey || it.eval_id === selectedKey
    );
    let nextIdx = (currentIdx === -1 ? 0 : currentIdx) + direction;
    if (nextIdx >= reviewItems.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = reviewItems.length - 1;
    const nextItem = reviewItems[nextIdx];
    if (nextItem) {
      setSelectedKey(nextItem.question_key || nextItem.q_no || nextItem.eval_id || '');
    }
  };

  const selectNextFlaggedQuestion = () => {
    if (!reviewItems || reviewItems.length === 0) return;
    const currentIdx = reviewItems.findIndex(
      (it) => it.q_no === selectedKey || it.question_key === selectedKey || it.eval_id === selectedKey
    );
    for (let i = 1; i <= reviewItems.length; i++) {
      const idx = (currentIdx + i) % reviewItems.length;
      if (!reviewItems[idx].resolved) {
        setSelectedKey(reviewItems[idx].question_key || reviewItems[idx].q_no || reviewItems[idx].eval_id || '');
        return;
      }
    }
  };

  const handleAcceptCurrent = async (item: EvaluatedReviewItem) => {
    const finalVal = item.suggested_marks !== undefined ? item.suggested_marks : item.finalMarks;
    const updated = reviewItems.map((cur) =>
      cur.q_no === item.q_no
        ? {
            ...cur,
            finalMarks: finalVal,
            resolved: true,
            statusLabel: 'Checked',
            isCounted: isCountedOverride,
          }
        : cur
    );
    setReviewItems(updated);

    if (item.eval_id) {
      try {
        const res = await fetch(`/api/evaluations/${item.eval_id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_marks: finalVal,
            comment: '',
            accept_ai: true,
            is_counted: isCountedOverride,
          }),
        });
        if (res.ok && currentSheetId) {
          await loadSheetReview(currentSheetId);
        }
      } catch (err) {
        console.error('Accept failed:', err);
      }
    }

    selectNextQuestion(1);
  };

  const handleOverrideCurrent = async (item: EvaluatedReviewItem) => {
    const isAiMismatch = overrideMarks !== (item.suggested_marks ?? item.finalMarks);
    if (isAiMismatch && !overrideReason.trim()) {
      setError('A teacher override reason is required when overriding AI marks.');
      return;
    }
    setError('');

    const updated = reviewItems.map((cur) =>
      cur.q_no === item.q_no
        ? {
            ...cur,
            finalMarks: overrideMarks,
            resolved: true,
            statusLabel: 'Checked',
            teacher_override_reason: overrideReason,
            isCounted: isCountedOverride,
          }
        : cur
    );
    setReviewItems(updated);

    if (item.eval_id) {
      try {
        const res = await fetch(`/api/evaluations/${item.eval_id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_marks: overrideMarks,
            comment: overrideReason.trim(),
            accept_ai: false,
            is_counted: isCountedOverride,
          }),
        });
        if (res.ok && currentSheetId) {
          await loadSheetReview(currentSheetId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Override failed');
      }
    }

    selectNextQuestion(1);
  };

  const handleLiveRecheck = async (item: EvaluatedReviewItem) => {
    if (!item?.eval_id) return;
    setStatus(`Re-checking ${formatQNo(item.q_no)} with AI rubric...`);
    try {
      const res = await fetch(`/api/evaluations/${item.eval_id}/recheck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edited_text: editTranscript }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Recheck request failed');
      }
      const data = await res.json();
      const updatedItem: EvaluatedReviewItem = {
        ...item,
        transcribed_text: editTranscript,
        suggested_marks: data.ai_marks,
        finalMarks: data.final_marks,
        reason: Array.isArray(data.flags) && data.flags.length > 0 ? data.flags.join('; ') : data.reason,
        resolved: Boolean(data.resolved),
        statusLabel: data.resolved ? 'Checked' : 'Flagged',
        feedback: data.reason,
        evidence_quote: data.evidence_quote || '',
      };
      setReviewItems((items) => items.map((it) => (it.q_no === item.q_no ? updatedItem : it)));
      if (currentSheetId) {
        await loadSheetReview(currentSheetId);
      }
      setStatus(`Re-check for ${formatQNo(item.q_no)} completed.`);
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recheck failed');
    }
  };

  const handleToggleCounted = async (item: EvaluatedReviewItem, countVal: boolean) => {
    setIsCountedOverride(countVal);
    const updated = reviewItems.map((cur) =>
      cur.q_no === item.q_no
        ? {
            ...cur,
            isCounted: countVal,
            statusLabel: !countVal ? 'Optional / Extra — Not Counted' : (cur.resolved ? 'Checked' : 'Flagged'),
          }
        : cur
    );
    setReviewItems(updated);

    if (item.eval_id) {
      try {
        await fetch(`/api/evaluations/${item.eval_id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_marks: item.finalMarks,
            accept_ai: true,
            is_counted: countVal,
          }),
        });
        if (currentSheetId) {
          await loadSheetReview(currentSheetId);
        }
      } catch (err) {
        console.error('Toggle counted failed:', err);
      }
    }
  };

  const handleFinalizeSheet = async (sheetId: string) => {
    if (!sheetId) return;
    const unresolved = reviewItems.filter((it) => !it.resolved);
    if (unresolved.length > 0) {
      setError(`Cannot finalize: ${unresolved.length} unresolved flagged question(s) remain. Resolve all flags before finalizing.`);
      return;
    }
    setIsFinalizing(true);
    setError('');
    setStatus('Finalizing student answer sheet...');
    try {
      const res = await fetch(`/api/sheets/${sheetId}/finalize`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to finalize sheet.');
      }
      setStatus('Sheet finalized successfully! Transitioning to academic reports...');
      setStep('report');
      loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finalization failed');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleBulkFinalize = async () => {
    if (!currentPaperId) return;
    setIsBulkFinalizing(true);
    setError('');
    setStatus('Bulk finalizing eligible sheets (0 unresolved flags)...');
    try {
      const res = await fetch('/api/sheets/bulk-finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper_id: currentPaperId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Bulk finalization failed.');
      }
      const data = await res.json();
      setStatus(`Successfully finalized ${data.finalized_count} sheet(s).`);
      loadSheetsList(currentPaperId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk finalization failed');
    } finally {
      setIsBulkFinalizing(false);
    }
  };

  // Keyboard shortcut listener for Review Workspace (J: next, K: prev, A: accept, F: next flagged)
  useEffect(() => {
    if (step !== 'review') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toUpperCase();
      if (key === 'J') {
        e.preventDefault();
        selectNextQuestion(1);
      } else if (key === 'K') {
        e.preventDefault();
        selectNextQuestion(-1);
      } else if (key === 'A') {
        e.preventDefault();
        if (selectedReviewItem) {
          handleAcceptCurrent(selectedReviewItem);
        }
      } else if (key === 'F') {
        e.preventDefault();
        selectNextFlaggedQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, reviewItems, selectedKey, selectedReviewItem, isCountedOverride]);

  const handleOpenPaper = async (paperId: string) => {
    try {
      const res = await fetch(`/api/papers/${paperId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentPaperId(paperId);
        setPaperTitle(data.paper.title);
        setSubject(data.paper.subject || '');
        setMode((data.paper.strictness as CheckingMode) || 'lenient');
        if (data.questions && data.questions.length > 0) {
          setEditableQuestions(
            data.questions.map((q: any) => ({
              key: q.key,
              q_no: String(q.q_no),
              question_text: q.question_text,
              max_marks: Number(q.max_marks) || 5,
              question_type: q.question_type || 'short',
              section_name: q.section_name || 'General',
              section_id: q.section_id,
              options: q.options || [],
            }))
          );
        }
        if (data.sections && Array.isArray(data.sections)) {
          setSections(data.sections);
        }
        setIsLocked(Boolean(data.paper.is_locked));
        setSetupSaved(true);
        setStep('setup');
      }
    } catch (e) {
      console.error('Failed to open paper', e);
    }
  };

  const loadReports = async () => {
    if (!currentPaperId) return;
    try {
      const res = await fetch(`/api/papers/${currentPaperId}/reports`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (e) {
      console.error('Failed to load reports', e);
    }
  };

  const handleVerifyLine = async () => {
    if (!activeLine) return;
    try {
      await fetch(`/api/training/lines/${activeLine.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified_text: verifiedText }),
      });
      setTrainingLines((lines) =>
        lines.map((l) => (l.id === activeLine.id ? { ...l, verified_text: verifiedText, provenance: 'human_verified' } : l))
      );
      // Move to next line
      const curIdx = trainingLines.findIndex((l) => l.id === activeLine.id);
      if (curIdx < trainingLines.length - 1) {
        const nextL = trainingLines[curIdx + 1];
        setActiveLine(nextL);
        setVerifiedText(nextL.verified_text || nextL.ai_text);
      }
    } catch {
      // Local fallback
    }
  };

  useEffect(() => {
    if (step === 'library') {
      loadSavedPapers();
    } else if (step === 'verify') {
      loadTrainingLines();
    } else if (step === 'report' && currentPaperId) {
      loadReports();
    }
  }, [step, currentPaperId]);

  const checked = reviewItems.filter((i) => i.resolved && i.isCounted);
  const flagged = reviewItems.filter((i) => !i.resolved);
  const unresolvedFlagsCount = flagged.length;
  const uncounted = reviewItems.filter((i) => !i.isCounted);
  const totalScore = paperSummary ? paperSummary.totalScore : checked.reduce((s, i) => s + i.finalMarks, 0);
  const maxMarks = answerKey?.paper_max_marks || (paperSummary ? paperSummary.paperMaxMarks : calculatedQuestionTotal);
  const percentage = maxMarks ? Math.min(100, Math.round((totalScore / maxMarks) * 100)) : 0;
  const grade = paperSummary?.grade || (percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : 'Needs Support');

  const [paperZoom, setPaperZoom] = useState(1);
  const [studentZoom, setStudentZoom] = useState(1);

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      {/* Top Header & Executive Stepper */}
      <header className="sticky top-0 z-30 border-b border-[#e2e8f0] bg-white px-6 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#005dac] p-2 text-white font-black text-sm tracking-tight shadow-xs">ED</div>
          <div>
            <div className="text-sm font-bold text-[#0f172a] flex items-center gap-2">
              EvalDesk AI
              {basis === 'AI-Generated Reference' && setupSaved && (
                <span className="rounded-full bg-[#fff3e0] px-2 py-0.5 text-[10px] font-semibold text-[#b26a00] border border-[#ffe082]">
                  AI Reference
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#64748b] font-medium">Academic Evaluation & Assessment Intelligence</div>
          </div>
        </div>

        {/* 5-Step Horizontal Progress Stepper */}
        <nav className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0]">
          {(
            [
              ['setup', '1', 'Question Paper'],
              ['upload', '2', 'Upload Sheets'],
              ['status', '3', 'Live Evaluation'],
              ['review', '4', 'Review & Verify'],
              ['report', '5', 'Reports'],
            ] as [SetupStep, string, string][]
          ).map(([key, num, label]) => {
            const isUploadLocked = key === 'upload' && !isLocked;
            const isActive = step === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleNavigateStep(key)}
                disabled={isUploadLocked}
                title={isUploadLocked ? 'Locked until Paper Setup is approved and locked' : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-[#005dac] shadow-xs font-bold'
                    : isUploadLocked
                    ? 'text-[#94a3b8] opacity-50 cursor-not-allowed'
                    : 'text-[#64748b] hover:text-[#0b1c30] hover:bg-white/50'
                }`}
              >
                <span
                  className={`grid place-items-center w-4 h-4 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-[#005dac] text-white' : 'bg-[#e2e8f0] text-[#64748b]'
                  }`}
                >
                  {num}
                </span>
                <span>{label}</span>
                {isUploadLocked && <LockKeyhole className="w-3 h-3 text-[#94a3b8]" />}
              </button>
            );
          })}
        </nav>

        {/* Secondary Actions & AI Status */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNavigateStep('library')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
              step === 'library'
                ? 'bg-[#005dac] text-white border-[#005dac]'
                : 'bg-white text-[#475569] border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Paper Library
          </button>
          <button
            type="button"
            onClick={() => handleNavigateStep('verify')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
              step === 'verify'
                ? 'bg-[#005dac] text-white border-[#005dac]'
                : 'bg-white text-[#475569] border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Verify Data
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] text-[11px] font-semibold text-[#166534]">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
            <span>Live AI System</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1520px] mx-auto p-5 space-y-5">
        {error && (
          <div
            className={`rounded-lg border px-4 py-3 text-xs flex items-center justify-between shadow-xs ${
              error.toLowerCase().includes('429') ||
              error.toLowerCase().includes('quota') ||
              error.toLowerCase().includes('rate limit')
                ? 'border-[#f59e0b] bg-[#fffbeb] text-[#b45309]'
                : 'border-[#ba1a1a] bg-[#ffdad6] text-[#93000a]'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`w-4 h-4 shrink-0 ${
                  error.toLowerCase().includes('429') ||
                  error.toLowerCase().includes('quota') ||
                  error.toLowerCase().includes('rate limit')
                    ? 'text-[#f59e0b]'
                    : 'text-[#ba1a1a]'
                }`}
              />
              <div>
                {(error.toLowerCase().includes('429') ||
                  error.toLowerCase().includes('quota') ||
                  error.toLowerCase().includes('rate limit')) && (
                  <span className="mr-2 inline-block rounded bg-[#f59e0b] px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    AI Quota / Rate Limit (HTTP 429)
                  </span>
                )}
                <span className="font-semibold">{error}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {retryAction && (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    const fn = retryAction;
                    setRetryAction(null);
                    fn();
                  }}
                  className={`px-3 py-1 text-white rounded font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-xs ${
                    error.toLowerCase().includes('429') ||
                    error.toLowerCase().includes('quota') ||
                    error.toLowerCase().includes('rate limit')
                      ? 'bg-[#d97706] hover:bg-[#b45309]'
                      : 'bg-[#ba1a1a] hover:bg-[#93000a]'
                  }`}
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setRetryAction(null);
                }}
                className="hover:opacity-75 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {status && (
          <div className="rounded-lg border border-[#a5c8ff] bg-[#eff4ff] px-4 py-3 text-sm text-[#004786] text-center font-semibold">
            {status}
          </div>
        )}

        {/* ----------------- SCREEN 1: PAPER SETUP ----------------- */}
        {step === 'setup' && (
          <section className="space-y-4">
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4 mb-4">
                <div>
                  <h1 className="text-lg font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#005dac]" />
                    Question Paper Setup & Rubric Configuration
                  </h1>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    Extract questions, define strictness rules, and approve reference answers.
                  </p>
                </div>
                {isLocked ? (
                  <button
                    type="button"
                    onClick={unlockPaperWithConfirmation}
                    className="rounded-lg border border-[#ba1a1a] bg-[#ffdad6] px-3 py-1.5 text-xs font-bold text-[#93000a] flex items-center gap-1 hover:bg-[#ffb4ab]"
                  >
                    <Unlock className="w-3.5 h-3.5" /> Unlock & Edit Paper
                  </button>
                ) : (
                  <span className="rounded bg-[#e8f5e9] px-2.5 py-1 text-xs font-semibold text-[#196b22] border border-[#c8e6c9]">
                    Draft Mode (Editable)
                  </span>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-4">
                <label className="rounded-lg border border-dashed border-[#a5c8ff] bg-[#f8f9ff] p-4 text-xs cursor-pointer hover:bg-[#eff4ff] transition-all">
                  <span className="font-semibold block mb-1">Question Paper (PDF or Image) *</span>
                  <input
                    type="file"
                    disabled={isLocked || isExtracting}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePaperUpload(f);
                    }}
                  />
                  <span className="text-[#005dac] font-semibold flex items-center gap-1 mt-2">
                    <Upload className="w-4 h-4" /> Choose Paper
                  </span>
                  {paperFile && (
                    <span className="block mt-2 font-medium text-[#414752] truncate">
                      {paperFile.name} · {formatBytes(paperFile.size)}
                    </span>
                  )}
                  {isExtracting && (
                    <span className="block mt-1.5 text-[11px] font-bold text-[#005dac] animate-pulse">
                      Extracting questions with AI...
                    </span>
                  )}
                  {extractionSource && !isExtracting && (
                    <span className="block mt-1 text-[10px] text-[#196b22] font-semibold">
                      Extracted via {extractionSource === 'pdf_text' ? 'PDF Text Layer' : 'Vision Extraction'}
                    </span>
                  )}
                </label>

                <label className="rounded-lg border border-dashed border-[#c1c6d4] bg-[#f8f9ff] p-4 text-xs cursor-pointer hover:bg-[#eff4ff] transition-all">
                  <span className="font-semibold block mb-1">Answer Key (Optional)</span>
                  <input
                    type="file"
                    disabled={isLocked}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => setAnswerKeyFile(e.target.files?.[0] || null)}
                  />
                  <span className="text-[#005dac] font-semibold flex items-center gap-1 mt-2">
                    <FileKey2 className="w-4 h-4" /> Choose Key
                  </span>
                  {answerKeyFile ? (
                    <span className="block mt-2 font-medium text-[#414752] truncate">
                      {answerKeyFile.name} · {formatBytes(answerKeyFile.size)}
                    </span>
                  ) : (
                    <span className="block mt-2 text-[#64748b]">No key uploaded (AI will draft reference)</span>
                  )}
                </label>

                <div>
                  <label className="text-xs font-semibold block mb-1">Subject & Paper Title</label>
                  <input
                    disabled={isLocked}
                    value={paperTitle}
                    onChange={(e) => setPaperTitle(e.target.value)}
                    placeholder="e.g. Linux System Programming"
                    className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 text-xs mb-2 disabled:bg-[#f1f5f9]"
                  />
                  <label className="text-xs font-semibold block mb-1">Default Paper Strictness</label>
                  <select
                    disabled={isLocked}
                    value={mode}
                    onChange={(e) => setMode(e.target.value as CheckingMode)}
                    className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 text-xs disabled:bg-[#f1f5f9]"
                  >
                    {Object.entries(modeLabels).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col justify-end gap-2">
                  <button
                    type="button"
                    disabled={isLocked || editableQuestions.length === 0 || isExtracting || isGeneratingRef}
                    onClick={handleSaveSetup}
                    className="w-full rounded-lg bg-[#005dac] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#004786] disabled:opacity-40 shadow-xs flex items-center justify-center gap-1.5"
                  >
                    {isGeneratingRef ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>{answerKeyFile ? 'Parsing Answer Key...' : 'Drafting Reference...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>{setupSaved ? 'Re-Save Paper Setup' : (answerKeyFile ? 'Save & Parse Answer Key' : 'Save & Draft AI Reference')}</span>
                      </>
                    )}
                  </button>
                  {setupSaved && (
                    <span className="text-center text-[11px] font-semibold text-[#196b22] flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Paper Saved · {basis}
                    </span>
                  )}
                </div>
              </div>

              {/* Extraction Warnings & Instructions */}
              {extractionWarnings.length > 0 && (
                <div className="mt-4 rounded-lg border border-[#f57c00] bg-[#fff3e0] p-3 text-xs text-[#b26a00]">
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-4 h-4" /> Extraction Warnings:
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {extractionWarnings.map((w, wIdx) => (
                      <li key={wIdx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {instructions && (
                <div className="mt-3 rounded-lg border border-[#90caf9] bg-[#e3f2fd] p-2.5 text-xs text-[#0d47a1]">
                  <strong>Paper Instructions:</strong> {instructions}
                </div>
              )}

              {/* Section Rules Cards */}
              {sections.length > 0 && (
                <div className="mt-5 border-t border-[#f1f5f9] pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#005dac] flex items-center gap-1.5">
                        <Settings className="w-4 h-4 text-[#005dac]" />
                        Section Choice Rules & Attempt Limits ({sections.length} Sections)
                      </h2>
                      <p className="text-[11px] text-[#64748b]">
                        Configure attempt limits, per-question marks, and choice policies for each exam section.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {sections.map((sec, sIdx) => {
                      const isContradiction =
                        sec.attempt_n > 0 &&
                        sec.marks_each > 0 &&
                        sec.section_marks > 0 &&
                        Math.abs(sec.attempt_n * sec.marks_each - sec.section_marks) > 0.01;
                      const isCountMismatch =
                        sec.total_questions > 0 && sec.total_questions < sec.attempt_n;

                      return (
                        <div
                          key={sec.id || sIdx}
                          className={`rounded-xl border p-3.5 text-xs transition-all ${
                            isContradiction || isCountMismatch
                              ? 'border-[#f57c00] bg-[#fff8e1]'
                              : 'border-[#d4e3ff] bg-[#f8f9ff]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-[#005dac] text-sm">{sec.name}</span>
                            <span className="text-[10px] font-semibold text-[#64748b]">
                              {sec.total_questions} Questions Total
                            </span>
                          </div>

                          {sec.instructions && (
                            <p className="text-[11px] italic text-[#64748b] mb-2.5 bg-white/70 p-1.5 rounded border border-[#e2e8f0]">
                              "{sec.instructions}"
                            </p>
                          )}

                          {/* Contradiction Warning Banner */}
                          {isContradiction && (
                            <div className="mb-2.5 rounded-lg border border-[#f57c00] bg-[#fff3e0] p-2 text-[11px] font-bold text-[#b26a00] flex items-start gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-[#f57c00] shrink-0 mt-0.5" />
                              <div>
                                <strong>Contradiction Warning:</strong> Attempt {sec.attempt_n} × {sec.marks_each}M = {sec.attempt_n * sec.marks_each}M, but section marks is listed as {sec.section_marks}M!
                              </div>
                            </div>
                          )}
                          {isCountMismatch && (
                            <div className="mb-2.5 rounded-lg border border-[#ba1a1a] bg-[#ffdad6] p-2 text-[11px] font-bold text-[#93000a] flex items-start gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-[#ba1a1a] shrink-0 mt-0.5" />
                              <div>
                                <strong>Count Warning:</strong> Attempt {sec.attempt_n} specified, but only {sec.total_questions} questions exist in this section!
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-0.5">
                                Attempt Limit (N)
                              </label>
                              <input
                                type="number"
                                min={0}
                                disabled={isLocked}
                                value={sec.attempt_n}
                                onChange={(e) => {
                                  const copy = [...sections];
                                  copy[sIdx].attempt_n = Number(e.target.value) || 0;
                                  setSections(copy);
                                }}
                                className="w-full rounded border border-[#c1c6d4] bg-white px-2 py-1 text-xs font-bold text-[#005dac] disabled:bg-[#f1f5f9]"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-0.5">
                                Marks Each
                              </label>
                              <input
                                type="number"
                                step={0.5}
                                min={0.5}
                                disabled={isLocked}
                                value={sec.marks_each}
                                onChange={(e) => {
                                  const copy = [...sections];
                                  copy[sIdx].marks_each = Number(e.target.value) || 1;
                                  setSections(copy);
                                }}
                                className="w-full rounded border border-[#c1c6d4] bg-white px-2 py-1 text-xs font-bold disabled:bg-[#f1f5f9]"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-0.5">
                                Section Marks
                              </label>
                              <input
                                type="number"
                                step={0.5}
                                min={0.5}
                                disabled={isLocked}
                                value={sec.section_marks}
                                onChange={(e) => {
                                  const copy = [...sections];
                                  copy[sIdx].section_marks = Number(e.target.value) || 0;
                                  setSections(copy);
                                }}
                                className="w-full rounded border border-[#c1c6d4] bg-white px-2 py-1 text-xs font-bold disabled:bg-[#f1f5f9]"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold uppercase text-[#64748b] block mb-0.5">
                                Choice Policy
                              </label>
                              <select
                                disabled={isLocked}
                                value={sec.policy || 'best_n'}
                                onChange={(e) => {
                                  const copy = [...sections];
                                  copy[sIdx].policy = e.target.value as 'best_n' | 'first_n_answered';
                                  setSections(copy);
                                }}
                                className="w-full rounded border border-[#c1c6d4] bg-white px-1.5 py-1 text-[11px] font-semibold text-[#005dac] disabled:bg-[#f1f5f9]"
                              >
                                <option value="best_n">Best N (Highest)</option>
                                <option value="first_n_answered">First N Answered</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Editable Question Breakdown Table */}
              <div className="mt-5 border-t border-[#f1f5f9] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#005dac]">
                      Extracted Questions & Section Rules
                    </h2>
                    <p className="text-[11px] text-[#64748b]">
                      Total Questions: <strong>{editableQuestions.length}</strong> · Sum of Marks:{' '}
                      <strong className="text-[#005dac]">{calculatedQuestionTotal} Marks</strong>
                      {paperTotalMarks > 0 && ` (Paper Total: ${paperTotalMarks} Marks)`}
                    </p>
                  </div>
                  {paperTotalMismatch && (
                    <div className="rounded border border-[#f57c00] bg-[#fff3e0] px-3 py-1 text-[11px] font-bold text-[#b26a00] flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Warning: Sum of question marks ({calculatedQuestionTotal}) does not equal paper total ({paperTotalMarks})!
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#f8f9ff] border-b border-[#e2e8f0] font-bold text-[#414752]">
                      <tr>
                        <th className="p-2.5 w-16">Q #</th>
                        <th className="p-2.5">Question Text & MCQ Options</th>
                        <th className="p-2.5 w-24">Section</th>
                        <th className="p-2.5 w-28">Type</th>
                        <th className="p-2.5 w-24">Marks</th>
                        <th className="p-2.5 w-32">Strictness</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                      {editableQuestions.map((q, idx) => (
                        <tr key={idx} className="hover:bg-[#f8f9ff]">
                          <td className="p-2.5 font-bold">
                            <input
                              disabled={isLocked}
                              value={q.q_no}
                              onChange={(e) => {
                                const copy = [...editableQuestions];
                                copy[idx].q_no = e.target.value;
                                setEditableQuestions(copy);
                              }}
                              className="w-16 rounded border border-[#c1c6d4] px-1.5 py-1 text-xs font-bold disabled:bg-transparent disabled:border-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              disabled={isLocked}
                              value={q.question_text}
                              onChange={(e) => {
                                const copy = [...editableQuestions];
                                copy[idx].question_text = e.target.value;
                                setEditableQuestions(copy);
                              }}
                              className="w-full rounded border border-[#c1c6d4] px-2 py-1 text-xs disabled:bg-transparent disabled:border-none mb-1"
                            />
                            {q.question_type === 'mcq' && q.options && q.options.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {q.options.map((opt, oIdx) => (
                                  <span key={oIdx} className="rounded bg-[#eff4ff] border border-[#d4e3ff] px-1.5 py-0.5 text-[10px] text-[#005dac]">
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5">
                            <input
                              disabled={isLocked}
                              value={q.section_name}
                              onChange={(e) => {
                                const copy = [...editableQuestions];
                                copy[idx].section_name = e.target.value;
                                setEditableQuestions(copy);
                              }}
                              className="w-20 rounded border border-[#c1c6d4] px-1.5 py-1 text-xs disabled:bg-transparent disabled:border-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <select
                              disabled={isLocked}
                              value={q.question_type}
                              onChange={(e) => {
                                const copy = [...editableQuestions];
                                copy[idx].question_type = e.target.value;
                                setEditableQuestions(copy);
                              }}
                              className="rounded border border-[#c1c6d4] px-1.5 py-1 text-xs disabled:bg-transparent"
                            >
                              <option value="short">Short</option>
                              <option value="long">Long</option>
                              <option value="mcq">MCQ</option>
                              <option value="one_word">One Word</option>
                              <option value="maths">Maths</option>
                            </select>
                          </td>
                          <td className="p-2.5">
                            <input
                              disabled={isLocked}
                              type="number"
                              min={0.5}
                              step={0.5}
                              value={q.max_marks}
                              onChange={(e) => {
                                const copy = [...editableQuestions];
                                copy[idx].max_marks = Number(e.target.value) || 1;
                                setEditableQuestions(copy);
                              }}
                              className="w-16 rounded border border-[#c1c6d4] px-2 py-1 text-xs font-bold text-[#005dac] disabled:bg-transparent disabled:border-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <select
                              disabled={isLocked}
                              value={overrides[q.q_no] || mode}
                              onChange={(e) =>
                                setOverrides({ ...overrides, [q.q_no]: e.target.value as CheckingMode })
                              }
                              className="rounded border border-[#c1c6d4] px-2 py-1 text-[11px] disabled:bg-transparent"
                            >
                              <option value="strict">Strict</option>
                              <option value="lenient">Lenient</option>
                              <option value="maths">Maths</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 1.3: Reference Review & Approve/Lock Panel */}
              {references.length > 0 && (
                <div className="mt-6 rounded-xl border border-[#b9d3ff] bg-[#f8fbff] p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#dbe6f5] pb-3 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-[#004786] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#005dac]" />
                        Step 1.3 · Reference & Model Answers Review ({basis})
                      </h3>
                      <p className="text-xs text-[#526071]">
                        Review and fine-tune model answers and rubric points before approving and locking the paper.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={handleUpdateReferences}
                          className="rounded-lg border border-[#c1c6d4] bg-white px-3 py-1.5 text-xs font-semibold text-[#414752] hover:bg-[#f1f5f9]"
                        >
                          Save Edits
                        </button>
                      )}
                      {!isLocked ? (
                        <button
                          type="button"
                          onClick={handleLockPaper}
                          className="rounded-lg bg-[#005dac] px-4 py-2 text-xs font-bold text-white hover:bg-[#004786] flex items-center gap-1.5 shadow-xs"
                        >
                          <LockKeyhole className="w-4 h-4" /> Approve & Lock Paper
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-[#e8f5e9] border border-[#a5d6a7] px-3 py-1.5 text-xs font-bold text-[#1b5e20] flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-[#2e7d32]" /> Paper Approved & Locked
                          </span>
                          <button
                            type="button"
                            onClick={() => setStep('upload')}
                            className="rounded-lg bg-[#196b22] px-4 py-2 text-xs font-bold text-white hover:bg-[#14531b] flex items-center gap-1.5 shadow-xs"
                          >
                            <span>Proceed to Step 2: Upload Student Sheets</span>
                            <Upload className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {disagreements.length > 0 && (
                    <div className="mb-4 rounded-lg border border-[#f57c00] bg-[#fff3e0] p-3 text-xs text-[#b26a00]">
                      <div className="font-bold flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-4 h-4" /> Dual-Draft Cross-Check Disagreements:
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        {disagreements.map((d, dIdx) => (
                          <li key={dIdx}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-3">
                    {references.map((ref, rIdx) => {
                      const q = editableQuestions.find((item) => item.key === ref.key) || editableQuestions[rIdx];
                      const wordCount = (ref.model_answer || '').trim().split(/\s+/).filter(Boolean).length;
                      const targetWords = q?.word_limit || (q?.max_marks && q.max_marks >= 10 ? 300 : q?.max_marks && q.max_marks >= 6 ? 200 : 50);
                      const isAdequate = wordCount >= Math.floor(targetWords * 0.7);
                      const isBusy = Boolean(generatingKeys[ref.key]);

                      return (
                        <div key={ref.key || rIdx} className="rounded-lg border border-[#d4e3ff] bg-white p-4 shadow-2xs space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="rounded bg-[#005dac] px-2 py-0.5 text-[11px] font-bold text-white">
                                {q?.q_no || `Q.${rIdx + 1}`}
                              </span>
                              <span className="text-xs font-semibold text-[#1e293b]">
                                {q?.question_text || ref.key}
                              </span>
                              <span className="rounded bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">
                                {q?.max_marks} Marks · {q?.question_type?.toUpperCase()}
                              </span>
                              <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                isAdequate ? 'bg-[#e8f5e9] text-[#1b5e20] border border-[#a5d6a7]' : 'bg-[#fff3e0] text-[#b26a00] border border-[#ffe0b2]'
                              }`}>
                                {wordCount} / ~{targetWords} words
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {ref.correct_option && (
                                <span className="text-xs font-bold text-[#005dac] bg-[#eff4ff] px-2 py-0.5 rounded">
                                  Correct Option: {ref.correct_option}
                                </span>
                              )}
                              {!isLocked && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleRegenerateQuestion(ref.key)}
                                    className="rounded border border-[#c1c6d4] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#005dac] hover:bg-[#eff4ff] flex items-center gap-1 disabled:opacity-50"
                                    title="Regenerate reference and key points for this question"
                                  >
                                    <RefreshCw className={`w-3 h-3 ${isBusy ? 'animate-spin text-[#005dac]' : ''}`} />
                                    <span>Regenerate</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleExpandQuestion(ref.key)}
                                    className="rounded border border-[#005dac] bg-[#eff4ff] px-2.5 py-1 text-[11px] font-semibold text-[#005dac] hover:bg-[#dbe6f5] flex items-center gap-1 disabled:opacity-50"
                                    title="Critique missing depth and expand answer to target word length"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>Expand</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {ref.disagreements && ref.disagreements.length > 0 && (
                            <div className="rounded border border-[#ffe0b2] bg-[#fff8e1] p-2 text-[11px] text-[#b26a00]">
                              <strong className="block font-semibold">Dual-Draft Divergence:</strong>
                              <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                                {ref.disagreements.map((d, dIdx) => (
                                  <li key={dIdx}>{d}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="space-y-2 text-xs">
                            <div>
                              <label className="block text-[11px] font-semibold text-[#64748b] mb-1">Model Answer:</label>
                              <textarea
                                disabled={isLocked}
                                rows={3}
                                value={ref.model_answer}
                                onChange={(e) => {
                                  const copy = [...references];
                                  copy[rIdx].model_answer = e.target.value;
                                  setReferences(copy);
                                }}
                                className="w-full rounded border border-[#c1c6d4] p-2 text-xs disabled:bg-[#f8fafc]"
                              />
                            </div>

                            {ref.key_points && ref.key_points.length > 0 && (
                              <div>
                                <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                                  Rubric Key Points ({ref.key_points.reduce((s, p) => s + (Number(p.marks) || 0), 0)} / {q?.max_marks} M):
                                </label>
                                <div className="space-y-2">
                                  {ref.key_points.map((kp, kpIdx) => (
                                    <div key={kpIdx} className="rounded border border-[#e2e8f0] bg-[#fafcff] p-2 space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <input
                                          disabled={isLocked}
                                          value={kp.text}
                                          onChange={(e) => {
                                            const copy = [...references];
                                            copy[rIdx].key_points[kpIdx].text = e.target.value;
                                            setReferences(copy);
                                          }}
                                          className="flex-1 rounded border border-[#c1c6d4] px-2 py-1 text-xs disabled:bg-transparent"
                                        />
                                        <input
                                          disabled={isLocked}
                                          type="number"
                                          step={0.5}
                                          min={0.5}
                                          value={kp.marks}
                                          onChange={(e) => {
                                            const copy = [...references];
                                            copy[rIdx].key_points[kpIdx].marks = Number(e.target.value) || 0.5;
                                            setReferences(copy);
                                          }}
                                          className="w-16 rounded border border-[#c1c6d4] px-2 py-1 text-xs font-bold text-[#005dac] disabled:bg-transparent"
                                        />
                                        <span className="text-[11px] text-[#64748b]">M</span>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pl-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-[#1b5e20] shrink-0 text-[10px]">Accept if:</span>
                                          <input
                                            disabled={isLocked}
                                            placeholder="e.g. Real syntax or standard command arguments"
                                            value={kp.accept_if || ''}
                                            onChange={(e) => {
                                              const copy = [...references];
                                              copy[rIdx].key_points[kpIdx].accept_if = e.target.value;
                                              setReferences(copy);
                                            }}
                                            className="w-full rounded border border-[#c8e6c9] bg-[#f9fef9] px-2 py-0.5 text-[11px] text-[#1b5e20]"
                                          />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-[#ba1a1a] shrink-0 text-[10px]">Reject if:</span>
                                          <input
                                            disabled={isLocked}
                                            placeholder="e.g. Non-computing analogies or syntax error"
                                            value={kp.reject_if || ''}
                                            onChange={(e) => {
                                              const copy = [...references];
                                              copy[rIdx].key_points[kpIdx].reject_if = e.target.value;
                                              setReferences(copy);
                                            }}
                                            className="w-full rounded border border-[#ffcdd2] bg-[#fffafb] px-2 py-0.5 text-[11px] text-[#ba1a1a]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ----------------- SCREEN 2: UPLOAD ANSWER SHEETS ----------------- */}
        {step === 'upload' && (
          <section className="space-y-4">
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4 mb-4">
                <div>
                  <h1 className="text-lg font-bold flex items-center gap-2">
                    <Upload className="w-5 h-5 text-[#005dac]" />
                    Upload Student Answer Sheets
                  </h1>
                  <p className="text-xs text-[#64748b]">
                    Batch-queue answer sheets, verify student name/roll number detection, and ensure consent.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={readNamesWithAi}
                      onChange={(e) => setReadNamesWithAi(e.target.checked)}
                      className="accent-[#005dac] w-3.5 h-3.5"
                    />
                    Read names with AI
                  </label>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                  <label className="block rounded-xl border-2 border-dashed border-[#a5c8ff] bg-[#f8f9ff] p-6 text-center cursor-pointer hover:bg-[#eff4ff] transition-all">
                    <Upload className="w-8 h-8 text-[#005dac] mx-auto mb-2" />
                    <span className="font-bold text-sm text-[#005dac] block">
                      Click to choose student answer sheets (images or PDF)
                    </span>
                    <span className="text-xs text-[#64748b] block mt-1">
                      One upload per student (or select multiple files for batch queueing)
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const fl = Array.from(e.target.files || []);
                        if (fl.length > 0) {
                          setStudentFiles(fl);
                          handleStudentSheetUpload(fl);
                        }
                      }}
                    />
                  </label>

                  {/* Consent Checkbox */}
                  <div className="rounded-lg border border-[#d4e3ff] bg-[#eff4ff] p-3 text-xs flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="consent"
                      checked={hasConsent}
                      onChange={(e) => setHasConsent(e.target.checked)}
                      className="mt-0.5 accent-[#005dac] w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="consent" className="cursor-pointer font-medium text-[#00325b]">
                      I have permission to process these sheets with external AI services. (Required for evaluation and training-data capture export)
                    </label>
                  </div>

                  {/* Queued Student List */}
                  {studentFiles.length > 0 && (
                    <div className="rounded-lg border border-[#e2e8f0] p-3">
                      <div className="text-xs font-bold text-[#414752] mb-2">
                        Uploaded Sheets ({studentFiles.length})
                      </div>
                      <div className="space-y-1.5">
                        {studentFiles.map((file, idx) => (
                          <div
                            key={idx}
                            onClick={() => setActiveStudentIdx(idx)}
                            className={`p-2 rounded text-xs flex items-center justify-between cursor-pointer ${
                              activeStudentIdx === idx ? 'bg-[#d4e3ff] font-bold text-[#005dac]' : 'hover:bg-[#f1f5f9]'
                            }`}
                          >
                            <span>Sheet #{idx + 1} · {file.name}</span>
                            <span className="text-[11px] text-[#64748b]">{formatBytes(file.size)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Student Identity Box & Validation */}
                <div className="rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] p-4 space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#005dac]">
                    Student Header Verification
                  </h2>
                  <p className="text-[11px] text-[#64748b]">
                    Evaluation starts automatically when header confidence is &gt;= 70%.
                  </p>

                  {isUploadingSheet && (
                    <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-[#eff4ff] border border-[#b9d3ff] text-xs font-bold text-[#005dac]">
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Scanning header with AI (Task T4)...</span>
                    </div>
                  )}

                  {needsIdentityPrompt && currentSheetId ? (
                    <>
                      <div className="rounded-lg border border-[#f57c00] bg-[#fff3e0] p-2.5 text-xs text-[#b26a00]">
                        <div className="font-bold flex items-center gap-1.5 mb-1">
                          <AlertTriangle className="w-4 h-4" /> Header Verification Required
                        </div>
                        <p className="text-[11px]">
                          Header confidence was {headerConfidence !== null ? `${Math.round(headerConfidence * 100)}%` : 'unreadable'}. Please verify or enter student name and roll number below to proceed.
                        </p>
                      </div>

                      <div className={`p-3 rounded-lg border ${(!studentName || !rollNo) ? 'border-[#ba1a1a] bg-[#ffdad6]' : 'border-[#c1c6d4] bg-white'}`}>
                        <label className="text-[11px] font-bold block mb-1">Student Name *</label>
                        <input
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          placeholder="Enter student name"
                          className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 text-xs mb-2 font-medium"
                        />
                        <label className="text-[11px] font-bold block mb-1">Roll Number *</label>
                        <input
                          value={rollNo}
                          onChange={(e) => setRollNo(e.target.value)}
                          placeholder="e.g. BCA-2026-01"
                          className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 text-xs font-medium"
                        />
                        {(!studentName || !rollNo) && (
                          <span className="text-[10px] text-[#ba1a1a] font-bold block mt-1">
                            Manual entry required before evaluation can start.
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isUploadingSheet || !studentName.trim() || !rollNo.trim() || !hasConsent}
                        onClick={handleSaveIdentityAndStart}
                        className="w-full rounded-lg bg-[#005dac] px-4 py-3 text-xs font-bold text-white hover:bg-[#004786] disabled:opacity-40 shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Save Identity & Start Evaluation</span>
                      </button>
                    </>
                  ) : !isUploadingSheet && (
                    <div className="p-3 rounded-lg border border-[#e2e8f0] bg-white text-xs text-[#64748b]">
                      Upload an answer sheet above. If the header is detected with high confidence (≥70%), evaluation begins automatically. If unreadable, you will be prompted here to enter identity.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Phase D: Batch Sheets Queue & Management Card */}
            {sheetsList.length > 0 && (
              <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#f1f5f9] pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#004786] flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#005dac]" />
                      Class Answer Sheets Queue ({sheetsList.length} Sheets)
                    </h2>
                    <p className="text-xs text-[#526071]">
                      Batch-track student sheet processing status, unresolved flags, and bulk finalize clean sheets.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isBulkFinalizing || sheetsList.filter(s => s.status === 'completed' && s.unresolved_flags_count === 0).length === 0}
                      onClick={handleBulkFinalize}
                      className="rounded-lg bg-[#196b22] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#14531b] disabled:opacity-40 flex items-center gap-1.5 shadow-2xs"
                      title="Bulk finalize all completed sheets with zero unresolved flags"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isBulkFinalizing ? 'Finalizing...' : `Bulk Finalize (${sheetsList.filter(s => s.status === 'completed' && s.unresolved_flags_count === 0).length} Clean Sheets)`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => loadSheetsList(currentPaperId)}
                      className="rounded-lg border border-[#c1c6d4] bg-white p-1.5 text-[#005dac] hover:bg-[#eff4ff]"
                      title="Refresh sheets list"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Filters Bar */}
                <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-[#64748b]" />
                    <span className="font-semibold text-[#64748b]">Filter:</span>
                    {(['all', 'flagged', 'completed', 'queued'] as const).map((filterKey) => (
                      <button
                        key={filterKey}
                        type="button"
                        onClick={() => setSheetStatusFilter(filterKey)}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize transition-all ${
                          sheetStatusFilter === filterKey
                            ? 'bg-[#005dac] text-white shadow-2xs'
                            : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
                        }`}
                      >
                        {filterKey === 'flagged' ? 'Needs Review / Flagged' : filterKey}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-2.5 top-2" />
                    <input
                      value={sheetSearchQuery}
                      onChange={(e) => setSheetSearchQuery(e.target.value)}
                      placeholder="Search student or roll no..."
                      className="rounded-lg border border-[#c1c6d4] pl-8 pr-3 py-1 text-xs w-56"
                    />
                  </div>
                </div>

                {/* Sheets Table */}
                <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f8f9ff] text-[11px] font-bold text-[#64748b] border-b border-[#e2e8f0]">
                      <tr>
                        <th className="py-2.5 px-3">Roll No</th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Score</th>
                        <th className="py-2.5 px-3">Flags</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {filteredSheets.map((sh) => (
                        <tr key={sh.id} className="hover:bg-[#f8fbff] transition-all">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#005dac]">{sh.roll_number || '—'}</td>
                          <td className="py-2.5 px-3 font-semibold text-[#1e293b]">{sh.student_name || 'Unnamed'}</td>
                          <td className="py-2.5 px-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              sh.status === 'completed'
                                ? 'bg-[#e8f5e9] text-[#1b5e20]'
                                : sh.status === 'failed'
                                ? 'bg-[#ffdad6] text-[#93000a]'
                                : 'bg-[#eff4ff] text-[#005dac]'
                            }`}>
                              {sh.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#1e293b]">
                            {sh.total_score !== undefined ? `${sh.total_score} / ${sh.max_marks} M` : '—'}
                            {sh.grade && <span className="ml-1 text-[11px] font-semibold text-[#64748b]">({sh.grade})</span>}
                          </td>
                          <td className="py-2.5 px-3">
                            {sh.unresolved_flags_count > 0 ? (
                              <span className="rounded bg-[#ffdad6] text-[#93000a] px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 w-fit">
                                <Flag className="w-3 h-3" /> {sh.unresolved_flags_count} Unresolved
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#196b22] font-semibold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> 0 Flags
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentSheetId(sh.id);
                                loadSheetReview(sh.id);
                                setStep('review');
                              }}
                              className="rounded border border-[#005dac] bg-[#eff4ff] px-2.5 py-1 text-[11px] font-bold text-[#005dac] hover:bg-[#dbe6f5]"
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              disabled={sh.unresolved_flags_count > 0 || isFinalizing}
                              onClick={() => handleFinalizeSheet(sh.id)}
                              className="rounded border border-[#196b22] bg-white px-2 py-1 text-[11px] font-bold text-[#196b22] hover:bg-[#e8f5e9] disabled:opacity-40"
                              title={sh.unresolved_flags_count > 0 ? 'Resolve flags before finalizing' : 'Finalize sheet'}
                            >
                              Finalize
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSheet(sh.id)}
                              className="rounded border border-[#ba1a1a] bg-white p-1 text-[#ba1a1a] hover:bg-[#ffdad6]"
                              title="Delete sheet"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ----------------- SCREEN 3: EVALUATION STATUS TRACKER ----------------- */}
        {step === 'status' && (
          <section className="max-w-2xl mx-auto rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm text-center space-y-6">
            <h1 className="text-xl font-bold text-[#005dac]">Live Evaluation Progress</h1>
            <p className="text-xs text-[#64748b]">
              Evaluating sheet for <strong>{studentName}</strong> ({rollNo})
            </p>

            {/* Stage Progress Bar */}
            <div className="w-full bg-[#f1f5f9] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#005dac] h-full transition-all duration-300"
                style={{ width: `${stageProgress}%` }}
              />
            </div>

            {/* Stages Grid */}
            <div className="grid grid-cols-5 gap-2 text-[11px]">
              {[
                { key: 'reading', label: '1. Reading Pages' },
                { key: 'matching', label: '2. Matching Answers' },
                { key: 'marking', label: '3. Marking Rubric' },
                { key: 'checking', label: '4. Checking Flags' },
                { key: 'done', label: '5. Done' },
              ].map((st) => (
                <div
                  key={st.key}
                  className={`p-2.5 rounded-lg border ${
                    evalStage === st.key
                      ? 'border-[#005dac] bg-[#eff4ff] text-[#005dac] font-bold shadow-xs'
                      : stageProgress > 50
                      ? 'border-[#c8e6c9] bg-[#e8f5e9] text-[#196b22]'
                      : 'border-[#e2e8f0] text-[#64748b]'
                  }`}
                >
                  {st.label}
                </div>
              ))}
            </div>

            {evalStage === 'error' || sheetStatus === 'failed' ? (
              <div
                className={`rounded-lg border p-4 text-xs space-y-3 ${
                  errorMessage.toLowerCase().includes('429') ||
                  errorMessage.toLowerCase().includes('quota') ||
                  errorMessage.toLowerCase().includes('rate limit')
                    ? 'border-[#f59e0b] bg-[#fffbeb] text-[#b45309]'
                    : 'border-[#ba1a1a] bg-[#ffdad6] text-[#93000a]'
                }`}
              >
                <div className="flex items-center justify-center gap-2 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {errorMessage.toLowerCase().includes('429') ||
                    errorMessage.toLowerCase().includes('quota') ||
                    errorMessage.toLowerCase().includes('rate limit')
                      ? 'AI Provider Quota / Rate Limit Reached (HTTP 429)'
                      : 'Evaluation Encountered an Error'}
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded border border-current/20 font-mono text-[11px] text-left break-words">
                  {errorMessage || 'External provider timed out or rate limit reached.'}
                </div>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => currentSheetId && handleRetryEvaluation(currentSheetId)}
                    className="rounded bg-[#005dac] px-5 py-2 font-bold text-white hover:bg-[#004786] flex items-center gap-2 transition-all cursor-pointer shadow-md text-xs"
                  >
                    <RefreshCw className="w-4 h-4" /> Retry Evaluation
                  </button>
                  <button
                    type="button"
                    onClick={() => currentSheetId && handleDeleteSheet(currentSheetId)}
                    className="rounded border border-[#ba1a1a] bg-white px-3 py-2 font-bold text-[#ba1a1a] hover:bg-[#ffdad6] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Discard Sheet
                  </button>
                </div>
              </div>
            ) : evalStage === 'done' ? (
              <div className="text-xs font-bold text-[#196b22] flex items-center justify-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Evaluation complete! Redirecting to review...
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#005dac] animate-pulse flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{liveStageText || 'Processing in background · Zero frozen screen'}</span>
                </div>
                <div className="text-[11px] text-[#64748b]">
                  Continuous live polling active · Evaluates questions in parallel
                </div>
              </div>
            )}
          </section>
        )}

        {/* ----------------- SCREEN 4: 3-PANE TEACHER REVIEW WORKSPACE ----------------- */}
        {step === 'review' && (
          <section className="space-y-4">
            {/* Top Bar: Student Identity, Live Total Score, KPI & Finalize Action */}
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[#f1f5f9] pb-3 mb-3">
                <div>
                  <h1 className="text-base font-bold flex items-center gap-2 text-[#005dac]">
                    Teacher Review Workspace · {studentName} ({rollNo})
                  </h1>
                  <p className="text-xs text-[#64748b]">
                    Evaluation Basis: <strong className="text-[#005dac]">{basis}</strong> · Paper: <strong>{paperTitle || 'Exam Paper'}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Keyboard Shortcuts Pill */}
                  <span className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-[#f1f5f9] px-2.5 py-1 text-[11px] font-mono text-[#526071] border border-[#e2e8f0]">
                    <span className="font-bold text-[#005dac]">J/K:</span> Nav &nbsp;|&nbsp;
                    <span className="font-bold text-[#005dac]">A:</span> Accept &nbsp;|&nbsp;
                    <span className="font-bold text-[#005dac]">F:</span> Flagged
                  </span>

                  {/* Finalize Sheet Button */}
                  <button
                    type="button"
                    disabled={unresolvedFlagsCount > 0 || isFinalizing}
                    onClick={() => currentSheetId && handleFinalizeSheet(currentSheetId)}
                    className={`rounded-lg px-4 py-2 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all ${
                      unresolvedFlagsCount > 0
                        ? 'bg-[#e2e8f0] text-[#94a3b8] cursor-not-allowed border border-[#cbd5e1]'
                        : 'bg-[#196b22] text-white hover:bg-[#14531b] cursor-pointer'
                    }`}
                    title={unresolvedFlagsCount > 0 ? `Cannot finalize: ${unresolvedFlagsCount} unresolved flag(s) remain` : 'Finalize sheet and generate report card'}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isFinalizing ? 'Finalizing...' : 'Finalize Sheet'}</span>
                    {unresolvedFlagsCount > 0 && (
                      <span className="rounded bg-[#ffdad6] px-1.5 py-0.2 text-[10px] text-[#93000a] font-bold">
                        {unresolvedFlagsCount} flag{unresolvedFlagsCount > 1 ? 's' : ''} left
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('report');
                      loadReports();
                    }}
                    className="rounded-lg border border-[#c1c6d4] bg-white px-3 py-2 text-xs font-bold text-[#414752] hover:bg-[#f1f5f9]"
                  >
                    Reports
                  </button>

                  <button
                    type="button"
                    onClick={() => currentSheetId && handleDeleteSheet(currentSheetId)}
                    className="rounded-lg border border-[#ba1a1a] bg-white p-2 text-[#ba1a1a] hover:bg-[#ffdad6]"
                    title="Delete sheet"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* KPI Score Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-xl bg-[#eff4ff] border border-[#d4e3ff]">
                  <span className="text-[11px] font-semibold text-[#005dac] block">Total Counted Score</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-bold text-[#005dac]">{totalScore}</span>
                    <span className="text-xs text-[#005dac]/70 font-semibold">/ {maxMarks} M</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0]">
                  <span className="text-[11px] font-semibold text-[#64748b] block">Percentage</span>
                  <div className="text-xl font-bold text-[#1e293b] mt-0.5">{percentage}%</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#e8f5e9] border border-[#c8e6c9]">
                  <span className="text-[11px] font-semibold text-[#196b22] block">Grade</span>
                  <div className="text-xl font-bold text-[#196b22] mt-0.5">{grade}</div>
                </div>
                <div className={`p-2.5 rounded-xl border ${unresolvedFlagsCount > 0 ? 'bg-[#ffdad6] border-[#ba1a1a]' : 'bg-[#f8f9ff] border-[#e2e8f0]'}`}>
                  <span className={`text-[11px] font-semibold block ${unresolvedFlagsCount > 0 ? 'text-[#93000a]' : 'text-[#64748b]'}`}>
                    Unresolved Flags
                  </span>
                  <div className={`text-xl font-bold mt-0.5 ${unresolvedFlagsCount > 0 ? 'text-[#93000a]' : 'text-[#196b22]'}`}>
                    {unresolvedFlagsCount} {unresolvedFlagsCount === 0 ? '✓ All Clear' : 'Action Required'}
                  </div>
                </div>
              </div>
            </div>

            {/* 3-Pane Layout Grid */}
            <div className="grid gap-4 lg:grid-cols-[300px_1fr_420px] items-start">
              {/* PANE 1 (LEFT): Question List grouped by Section with Status Chips & Section Choice Rules */}
              <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-xs space-y-3">
                {/* Section Choice Rules Summary */}
                {sections && sections.length > 0 && (
                  <div className="space-y-1.5 border-b border-[#f1f5f9] pb-3">
                    <span className="text-[11px] font-bold text-[#64748b] block uppercase tracking-wider">
                      Section Choice Rules
                    </span>
                    {sections.map((sec) => {
                      const secQuestions = reviewItems.filter((q) => q.section_name === sec.name);
                      const countedQuestions = secQuestions.filter((q) => q.isCounted);
                      const secScore = countedQuestions.reduce((s, q) => s + (Number(q.finalMarks) || 0), 0);
                      const isChoice = sec.attempt_n && sec.total_questions && sec.attempt_n < sec.total_questions;
                      return (
                        <div key={sec.name} className="rounded-lg border border-[#c1c6d4]/50 bg-[#f8fbff] p-2 text-xs">
                          <div className="flex items-center justify-between font-bold text-[#004786]">
                            <span>{sec.name}</span>
                            <span className="text-[11px] font-semibold text-[#005dac]">
                              {secScore} / {sec.section_marks || (sec.attempt_n * sec.marks_each)} M
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] text-[#526071] leading-tight">
                            {isChoice
                              ? `Attempt ${sec.attempt_n} of ${sec.total_questions} (${sec.policy === 'best_n' ? 'Best N' : 'First N'}): counting ${countedQuestions.map(q => formatQNo(q.q_no)).join(', ') || 'none'}`
                              : `Compulsory: all ${sec.total_questions || secQuestions.length} Qs counted`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Filter Bar: All vs Flagged Only */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1e293b]">Questions</span>
                  <button
                    type="button"
                    onClick={() => setFlaggedOnlyFilter(!flaggedOnlyFilter)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all flex items-center gap-1 ${
                      flaggedOnlyFilter
                        ? 'bg-[#ba1a1a] text-white shadow-2xs'
                        : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
                    }`}
                  >
                    <Flag className="w-3 h-3" />
                    <span>Flagged Only ({unresolvedFlagsCount})</span>
                  </button>
                </div>

                {/* Grouped Questions List */}
                <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                  {(() => {
                    const sectionsList = Array.from(new Set(reviewItems.map((it) => it.section_name || 'General')));
                    return sectionsList.map((secName) => {
                      const secItems = reviewItems.filter((it) => (it.section_name || 'General') === secName);
                      const displayItems = flaggedOnlyFilter ? secItems.filter((it) => !it.resolved) : secItems;
                      if (displayItems.length === 0) return null;

                      return (
                        <div key={secName} className="space-y-1">
                          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block px-1">
                            {secName}
                          </span>
                          {displayItems.map((item) => {
                            const isSelected = (selectedReviewItem?.q_no === item.q_no) || (selectedReviewItem?.question_key === item.question_key);
                            return (
                              <button
                                key={item.q_no}
                                type="button"
                                onClick={() => setSelectedKey(item.question_key || item.q_no || item.eval_id || '')}
                                className={`w-full text-left rounded-lg p-2.5 text-xs transition-all flex items-center justify-between border ${
                                  isSelected
                                    ? 'border-[#005dac] bg-[#eff4ff] ring-2 ring-[#005dac]/30 shadow-xs'
                                    : !item.resolved
                                    ? 'border-[#ba1a1a]/60 bg-[#fff5f5] hover:bg-[#ffebee]'
                                    : 'border-[#e2e8f0] bg-white hover:bg-[#f8f9ff]'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="font-bold flex items-center gap-1.5">
                                    <span className={isSelected ? 'text-[#005dac]' : 'text-[#1e293b]'}>
                                      {formatQNo(item.q_no)}
                                    </span>
                                    {!item.isCounted && (
                                      <span className="ml-1 rounded bg-[#fff3e0] border border-[#ffe0b2] px-1 py-0.2 text-[9px] font-bold text-[#b26a00]">
                                        Not Counted
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] truncate max-w-[170px] text-[#64748b]">
                                    {!item.resolved ? (
                                      <span className="text-[#ba1a1a] font-medium flex items-center gap-1">
                                        <Flag className="w-2.5 h-2.5 shrink-0" /> {item.reason || 'Flagged for review'}
                                      </span>
                                    ) : (
                                      <span className="text-[#196b22] font-medium flex items-center gap-1">
                                        <Check className="w-2.5 h-2.5 shrink-0" /> Verified
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className={`font-bold block ${!item.resolved ? 'text-[#ba1a1a]' : 'text-[#196b22]'}`}>
                                    {item.finalMarks} / {item.max_marks} M
                                  </span>
                                  <span className="text-[9px] text-[#64748b]">
                                    {item.resolved ? 'Checked' : 'Flagged'}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* PANE 2 (CENTER): Interactive Sheet Viewer with Auto-Page Jump & Bounding-Box Overlay */}
              <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-xs space-y-2">
                {/* Center Toolbar */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#f1f5f9]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#005dac]">Answer Sheet Viewer</span>
                    {sheetPages.length > 1 && (
                      <span className="text-[11px] text-[#64748b] font-medium">
                        (Page {activeSheetPage + 1} of {sheetPages.length})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {sheetPages.length > 1 && (
                      <div className="flex items-center gap-1 mr-1">
                        <button
                          type="button"
                          disabled={activeSheetPage <= 0}
                          onClick={() => setActiveSheetPage((p) => Math.max(0, p - 1))}
                          className="px-2 py-0.5 rounded border border-[#c1c6d4] bg-white text-xs disabled:opacity-40 hover:bg-[#f1f5f9]"
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          disabled={activeSheetPage >= sheetPages.length - 1}
                          onClick={() => setActiveSheetPage((p) => Math.min(sheetPages.length - 1, p + 1))}
                          className="px-2 py-0.5 rounded border border-[#c1c6d4] bg-white text-xs disabled:opacity-40 hover:bg-[#f1f5f9]"
                        >
                          Next
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setStudentZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                      className="rounded border border-[#c1c6d4] bg-white p-1 hover:bg-[#f1f5f9]"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5 text-[#005dac]" />
                    </button>
                    <span className="text-[10px] font-bold text-[#64748b] w-8 text-center">
                      {Math.round(studentZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setStudentZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                      className="rounded border border-[#c1c6d4] bg-white p-1 hover:bg-[#f1f5f9]"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5 text-[#005dac]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentRotation((r) => (r + 90) % 360)}
                      className="rounded border border-[#c1c6d4] bg-white px-2 py-1 text-xs font-semibold hover:bg-[#f1f5f9] flex items-center gap-1"
                      title="Rotate Sheet 90°"
                    >
                      <RotateCw className="w-3 h-3 text-[#005dac]" /> {studentRotation}°
                    </button>
                  </div>
                </div>

                {/* Clickable Page Thumbnail Strip (if multiple pages) */}
                {sheetPages.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 border-b border-[#f1f5f9]">
                    {sheetPages.map((pageUrl, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setActiveSheetPage(pIdx)}
                        className={`shrink-0 rounded border p-0.5 transition-all ${
                          activeSheetPage === pIdx
                            ? 'border-[#005dac] ring-2 ring-[#005dac]/40 bg-[#eff4ff]'
                            : 'border-[#e2e8f0] opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={pageUrl}
                          alt={`Thumbnail ${pIdx + 1}`}
                          className="w-10 h-14 object-cover rounded-xs"
                        />
                        <span className="text-[9px] font-bold block text-center mt-0.5 text-[#64748b]">
                          P.{pIdx + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Sheet Page Canvas Container with Bounding Box Overlay */}
                <div className="relative min-h-[560px] max-h-[720px] overflow-auto rounded-lg bg-[#f8f9ff] p-3 border border-[#e2e8f0] flex items-center justify-center">
                  <div
                    className="relative inline-block transition-transform duration-150"
                    style={{
                      transform: `rotate(${studentRotation}deg) scale(${studentZoom})`,
                      transformOrigin: 'center center',
                    }}
                  >
                    {sheetPages.length > 0 ? (
                      <img
                        src={sheetPages[activeSheetPage]}
                        alt={`Student sheet page ${activeSheetPage + 1}`}
                        className="max-h-[660px] max-w-full object-contain rounded shadow-xs"
                      />
                    ) : studentPreview ? (
                      <img
                        src={studentPreview}
                        alt="Student sheet preview"
                        className="max-h-[660px] max-w-full object-contain rounded shadow-xs"
                      />
                    ) : (
                      <div className="text-xs text-[#64748b] p-8 text-center">Answer sheet image preview unavailable</div>
                    )}

                    {/* Bounding Box Highlight Overlay */}
                    {selectedReviewItem?.bbox_json && Array.isArray(selectedReviewItem.bbox_json) && selectedReviewItem.bbox_json.length > 0 && (
                      (() => {
                        const box = selectedReviewItem.bbox_json[0];
                        let top = 0, left = 0, width = 100, height = 25;
                        if (box && typeof box === 'object' && 'x' in box && 'y' in box && 'w' in box && 'h' in box) {
                          left = box.x <= 1.0 ? box.x * 100 : (box.x / 800) * 100;
                          top = box.y <= 1.0 ? box.y * 100 : (box.y / 1100) * 100;
                          width = box.w <= 1.0 ? box.w * 100 : (box.w / 800) * 100;
                          height = box.h <= 1.0 ? box.h * 100 : (box.h / 1100) * 100;
                        } else if (Array.isArray(box) && box.length === 4) {
                          const [b0, b1, b2, b3] = box;
                          if (Math.max(b0, b1, b2, b3) <= 1.0) {
                            top = b0 * 100;
                            left = b1 * 100;
                            height = (b2 - b0) * 100;
                            width = (b3 - b1) * 100;
                          }
                        }
                        return (
                          <div
                            className="pointer-events-none absolute rounded border-2 border-[#005dac] bg-[#005dac]/15 shadow-sm transition-all"
                            style={{
                              top: `${Math.max(0, top)}%`,
                              left: `${Math.max(0, left)}%`,
                              width: `${Math.min(100, width)}%`,
                              height: `${Math.min(100, height)}%`,
                            }}
                          >
                            <span className="absolute -top-4 left-0 rounded bg-[#005dac] px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs">
                              {formatQNo(selectedReviewItem.q_no)}
                            </span>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>

              {/* PANE 3 (RIGHT): Selected Question Evaluation Card */}
              {selectedReviewItem ? (
                <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-xs space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#005dac] px-2 py-0.5 text-xs font-bold text-white">
                        {formatQNo(selectedReviewItem.q_no)}
                      </span>
                      <span className="text-xs font-bold text-[#1e293b]">
                        {selectedReviewItem.section_name || 'General'}
                      </span>
                      <span className="rounded bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">
                        {selectedReviewItem.max_marks} Marks
                      </span>
                    </div>

                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      selectedReviewItem.resolved
                        ? 'bg-[#e8f5e9] text-[#1b5e20]'
                        : 'bg-[#ffdad6] text-[#93000a]'
                    }`}>
                      {selectedReviewItem.resolved ? 'Checked' : 'Flagged'}
                    </span>
                  </div>

                  {/* Flag Reason Alert */}
                  {!selectedReviewItem.resolved && selectedReviewItem.reason && (
                    <div className="rounded-lg border border-[#ba1a1a] bg-[#ffdad6] p-2.5 text-xs text-[#93000a] space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Flag Reason:</span>
                      </div>
                      <p className="text-[11px] leading-snug">{selectedReviewItem.reason}</p>
                    </div>
                  )}

                  {/* Cropped Handwriting Image */}
                  <div className="rounded-lg border border-[#c1c6d4]/70 bg-[#f8fafc] p-2 space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#526071]">
                      Handwriting Snippet (Page {(selectedReviewItem.page_numbers?.[0] ?? 0) + 1})
                    </span>
                    <div className="max-h-36 overflow-auto rounded bg-white border border-[#e2e8f0] p-1 flex items-center justify-center">
                      <img
                        src={`/api/sheets/${currentSheetId}/crop/${selectedReviewItem.eval_id}`}
                        alt="Handwriting crop"
                        className="max-h-32 max-w-full object-contain mx-auto"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>

                  {/* Verbatim Transcript (Editable) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#1e293b] flex items-center justify-between">
                      <span>Raw Character-by-Character Transcript (Editable)</span>
                      <span className="text-[10px] text-[#64748b] font-normal">Edit typos below</span>
                    </label>
                    <textarea
                      value={editTranscript}
                      onChange={(e) => setEditTranscript(e.target.value)}
                      rows={3}
                      className="w-full rounded border border-[#c1c6d4] p-2 text-xs font-mono bg-white focus:ring-1 focus:ring-[#005dac]"
                    />
                  </div>

                  {/* Verified Evidence Quote */}
                  {selectedReviewItem.evidence_quote && (
                    <div className="rounded-lg border border-[#c8e6c9] bg-[#e8f5e9] p-2 text-xs text-[#196b22] space-y-0.5">
                      <div className="font-bold flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Verified Evidence Quote:
                      </div>
                      <blockquote className="italic text-[11px] font-serif bg-white/70 p-1.5 rounded border border-[#c8e6c9]/50">
                        "{selectedReviewItem.evidence_quote}"
                      </blockquote>
                    </div>
                  )}

                  {/* Rubric Key-Point Breakdown */}
                  {selectedReviewItem.key_points && selectedReviewItem.key_points.length > 0 && (
                    <div className="rounded-lg border border-[#e2e8f0] bg-[#fafcff] p-2.5 space-y-1.5">
                      <span className="text-[11px] font-bold text-[#005dac] block">
                        Rubric Breakdown ({selectedReviewItem.max_marks} M)
                      </span>
                      <div className="space-y-1">
                        {selectedReviewItem.key_points.map((kp, kpIdx) => (
                          <div key={kpIdx} className="rounded border border-[#e2e8f0] bg-white p-1.5 text-[11px] space-y-0.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-medium text-[#1e293b] flex-1 leading-snug">{kp.text}</span>
                              <span className="rounded bg-[#eff4ff] px-1.5 py-0.2 text-[10px] font-bold text-[#005dac] shrink-0">
                                {kp.marks} M
                              </span>
                            </div>
                            {kp.accept_if && (
                              <div className="text-[10px] text-[#196b22]"><strong className="text-[#2e7d32]">Accept:</strong> {kp.accept_if}</div>
                            )}
                            {kp.reject_if && (
                              <div className="text-[10px] text-[#ba1a1a]"><strong className="text-[#c62828]">Reject:</strong> {kp.reject_if}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Teacher Override Controls */}
                  <div className="rounded-lg border border-[#c1c6d4] bg-[#f8fbff] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#1e293b]">Final Marks (0.5 steps)</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setOverrideMarks((m) => Math.max(0, Number((m - 0.5).toFixed(1))))}
                          className="rounded border border-[#c1c6d4] bg-white p-1 hover:bg-[#e2e8f0]"
                          title="Decrease 0.5M"
                        >
                          <Minus className="w-3 h-3 text-[#005dac]" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={selectedReviewItem.max_marks}
                          step={0.5}
                          value={overrideMarks}
                          onChange={(e) => setOverrideMarks(Number(e.target.value) || 0)}
                          className="w-14 text-center font-bold text-[#005dac] text-sm border border-[#005dac] rounded py-0.5 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setOverrideMarks((m) => Math.min(selectedReviewItem.max_marks, Number((m + 0.5).toFixed(1))))}
                          className="rounded border border-[#c1c6d4] bg-white p-1 hover:bg-[#e2e8f0]"
                          title="Increase 0.5M"
                        >
                          <Plus className="w-3 h-3 text-[#005dac]" />
                        </button>
                        <span className="text-xs font-semibold text-[#64748b]">/ {selectedReviewItem.max_marks}</span>
                      </div>
                    </div>

                    {/* Required reason when marks differ from AI suggested marks */}
                    {overrideMarks !== (selectedReviewItem.suggested_marks ?? selectedReviewItem.finalMarks) && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-[#ba1a1a] block">
                          Teacher Override Reason (Required):
                        </label>
                        <input
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="e.g. Accurate system call explanation provided"
                          className="w-full rounded border border-[#ba1a1a] px-2 py-1 text-xs bg-white"
                        />
                      </div>
                    )}

                    {/* Count in Total Toggle */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#d4e3ff]">
                      <div>
                        <span className="text-xs font-semibold text-[#004786] block">Count in Final Total</span>
                        <span className="text-[10px] text-[#64748b]">
                          {isCountedOverride ? 'Included in student score' : 'Optional / Extra answer excluded'}
                        </span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-[#005dac]">
                        <input
                          type="checkbox"
                          checked={isCountedOverride}
                          onChange={(e) => handleToggleCounted(selectedReviewItem, e.target.checked)}
                          className="w-4 h-4 rounded text-[#005dac]"
                        />
                        <span>{isCountedOverride ? 'Counted' : 'Not Counted'}</span>
                      </label>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAcceptCurrent(selectedReviewItem)}
                      className="flex-1 rounded-lg border border-[#196b22] bg-[#e8f5e9] py-2 text-xs font-bold text-[#196b22] hover:bg-[#c8e6c9] flex items-center justify-center gap-1 shadow-2xs"
                      title="Accept AI suggested marks and move to next question [A]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept AI ({selectedReviewItem.suggested_marks ?? selectedReviewItem.finalMarks}M) [A]</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOverrideCurrent(selectedReviewItem)}
                      className="flex-1 rounded-lg bg-[#005dac] py-2 text-xs font-bold text-white hover:bg-[#004786] flex items-center justify-center gap-1 shadow-2xs"
                      title="Save teacher overridden marks with required reason"
                    >
                      <span>Save Override</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLiveRecheck(selectedReviewItem)}
                      className="rounded-lg border border-[#c1c6d4] bg-white p-2 text-[#005dac] hover:bg-[#eff4ff]"
                      title="Live AI Recheck with edited transcript"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 text-center text-xs text-[#64748b]">
                  Select a question from the left pane to review evaluation details.
                </div>
              )}
            </div>
          </section>
        )}

        {/* ----------------- SCREEN 5: REPORTS (PDF & EXCEL) ----------------- */}
        {step === 'report' && (
          <section className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
              <div>
                <h1 className="text-lg font-bold text-[#005dac]">Academic Reports & Performance Analysis</h1>
                <p className="text-xs text-[#64748b]">
                  Student Report Cards (PDF) and Class Results Matrix (Excel)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-lg border border-[#c1c6d4] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#f1f5f9] flex items-center gap-1 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Report
                </button>
                {reportData?.student_reports?.[0] && (
                  <a
                    href={reportData.student_reports[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[#005dac] px-3 py-1.5 text-xs font-bold text-[#005dac] hover:bg-[#eff4ff] flex items-center gap-1 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Student PDF Report Card
                  </a>
                )}
                {reportData?.paper_summary_pdf_url && (
                  <a
                    href={reportData.paper_summary_pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[#005dac] px-3 py-1.5 text-xs font-bold text-[#005dac] hover:bg-[#eff4ff] flex items-center gap-1 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Paper Summary PDF
                  </a>
                )}
                <a
                  href={reportData?.excel_report_url || `/api/papers/${currentPaperId}/reports`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-[#005dac] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#004786] flex items-center gap-1 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download Excel Matrix
                </a>
              </div>
            </div>

            {/* Student Summary KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                <span className="text-[#64748b] block">Student</span>
                <strong className="text-sm">{studentName}</strong>
              </div>
              <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                <span className="text-[#64748b] block">Roll Number</span>
                <strong className="text-sm">{rollNo}</strong>
              </div>
              <div className="p-3 rounded-lg bg-[#eff4ff] border border-[#d4e3ff]">
                <span className="text-[#005dac] block">Total Score</span>
                <strong className="text-base text-[#005dac]">{totalScore} / {maxMarks}</strong>
              </div>
              <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                <span className="text-[#64748b] block">Percentage</span>
                <strong className="text-sm">{percentage}%</strong>
              </div>
              <div className="p-3 rounded-lg bg-[#e8f5e9] border border-[#c8e6c9]">
                <span className="text-[#196b22] block">Grade</span>
                <strong className="text-sm text-[#196b22]">{grade}</strong>
              </div>
              <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                <span className="text-[#64748b] block">Evaluation Basis</span>
                <strong className="text-[11px] truncate block">{basis}</strong>
              </div>
            </div>

            {/* Questions Table */}
            <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#f8f9ff] border-b border-[#e2e8f0] font-bold text-[#414752]">
                  <tr>
                    <th className="p-2.5">Q #</th>
                    <th className="p-2.5">Marks Obtained / Max</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Remarks / Quoted Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {reviewItems.map((item) => (
                    <tr key={item.q_no} className="hover:bg-[#f8f9ff]">
                      <td className="p-2.5 font-bold">{formatQNo(item.q_no)}</td>
                      <td className="p-2.5 font-semibold">
                        {item.finalMarks} / {item.max_marks}M
                      </td>
                      <td className="p-2.5">
                        <span className="rounded bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#196b22]">
                          {item.statusLabel || 'Auto-Verified'}
                        </span>
                      </td>
                      <td className="p-2.5 text-[#414752]">
                        {item.feedback || item.reason || 'Answers verified against rubric standard.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Strengths & Improvements */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#c8e6c9] bg-[#f1f8e9] p-4 text-xs">
                <h3 className="font-bold text-[#2e7d32] mb-1">Key Strengths (Task T7 Rubric Analysis)</h3>
                <ul className="list-disc list-inside space-y-1 text-[#33691e]">
                  {reviewItems.filter((r) => r.finalMarks >= r.max_marks * 0.75).map((r, i) => (
                    <li key={i}>Demonstrated mastery on {formatQNo(r.q_no)} ({r.finalMarks}/{r.max_marks} marks).</li>
                  ))}
                  {reviewItems.filter((r) => r.finalMarks >= r.max_marks * 0.75).length === 0 && (
                    <li>Consistent effort across attempted questions.</li>
                  )}
                </ul>
              </div>
              <div className="rounded-lg border border-[#ffe082] bg-[#fffde7] p-4 text-xs">
                <h3 className="font-bold text-[#f57f17] mb-1">Areas for Improvement (Missed Rubric Criteria)</h3>
                <ul className="list-disc list-inside space-y-1 text-[#e65100]">
                  {reviewItems.filter((r) => r.finalMarks < r.max_marks * 0.75).map((r, i) => (
                    <li key={i}>Review {formatQNo(r.q_no)}: {r.reason || 'Deductions against key points'}</li>
                  ))}
                  {reviewItems.filter((r) => r.finalMarks < r.max_marks * 0.75).length === 0 && (
                    <li>No major rubric deficiencies identified.</li>
                  )}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ----------------- SCREEN 6: LIBRARY ----------------- */}
        {step === 'library' && (
          <section className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2 text-[#005dac]">
                  <Database className="w-5 h-5 text-[#005dac]" />
                  Library of Saved Papers & Reports
                </h1>
                <p className="text-xs text-[#64748b]">
                  Persistent SQLite storage (`data/app.db`) and disk repository (`data/storage/`).
                </p>
              </div>
              <button
                type="button"
                onClick={loadSavedPapers}
                className="rounded-lg border border-[#c1c6d4] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#f1f5f9] flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {savedPapers.length === 0 ? (
              <div className="text-center py-10 text-xs text-[#64748b]">
                No papers saved in SQLite database yet. Save a paper in Screen 1 to see it here.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {savedPapers.map((p) => (
                  <div key={p.id} className="rounded-xl border border-[#e2e8f0] p-4 bg-[#f8f9ff] space-y-2">
                    <div className="font-bold text-sm text-[#005dac] flex items-center justify-between">
                      <span>{p.title}</span>
                      <span className="text-xs text-[#414752]">{p.total_marks} Marks</span>
                    </div>
                    <div className="text-xs text-[#64748b]">{p.subject || 'General'} · {p.strictness}</div>
                    <div className="flex items-center justify-between pt-2 text-[11px]">
                      <span className="text-[#64748b]">{new Date(p.created_at).toLocaleDateString()}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenPaper(p.id)}
                        className="font-bold text-[#005dac] hover:underline"
                      >
                        Open Paper →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ----------------- SCREEN 7: VERIFY MODE (TRAINING DATA CAPTURE) ----------------- */}
        {step === 'verify' && (
          <section className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2 text-[#005dac]">
                  <Archive className="w-5 h-5 text-[#005dac]" />
                  Training Dataset Verification & Export
                </h1>
                <p className="text-xs text-[#64748b]">
                  Verify segmented line crops to build a human-verified dataset (`provenance = human_verified`).
                </p>
              </div>
              <a
                href="/api/training/export.zip"
                download="training_export.zip"
                className="rounded-lg bg-[#005dac] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#004786] flex items-center gap-1 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" /> Export Training Dataset ZIP
              </a>
            </div>

            {/* Line Verification Workspace */}
            {trainingLines.length === 0 ? (
              <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-8 text-center space-y-2">
                <Archive className="w-8 h-8 text-[#94a3b8] mx-auto" />
                <div className="text-sm font-bold text-[#334155]">No Segmented Lines Pending Verification</div>
                <p className="text-xs text-[#64748b] max-w-md mx-auto">
                  Line crops are automatically segmented when student answer sheets are processed with consent enabled.
                  Process an answer sheet with student consent to capture handwriting lines.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-lg border border-[#e2e8f0] p-4 bg-[#f8f9ff] space-y-3">
                  <div className="text-xs font-bold text-[#005dac] flex justify-between">
                    <span>
                      Handwritten Line Crop ({trainingLines.findIndex((l) => l.id === activeLine?.id) + 1} of {trainingLines.length})
                    </span>
                    <span className="text-[#64748b]">
                      {activeLine?.is_sample ? '10% Random Sample' : 'Review Candidate'}
                    </span>
                  </div>
                  <div className="h-36 rounded bg-white border border-[#e2e8f0] flex items-center justify-center p-2 overflow-hidden">
                    {activeLine?.image_path ? (
                      <img
                        src={
                          activeLine.image_path.startsWith('/storage/')
                            ? activeLine.image_path
                            : activeLine.image_path.startsWith('storage/')
                            ? `/${activeLine.image_path.replace(/\\/g, '/')}`
                            : `/storage/${activeLine.image_path.replace(/\\/g, '/')}`
                        }
                        alt="Line crop"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-xs text-[#64748b]">No active line crop selected.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-[#e2e8f0] p-4 bg-white space-y-3">
                  <div className="text-xs font-bold text-[#005dac]">Human-Verified Transcription</div>
                  <textarea
                    value={verifiedText}
                    onChange={(e) => setVerifiedText(e.target.value)}
                    rows={4}
                    disabled={!activeLine}
                    className="w-full rounded border border-[#c1c6d4] p-2 text-xs font-mono disabled:bg-[#f8fafc]"
                    placeholder="Type or correct student handwriting text here..."
                  />
                  <button
                    type="button"
                    disabled={!activeLine}
                    onClick={handleVerifyLine}
                    className="w-full rounded-lg bg-[#196b22] py-2 text-xs font-bold text-white hover:bg-[#145a1c] shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Confirm & Mark Human-Verified (Provenance: human_verified)
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ----------------- INTERACTIVE REVIEW POPUP ----------------- */}
      {activeReview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
              <h2 className="text-base font-bold text-[#005dac]">
                Teacher Review · {formatQNo(activeReview.q_no)}
              </h2>
              <button
                type="button"
                onClick={() => setActiveReview(null)}
                className="text-[#64748b] hover:text-[#0b1c30]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Flag Reason Alert */}
            {activeReview.reason && (
              <div className="rounded-lg border border-[#ba1a1a] bg-[#ffdad6] p-3 text-xs text-[#93000a] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span><strong>Flag Reason:</strong> {activeReview.reason}</span>
              </div>
            )}

            {/* Verified Quote Alert */}
            {activeReview.evidence_quote && (
              <div className="rounded-lg border border-[#c8e6c9] bg-[#e8f5e9] p-3 text-xs text-[#196b22] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#196b22]" />
                <span><strong>Verified Evidence Quote:</strong> "{activeReview.evidence_quote}"</span>
              </div>
            )}

            {/* Extracted Text (Editable) */}
            <div>
              <label className="text-xs font-bold block mb-1">Student's Extracted Text (Editable)</label>
              <textarea
                value={activeReview.transcribed_text}
                onChange={(e) =>
                  setActiveReview({ ...activeReview, transcribed_text: e.target.value })
                }
                rows={3}
                className="w-full rounded border border-[#c1c6d4] p-2.5 text-xs font-mono"
              />
            </div>

            {/* AI Marks & Teacher Override Box */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg bg-[#f8f9ff] border border-[#e2e8f0] p-3">
                <span className="text-[#64748b] block mb-1">AI Evaluated Marks</span>
                <strong className="text-base text-[#005dac]">
                  {activeReview.suggested_marks ?? activeReview.finalMarks} / {activeReview.max_marks}
                </strong>
                <p className="text-[11px] text-[#414752] mt-1">
                  {activeReview.feedback || 'Evaluated against question key points.'}
                </p>
              </div>

              <div className="rounded-lg bg-white border border-[#c1c6d4] p-3">
                <label className="text-xs font-bold block mb-1">Teacher Override Marks (0.5 steps)</label>
                <input
                  type="number"
                  min={0}
                  max={activeReview.max_marks}
                  step={0.5}
                  value={activeReview.finalMarks}
                  onChange={(e) =>
                    setActiveReview({ ...activeReview, finalMarks: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded border border-[#005dac] px-3 py-1.5 text-sm font-bold text-[#005dac]"
                />
                <span className="text-[10px] text-[#64748b] block mt-1">
                  Range: 0 to {activeReview.max_marks} marks
                </span>
              </div>
            </div>

            {/* Count in Total Score Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff]">
              <div>
                <span className="text-xs font-bold text-[#005dac] block">Count in Final Total Score</span>
                <span className="text-[11px] text-[#64748b]">
                  {activeReview.isCounted
                    ? "Question marks are included in the student's final total score."
                    : 'Optional / Extra answer excluded from total score calculation.'}
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-[#005dac]">
                <input
                  type="checkbox"
                  checked={activeReview.isCounted}
                  onChange={(e) => setActiveReview({ ...activeReview, isCounted: e.target.checked })}
                  className="w-4 h-4 rounded text-[#005dac] focus:ring-0"
                />
                <span>{activeReview.isCounted ? 'Counted' : 'Not Counted'}</span>
              </label>
            </div>

            {/* Teacher Comment */}
            <div>
              <label className="text-xs font-bold block mb-1">Optional Teacher Comment</label>
              <input
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                placeholder="e.g. Excellent explanation of system calls."
                className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 text-xs"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleRecheck}
                className="rounded-lg border border-[#c1c6d4] bg-[#f8f9ff] px-4 py-2 text-xs font-bold text-[#005dac] hover:bg-[#eff4ff] flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-check with AI
              </button>
              <button
                type="button"
                onClick={() => handleConfirmReview(activeReview, activeReview.suggested_marks)}
                className="rounded-lg border border-[#005dac] px-4 py-2 text-xs font-bold text-[#005dac] hover:bg-[#eff4ff]"
              >
                Accept AI Marks
              </button>
              <button
                type="button"
                onClick={() => handleConfirmReview(activeReview, activeReview.finalMarks)}
                className="rounded-lg bg-[#005dac] px-5 py-2 text-xs font-bold text-white hover:bg-[#004786] shadow-xs"
              >
                Save My Marks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
