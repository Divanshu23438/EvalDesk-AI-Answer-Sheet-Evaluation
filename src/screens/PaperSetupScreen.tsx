import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  Upload,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';

interface PaperItem {
  id: string;
  title: string;
  subject?: string;
  total_marks: number;
  is_locked: boolean | number;
  strictness?: string;
  checking_medium?: string;
  has_answer_key?: boolean | number;
}

interface QuestionItem {
  id?: string;
  key?: string;
  q_no: string;
  question_text: string;
  max_marks: number;
  question_type: string;
  section_name: string;
  strictness_override?: string;
  checking_medium_override?: string;
  model_answer?: string;
  key_points?: string[];
}

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

export const PaperSetupScreen: React.FC = () => {
  const [state, store] = useSheetStore();

  // Papers list & active selection
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(state.paperId);
  const [isLoading, setIsLoading] = useState(false);

  // Paper details form
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [strictness, setStrictness] = useState('lenient');
  const [checkingMedium, setCheckingMedium] = useState('ai_reference');
  const [isLocked, setIsLocked] = useState(false);
  const [totalMarks, setTotalMarks] = useState(0);

  // Questions and Sections
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [expandedQuestionKey, setExpandedQuestionKey] = useState<string | null>(null);

  // File uploads
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploadingKey, setIsUploadingKey] = useState(false);
  const [isGeneratingRubric, setIsGeneratingRubric] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const paperFileInputRef = useRef<HTMLInputElement>(null);
  const keyFileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch all papers
  const loadPapers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<{ papers: PaperItem[] }>('/api/papers');
      const list = data.papers || [];
      setPapers(list);

      // Default to selected paper, or first locked paper, or first paper
      if (!selectedPaperId && list.length > 0) {
        const target = list.find((p) => Boolean(p.is_locked)) || list[0];
        setSelectedPaperId(target.id);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to fetch papers list.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedPaperId]);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  // 2. Fetch details for active paper
  const loadPaperDetails = useCallback(async (paperId: string) => {
    try {
      const details = await apiClient.get<any>(`/api/papers/${paperId}`);
      const p = details.paper || details;

      setTitle(p.title || '');
      setSubject(p.subject || '');
      setStrictness(p.strictness || 'lenient');
      setCheckingMedium(p.checking_medium || 'ai_reference');
      setIsLocked(Boolean(p.is_locked));
      setTotalMarks(p.total_marks || 0);

      const qList: QuestionItem[] = (details.questions || []).map((q: any) => ({
        id: q.id,
        key: q.key || q.q_no,
        q_no: q.q_no,
        question_text: q.question_text || q.text || '',
        max_marks: q.max_marks || q.marks || 1,
        question_type: q.question_type || q.type || 'short',
        section_name: q.section_name || q.section || 'Part I',
        strictness_override: q.strictness_override,
        checking_medium_override: q.checking_medium_override,
      }));

      // Match references if available
      const refMap = new Map<string, any>();
      (details.references || []).forEach((r: any) => {
        refMap.set(r.question_key, r);
      });

      const enriched = qList.map((q) => {
        const ref = refMap.get(q.key || q.q_no);
        return {
          ...q,
          model_answer: ref ? ref.model_answer : '',
          key_points: ref ? ref.key_points || [] : [],
        };
      });

      setQuestions(enriched);
      setSections(details.sections || []);

      // Synchronize paper in store
      store.setPaper({
        id: p.id,
        title: p.title,
        totalMarks: p.total_marks,
        questionCount: enriched.length,
        isLocked: Boolean(p.is_locked),
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to load paper details.',
      });
    }
  }, [store]);

  useEffect(() => {
    if (selectedPaperId) {
      loadPaperDetails(selectedPaperId);
    }
  }, [selectedPaperId, loadPaperDetails]);

  // 3. Create a blank new paper
  const handleCreateNewPaper = async () => {
    try {
      const res = await apiClient.post<{ paper_id: string; status: string }>('/api/papers', {
        title: 'New Assessment Paper',
        subject: 'General',
        strictness: 'lenient',
        checking_medium: 'ai_reference',
      });
      setStatusMessage({ type: 'success', text: 'Created new paper draft.' });
      await loadPapers();
      setSelectedPaperId(res.paper_id);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create paper.' });
    }
  };

  // 4. Extract questions from uploaded Question Paper PDF / Image
  const handleUploadPaperFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setStatusMessage(null);
    try {
      const formData = new FormData();
      formData.append('paper_file', file);

      const extracted = await apiClient.post<any>('/api/papers/extract', formData);

      // Create new paper setup from extracted draft
      const createRes = await apiClient.post<any>('/api/papers', {
        title: extracted.paper_title || file.name.replace(/\.[^/.]+$/, ''),
        subject: 'Extracted Assessment',
        strictness: 'lenient',
        checking_medium: 'ai_reference',
        draft_id: extracted.draft_id,
      });

      setStatusMessage({
        type: 'success',
        text: `Extracted ${extracted.questions?.length || 0} questions from "${file.name}".`,
      });

      await loadPapers();
      if (createRes.paper_id) {
        setSelectedPaperId(createRes.paper_id);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to extract questions from uploaded document.',
      });
    } finally {
      setIsExtracting(false);
      if (paperFileInputRef.current) paperFileInputRef.current.value = '';
    }
  };

  // 5. Upload Answer Key Document
  const handleUploadAnswerKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPaperId) return;

    setIsUploadingKey(true);
    setStatusMessage(null);
    try {
      const formData = new FormData();
      formData.append('answer_key_file', file);

      await apiClient.post(`/api/papers/${selectedPaperId}/answer-key`, formData);
      setStatusMessage({
        type: 'success',
        text: `Parsed answer key: "${file.name}".`,
      });
      await loadPaperDetails(selectedPaperId);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to upload answer key.',
      });
    } finally {
      setIsUploadingKey(false);
      if (keyFileInputRef.current) keyFileInputRef.current.value = '';
    }
  };

  // 6. Generate Rubric References with AI
  const handleGenerateRubric = async () => {
    if (!selectedPaperId) return;
    setIsGeneratingRubric(true);
    setStatusMessage(null);
    try {
      await apiClient.post(`/api/papers/${selectedPaperId}/reference/generate`, {});
      setStatusMessage({
        type: 'success',
        text: 'AI rubric references generated successfully.',
      });
      await loadPaperDetails(selectedPaperId);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to generate rubric references.',
      });
    } finally {
      setIsGeneratingRubric(false);
    }
  };

  // 7. Save Paper Changes (Questions & Metadata)
  const handleSaveQuestions = async () => {
    if (!selectedPaperId) return;
    try {
      await apiClient.put(`/api/papers/${selectedPaperId}/questions`, {
        questions: questions.map((q, idx) => ({
          id: q.id,
          q_no: q.q_no || String(idx + 1),
          question_text: q.question_text,
          max_marks: Number(q.max_marks) || 1,
          question_type: q.question_type || 'short',
          section_name: q.section_name || 'Part I',
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

      setStatusMessage({ type: 'success', text: 'Paper questions saved successfully.' });
      await loadPaperDetails(selectedPaperId);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to save paper changes.',
      });
    }
  };

  // 8. Lock Paper
  const handleLockPaper = async () => {
    if (!selectedPaperId) return;
    if (questions.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Cannot lock paper with 0 questions. Add or extract questions first.',
      });
      return;
    }

    try {
      const res = await apiClient.post<any>(`/api/papers/${selectedPaperId}/lock`, {});
      setIsLocked(true);
      setStatusMessage({
        type: 'success',
        text: `Paper locked with ${res.questions_count || questions.length} questions. Ready for student sheets!`,
      });

      store.setPaper({
        id: selectedPaperId,
        title: res.title || title,
        totalMarks: res.total_marks || totalMarks,
        questionCount: res.questions_count || questions.length,
        isLocked: true,
      });

      await loadPaperDetails(selectedPaperId);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to lock paper.',
      });
    }
  };

  // 9. Unlock Paper
  const handleUnlockPaper = async () => {
    if (!selectedPaperId) return;
    if (!window.confirm('Unlocking will reset any evaluated sheets for this paper. Continue?')) {
      return;
    }

    try {
      await apiClient.post(`/api/papers/${selectedPaperId}/unlock`, {});
      setIsLocked(false);
      setStatusMessage({
        type: 'success',
        text: 'Paper unlocked for editing.',
      });

      store.setPaper({
        id: selectedPaperId,
        title,
        totalMarks,
        questionCount: questions.length,
        isLocked: false,
      });

      await loadPaperDetails(selectedPaperId);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to unlock paper.',
      });
    }
  };

  // Helper to add question
  const handleAddQuestion = () => {
    const nextQNo = String(questions.length + 1);
    setQuestions([
      ...questions,
      {
        q_no: nextQNo,
        question_text: '',
        max_marks: 2.0,
        question_type: 'short',
        section_name: sections[0]?.name || 'Part I',
        key_points: [],
      },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleUpdateQuestion = (idx: number, field: keyof QuestionItem, val: any) => {
    const copy = [...questions];
    copy[idx] = { ...copy[idx], [field]: val };
    setQuestions(copy);
  };

  return (
    <div className="panel h-full min-h-0 flex flex-col p-4 bg-slate-50 overflow-hidden">
      {/* Top Header Bar for Paper Setup */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 shadow-2xs shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Assessment & Question Paper Setup
                {isLocked ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    Locked ✓
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Draft (Unlocked)
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500">
                Configure question text, section rules, and rubric criteria before student intake.
              </p>
            </div>
          </div>

          {/* Paper Select Dropdown & Actions */}
          <div className="flex items-center gap-2">
            <select
              value={selectedPaperId || ''}
              onChange={(e) => setSelectedPaperId(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              {papers.length === 0 ? (
                <option value="">No papers available</option>
              ) : (
                papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.total_marks}M) {Boolean(p.is_locked) ? '· Locked' : '· Draft'}
                  </option>
                ))
              )}
            </select>

            <button
              type="button"
              onClick={handleCreateNewPaper}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition flex items-center gap-1 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>

            {isLocked ? (
              <button
                type="button"
                onClick={handleUnlockPaper}
                className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition flex items-center gap-1.5 shadow-2xs"
              >
                <Unlock className="w-3.5 h-3.5 text-amber-600" />
                <span>Unlock Paper</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLockPaper}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-1.5 shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Paper</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => store.setStep('upload')}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition flex items-center gap-1.5 shadow-sm ml-2"
            >
              <span>Upload Sheets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Status Toast Message */}
        {statusMessage && (
          <div
            className={`mt-3 p-2.5 rounded-lg border text-xs flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-[10px] font-bold uppercase underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Main 2-Column Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Left Column: Metadata & AI Extraction Tools */}
        <div className="panel bg-white rounded-xl border border-slate-200 p-4 space-y-4 overflow-y-auto">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Paper Details & Strictness
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assessment Title
                </label>
                <input
                  type="text"
                  value={title}
                  disabled={isLocked}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Operating Systems MST-I"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject / Course
                </label>
                <input
                  type="text"
                  value={subject}
                  disabled={isLocked}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Grading Strictness
                  </label>
                  <select
                    value={strictness}
                    disabled={isLocked}
                    onChange={(e) => setStrictness(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50"
                  >
                    <option value="lenient">Lenient (Focus on key ideas)</option>
                    <option value="moderate">Moderate (Standard)</option>
                    <option value="strict">Strict (Exact technical terms)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Checking Medium
                  </label>
                  <select
                    value={checkingMedium}
                    disabled={isLocked}
                    onChange={(e) => setCheckingMedium(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50"
                  >
                    <option value="ai_reference">AI Reference Model</option>
                    <option value="answer_key">Uploaded Answer Key</option>
                    <option value="hybrid">Hybrid (Key + AI)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* AI Intake: Upload Paper / Answer Key */}
          <div className="pt-4 border-t border-slate-200">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Automated Intake & Extraction
            </h2>

            <div className="space-y-2.5">
              {/* Extract questions from paper document */}
              <div>
                <input
                  type="file"
                  ref={paperFileInputRef}
                  onChange={handleUploadPaperFile}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isLocked || isExtracting}
                  onClick={() => paperFileInputRef.current?.click()}
                  className="w-full p-2.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-xs font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isExtracting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting Questions with AI...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Extract Questions from Exam File (PDF/Image)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Upload Answer Key */}
              <div>
                <input
                  type="file"
                  ref={keyFileInputRef}
                  onChange={handleUploadAnswerKey}
                  accept=".pdf,.jpg,.jpeg,.png,.txt"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isLocked || isUploadingKey || questions.length === 0}
                  onClick={() => keyFileInputRef.current?.click()}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUploadingKey ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing Answer Key...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Upload Teacher Answer Key File</span>
                    </>
                  )}
                </button>
              </div>

              {/* Auto-generate AI Rubric */}
              <button
                type="button"
                disabled={isLocked || isGeneratingRubric || questions.length === 0}
                onClick={handleGenerateRubric}
                className="w-full p-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                {isGeneratingRubric ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing Rubric Key Points...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Generate AI Rubrics & Key Points</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section Rules */}
          <div className="pt-4 border-t border-slate-200">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Section Rules</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {sections.length} configured
              </span>
            </h2>

            {sections.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No section limits configured.</p>
            ) : (
              <div className="space-y-2">
                {sections.map((s, idx) => (
                  <div
                    key={s.id || idx}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>{s.name}</span>
                      <span className="text-[11px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        {s.attempt_n > 0 ? `Attempt ${s.attempt_n} of ${s.total_questions || 'all'}` : 'All compulsory'}
                      </span>
                    </div>
                    {s.instructions && (
                      <p className="text-[11px] text-slate-500 leading-tight">{s.instructions}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (2 cols wide): Questions & Rubric Table */}
        <div className="lg:col-span-2 panel bg-white rounded-xl border border-slate-200 p-4 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Configured Questions ({questions.length})
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                · {questions.reduce((acc, q) => acc + (Number(q.max_marks) || 0), 0)} Total Marks
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isLocked}
                onClick={handleAddQuestion}
                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>

              <button
                type="button"
                disabled={isLocked}
                onClick={handleSaveQuestions}
                className="px-3 py-1 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition shadow-2xs disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>

          {/* Scrollable Questions List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {questions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <FileText className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No questions added yet</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  Click "Extract Questions" on the left to parse a PDF/image, or click "Add Question" above to enter manually.
                </p>
              </div>
            ) : (
              questions.map((q, idx) => {
                const isExpanded = expandedQuestionKey === (q.key || q.q_no);
                return (
                  <div
                    key={q.key || idx}
                    className="border border-slate-200 rounded-lg p-3 bg-white hover:border-slate-300 transition shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center font-mono">
                          {q.q_no}
                        </span>
                        <input
                          type="text"
                          value={q.section_name}
                          disabled={isLocked}
                          onChange={(e) => handleUpdateQuestion(idx, 'section_name', e.target.value)}
                          placeholder="Section (e.g. Part I)"
                          className="w-24 text-[11px] px-2 py-0.5 rounded border border-slate-200 font-medium text-slate-600 disabled:bg-slate-50"
                        />
                        <select
                          value={q.question_type}
                          disabled={isLocked}
                          onChange={(e) => handleUpdateQuestion(idx, 'question_type', e.target.value)}
                          className="text-[11px] px-2 py-0.5 rounded border border-slate-200 font-medium text-slate-600 disabled:bg-slate-50"
                        >
                          <option value="short">Short</option>
                          <option value="long">Long</option>
                          <option value="mcq">MCQ</option>
                          <option value="one_word">One Word</option>
                          <option value="maths">Maths</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-slate-400">Marks:</span>
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={q.max_marks}
                            disabled={isLocked}
                            onChange={(e) => handleUpdateQuestion(idx, 'max_marks', parseFloat(e.target.value) || 1)}
                            className="w-14 text-xs font-mono font-bold text-slate-800 px-1.5 py-0.5 rounded border border-slate-300 text-center disabled:bg-slate-50"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedQuestionKey(isExpanded ? null : (q.key || q.q_no))
                          }
                          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                          title="Toggle Rubric & Model Answer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                            title="Remove Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Question text textarea */}
                    <div className="mt-2">
                      <textarea
                        rows={2}
                        value={q.question_text}
                        disabled={isLocked}
                        onChange={(e) => handleUpdateQuestion(idx, 'question_text', e.target.value)}
                        placeholder="Question text in English or Hindi..."
                        className="w-full text-xs p-2 rounded border border-slate-200 text-slate-800 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 leading-relaxed font-sans"
                      />
                    </div>

                    {/* Expandable Rubric & Model Answer Drawer */}
                    {isExpanded && (
                      <div className="mt-2.5 p-3 rounded-lg bg-indigo-50/40 border border-indigo-100 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-indigo-900 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            Model Answer & Rubric Criteria
                          </span>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                            Model Answer:
                          </label>
                          <textarea
                            rows={2}
                            value={q.model_answer || ''}
                            disabled={isLocked}
                            onChange={(e) => handleUpdateQuestion(idx, 'model_answer', e.target.value)}
                            placeholder="Ideal solution / response for this question..."
                            className="w-full text-xs p-2 rounded border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50"
                          />
                        </div>

                        {q.key_points && q.key_points.length > 0 && (
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Key Points ({q.key_points.length}):
                            </label>
                            <ul className="space-y-1">
                              {q.key_points.map((pt, pIdx) => (
                                <li
                                  key={pIdx}
                                  className="text-[11px] text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded flex items-center gap-1.5"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                                  <span>{pt}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
