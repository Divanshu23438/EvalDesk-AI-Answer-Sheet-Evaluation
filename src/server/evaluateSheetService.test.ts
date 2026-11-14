import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSheetPipeline,
  isGeminiFallbackTriggerError,
  mergeRubricEvaluation,
  parseOcrJsonResponse,
  ServiceHttpError,
  type OcrPipelineDeps,
} from './evaluateSheetService';

const SAMPLE_BUF = Buffer.from('fake-image-bytes');

function makeMockDeps(overrides: Partial<OcrPipelineDeps> = {}): OcrPipelineDeps {
  return {
    async geminiOcr() {
      return [
        {
          q_no: 'Q1',
          transcribed_text: 'F = m * a = 3000 N',
          diagram_notes: '',
          confidence: 'high',
        },
      ];
    },
    async groqOcr({ mimeType }) {
      if (mimeType === 'application/pdf') {
        throw new ServiceHttpError(
          400,
          'Groq Vision fallback only supports image files (JPG, PNG, WEBP). Please upload a JPG or PNG image of your answer sheet when using Groq fallback.'
        );
      }
      return [
        {
          q_no: 'Q1',
          transcribed_text: 'F = m * a = 3000 N (Groq)',
          diagram_notes: '[Diagram: force arrow]',
          confidence: 'high',
        },
      ];
    },
    async geminiGrade() {
      return [
        {
          q_no: 'Q1',
          suggested_marks: 5,
          max_marks: 5,
          feedback: 'Correct formula and calculation.',
        },
      ];
    },
    async groqGrade() {
      return [
        {
          q_no: 'Q1',
          suggested_marks: 4.5,
          max_marks: 5,
          feedback: 'Groq evaluated formula accurately.',
        },
      ];
    },
    ...overrides,
  };
}

test('parseOcrJsonResponse strips markdown fences and normalizes schema', () => {
  const raw = '```json\n{"questions":[{"q_no":"Q1","transcribed_text":"Photosynthesis converts light","diagram_notes":"[Diagram: leaf]","confidence":"HIGH"}]}\n```';
  const parsed = parseOcrJsonResponse(raw);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].q_no, 'Q1');
  assert.equal(parsed[0].confidence, 'high');
  assert.equal(parsed[0].diagram_notes, '[Diagram: leaf]');
});

test('isGeminiFallbackTriggerError identifies 429, quota, and timeout errors', () => {
  assert.equal(isGeminiFallbackTriggerError(Object.assign(new Error('Too many requests'), { status: 429 })), true);
  assert.equal(isGeminiFallbackTriggerError(new Error('RESOURCE_EXHAUSTED: quota exceeded')), true);
  assert.equal(isGeminiFallbackTriggerError(new Error('Gemini OCR timed out after 45s')), true);
  assert.equal(isGeminiFallbackTriggerError(Object.assign(new Error('API_KEY_INVALID'), { status: 400 })), false);
});

test('primary Gemini succeeds and skips grading when rubric is empty', async () => {
  const calledModels: string[] = [];
  let gradeCalled = false;
  const deps = makeMockDeps({
    async geminiOcr({ model }) {
      calledModels.push(model);
      return [
        { q_no: 'Q1', transcribed_text: 'Verbatim answer', diagram_notes: '', confidence: 'high' },
      ];
    },
    async geminiGrade() {
      gradeCalled = true;
      return [];
    },
  });

  const result = await evaluateSheetPipeline(
    {
      fileBuffer: SAMPLE_BUF,
      mimeType: 'image/jpeg',
      fileName: 'sheet.jpg',
      rubric: '',
      forceFallback: false,
    },
    deps
  );

  assert.deepEqual(calledModels, ['gemini-3.8-flash']);
  assert.equal(result.engine, 'gemini');
  assert.equal(result.engineLabel, 'OCR Engine: Gemini (Primary)');
  assert.equal(result.model, 'gemini-3.8-flash');
  assert.equal(result.evaluatedWithRubric, false);
  assert.equal(gradeCalled, false);
  assert.equal(result.questions[0].suggested_marks, undefined);
});

