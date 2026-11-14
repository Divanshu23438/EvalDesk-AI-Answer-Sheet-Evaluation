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

