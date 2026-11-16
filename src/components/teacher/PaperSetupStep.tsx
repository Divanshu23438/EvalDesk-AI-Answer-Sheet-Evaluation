import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileKey2,
  FileText,
  LockKeyhole,
  RefreshCw,
  RotateCw,
  Settings,
  Sparkles,
  Unlock,
  Upload,
} from 'lucide-react';
import {
  type CheckingMode,
  type UIKeyPoint,
  type UIQuestion,
  type UIReferenceItem,
  type UISectionRule,
  formatBytes,
  modeLabels,
} from './types';

export interface PaperSetupStepProps {
  paperFile: File | null;
  setPaperFile: (f: File | null) => void;
  answerKeyFile: File | null;
  setAnswerKeyFile: (f: File | null) => void;
  paperTitle: string;
  setPaperTitle: (t: string) => void;
  subject: string;
  setSubject: (s: string) => void;
  mode: CheckingMode;
  setMode: (m: CheckingMode) => void;
  overrides: Record<string, CheckingMode>;
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, CheckingMode>>>;
  isLocked: boolean;
  setIsLocked: (l: boolean) => void;
  unlockPaperWithConfirmation: () => void;
  editableQuestions: UIQuestion[];
  setEditableQuestions: React.Dispatch<React.SetStateAction<UIQuestion[]>>;
  sections: UISectionRule[];
  setSections: React.Dispatch<React.SetStateAction<UISectionRule[]>>;
  draftId: string;
  setDraftId: (d: string) => void;
  extractionWarnings: string[];
  setExtractionWarnings: React.Dispatch<React.SetStateAction<string[]>>;
  extractionSource: string;
  setExtractionSource: (s: string) => void;
  isExtracting: boolean;
  setIsExtracting: (e: boolean) => void;
  instructions: string;
  setInstructions: (i: string) => void;
  paperTotalMarks: number;
  setPaperTotalMarks: (m: number) => void;
  references: UIReferenceItem[];
  setReferences: React.Dispatch<React.SetStateAction<UIReferenceItem[]>>;
  disagreements: string[];
  setDisagreements: React.Dispatch<React.SetStateAction<string[]>>;
  isGeneratingRef: boolean;
  setIsGeneratingRef: (g: boolean) => void;
  currentPaperId: string;
  setCurrentPaperId: (id: string) => void;
  setupSaved: boolean;
  setSetupSaved: (s: boolean) => void;
  basis: 'Answer Key' | 'AI-Generated Reference';
  setBasis: (b: 'Answer Key' | 'AI-Generated Reference') => void;
  setApproved: (a: boolean) => void;
  onProceedToUpload: () => void;
  setStatus: (s: string) => void;
  setError: (e: string) => void;
  setRetryAction: (fn: (() => void) | null) => void;
}

export const PaperSetupStep: React.FC<PaperSetupStepProps> = ({
  paperFile,
  setPaperFile,
  answerKeyFile,
  setAnswerKeyFile,
  paperTitle,
  setPaperTitle,
  subject,
  setSubject,
  mode,
  setMode,
  overrides,
  setOverrides,
  isLocked,
  setIsLocked,
  unlockPaperWithConfirmation,
  editableQuestions,
  setEditableQuestions,
  sections,
  setSections,
  draftId,
  setDraftId,
  extractionWarnings,
  setExtractionWarnings,
  extractionSource,
  setExtractionSource,
  isExtracting,
  setIsExtracting,
  instructions,
  setInstructions,
  paperTotalMarks,
  setPaperTotalMarks,
  references,
  setReferences,
  disagreements,
  setDisagreements,
  isGeneratingRef,
  setIsGeneratingRef,
  currentPaperId,
  setCurrentPaperId,
  setupSaved,
  setSetupSaved,
  basis,
  setBasis,
  setApproved,
  onProceedToUpload,
  setStatus,
  setError,
  setRetryAction,
}) => {
  const [generatingKeys, setGeneratingKeys] = useState<Record<string, boolean>>({});

  const calculatedQuestionTotal = editableQuestions.reduce(
    (sum, q) => sum + (Number(q.max_marks) || 0),
    0
  );
  const paperTotalMismatch =
    paperTotalMarks > 0 ? calculatedQuestionTotal !== paperTotalMarks : false;

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
        word_limit: q.word_limit,
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

  const handleRegenerateQuestion = async (key: string) => {
    if (!currentPaperId) return;
    setGeneratingKeys((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(`/api/papers/${currentPaperId}/questions/${encodeURIComponent(key)}/reference/regenerate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to regenerate question reference.');
      }
      const data = await res.json();
      setReferences((prev) =>
        prev.map((r) => (r.key === key ? { ...r, ...data.reference } : r))
      );
      setStatus(`Question ${key} regenerated successfully.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Regeneration failed';
      setError(msg);
    } finally {
      setGeneratingKeys((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleExpandQuestion = async (key: string) => {
    if (!currentPaperId) return;
    setGeneratingKeys((prev) => ({ ...prev, [key]: true }));
    setError('');
    try {
      const res = await fetch(`/api/papers/${currentPaperId}/questions/${encodeURIComponent(key)}/reference/expand`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to expand question reference.');
      }
      const data = await res.json();
      setReferences((prev) =>
        prev.map((r) => (r.key === key ? { ...r, ...data.reference } : r))
      );
      setStatus(`Question ${key} expanded successfully.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Expansion failed';
      setError(msg);
    } finally {
      setGeneratingKeys((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
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
                      onClick={onProceedToUpload}
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
  );
};
