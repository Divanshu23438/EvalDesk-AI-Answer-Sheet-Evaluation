import { useMemo, useState, useEffect } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  FileText,
  LockKeyhole,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  type CheckingMode,
  type ReportData,
  type SavedPaper,
  type SetupStep,
  type TrainingLine,
  type UIQuestion,
  type UIReferenceItem,
  type UISectionRule,
  type UISheetSummary,
  formatBytes,
} from './types';
import { type EvaluatedReviewItem, applySectionChoiceRules } from '../../utils/apiOcr';
import { PaperSetupStep } from './PaperSetupStep';
import { SheetIntakeStep } from './SheetIntakeStep';
import { ReviewWorkspaceStep } from './ReviewWorkspaceStep';
import { ReportsStep } from './ReportsStep';

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
  const [basis, setBasis] = useState<'Answer Key' | 'AI-Generated Reference'>('AI-Generated Reference');
  const [setupSaved, setSetupSaved] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [, setApproved] = useState(false);

  // Editable Question Setup Table
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
  const [studentRotation, setStudentRotation] = useState(0);
  const [studentZoom, setStudentZoom] = useState(1);
  const [reviewItems, setReviewItems] = useState<EvaluatedReviewItem[]>([]);

  // 3-Pane Teacher Review & Shortcuts State
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [flaggedOnlyFilter, setFlaggedOnlyFilter] = useState<boolean>(false);
  const [editTranscript, setEditTranscript] = useState<string>('');
  const [overrideMarks, setOverrideMarks] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isCountedOverride, setIsCountedOverride] = useState<boolean>(true);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);

  // Batch Sheets State
  const [sheetsList, setSheetsList] = useState<UISheetSummary[]>([]);
  const [sheetStatusFilter, setSheetStatusFilter] = useState<string>('all');
  const [sheetSearchQuery, setSheetSearchQuery] = useState<string>('');
  const [isBulkFinalizing, setIsBulkFinalizing] = useState<boolean>(false);

  // Library & Training Verify State
  const [currentPaperId, setCurrentPaperId] = useState<string>('');
  const [currentSheetId, setCurrentSheetId] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [savedPapers, setSavedPapers] = useState<SavedPaper[]>([]);
  const [trainingLines, setTrainingLines] = useState<TrainingLine[]>([]);
  const [activeLine, setActiveLine] = useState<TrainingLine | null>(null);
  const [verifiedText, setVerifiedText] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [sheetPages, setSheetPages] = useState<string[]>([]);
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

  const currentStudentFile = studentFiles[activeStudentIdx] || null;
  const studentPreview = currentStudentFile ? URL.createObjectURL(currentStudentFile) : '';

  const calculatedQuestionTotal = useMemo(
    () => editableQuestions.reduce((sum, q) => sum + (Number(q.max_marks) || 0), 0),
    [editableQuestions]
  );

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
      const targetPage = Number(selectedReviewItem.page_numbers[0]);
      if (!isNaN(targetPage) && targetPage >= 0) {
        setActiveSheetPage(targetPage);
      }
    }
  }, [selectedReviewItem]);

  const loadSheetsList = async (paperId: string) => {
    if (!paperId) return;
    try {
      const res = await fetch(`/api/papers/${paperId}/sheets`);
      if (res.ok) {
        const data = await res.json();
        setSheetsList(data.sheets || []);
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    if (currentPaperId && (step === 'upload' || step === 'review')) {
      loadSheetsList(currentPaperId);
    }
  }, [currentPaperId, step]);

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

  // Continuous 2-second polling on Screen 3
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
          setErrorMessage(stData.error_message || 'Evaluation encountered an error.');
        }
      } catch {
        // Continue polling
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

  const handleStudentSheetUpload = async (files: File[]) => {
    if (!currentPaperId) {
      setError('No paper setup loaded. Please save and lock paper setup in Step 1 first.');
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
        setNeedsIdentityPrompt(false);
        setStatus(`Header read successfully (${data.student_name}, ${data.roll_number}). Evaluation auto-queued!`);
        setStep('status');
        setEvalStage('reading');
        setStageProgress(20);
      } else if (data.status === 'needs_identity') {
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
    } catch (err) {
      setStatus('');
      const msg = err instanceof Error ? err.message : 'Failed to save student identity.';
      setError(msg);
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
      setSheetPages([]);
      setActiveSheetPage(0);
      setStep('upload');
      setStatus('Answer sheet permanently deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sheet.');
    }
  };

  const handleRetryEvaluation = async (sheetId: string) => {
    if (!sheetId) return;
    setError('');
    setEvalStage('reading');
    setStageProgress(15);
    setStatus('Retrying evaluation pipeline...');
    try {
      const res = await fetch(`/api/sheets/${sheetId}/evaluate`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to retry evaluation.');
      }
      setStep('status');
    } catch (err) {
      setEvalStage('error');
      setError(err instanceof Error ? err.message : 'Failed to retry evaluation');
    }
  };

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
    setStatus(`Re-checking question with AI rubric...`);
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
      setStatus(`Re-check completed.`);
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
              word_limit: q.word_limit,
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
  const totalScore = checked.reduce((s, i) => s + i.finalMarks, 0);
  const maxMarks = calculatedQuestionTotal || 10;
  const percentage = maxMarks ? Math.min(100, Math.round((totalScore / maxMarks) * 100)) : 0;
  const grade = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : 'Needs Support';

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

        {/* Step 1: Question Paper Setup */}
        {step === 'setup' && (
          <PaperSetupStep
            paperFile={paperFile}
            setPaperFile={setPaperFile}
            answerKeyFile={answerKeyFile}
            setAnswerKeyFile={setAnswerKeyFile}
            paperTitle={paperTitle}
            setPaperTitle={setPaperTitle}
            subject={subject}
            setSubject={setSubject}
            mode={mode}
            setMode={setMode}
            overrides={overrides}
            setOverrides={setOverrides}
            isLocked={isLocked}
            setIsLocked={setIsLocked}
            unlockPaperWithConfirmation={unlockPaperWithConfirmation}
            editableQuestions={editableQuestions}
            setEditableQuestions={setEditableQuestions}
            sections={sections}
            setSections={setSections}
            draftId={draftId}
            setDraftId={setDraftId}
            extractionWarnings={extractionWarnings}
            setExtractionWarnings={setExtractionWarnings}
            extractionSource={extractionSource}
            setExtractionSource={setExtractionSource}
            isExtracting={isExtracting}
            setIsExtracting={setIsExtracting}
            instructions={instructions}
            setInstructions={setInstructions}
            paperTotalMarks={paperTotalMarks}
            setPaperTotalMarks={setPaperTotalMarks}
            references={references}
            setReferences={setReferences}
            disagreements={disagreements}
            setDisagreements={setDisagreements}
            isGeneratingRef={isGeneratingRef}
            setIsGeneratingRef={setIsGeneratingRef}
            currentPaperId={currentPaperId}
            setCurrentPaperId={setCurrentPaperId}
            setupSaved={setupSaved}
            setSetupSaved={setSetupSaved}
            basis={basis}
            setBasis={setBasis}
            setApproved={setApproved}
            onProceedToUpload={() => setStep('upload')}
            setStatus={setStatus}
            setError={setError}
            setRetryAction={setRetryAction}
          />
        )}

        {/* Steps 2 & 3: Sheet Intake & Live Evaluation Progress */}
        {(step === 'upload' || step === 'status') && (
          <SheetIntakeStep
            step={step}
            setStep={setStep}
            currentPaperId={currentPaperId}
            currentSheetId={currentSheetId}
            setCurrentSheetId={setCurrentSheetId}
            studentFiles={studentFiles}
            setStudentFiles={setStudentFiles}
            activeStudentIdx={activeStudentIdx}
            setActiveStudentIdx={setActiveStudentIdx}
            hasConsent={hasConsent}
            setHasConsent={setHasConsent}
            readNamesWithAi={readNamesWithAi}
            setReadNamesWithAi={setReadNamesWithAi}
            studentName={studentName}
            setStudentName={setStudentName}
            rollNo={rollNo}
            setRollNo={setRollNo}
            isUploadingSheet={isUploadingSheet}
            setIsUploadingSheet={setIsUploadingSheet}
            needsIdentityPrompt={needsIdentityPrompt}
            setNeedsIdentityPrompt={setNeedsIdentityPrompt}
            headerConfidence={headerConfidence}
            setHeaderConfidence={setHeaderConfidence}
            evalStage={evalStage}
            setEvalStage={setEvalStage}
            stageProgress={stageProgress}
            setStageProgress={setStageProgress}
            liveStageText={liveStageText}
            setLiveStageText={setLiveStageText}
            sheetStatus={sheetStatus}
            setSheetStatus={setSheetStatus}
            errorMessage={errorMessage}
            setErrorMessage={setErrorMessage}
            sheetsList={sheetsList}
            setSheetsList={setSheetsList}
            sheetStatusFilter={sheetStatusFilter}
            setSheetStatusFilter={setSheetStatusFilter}
            sheetSearchQuery={sheetSearchQuery}
            setSheetSearchQuery={setSheetSearchQuery}
            isBulkFinalizing={isBulkFinalizing}
            setIsBulkFinalizing={setIsBulkFinalizing}
            isFinalizing={isFinalizing}
            loadSheetsList={loadSheetsList}
            loadSheetReview={loadSheetReview}
            handleStudentSheetUpload={handleStudentSheetUpload}
            handleSaveIdentityAndStart={handleSaveIdentityAndStart}
            handleFinalizeSheet={handleFinalizeSheet}
            handleDeleteSheet={handleDeleteSheet}
            handleRetryEvaluation={handleRetryEvaluation}
            handleBulkFinalize={handleBulkFinalize}
          />
        )}

        {/* Step 4: 3-Pane Teacher Review Workspace */}
        {step === 'review' && (
          <ReviewWorkspaceStep
            currentSheetId={currentSheetId}
            studentName={studentName}
            rollNo={rollNo}
            basis={basis}
            paperTitle={paperTitle}
            unresolvedFlagsCount={unresolvedFlagsCount}
            totalScore={totalScore}
            maxMarks={maxMarks}
            percentage={percentage}
            grade={grade}
            sections={sections}
            reviewItems={reviewItems}
            selectedKey={selectedKey}
            setSelectedKey={setSelectedKey}
            selectedReviewItem={selectedReviewItem}
            flaggedOnlyFilter={flaggedOnlyFilter}
            setFlaggedOnlyFilter={setFlaggedOnlyFilter}
            sheetPages={sheetPages}
            activeSheetPage={activeSheetPage}
            setActiveSheetPage={setActiveSheetPage}
            studentZoom={studentZoom}
            setStudentZoom={setStudentZoom}
            studentRotation={studentRotation}
            setStudentRotation={setStudentRotation}
            studentPreview={studentPreview}
            editTranscript={editTranscript}
            setEditTranscript={setEditTranscript}
            overrideMarks={overrideMarks}
            setOverrideMarks={setOverrideMarks}
            overrideReason={overrideReason}
            setOverrideReason={setOverrideReason}
            isCountedOverride={isCountedOverride}
            isFinalizing={isFinalizing}
            handleFinalizeSheet={handleFinalizeSheet}
            handleDeleteSheet={handleDeleteSheet}
            handleToggleCounted={handleToggleCounted}
            handleAcceptCurrent={handleAcceptCurrent}
            handleOverrideCurrent={handleOverrideCurrent}
            handleLiveRecheck={handleLiveRecheck}
            onNavigateToReports={() => {
              setStep('report');
              loadReports();
            }}
          />
        )}

        {/* Step 5: Academic Reports & Performance Analysis */}
        {step === 'report' && (
          <ReportsStep
            currentPaperId={currentPaperId}
            reportData={reportData}
            studentName={studentName}
            rollNo={rollNo}
            totalScore={totalScore}
            maxMarks={maxMarks}
            percentage={percentage}
            grade={grade}
            basis={basis}
            reviewItems={reviewItems}
          />
        )}

        {/* Step 6: Paper Library */}
        {step === 'library' && (
          <section className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
              <div>
                <h1 className="text-lg font-bold text-[#005dac]">Question Paper Library</h1>
                <p className="text-xs text-[#64748b]">
                  Load previously saved assessments, locked rubrics, and evaluation benchmarks.
                </p>
              </div>
              <button
                type="button"
                onClick={loadSavedPapers}
                className="rounded-lg border border-[#c1c6d4] bg-white p-2 text-[#005dac] hover:bg-[#eff4ff]"
                title="Refresh library"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {savedPapers.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleOpenPaper(p.id)}
                  className="rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] p-4 text-xs cursor-pointer hover:border-[#005dac] hover:shadow-xs transition-all space-y-2"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-[#005dac] text-sm truncate max-w-[200px]">{p.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      p.is_locked ? 'bg-[#e8f5e9] text-[#196b22]' : 'bg-[#fff3e0] text-[#b26a00]'
                    }`}>
                      {p.is_locked ? 'Locked' : 'Draft'}
                    </span>
                  </div>
                  <div className="text-[#64748b]">
                    <span>Total Marks: <strong>{p.total_marks}M</strong></span> ·{' '}
                    <span>Strictness: <strong>{p.strictness}</strong></span>
                  </div>
                  <div className="text-[10px] text-[#94a3b8]">Created: {p.created_at}</div>
                </div>
              ))}
              {savedPapers.length === 0 && (
                <div className="col-span-full p-8 text-center text-xs text-[#64748b]">
                  No saved papers found in the database.
                </div>
              )}
            </div>
          </section>
        )}

        {/* Step 7: Verify Mode */}
        {step === 'verify' && (
          <section className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-4">
            <div className="border-b border-[#f1f5f9] pb-4">
              <h1 className="text-lg font-bold text-[#005dac]">Human-in-the-Loop OCR Verification</h1>
              <p className="text-xs text-[#64748b]">
                Review character-by-character line transcriptions to improve local fine-tuning accuracy.
              </p>
            </div>

            {activeLine ? (
              <div className="space-y-4 max-w-xl mx-auto">
                <div className="rounded-lg border border-[#e2e8f0] p-2 bg-white flex items-center justify-center">
                  <img
                    src={activeLine.image_path}
                    alt="Line crop"
                    className="max-h-24 max-w-full object-contain"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1e293b]">Transcribed Text (Character-by-character)</label>
                  <input
                    value={verifiedText}
                    onChange={(e) => setVerifiedText(e.target.value)}
                    className="w-full rounded border border-[#005dac] p-2 text-xs font-mono"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleVerifyLine}
                  className="w-full rounded-lg bg-[#005dac] py-2 text-xs font-bold text-white hover:bg-[#004786] shadow-xs"
                >
                  Confirm & Next Line
                </button>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#64748b]">
                No consent-approved training lines queued for human verification.
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
