import { GoogleGenAI, Type } from '@google/genai';

export const OCR_SYSTEM_INSTRUCTION = `You are an expert exam OCR engine. Transcribe all handwritten student answers verbatim, grouped by Question Number (Q1, Q2, etc.). Do NOT correct spelling, grammar, or math mistakes. Ignore crossed-out words and rough-work margins. Briefly note any drawn diagrams or equations in [Diagram: ...]. Return ONLY valid JSON matching this exact schema:
{ "questions": [{ "q_no": "Q1", "transcribed_text": "...", "diagram_notes": "...", "confidence": "high" }] }`;

export const GRADING_SYSTEM_INSTRUCTION = `You are an expert exam evaluation assistant. Grade each transcribed student answer strictly against the provided teacher rubric / model answer key. Preserve the exact q_no values. Return ONLY valid JSON matching this exact schema:
{ "evaluations": [{ "q_no": "Q1", "suggested_marks": 4, "max_marks": 5, "feedback": "Concise, constructive marking feedback referencing key points covered or missed." }] }`;

export type OcrConfidence = 'high' | 'medium' | 'low';

export interface ExtractedQuestion {
  q_no: string;
  transcribed_text: string;
  diagram_notes: string;
  confidence: OcrConfidence;
  suggested_marks?: number;
  max_marks?: number;
  feedback?: string;
}

export interface EvaluateSheetInput {
  fileBuffer: Buffer;
  mimeType: string;
  fileName: string;
  rubric?: string;
  subject?: string;
  forceFallback?: boolean;
}

export interface EvaluateSheetOutput {
  engine: 'gemini' | 'groq';
  engineLabel: 'OCR Engine: Gemini (Primary)' | 'OCR Engine: Groq (Fallback)';
  model: string;
  fallbackTriggered: boolean;
  fallbackReason: string | null;
  evaluatedWithRubric: boolean;
  questions: ExtractedQuestion[];
}

export interface RubricEvaluationItem {
  q_no: string;
  suggested_marks: number;
  max_marks: number;
  feedback: string;
}

export class ServiceHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ServiceHttpError';
    this.status = status;
  }
}

export interface OcrPipelineDeps {
  geminiOcr: (params: {
    model: string;
    mimeType: string;
    base64Data: string;
    subject?: string;
  }) => Promise<ExtractedQuestion[]>;
  groqOcr: (params: {
    mimeType: string;
    base64Data: string;
    subject?: string;
  }) => Promise<ExtractedQuestion[]>;
  geminiGrade: (params: {
    model: string;
    questions: ExtractedQuestion[];
    rubric: string;
    subject?: string;
  }) => Promise<RubricEvaluationItem[]>;
  groqGrade: (params: {
    questions: ExtractedQuestion[];
    rubric: string;
    subject?: string;
  }) => Promise<RubricEvaluationItem[]>;
}

const GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
const GEMINI_RATE_LIMIT_RETRY_MODEL = 'gemini-3.5-flash-lite';
const GROQ_VISION_MODEL = 'qwen/qwen3.8-27b';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 45000;

export function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function normalizeConfidence(val: unknown): OcrConfidence {
  const s = String(val || '').toLowerCase().trim();
  if (s === 'high' || s === 'medium' || s === 'low') return s;
  return 'medium';
}

export function parseOcrJsonResponse(rawText: string): ExtractedQuestion[] {
  const cleaned = stripJsonFences(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ServiceHttpError(502, 'OCR engine returned invalid JSON output. Please retry.');
  }

  const obj = parsed as { questions?: unknown[] };
  if (!obj || !Array.isArray(obj.questions)) {
    throw new ServiceHttpError(502, 'OCR response did not match the required { "questions": [...] } schema.');
  }

  return obj.questions.map((item, idx) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const qNoRaw = String(row.q_no ?? `Q${idx + 1}`).trim();
    const qNo = qNoRaw || `Q${idx + 1}`;
    return {
      q_no: qNo,
      transcribed_text: String(row.transcribed_text ?? '').trim(),
      diagram_notes: String(row.diagram_notes ?? '').trim(),
      confidence: normalizeConfidence(row.confidence),
    };
  });
}

