import { useMemo, useState, useEffect } from 'react';
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

interface UIQuestion {
  key: string;
  q_no: string;
  question_text: string;
  max_marks: number;
  question_type: string;
  section_name: string;
  options: string[];
}

interface UIKeyPoint {
  text: string;
  marks: number;
}

interface UIReferenceItem {
  id?: string;
  key: string;
  question_id?: string;
  model_answer: string;
  key_points: UIKeyPoint[];
  accepted_alternatives?: string[];
  common_mistakes?: string[];
  correct_option?: string | null;
  confidence?: number;
  source?: string;
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
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);

  // Review & Split View State
  const [paperRotation, setPaperRotation] = useState(0);
  const [studentRotation, setStudentRotation] = useState(0);
  const [reviewItems, setReviewItems] = useState<EvaluatedReviewItem[]>([]);
  const [activeReview, setActiveReview] = useState<EvaluatedReviewItem | null>(null);
  const [teacherComment, setTeacherComment] = useState('');
  const [paperSummary, setPaperSummary] = useState<EvaluatedPaperSummary | null>(null);
  const [result, setResult] = useState<ServerEvaluateSheetResult | null>(null);

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
        questions: editableQuestions.map((q) => ({
          key: q.key,
          q_no: q.q_no,
          question_text: q.question_text,
          max_marks: q.max_marks,
          question_type: q.question_type,
          section_name: q.section_name,
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

      const allEvals = [...(revData.checked_questions || []), ...(revData.flagged_questions || [])];
      if (allEvals.length > 0) {
        const mapped: EvaluatedReviewItem[] = allEvals.map((e: any) => ({
          eval_id: e.eval_id || e.id,
          question_id: e.question_id,
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
          isCounted: true,
          statusLabel: e.resolved ? 'Checked' : 'Flagged',
          evidence_quote: e.evidence_quote || '',
        }));
        setReviewItems(mapped);
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

  const pollSheetStatus = async (sheetId: string) => {
    let isDone = false;
    let pollCount = 0;
    while (!isDone && pollCount < 60) {
      pollCount++;
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const stRes = await fetch(`/api/sheets/${sheetId}`);
        if (!stRes.ok) continue;
        const stData = await stRes.json();

        if (stData.current_stage) {
          const stLower = String(stData.current_stage).toLowerCase();
          if (stLower.includes('queued')) {
            setEvalStage('reading');
            setStageProgress(15);
          } else if (stLower.includes('read')) {
            setEvalStage('reading');
            setStageProgress(35);
          } else if (stLower.includes('match')) {
            setEvalStage('matching');
            setStageProgress(60);
          } else if (stLower.includes('mark')) {
            setEvalStage('marking');
            setStageProgress(80);
          } else if (stLower.includes('flag') || stLower.includes('check') || stLower.includes('total')) {
            setEvalStage('checking');
            setStageProgress(90);
          }
        }

        if (stData.status === 'evaluated' || stData.status === 'needs_review') {
          isDone = true;
          setEvalStage('done');
          setStageProgress(100);
          await loadSheetReview(sheetId);
          setTimeout(() => setStep('review'), 500);
          return;
        } else if (stData.status === 'failed' || stData.status === 'error') {
          setEvalStage('error');
          setErrorMessage(stData.error_message || 'Evaluation pipeline encountered an unexpected error.');
          setRetryAction(() => () => handleRetryEvaluation(sheetId));
          return;
        }
      } catch (err) {
        console.error('Status poll error:', err);
      }
    }
  };

  const handleRetryEvaluation = async (sheetId: string) => {
    setError('');
    setErrorMessage('');
    setEvalStage('reading');
    setStageProgress(20);
    try {
      const res = await fetch(`/api/sheets/${sheetId}/retry`, { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to retry evaluation.');
      }
      pollSheetStatus(sheetId);
    } catch (err) {
      setEvalStage('error');
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
              q_no: String(q.q_no),
              question_text: q.question_text,
              max_marks: Number(q.max_marks) || 5,
              question_type: q.question_type || 'short',
              section_name: q.section_name || 'General',
            }))
          );
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

  const checked = reviewItems.filter((i) => i.resolved && i.isCounted);
  const flagged = reviewItems.filter((i) => !i.resolved);
  const uncounted = reviewItems.filter((i) => !i.isCounted);
  const totalScore = paperSummary ? paperSummary.totalScore : checked.reduce((s, i) => s + i.finalMarks, 0);
  const maxMarks = answerKey?.paper_max_marks || (paperSummary ? paperSummary.paperMaxMarks : calculatedQuestionTotal);
  const percentage = maxMarks ? Math.min(100, Math.round((totalScore / maxMarks) * 100)) : 0;
  const grade = paperSummary?.grade || (percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : 'Needs Support');

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      {/* Top Header & Screen Navigation */}
      <header className="sticky top-0 z-30 border-b border-[#e2e8f0] bg-white px-6 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#005dac] p-2 text-white font-black text-sm">ED</div>
          <div>
            <div className="text-sm font-bold text-[#005dac] flex items-center gap-2">
              EvalDesk AI · Teacher Evaluation System
              {basis === 'AI-Generated Reference' && setupSaved && (
                <span className="rounded bg-[#fff3e0] px-2 py-0.5 text-[10px] font-semibold text-[#b26a00] border border-[#ffe082]">
                  No answer key used (AI Reference)
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#64748b]">Dual-Reader Verification · Quote Evidence · Training Data Capture</div>
          </div>
        </div>

        {/* Screen Tabs */}
        <nav className="flex items-center gap-1 text-[11px] font-semibold bg-[#f1f5f9] p-1 rounded-lg">
          {(
            [
              ['setup', '1. Paper'],
              ['upload', '2. Upload'],
              ['status', '3. Status'],
              ['review', '4. Review'],
              ['report', '5. Report'],
              ['library', '6. Library'],
              ['verify', '7. Verify Mode'],
            ] as [SetupStep, string][]
          ).map(([key, label]) => {
            const isUploadLocked = key === 'upload' && !isLocked;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleNavigateStep(key)}
                title={isUploadLocked ? 'Locked until Paper Setup is approved and locked' : undefined}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${
                  step === key
                    ? 'bg-white text-[#005dac] shadow-xs font-bold'
                    : isUploadLocked
                    ? 'text-[#94a3b8] opacity-60 cursor-not-allowed'
                    : 'text-[#64748b] hover:text-[#0b1c30]'
                }`}
              >
                <span>{label}</span>
                {isUploadLocked && <LockKeyhole className="w-3 h-3 text-[#94a3b8]" />}
              </button>
            );
          })}
        </nav>

        {/* Demo Mode & Quick Settings */}
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 bg-[#eff4ff] px-2.5 py-1 rounded border border-[#d4e3ff] cursor-pointer">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              className="accent-[#005dac] w-3.5 h-3.5"
            />
            <span className="font-semibold text-[#005dac]">Demo Mode (Offline)</span>
          </label>
        </div>
      </header>

      <main className="max-w-[1520px] mx-auto p-5 space-y-5">
        {error && (
          <div className="rounded-lg border border-[#ba1a1a] bg-[#ffdad6] px-4 py-3 text-xs text-[#93000a] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#ba1a1a]" />
              <span className="font-semibold">{error}</span>
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
                  className="px-2.5 py-1 bg-[#ba1a1a] text-white rounded font-semibold hover:bg-[#93000a] transition-all cursor-pointer"
                >
                  Retry
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
                    Screen 1 · Paper Setup & Rubric Configuration
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
                      return (
                        <div key={ref.key || rIdx} className="rounded-lg border border-[#d4e3ff] bg-white p-4 shadow-2xs">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-[#005dac] px-2 py-0.5 text-[11px] font-bold text-white">
                                {q?.q_no || `Q.${rIdx + 1}`}
                              </span>
                              <span className="text-xs font-semibold text-[#1e293b]">
                                {q?.question_text || ref.key}
                              </span>
                              <span className="rounded bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">
                                {q?.max_marks} Marks · {q?.question_type?.toUpperCase()}
                              </span>
                            </div>
                            {ref.correct_option && (
                              <span className="text-xs font-bold text-[#005dac] bg-[#eff4ff] px-2 py-0.5 rounded">
                                Correct Option: {ref.correct_option}
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-xs">
                            <div>
                              <label className="block text-[11px] font-semibold text-[#64748b] mb-1">Model Answer:</label>
                              <textarea
                                disabled={isLocked}
                                rows={2}
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
                                <div className="space-y-1.5">
                                  {ref.key_points.map((kp, kpIdx) => (
                                    <div key={kpIdx} className="flex items-center gap-2">
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
                    Screen 2 · Upload Student Answer Sheets
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
          </section>
        )}

        {/* ----------------- SCREEN 3: EVALUATION STATUS TRACKER ----------------- */}
        {step === 'status' && (
          <section className="max-w-2xl mx-auto rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm text-center space-y-6">
            <h1 className="text-xl font-bold text-[#005dac]">Screen 3 · Evaluation Status</h1>
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

            {evalStage === 'error' ? (
              <div className="rounded-lg border border-[#ba1a1a] bg-[#ffdad6] p-4 text-xs text-[#93000a] space-y-2">
                <div className="font-bold">Evaluation Encountered an Error</div>
                <div>{errorMessage || 'External provider timed out or rate limit reached.'}</div>
                <button
                  type="button"
                  onClick={() => currentSheetId && handleRetryEvaluation(currentSheetId)}
                  className="rounded bg-[#005dac] px-4 py-2 font-bold text-white hover:bg-[#004786] flex items-center gap-1 mx-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Evaluation
                </button>
              </div>
            ) : evalStage === 'done' ? (
              <div className="text-xs font-bold text-[#196b22] flex items-center justify-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Evaluation complete! Redirecting to review...
              </div>
            ) : (
              <div className="text-xs text-[#64748b] animate-pulse">
                Processing in background · Zero frozen screen
              </div>
            )}
          </section>
        )}

        {/* ----------------- SCREEN 4: SPLIT-VIEW REVIEW & POPUP ----------------- */}
        {step === 'review' && (
          <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-[#f1f5f9] pb-3">
                <div>
                  <h1 className="text-base font-bold flex items-center gap-2">
                    Screen 4 · Center Split View & Interactive Review
                  </h1>
                  <p className="text-xs text-[#64748b]">
                    Student: <strong>{studentName}</strong> ({rollNo}) · Basis: <strong>{basis}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaperRotation((r) => (r + 90) % 360)}
                    className="rounded border border-[#c1c6d4] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#f1f5f9] flex items-center gap-1"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-[#005dac]" />
                    Rotate Paper ({paperRotation}°)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentRotation((r) => (r + 90) % 360)}
                    className="rounded border border-[#c1c6d4] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#f1f5f9] flex items-center gap-1"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-[#005dac]" />
                    Rotate Sheet ({studentRotation}°)
                  </button>
                </div>
              </div>

              {/* Side-by-Side Split View */}
              <div className="grid gap-3 lg:grid-cols-2">
                {/* Left: Question Paper / Rubric */}
                <div className="rounded-lg border border-[#e2e8f0] p-2 bg-[#f8f9ff]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#005dac]">Question Paper & Model Answers</span>
                    {paperPages.length > 1 && (
                      <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
                        <button
                          type="button"
                          disabled={activePaperPage <= 0}
                          onClick={() => setActivePaperPage((p) => Math.max(0, p - 1))}
                          className="px-1.5 py-0.5 rounded border border-[#c1c6d4] bg-white disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <span>{activePaperPage + 1} / {paperPages.length}</span>
                        <button
                          type="button"
                          disabled={activePaperPage >= paperPages.length - 1}
                          onClick={() => setActivePaperPage((p) => Math.min(paperPages.length - 1, p + 1))}
                          className="px-1.5 py-0.5 rounded border border-[#c1c6d4] bg-white disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="h-[460px] overflow-auto rounded bg-white p-3 border border-[#e2e8f0] flex items-center justify-center">
                    {paperPages.length > 0 ? (
                      <img
                        src={paperPages[activePaperPage]}
                        alt="Question paper"
                        style={{ transform: `rotate(${paperRotation}deg)` }}
                        className="max-h-full max-w-full object-contain mx-auto transition-transform"
                      />
                    ) : paperPreview ? (
                      <img
                        src={paperPreview}
                        alt="Question paper"
                        style={{ transform: `rotate(${paperRotation}deg)` }}
                        className="max-h-full max-w-full object-contain mx-auto transition-transform"
                      />
                    ) : (
                      <div className="space-y-3 w-full">
                        {editableQuestions.map((q) => (
                          <div key={q.q_no} className="rounded border border-[#e2e8f0] p-2 text-xs">
                            <div className="font-bold flex justify-between">
                              <span>Q.{q.q_no}</span>
                              <span>{q.max_marks} Marks</span>
                            </div>
                            <p className="text-[#414752] mt-1">{q.question_text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Student Answer Sheet */}
                <div className="rounded-lg border border-[#e2e8f0] p-2 bg-[#f8f9ff]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#005dac]">Student Answer Sheet (Handwritten)</span>
                    {sheetPages.length > 1 && (
                      <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
                        <button
                          type="button"
                          disabled={activeSheetPage <= 0}
                          onClick={() => setActiveSheetPage((p) => Math.max(0, p - 1))}
                          className="px-1.5 py-0.5 rounded border border-[#c1c6d4] bg-white disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <span>{activeSheetPage + 1} / {sheetPages.length}</span>
                        <button
                          type="button"
                          disabled={activeSheetPage >= sheetPages.length - 1}
                          onClick={() => setActiveSheetPage((p) => Math.min(sheetPages.length - 1, p + 1))}
                          className="px-1.5 py-0.5 rounded border border-[#c1c6d4] bg-white disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="h-[460px] overflow-auto rounded bg-white p-3 border border-[#e2e8f0] flex items-center justify-center">
                    {sheetPages.length > 0 ? (
                      <img
                        src={sheetPages[activeSheetPage]}
                        alt={`Student sheet page ${activeSheetPage + 1}`}
                        style={{ transform: `rotate(${studentRotation}deg)` }}
                        className="max-h-full max-w-full object-contain mx-auto transition-transform"
                      />
                    ) : studentPreview ? (
                      <img
                        src={studentPreview}
                        alt="Student sheet"
                        style={{ transform: `rotate(${studentRotation}deg)` }}
                        className="max-h-full max-w-full object-contain mx-auto transition-transform"
                      />
                    ) : (
                      <div className="text-xs text-[#64748b]">Answer sheet image preview unavailable</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel: Checked vs Flagged Questions */}
            <aside className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm h-fit space-y-4">
              <div>
                <h2 className="text-sm font-bold">Review Questions</h2>
                <div className="mt-2 flex items-center justify-between text-xs bg-[#eff4ff] p-2.5 rounded-lg border border-[#d4e3ff]">
                  <span className="font-semibold text-[#005dac]">Paper Total Score</span>
                  <span className="text-sm font-bold text-[#005dac]">{totalScore} / {maxMarks}</span>
                </div>
              </div>

              {/* Flagged Questions */}
              <div>
                <div className="text-xs font-bold text-[#ba1a1a] flex items-center justify-between mb-1.5">
                  <span>Flagged for Review ({flagged.length})</span>
                  {flagged.length > 0 && <span className="text-[10px] text-[#ba1a1a]">Action required</span>}
                </div>
                {flagged.length === 0 ? (
                  <div className="text-[11px] text-[#196b22] font-semibold bg-[#e8f5e9] p-2 rounded">
                    ✓ All questions verified and resolved!
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {flagged.map((item) => (
                      <button
                        key={item.q_no}
                        type="button"
                        onClick={() => setActiveReview(item)}
                        className="w-full text-left rounded-lg border border-[#ba1a1a] bg-[#ffdad6] p-2.5 text-xs hover:bg-[#ffb4ab] transition-all"
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Flag className="w-3.5 h-3.5 text-[#ba1a1a]" /> Q.{item.q_no}
                          </span>
                          <span className="text-[#93000a]">{item.suggested_marks ?? 0} / {item.max_marks}M</span>
                        </div>
                        <div className="text-[11px] text-[#93000a] mt-1 font-medium truncate">
                          {item.reason || 'Flagged for teacher inspection'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Checked Questions */}
              <div>
                <div className="text-xs font-bold text-[#196b22] mb-1.5">
                  Checked & Auto-Verified ({checked.length})
                </div>
                <div className="space-y-1">
                  {checked.map((item) => (
                    <div
                      key={item.q_no}
                      onClick={() => setActiveReview(item)}
                      className="p-2 rounded border border-[#c8e6c9] bg-[#e8f5e9] text-xs flex items-center justify-between cursor-pointer hover:bg-[#dcedc8]"
                    >
                      <span className="font-semibold">Q.{item.q_no}</span>
                      <span className="font-bold text-[#196b22]">{item.finalMarks} / {item.max_marks}M</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate Report Card Button */}
              <button
                type="button"
                disabled={flagged.length > 0}
                onClick={() => {
                  setStep('report');
                  loadReports();
                }}
                className="w-full rounded-lg bg-[#005dac] py-2.5 text-xs font-bold text-white hover:bg-[#004786] disabled:opacity-40 shadow-xs"
              >
                Proceed to Reports
              </button>
            </aside>
          </section>
        )}

        {/* ----------------- SCREEN 5: REPORTS (PDF & EXCEL) ----------------- */}
        {step === 'report' && (
          <section className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
              <div>
                <h1 className="text-lg font-bold">Screen 5 · Academic Reports & Performance Analysis</h1>
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
                      <td className="p-2.5 font-bold">Q.{item.q_no}</td>
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
                    <li key={i}>Demonstrated mastery on Question {r.q_no} ({r.finalMarks}/{r.max_marks} marks).</li>
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
                    <li key={i}>Review Question {r.q_no}: {r.reason || 'Deductions against key points'}</li>
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
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#005dac]" />
                  Screen 6 · Library of Saved Papers & Reports
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
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <Archive className="w-5 h-5 text-[#005dac]" />
                  Screen 7 · Verify Mode (Handwriting Training-Data Capture)
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
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-lg border border-[#e2e8f0] p-4 bg-[#f8f9ff] space-y-3">
                <div className="text-xs font-bold text-[#005dac] flex justify-between">
                  <span>Handwritten Line Crop</span>
                  <span className="text-[#64748b]">
                    {activeLine?.is_sample ? '10% Random Sample' : 'Review Candidate'}
                  </span>
                </div>
                <div className="h-36 rounded bg-white border border-[#e2e8f0] flex items-center justify-center p-2 overflow-hidden">
                  {activeLine?.image_path ? (
                    <img
                      src={`/${activeLine.image_path}`}
                      alt="Line crop"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-[#64748b]">Sample line crop preview</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[#e2e8f0] p-4 bg-white space-y-3">
                <div className="text-xs font-bold text-[#005dac]">Human-Verified Transcription</div>
                <textarea
                  value={verifiedText}
                  onChange={(e) => setVerifiedText(e.target.value)}
                  rows={4}
                  className="w-full rounded border border-[#c1c6d4] p-2 text-xs font-mono"
                  placeholder="Type or correct student handwriting text here..."
                />
                <button
                  type="button"
                  onClick={handleVerifyLine}
                  className="w-full rounded-lg bg-[#196b22] py-2 text-xs font-bold text-white hover:bg-[#145a1c] shadow-xs"
                >
                  Confirm & Mark Human-Verified (Provenance: human_verified)
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ----------------- INTERACTIVE REVIEW POPUP ----------------- */}
      {activeReview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
              <h2 className="text-base font-bold text-[#005dac]">
                Teacher Review · Question {activeReview.q_no}
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