test('retries gemini-3.5-flash-lite when gemini-3.8-flash hits 429', async () => {
  const calledModels: string[] = [];
  const deps = makeMockDeps({
    async geminiOcr({ model }) {
      calledModels.push(model);
      if (model === 'gemini-3.8-flash') {
        throw Object.assign(new Error('Rate limit 429'), { status: 429 });
      }
      return [
        { q_no: 'Q1', transcribed_text: 'Recovered via lite', diagram_notes: '', confidence: 'medium' },
      ];
    },
  });

  const result = await evaluateSheetPipeline(
    {
      fileBuffer: SAMPLE_BUF,
      mimeType: 'image/png',
      fileName: 'sheet.png',
      rubric: 'Q1 (5m): Newton second law',
    },
    deps
  );

  assert.deepEqual(calledModels, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  assert.equal(result.engine, 'gemini');
  assert.equal(result.model, 'gemini-3.5-flash-lite');
  assert.equal(result.fallbackTriggered, false);
  assert.equal(result.evaluatedWithRubric, true);
  assert.equal(result.questions[0].suggested_marks, 5);
});

test('falls back to Groq when both Gemini models fail with 429/timeout', async () => {
  const deps = makeMockDeps({
    async geminiOcr() {
      throw Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 });
    },
  });

  const result = await evaluateSheetPipeline(
    {
      fileBuffer: SAMPLE_BUF,
      mimeType: 'image/jpeg',
      fileName: 'sheet.jpg',
      rubric: 'Q1 (5m): Force = mass x acceleration',
    },
    deps
  );

  assert.equal(result.engine, 'groq');
  assert.equal(result.engineLabel, 'OCR Engine: Groq (Fallback)');
  assert.equal(result.model, 'qwen/qwen3.8-27b');
  assert.equal(result.fallbackTriggered, true);
  assert.equal(result.evaluatedWithRubric, true);
  assert.equal(result.questions[0].suggested_marks, 4.5);
  assert.equal(result.questions[0].max_marks, 5);
});

test('forceFallback skips Gemini and runs Groq directly', async () => {
  let geminiCalled = false;
  const deps = makeMockDeps({
    async geminiOcr() {
      geminiCalled = true;
      return [];
    },
  });

  const result = await evaluateSheetPipeline(
    {
      fileBuffer: SAMPLE_BUF,
      mimeType: 'image/webp',
      fileName: 'sheet.webp',
      forceFallback: true,
    },
    deps
  );

  assert.equal(geminiCalled, false);
  assert.equal(result.engine, 'groq');
  assert.equal(result.engineLabel, 'OCR Engine: Groq (Fallback)');
  assert.equal(result.evaluatedWithRubric, false);
});

test('PDF on Groq fallback returns user-friendly JPG/PNG instruction', async () => {
  const deps = makeMockDeps();
  await assert.rejects(
    () =>
      evaluateSheetPipeline(
        {
          fileBuffer: SAMPLE_BUF,
          mimeType: 'application/pdf',
          fileName: 'sheet.pdf',
          forceFallback: true,
        },
        deps
      ),
    (err: unknown) =>
      err instanceof ServiceHttpError &&
      err.status === 400 &&
      /JPG or PNG image/i.test(err.message)
  );
});

test('mergeRubricEvaluation preserves verbatim transcribed_text', () => {
  const merged = mergeRubricEvaluation(
    [
      {
        q_no: 'Q1',
        transcribed_text: 'Enargy cant be creted',
        diagram_notes: '',
        confidence: 'medium',
      },
    ],
    [
      {
        q_no: 'Q1',
        suggested_marks: 3,
        max_marks: 5,
        feedback: 'Core law stated; spelling errors ignored.',
      },
    ]
  );
  assert.equal(merged[0].transcribed_text, 'Enargy cant be creted');
  assert.equal(merged[0].suggested_marks, 3);
  assert.equal(merged[0].max_marks, 5);
});