export function parseGradingJsonResponse(rawText: string): RubricEvaluationItem[] {
  const cleaned = stripJsonFences(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ServiceHttpError(502, 'AI grading engine returned invalid JSON output.');
  }

  const obj = parsed as { evaluations?: unknown[]; questions?: unknown[] };
  const list = Array.isArray(obj?.evaluations)
    ? obj.evaluations
    : Array.isArray(obj?.questions)
    ? obj.questions
    : null;

  if (!list) {
    throw new ServiceHttpError(502, 'AI grading response did not match the expected evaluations schema.');
  }

  return list.map((item, idx) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const maxMarks = Math.max(0, Number(row.max_marks ?? 0) || 0);
    const rawSuggested = Math.max(0, Number(row.suggested_marks ?? 0) || 0);
    const suggestedMarks = maxMarks > 0 ? Math.min(maxMarks, rawSuggested) : rawSuggested;
    return {
      q_no: String(row.q_no ?? `Q${idx + 1}`).trim() || `Q${idx + 1}`,
      suggested_marks: Math.round(suggestedMarks * 2) / 2,
      max_marks: maxMarks,
      feedback: String(row.feedback ?? '').trim(),
    };
  });
}

export function mergeRubricEvaluation(
  questions: ExtractedQuestion[],
  evaluations: RubricEvaluationItem[]
): ExtractedQuestion[] {
  return questions.map((q, idx) => {
    const match =
      evaluations.find((ev) => ev.q_no.toLowerCase() === q.q_no.toLowerCase()) ??
      evaluations[idx];
    if (!match) return q;
    return {
      ...q,
      suggested_marks: match.suggested_marks,
      max_marks: match.max_marks,
      feedback: match.feedback,
    };
  });
}

function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e.status === 'number') return e.status;
  if (typeof e.statusCode === 'number') return e.statusCode;
  if (e.error && typeof (e.error as Record<string, unknown>).code === 'number') {
    return (e.error as Record<string, unknown>).code as number;
  }
  return undefined;
}

export function isRateLimitOrQuotaError(err: unknown): boolean {
  const status = getErrorStatus(err);
  if (status === 429) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('too many requests') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota')
  );
}

export function isTimeoutError(err: unknown): boolean {
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
    return true;
  }
  const status = getErrorStatus(err);
  if (status === 408 || status === 504) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted');
}

export function isGeminiFallbackTriggerError(err: unknown): boolean {
  return isRateLimitOrQuotaError(err) || isTimeoutError(err);
}

