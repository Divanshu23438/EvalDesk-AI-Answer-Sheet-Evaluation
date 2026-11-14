import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  FileUp,
  Loader2,
  RefreshCw,
  ScanLine,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import {
  callEvaluateSheetApi,
  type ServerEvaluateSheetResult,
  type ServerExtractedQuestion,
} from '../../utils/apiOcr';
import {
  computeExtractedConfidenceScore,
  scoreToConfidenceLevel,
} from '../../utils/ocrAudit';
import { ServerOcrResultPanel } from '../ui/ServerOcrResultPanel';
import { SheetStatusBadge } from '../ui/StatusBadge';

interface StagedFile {
  id: string;
  file: File;
  fileName: string;
  studentId: string;
  previewUrl: string;
  tiltDegrees: number;
  ocrByQuestion: Record<string, string>;
  expandedOcr: boolean;
  aiLoading?: boolean;
  aiError?: string;
  aiResult?: ServerEvaluateSheetResult | null;
}

function createPdfPreviewDataUrl(fileName: string, sizeBytes: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1040;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#c1c6d4';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

    ctx.fillStyle = '#005dac';
    ctx.fillRect(24, 24, canvas.width - 48, 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('SCANNED ANSWER SCRIPT (PDF IMPORT)', 48, 68);

    ctx.fillStyle = '#0b1c30';
    ctx.font = '600 18px monospace';
    ctx.fillText(`File: ${fileName}`, 48, 140);
    ctx.fillStyle = '#414752';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Size: ${Math.max(1, Math.round(sizeBytes / 1024))} KB · Imported ${new Date().toLocaleDateString()}`, 48, 172);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let y = 220; y < 960; y += 44) {
      ctx.beginPath();
      ctx.moveTo(48, y);
      ctx.lineTo(canvas.width - 48, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 16px sans-serif';
    ctx.fillText('Page 1 rendered for teacher review and OCR verification.', 48, 250);
  }
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function fileToPersistentDataUrl(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return createPdfPreviewDataUrl(file.name, file.size);
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1100;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export function AdminIntake() {
  const { state, processingQueue, uploadSheetsBatch, recordOcrAudit, retryFailedSheet, setActiveView } = useEval();
  const [paperId, setPaperId] = useState(state.papers[0]?.id || '');
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [rubricInput, setRubricInput] = useState('');
  const [forceFallback, setForceFallback] = useState(false);
  const [runningAllOcr, setRunningAllOcr] = useState(false);
  const [apiErrorBanner, setApiErrorBanner] = useState('');

  const effectivePaperId = state.papers.some((p) => p.id === paperId)
    ? paperId
    : state.papers[0]?.id || '';
  const selectedPaper = state.papers.find((p) => p.id === effectivePaperId) ?? null;
  const selectedSubject = selectedPaper
    ? state.subjects.find((s) => s.id === selectedPaper.subjectId)
    : undefined;

  const students = state.users.filter((u) => u.role === 'student' && u.status === 'active');
  const paperQuestions = state.questions
    .filter((q) => q.paperId === effectivePaperId)
    .sort((a, b) => a.number - b.number);

  const loadPaperRubric = () => {
    if (paperQuestions.length === 0) return;
    const text = paperQuestions
      .map(
        (q) =>
          `${q.label} (${q.marks} marks): ${q.text}\nModel Answer: ${q.modelAnswer}${
            q.keyPoints.length > 0
              ? `\nKey Points: ${q.keyPoints.map((kp) => `${kp.text} [${kp.marks}m]`).join('; ')}`
              : ''
          }`
      )
      .join('\n\n');
    setRubricInput(text);
    if (!subjectInput.trim() && selectedSubject) {
      setSubjectInput(`${selectedSubject.code} — ${selectedSubject.name}`);
    }
  };

  const runServerOcrForItem = async (item: StagedFile): Promise<boolean> => {
    setApiErrorBanner('');
    setStaged((prev) =>
      prev.map((x) =>
        x.id === item.id ? { ...x, aiLoading: true, aiError: undefined } : x
      )
    );

    try {
      const effectiveSubject =
        subjectInput.trim() ||
        (selectedSubject ? `${selectedSubject.code} — ${selectedSubject.name}` : '');
      const result = await callEvaluateSheetApi({
        file: item.file,
        rubric: rubricInput,
        subject: effectiveSubject,
        forceFallback,
      });

      const confidenceScore = computeExtractedConfidenceScore(result.questions);
      const matchedStudent = students.find((st) => st.id === item.studentId);
      recordOcrAudit({
        fileName: item.fileName,
        paperId: effectivePaperId || undefined,
        subjectLabel: effectiveSubject || undefined,
        studentLabel: matchedStudent
          ? `${matchedStudent.name} (${matchedStudent.rollNumber || matchedStudent.rollCode || ''})`
          : undefined,
        timestamp: new Date().toISOString(),
        engine: result.engine,
        engineLabel: result.engineLabel,
        model: result.model,
        confidenceScore,
        confidence: scoreToConfidenceLevel(confidenceScore, state.settings),
        questionCount: result.questions.length,
        fallbackTriggered: result.fallbackTriggered,
        fallbackReason: result.fallbackReason,
        evaluatedWithRubric: result.evaluatedWithRubric,
      });

      setStaged((prev) =>
        prev.map((x) => {
          if (x.id !== item.id) return x;
          const mappedOcr: Record<string, string> = { ...x.ocrByQuestion };
          result.questions.forEach((extracted, idx) => {
            const matchedQ =
              paperQuestions.find(
                (pq) =>
                  pq.label.toLowerCase() === extracted.q_no.toLowerCase() ||
                  `q${pq.number}` === extracted.q_no.toLowerCase()
              ) ?? paperQuestions[idx];
            if (matchedQ) {
              const combined = extracted.diagram_notes
                ? `${extracted.transcribed_text}\n${extracted.diagram_notes}`.trim()
                : extracted.transcribed_text;
              mappedOcr[matchedQ.id] = combined;
            }
          });
          return {
            ...x,
            aiLoading: false,
            aiError: undefined,
            aiResult: result,
            ocrByQuestion: mappedOcr,
          };
        })
      );
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to process answer sheet OCR.';
      setStaged((prev) =>
        prev.map((x) =>
          x.id === item.id ? { ...x, aiLoading: false, aiError: msg } : x
        )
      );
      return false;
    }
  };

  const handleRunAllServerOcr = async () => {
    if (staged.length === 0) return;
    setRunningAllOcr(true);
    setApiErrorBanner('');
    let failedCount = 0;
    try {
      for (const item of staged) {
        const ok = await runServerOcrForItem(item);
        if (!ok) failedCount++;
      }
      if (failedCount > 0 && staged.length > 1) {
        setApiErrorBanner(`${failedCount} of ${staged.length} answer sheet(s) failed AI OCR — see details on the marked rows below.`);
      }
    } finally {
      setRunningAllOcr(false);
    }
  };

  const handleUpdateExtractedQuestion = (
    stagedId: string,
    qIndex: number,
    patch: Partial<ServerExtractedQuestion>
  ) => {
    setStaged((prev) =>
      prev.map((x) => {
        if (x.id !== stagedId || !x.aiResult) return x;
        return {
          ...x,
          aiResult: {
            ...x.aiResult,
            questions: x.aiResult.questions.map((q, idx) =>
              idx === qIndex ? { ...q, ...patch } : q
            ),
          },
        };
      })
    );
  };

  const stageFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploadNotice('');
    setApiErrorBanner('');
    const mapped: StagedFile[] = [];
    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      const matched = students.find(
        (s) => s.rollNumber && file.name.toUpperCase().includes(s.rollNumber.toUpperCase())
      );
      const previewUrl = await fileToPersistentDataUrl(file);
      mapped.push({
        id: `pick-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        file,
        fileName: file.name,
        studentId: matched?.id || students[0]?.id || '',
        previewUrl,
        tiltDegrees: 0.4,
        ocrByQuestion: {},
        expandedOcr: false,
        aiResult: null,
      });
    }
    setStaged((prev) => [...prev, ...mapped]);
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await stageFiles(files);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      /\.(jpg|jpeg|png|webp|pdf)$/i.test(f.name)
    );
    await stageFiles(files);
  };

  const handleUploadAll = () => {
    if (!effectivePaperId || staged.length === 0) return;
    if (staged.some((s) => !s.studentId)) {
      setUploadNotice('Every staged sheet must be matched to an active student.');
      return;
    }
    uploadSheetsBatch(
      effectivePaperId,
      staged.map((s) => ({
        fileName: s.fileName,
        studentId: s.studentId,
        previewUrl: s.previewUrl,
        pages: [s.previewUrl],
        tiltDegrees: s.tiltDegrees,
        ocrByQuestion: s.ocrByQuestion,
        ocrEngine: s.aiResult?.engine,
        ocrModel: s.aiResult?.model,
      }))
    );
    setUploadNotice(`Queued ${staged.length} sheet(s) into the local OCR processing queue.`);
    setStaged([]);
  };

  const paperSheets = state.sheets.filter((s) => s.paperId === effectivePaperId);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0b1c30]">Answer Sheet Intake & Quality Check</h1>
        <p className="text-xs text-[#64748b] mt-0.5">
          Upload scanned student sheets (JPG/PNG/PDF), match roll numbers, enter or leave OCR text for teacher verification, and monitor the 1-at-a-time intake queue.
        </p>
      </div>

      {/* Prerequisite checks */}
      {(state.papers.length === 0 || students.length === 0) && (
        <div className="p-4 rounded-lg border border-[#ffb865] bg-[#fff8e1] text-xs text-[#875200] flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong>Setup required before intake:</strong>{' '}
            {state.papers.length === 0 && 'Create a Paper & Answer Key Rubric first. '}
            {students.length === 0 && 'Add at least one active Student in Users Directory.'}
          </div>
          <div className="flex gap-2">
            {state.papers.length === 0 && (
              <button
                type="button"
                onClick={() => setActiveView('admin_exams')}
                className="px-3 py-1.5 rounded bg-[#005dac] text-white font-semibold"
              >
                Go to Exams & Papers
              </button>
            )}
            {students.length === 0 && (
              <button
                type="button"
                onClick={() => setActiveView('admin_users')}
                className="px-3 py-1.5 rounded bg-[#005dac] text-white font-semibold"
              >
                Add Students
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload & Roll Matching Panel */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex-1 max-w-sm">
            <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Target Paper</label>
            <select
              value={effectivePaperId}
              onChange={(e) => setPaperId(e.target.value)}
              className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-xs bg-white"
            >
              {state.papers.length === 0 && <option value="">No papers available</option>}
              {state.papers.map((p) => {
                const subj = state.subjects.find((s) => s.id === p.subjectId);
                return (
                  <option key={p.id} value={p.id}>
                    {subj?.code} — {subj?.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-[#c1c6d4] bg-white hover:bg-slate-50 text-xs font-semibold text-[#0b1c30]">
              <FileUp className="w-3.5 h-3.5" />
              <span>Select Scans (JPG/PNG/PDF)</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                multiple
                onChange={handleFilePick}
                className="hidden"
              />
            </label>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded border border-[#e2e8f0] bg-[#f8f9ff] text-xs font-medium text-[#0b1c30] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forceFallback}
                onChange={(e) => setForceFallback(e.target.checked)}
                className="rounded border-[#c1c6d4] text-[#005dac] focus:ring-[#005dac]"
              />
              <span>Force Groq Fallback (Test Mode)</span>
            </label>
            <button
              type="button"
              disabled={staged.length === 0 || runningAllOcr}
              onClick={handleRunAllServerOcr}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#196b22] hover:bg-[#005312] disabled:opacity-40 text-white text-xs font-semibold"
            >
              {runningAllOcr ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{runningAllOcr ? 'Running AI OCR...' : 'Run AI OCR & Evaluate'}</span>
            </button>
            <button
              type="button"
              disabled={staged.length === 0 || !effectivePaperId || students.length === 0}
              onClick={handleUploadAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#005dac] hover:bg-[#004786] disabled:opacity-40 text-white text-xs font-semibold"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Queue {staged.length} Sheet(s)</span>
            </button>
          </div>
        </div>

        {/* Optional Subject & Rubric for AI OCR & Evaluation */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1 border-t border-[#e2e8f0]">
          <div className="md:col-span-4">
            <label htmlFor="intake-subject" className="block text-xs font-semibold text-[#0b1c30] mb-1">
              Subject (optional)
            </label>
            <input
              id="intake-subject"
              type="text"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              placeholder={
                selectedSubject
                  ? `${selectedSubject.code} — ${selectedSubject.name}`
                  : 'e.g., Physics, Mathematics'
              }
              className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-xs text-[#0b1c30] focus:outline-none focus:border-[#005dac]"
            />
          </div>
          <div className="md:col-span-8">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="intake-rubric" className="block text-xs font-semibold text-[#0b1c30]">
                Teacher Rubric / Model Answer Key (optional)
              </label>
              {paperQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={loadPaperRubric}
                  className="text-[11px] font-semibold text-[#005dac] hover:underline"
                >
                  Load selected paper rubric
                </button>
              )}
            </div>
            <textarea
              id="intake-rubric"
              rows={2}
              value={rubricInput}
              onChange={(e) => setRubricInput(e.target.value)}
              placeholder="Paste model answers & marks per question to evaluate answers, or leave empty to run raw verbatim OCR speed & transcription tests."
              className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-xs text-[#0b1c30] focus:outline-none focus:border-[#005dac]"
            />
          </div>
        </div>

        {/* Drag & Drop Target */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors ${
            dragOver ? 'border-[#005dac] bg-[#eff4ff]' : 'border-[#c1c6d4] bg-[#f8f9ff]'
          }`}
        >
          <p className="text-xs font-medium text-[#0b1c30]">
            Drop scanned student answer scripts here, or click <strong>Select Scans</strong> above.
          </p>
          <p className="text-[11px] text-[#64748b] mt-1">
            Tip: Naming files with the student roll number (e.g. <code className="font-mono">2026CS201_scan.jpg</code>) auto-matches the student.
            {paperQuestions.length === 0 && effectivePaperId && (
              <span className="text-[#875200] font-semibold">
                {' '}· Selected paper has 0 questions yet; add questions in Exams & Papers before queueing.
              </span>
            )}
          </p>
        </div>

        {apiErrorBanner && (
          <div
            role="alert"
            className="p-3 rounded border border-[#ba1a1a] bg-[#ffdad6] text-xs text-[#93000a] flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{apiErrorBanner}</span>
          </div>
        )}

        {uploadNotice && (
          <div className="p-3 rounded border border-[#88d982] bg-[#e8f5e9] text-xs text-[#196b22]">
            {uploadNotice}
          </div>
        )}

        {/* Staged Matching Table */}
        {staged.length > 0 && (
          <div className="border border-[#e2e8f0] rounded overflow-hidden divide-y divide-[#e2e8f0]">
            <div className="bg-slate-50 px-3 py-2 text-[11px] font-semibold text-[#64748b] uppercase grid grid-cols-12 gap-2">
              <div className="col-span-4">File & Preview</div>
              <div className="col-span-4">Matched Student</div>
              <div className="col-span-2">Scan Tilt / Quality</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            {staged.map((item) => (
              <div key={item.id} className="p-3 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-4 flex items-center gap-2.5 min-w-0">
                    <img
                      src={item.previewUrl}
                      alt={item.fileName}
                      className="w-10 h-12 object-cover rounded border border-[#c1c6d4] shrink-0"
                    />
                    <span className="font-mono text-[#0b1c30] truncate">{item.fileName}</span>
                  </div>
                  <div className="sm:col-span-4">
                    <select
                      value={item.studentId}
                      onChange={(e) =>
                        setStaged((prev) =>
                          prev.map((x) => (x.id === item.id ? { ...x, studentId: e.target.value } : x))
                        )
                      }
                      className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 bg-white text-xs"
                    >
                      {students.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.rollNumber} — {st.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <select
                      value={item.tiltDegrees > 3.5 ? 'tilted' : 'clean'}
                      onChange={(e) =>
                        setStaged((prev) =>
                          prev.map((x) =>
                            x.id === item.id
                              ? { ...x, tiltDegrees: e.target.value === 'tilted' ? 4.8 : 0.4 }
                              : x
                          )
                        )
                      }
                      className="w-full rounded border border-[#c1c6d4] px-2 py-1.5 bg-white text-xs"
                    >
                      <option value="clean">Clean (0.4°)</option>
                      <option value="tilted">Tilted / Blurry (4.8°)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-end gap-1.5 flex-wrap">
                    <button
                      type="button"
                      disabled={Boolean(item.aiLoading)}
                      onClick={() => runServerOcrForItem(item)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#a5c8ff] bg-[#eff4ff] text-[#004786] hover:bg-[#d4e3ff] disabled:opacity-50 font-semibold"
                    >
                      {item.aiLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>{item.aiLoading ? 'Scanning' : 'AI OCR'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setStaged((prev) =>
                          prev.map((x) =>
                            x.id === item.id ? { ...x, expandedOcr: !x.expandedOcr } : x
                          )
                        )
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#c1c6d4] text-[#0b1c30] hover:bg-slate-50"
                    >
                      <FileText className="w-3 h-3" />
                      <span>OCR</span>
                      {item.expandedOcr ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaged((prev) => prev.filter((x) => x.id !== item.id))}
                      className="text-[#ba1a1a] hover:underline font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {item.aiError && (
                  <div
                    role="alert"
                    className="p-2.5 rounded border border-[#ba1a1a] bg-[#ffdad6] text-xs text-[#93000a] flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{item.aiError}</span>
                  </div>
                )}

                {item.aiResult && (
                  <ServerOcrResultPanel
                    result={item.aiResult}
                    onUpdateQuestion={(qIdx, patch) =>
                      handleUpdateExtractedQuestion(item.id, qIdx, patch)
                    }
                  />
                )}

                {item.expandedOcr && (
                  <div className="p-3 rounded bg-[#f8f9ff] border border-[#e2e8f0] space-y-2.5">
                    <div className="text-[11px] text-[#414752]">
                      Optionally enter extracted student OCR responses per question below. Leaving a question blank flags it as{' '}
                      <strong className="font-semibold">Low OCR confidence</strong> so the Teacher transcribes & verifies it in the Grading Workspace.
                    </div>
                    {paperQuestions.length === 0 ? (
                      <div className="text-[11px] text-[#875200]">
                        No rubric questions found on this paper yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {paperQuestions.map((q) => (
                          <div key={q.id} className="space-y-1">
                            <label className="block text-[11px] font-semibold text-[#0b1c30]">
                              {q.label}: {q.text}
                            </label>
                            <textarea
                              rows={2}
                              value={item.ocrByQuestion[q.id] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setStaged((prev) =>
                                  prev.map((x) =>
                                    x.id === item.id
                                      ? { ...x, ocrByQuestion: { ...x.ocrByQuestion, [q.id]: val } }
                                      : x
                                  )
                                );
                              }}
                              placeholder="Type transcribed student handwriting or leave blank for teacher review..."
                              className="w-full rounded border border-[#c1c6d4] bg-white p-2 text-xs font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processing Queue */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0b1c30]">
            <ScanLine className="w-4 h-4 text-[#005dac]" />
            <span>Local OCR Processing Queue (1 sheet at a time)</span>
          </div>
          <span className="text-xs text-[#64748b] tabular-nums">
            {processingQueue.length > 0
              ? `Est. ~${processingQueue.length * 2}s remaining`
              : 'Idle'}
          </span>
        </div>
        {processingQueue.length === 0 ? (
          <p className="text-xs text-[#64748b]">No sheets currently in the OCR queue.</p>
        ) : (
          <div className="space-y-2">
            {processingQueue.map((q, idx) => (
              <div key={q.sheetId} className="p-2.5 rounded border border-[#e2e8f0] bg-[#eff4ff] flex items-center justify-between gap-4 text-xs">
                <span className="font-medium text-[#0b1c30]">
                  #{idx + 1} · {q.fileName}
                </span>
                <span className="font-mono text-[#005dac] tabular-nums">{q.progressPct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail Quality Check Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#0b1c30]">
          Uploaded Sheets & Quality Check ({paperSheets.length})
        </h2>
        {paperSheets.length === 0 ? (
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-8 text-center text-xs text-[#64748b]">
            No answer sheets uploaded for the selected paper yet. Use the upload zone above to queue scanned scripts.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {paperSheets.map((sheet) => {
              const student = state.users.find((u) => u.id === sheet.studentId);
              return (
                <div key={sheet.id} className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden flex flex-col">
                  <div className="h-44 bg-slate-100 relative overflow-hidden border-b border-[#e2e8f0]">
                    <img
                      src={sheet.pages[0]}
                      alt={`Scanned answer sheet for ${student?.rollNumber}`}
                      className="w-full h-full object-cover object-top"
                    />
                    {!sheet.quality.blurOk && (
                      <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded bg-[#ffdad6]/95 border border-[#ba1a1a] text-[11px] font-medium text-[#93000a] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Tilt {sheet.quality.tiltDegrees}° · Low clarity</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#0b1c30] font-mono">
                          {student?.rollNumber || 'Unmapped'}
                        </span>
                        <SheetStatusBadge status={sheet.status} />
                      </div>
                      <div className="text-xs text-[#414752] mt-1">{student?.name || 'Unknown student'}</div>
                      <div className="text-[11px] text-[#64748b] mt-1 flex items-center gap-1">
                        {sheet.quality.blurOk ? (
                          <CheckCircle2 className="w-3 h-3 text-[#196b22]" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-[#ba1a1a]" />
                        )}
                        <span className="truncate">{sheet.quality.notes}</span>
                      </div>
                    </div>

                    {sheet.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => retryFailedSheet(sheet.id)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry Processing</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
