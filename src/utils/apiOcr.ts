export type OcrEngineType = 'gemini' | 'groq';

export interface ServerExtractedQuestion {
  q_no: string;
  transcribed_text: string;
  diagram_notes: string;
  confidence: 'high' | 'medium' | 'low';
  suggested_marks?: number;
  max_marks?: number;
  feedback?: string;
}

export interface ServerEvaluateSheetResult {
  engine: OcrEngineType;
  engineLabel: 'OCR Engine: Gemini (Primary)' | 'OCR Engine: Groq (Fallback)';
  model: string;
  fallbackTriggered: boolean;
  fallbackReason: string | null;
  evaluatedWithRubric: boolean;
  questions: ServerExtractedQuestion[];
  processingDurationMs: number;
  evaluationLog: {
    step: string;
    status: 'completed' | 'skipped' | 'failed';
    detail: string;
    durationMs?: number;
  }[];
}

import type {
  PaperSectionRule,
  GeneratedAnswerKeyItem,
  GeneratedAnswerKey,
  EvaluatedReviewItem,
  SectionRuleSummary,
  EvaluatedPaperSummary,
} from './sectionChoice';

export type {
  PaperSectionRule,
  GeneratedAnswerKeyItem,
  GeneratedAnswerKey,
  EvaluatedReviewItem,
  SectionRuleSummary,
  EvaluatedPaperSummary,
};
export {
  applySectionChoiceRules,
  normalizeQuestionKey,
  matchQuestionNumbers,
} from './sectionChoice';

export async function callGenerateAnswerKeyApi(
  fileOrParams: File | { file?: File; paperText?: string; subject?: string },
  subjectParam?: string
): Promise<GeneratedAnswerKey> {
  let response: Response;
  if (fileOrParams instanceof File) {
    const form = new FormData();
    form.append('file', fileOrParams, fileOrParams.name);
    if (subjectParam) form.append('subject', subjectParam);
    response = await fetch('/api/generate-answer-key', { method: 'POST', body: form });
  } else if (fileOrParams.file) {
    const form = new FormData();
    form.append('file', fileOrParams.file, fileOrParams.file.name);
    if (fileOrParams.subject) form.append('subject', fileOrParams.subject);
    response = await fetch('/api/generate-answer-key', { method: 'POST', body: form });
  } else if (fileOrParams.paperText) {
    response = await fetch('/api/generate-answer-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paperText: fileOrParams.paperText,
        subject: fileOrParams.subject,
      }),
    });
  } else {
    throw new Error('Please provide a file or paper text to generate an answer key.');
  }

  const data = (await response.json().catch(() => null)) as (GeneratedAnswerKey & { error?: string }) | null;
  if (!response.ok || !data?.questions) {
    throw new Error(data?.error || `Server error (HTTP ${response.status}) generating answer key.`);
  }
  return data;
}

export interface ReportCardSummaryResult {
  summary: string;
  areasForImprovement: string[];
  strengths: string[];
  engine: OcrEngineType;
  model: string;
}

export async function callGenerateReportSummaryApi(params: {
  studentName?: string;
  rollNo?: string;
  subject?: string;
  totalMarks?: number;
  maxMarks?: number;
  percentage?: number;
  grade?: string;
  questions?: ServerExtractedQuestion[];
}): Promise<ReportCardSummaryResult> {
  const response = await fetch('/api/generate-report-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await response.json().catch(() => null)) as (ReportCardSummaryResult & { error?: string }) | null;
  if (!response.ok || !data?.summary) {
    throw new Error(data?.error || `Server error (HTTP ${response.status}) generating report summary.`);
  }
  return data;
}

export async function callEvaluateSheetApi(params: {
  file?: File | Blob;
  fileDataUrl?: string;
  fileName?: string;
  rubric?: string;
  subject?: string;
  forceFallback?: boolean;
}): Promise<ServerEvaluateSheetResult> {
  let response: Response;

  if (params.file) {
    const form = new FormData();
    form.append('file', params.file, params.fileName || (params.file instanceof File ? params.file.name : 'sheet.jpg'));
    if (params.rubric !== undefined) form.append('rubric', params.rubric);
    if (params.subject !== undefined) form.append('subject', params.subject);
    form.append('forceFallback', String(Boolean(params.forceFallback)));

    response = await fetch('/api/evaluate-sheet', {
      method: 'POST',
      body: form,
    });
  } else if (params.fileDataUrl) {
    response = await fetch('/api/evaluate-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileDataUrl: params.fileDataUrl,
        fileName: params.fileName || 'sheet.jpg',
        rubric: params.rubric ?? '',
        subject: params.subject ?? '',
        forceFallback: Boolean(params.forceFallback),
      }),
    });
  } else {
    throw new Error('No answer sheet file provided.');
  }

  const data = (await response.json().catch(() => null)) as
    | (ServerEvaluateSheetResult & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(data?.error || `Server error (HTTP ${response.status}) during OCR evaluation.`);
  }

  if (!data || !Array.isArray(data.questions)) {
    throw new Error('Unexpected response format from /api/evaluate-sheet.');
  }

  return data;
}

export async function fetchServerOcrAudit<T = unknown>(): Promise<T[]> {
  try {
    const res = await fetch('/api/ocr-audit');
    if (!res.ok) return [];
    const data = (await res.json().catch(() => null)) as { records?: T[] } | null;
    return Array.isArray(data?.records) ? data.records : [];
  } catch {
    return [];
  }
}