function isGeminiAuthConfigError(err: unknown): boolean {
  const status = getErrorStatus(err);
  if (status === 400 || status === 401 || status === 403) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    return (
      msg.includes('api_key') ||
      msg.includes('api key') ||
      msg.includes('permission_denied') ||
      msg.includes('unauthorized')
    );
  }
  return false;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceHttpError(
      400,
      'GEMINI_API_KEY is not configured. Add it in Settings > Secrets, or enable "Force Groq Fallback (Test Mode)" to test Groq Vision.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function createDefaultDeps(): OcrPipelineDeps {
  return {
    async geminiOcr({ model, mimeType, base64Data, subject }) {
      const ai = getGeminiClient();
      const subjectContext = subject?.trim()
        ? `Subject: ${subject.trim()}. `
        : '';

      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: `${subjectContext}Transcribe all handwritten answers verbatim grouped by Question Number (Q1, Q2, etc.). Return ONLY valid JSON matching the required schema.`,
              },
            ],
          },
          config: {
            systemInstruction: OCR_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      q_no: { type: Type.STRING },
                      transcribed_text: { type: Type.STRING },
                      diagram_notes: { type: Type.STRING },
                      confidence: { type: Type.STRING },
                    },
                    required: ['q_no', 'transcribed_text', 'diagram_notes', 'confidence'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        }),
        REQUEST_TIMEOUT_MS,
        `Gemini OCR (${model})`
      );

      const text = response.text ?? '';
      return parseOcrJsonResponse(text);
    },

    async groqOcr({ mimeType, base64Data, subject }) {
      if (mimeType === 'application/pdf') {
        throw new ServiceHttpError(
          400,
          'Groq Vision fallback only supports image files (JPG, PNG, WEBP). Please upload a JPG or PNG image of your answer sheet when using Groq fallback.'
        );
      }

      const groqKey = process.env.GROQ_API_KEY?.trim();
      if (!groqKey) {
        throw new ServiceHttpError(
          400,
          'GROQ_API_KEY is not configured in Settings > Secrets. Add GROQ_API_KEY to use the Groq Vision fallback.'
        );
      }

      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      const subjectContext = subject?.trim() ? `Subject: ${subject.trim()}. ` : '';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch(GROQ_ENDPOINT, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: GROQ_VISION_MODEL,
            reasoning_effort: 'none',
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: OCR_SYSTEM_INSTRUCTION,
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `${subjectContext}Transcribe all handwritten answers verbatim grouped by Question Number (Q1, Q2, etc.). Return ONLY valid JSON matching { "questions": [{ "q_no": "Q1", "transcribed_text": "...", "diagram_notes": "...", "confidence": "high" }] }.`,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: dataUrl,
                    },
                  },
                ],
              },
            ],
          }),
        });

        const payload = (await res.json().catch(() => null)) as {
          choices?: { message?: { content?: string } }[];
          error?: { message?: string };
        } | null;

        if (!res.ok) {
          const msg = payload?.error?.message || `Groq API returned HTTP ${res.status}`;
          throw new ServiceHttpError(res.status >= 400 && res.status < 600 ? res.status : 502, `Groq Vision error: ${msg}`);
        }

        const content = payload?.choices?.[0]?.message?.content ?? '';
        return parseOcrJsonResponse(content);
      } catch (err) {
        if (err instanceof ServiceHttpError) throw err;
        if (isTimeoutError(err)) {
          throw new ServiceHttpError(504, 'Groq Vision OCR request timed out. Please retry.');
        }
        throw new ServiceHttpError(
          502,
          err instanceof Error ? `Groq Vision request failed: ${err.message}` : 'Groq Vision request failed.'
        );
      } finally {
        clearTimeout(timeoutId);
      }
    },

    async geminiGrade({ model, questions, rubric, subject }) {
      const ai = getGeminiClient();
      const prompt = [
        subject?.trim() ? `Subject: ${subject.trim()}` : null,
        `Teacher Rubric / Model Answer Key:\n${rubric.trim()}`,
        `Extracted Student Answers (JSON):\n${JSON.stringify(questions)}`,
        'Evaluate each extracted answer against the rubric and return suggested_marks, max_marks, and concise feedback for each q_no.',
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: GRADING_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                evaluations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      q_no: { type: Type.STRING },
                      suggested_marks: { type: Type.NUMBER },
                      max_marks: { type: Type.NUMBER },
                      feedback: { type: Type.STRING },
                    },
                    required: ['q_no', 'suggested_marks', 'max_marks', 'feedback'],
                  },
                },
              },
              required: ['evaluations'],
            },
          },
        }),
        REQUEST_TIMEOUT_MS,
        `Gemini Evaluation (${model})`
      );

      return parseGradingJsonResponse(response.text ?? '');
    },

    async groqGrade({ questions, rubric, subject }) {
      const groqKey = process.env.GROQ_API_KEY?.trim();
      if (!groqKey) {
        throw new ServiceHttpError(
          400,
          'GROQ_API_KEY is not configured in Settings > Secrets. Add GROQ_API_KEY to run rubric evaluation on Groq fallback.'
        );
      }

      const prompt = [
        subject?.trim() ? `Subject: ${subject.trim()}` : null,
        `Teacher Rubric / Model Answer Key:\n${rubric.trim()}`,
        `Extracted Student Answers (JSON):\n${JSON.stringify(questions)}`,
        'Return ONLY valid JSON: { "evaluations": [{ "q_no": "Q1", "suggested_marks": 4, "max_marks": 5, "feedback": "..." }] }',
      ]
        .filter(Boolean)
        .join('\n\n');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch(GROQ_ENDPOINT, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: GROQ_VISION_MODEL,
            reasoning_effort: 'none',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: GRADING_SYSTEM_INSTRUCTION },
              { role: 'user', content: prompt },
            ],
          }),
        });

        const payload = (await res.json().catch(() => null)) as {
          choices?: { message?: { content?: string } }[];
          error?: { message?: string };
        } | null;

        if (!res.ok) {
          const msg = payload?.error?.message || `Groq API returned HTTP ${res.status}`;
          throw new ServiceHttpError(res.status >= 400 && res.status < 600 ? res.status : 502, `Groq grading error: ${msg}`);
        }

        const content = payload?.choices?.[0]?.message?.content ?? '';
        return parseGradingJsonResponse(content);
      } catch (err) {
        if (err instanceof ServiceHttpError) throw err;
        if (isTimeoutError(err)) {
          throw new ServiceHttpError(504, 'Groq grading request timed out. Please retry.');
        }
        throw new ServiceHttpError(
          502,
          err instanceof Error ? `Groq grading failed: ${err.message}` : 'Groq grading failed.'
        );
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}

export async function evaluateSheetPipeline(
  input: EvaluateSheetInput,
  deps: OcrPipelineDeps = createDefaultDeps()
): Promise<EvaluateSheetOutput> {
  const mimeType = input.mimeType || 'image/jpeg';
  const base64Data = input.fileBuffer.toString('base64');
  const forceFallback = Boolean(input.forceFallback);
  const rubricText = (input.rubric ?? '').trim();

  let engine: 'gemini' | 'groq' = 'gemini';
  let modelUsed = GEMINI_PRIMARY_MODEL;
  let fallbackTriggered = false;
  let fallbackReason: string | null = null;
  let questions: ExtractedQuestion[] = [];

  if (forceFallback) {
    engine = 'groq';
    modelUsed = GROQ_VISION_MODEL;
    fallbackTriggered = true;
    fallbackReason = 'Force Groq Fallback (Test Mode) enabled';
    questions = await deps.groqOcr({
      mimeType,
      base64Data,
      subject: input.subject,
    });
  } else {
    try {
      questions = await deps.geminiOcr({
        model: GEMINI_PRIMARY_MODEL,
        mimeType,
        base64Data,
        subject: input.subject,
      });
    } catch (primaryErr) {
      if (isRateLimitOrQuotaError(primaryErr)) {
        // Retry with gemini-3.5-flash-lite if gemini-3.8-flash hits a rate limit
        try {
          modelUsed = GEMINI_RATE_LIMIT_RETRY_MODEL;
          questions = await deps.geminiOcr({
            model: GEMINI_RATE_LIMIT_RETRY_MODEL,
            mimeType,
            base64Data,
            subject: input.subject,
          });
        } catch (retryErr) {
          if (isGeminiFallbackTriggerError(retryErr)) {
            engine = 'groq';
            modelUsed = GROQ_VISION_MODEL;
            fallbackTriggered = true;
            fallbackReason =
              retryErr instanceof Error ? retryErr.message : 'Gemini rate limit or timeout triggered Groq fallback.';
            questions = await deps.groqOcr({
              mimeType,
              base64Data,
              subject: input.subject,
            });
          } else {
            throw normalizeGeminiError(retryErr);
          }
        }
      } else if (isGeminiFallbackTriggerError(primaryErr)) {
        engine = 'groq';
        modelUsed = GROQ_VISION_MODEL;
        fallbackTriggered = true;
        fallbackReason =
          primaryErr instanceof Error ? primaryErr.message : 'Gemini timeout triggered Groq fallback.';
        questions = await deps.groqOcr({
          mimeType,
          base64Data,
          subject: input.subject,
        });
      } else {
        throw normalizeGeminiError(primaryErr);
      }
    }
  }

  // Step 3 — AI Evaluation (Optional if non-empty rubric provided)
  let evaluatedWithRubric = false;
  if (rubricText.length > 0 && questions.length > 0) {
    evaluatedWithRubric = true;
    let evaluations: RubricEvaluationItem[] = [];

    if (engine === 'groq') {
      evaluations = await deps.groqGrade({
        questions,
        rubric: rubricText,
        subject: input.subject,
      });
    } else {
      try {
        evaluations = await deps.geminiGrade({
          model: modelUsed,
          questions,
          rubric: rubricText,
          subject: input.subject,
        });
      } catch (gradeErr) {
        if (isRateLimitOrQuotaError(gradeErr) && modelUsed === GEMINI_PRIMARY_MODEL) {
          try {
            evaluations = await deps.geminiGrade({
              model: GEMINI_RATE_LIMIT_RETRY_MODEL,
              questions,
              rubric: rubricText,
              subject: input.subject,
            });
          } catch (retryGradeErr) {
            if (isGeminiFallbackTriggerError(retryGradeErr)) {
              evaluations = await deps.groqGrade({
                questions,
                rubric: rubricText,
                subject: input.subject,
              });
            } else {
              throw normalizeGeminiError(retryGradeErr);
            }
          }
        } else if (isGeminiFallbackTriggerError(gradeErr)) {
          evaluations = await deps.groqGrade({
            questions,
            rubric: rubricText,
            subject: input.subject,
          });
        } else {
          throw normalizeGeminiError(gradeErr);
        }
      }
    }

    questions = mergeRubricEvaluation(questions, evaluations);
  }

  return {
    engine,
    engineLabel: engine === 'groq' ? 'OCR Engine: Groq (Fallback)' : 'OCR Engine: Gemini (Primary)',
    model: modelUsed,
    fallbackTriggered,
    fallbackReason,
    evaluatedWithRubric,
    questions,
  };
}

function normalizeGeminiError(err: unknown): Error {
  if (err instanceof ServiceHttpError) return err;
  if (isGeminiAuthConfigError(err)) {
    return new ServiceHttpError(
      403,
      'Gemini API key was rejected or lacks permission. Please verify GEMINI_API_KEY in Settings > Secrets.'
    );
  }
  const msg = err instanceof Error ? err.message : 'Gemini OCR request failed.';
  return new ServiceHttpError(getErrorStatus(err) || 502, msg);
}
