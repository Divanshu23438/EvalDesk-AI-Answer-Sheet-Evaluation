import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canPublishPaper,
  canSubmitSheet,
  computeSheetTotals,
  evaluateAnswerAgainstRubric,
  formatStudentIdentity,
  generateTemporaryPassword,
  parseUsersCsv,
  validateRubricTotal,
} from './gradingEngine';
import type { AnswerEvaluation, Question, Sheet } from '../types/eval';

const sampleQuestion: Question = {
  id: 'q1',
  paperId: 'p1',
  number: 1,
  label: 'Q1',
  text: 'Explain photosynthesis and write its chemical equation.',
  type: 'short',
  marks: 5,
  modelAnswer: 'Plants convert light energy into chemical energy: 6CO2 + 6H2O -> C6H12O6 + 6O2.',
  markingNotes: 'Award marks for light-to-chemical conversion and balanced equation.',
  commonWrongAnswers: ['plants breathe oxygen to make carbon dioxide'],
  keyPoints: [
    {
      id: 'kp1',
      text: 'convert light energy into chemical energy',
      marks: 2,
      alternativeWordings: ['sunlight converted to chemical energy', 'light energy transformed'],
    },
    {
      id: 'kp2',
      text: '6CO2 + 6H2O glucose C6H12O6 + 6O2',
      marks: 3,
      alternativeWordings: ['carbon dioxide and water into glucose and oxygen'],
    },
  ],
};

test('evaluateAnswerAgainstRubric awards full marks when key points match', () => {
  const result = evaluateAnswerAgainstRubric({
    ocrText:
      'Photosynthesis converts light energy into chemical energy. Carbon dioxide and water react to form glucose and oxygen: 6CO2 + 6H2O -> C6H12O6 + 6O2.',
    question: sampleQuestion,
    paperMode: 'lenient',
  });

  assert.equal(result.suggestedMarks, 5);
  assert.equal(result.confidence, 'high');
  assert.equal(result.checks.contradictionCheck, 'no_contradiction');
  assert.equal(result.keyPointResults.every((k) => k.verdict === 'found'), true);
});

test('evaluateAnswerAgainstRubric detects NLI contradiction and flags for review', () => {
  const result = evaluateAnswerAgainstRubric({
    ocrText: 'Photosynthesis does not convert light energy into chemical energy at all.',
    question: sampleQuestion,
    paperMode: 'lenient',
  });

  assert.equal(result.checks.contradictionCheck, 'contradiction_detected');
  assert.ok(result.reviewReasons.includes('checks_disagree'));
  assert.ok(result.suggestedMarks < 5);
});

test('strict mode produces content/grammar/spelling breakdown and catches spelling issues', () => {
  const result = evaluateAnswerAgainstRubric({
    ocrText: 'Shakespeare Hamlet shows the motif of deapy and coricption in the state.',
    question: {
      ...sampleQuestion,
      marks: 5,
      keyPoints: [
        { id: 'kp-s1', text: 'motif of decay and corruption in Hamlet', marks: 5, alternativeWordings: ['motif', 'Hamlet'] },
      ],
    },
    paperMode: 'strict',
  });

  assert.ok(result.strictBreakdown);
  assert.ok(result.reviewReasons.includes('spelling_doubt'));
});

test('validateRubricTotal checks sum equals paper total', () => {
  assert.deepEqual(validateRubricTotal([{ marks: 5 }, { marks: 5 }, { marks: 5 }], 15), {
    valid: true,
    sum: 15,
    diff: 0,
  });
  assert.deepEqual(validateRubricTotal([{ marks: 4 }, { marks: 5 }], 15), {
    valid: false,
    sum: 9,
    diff: 6,
  });
});

test('canSubmitSheet blocks submission when unresolved flags exist', () => {
  const baseAnswer: AnswerEvaluation = {
    questionId: 'q1',
    ocrText: 'text',
    originalOcrText: 'text',
    lowConfidenceWords: [],
    boundingBox: { pageIndex: 0, topPct: 10, leftPct: 5, widthPct: 90, heightPct: 20 },
    lineCrops: [],
    confidence: 'low',
    confidenceScore: 55,
    reviewReasons: ['low_ocr_confidence'],
    flagResolved: false,
    keyPointResults: [],
    checks: { aiJudge: 'partial', contradictionCheck: 'no_contradiction', votes: '2/3 agree' },
    suggestedMarks: 3,
    finalMarks: 3,
    source: 'ai',
    teacherOverride: false,
    feedback: '',
    aiDraftFeedback: '',
    acceptedByTeacher: false,
    history: [],
  };

  assert.equal(canSubmitSheet([baseAnswer]).allowed, false);
  assert.equal(canSubmitSheet([{ ...baseAnswer, flagResolved: true }]).allowed, true);
});

test('canPublishPaper blocks if any sheet is not evaluated or has open flags', () => {
  const sheet: Sheet = {
    id: 's1',
    paperId: 'p1',
    studentId: 'st1',
    pages: [],
    status: 'in_review',
    quality: { blurOk: true, tiltDegrees: 0, missingPages: false, notes: 'Clear' },
    spotCheckCompleted: false,
    timeSpentSeconds: 45,
    lastQuestionIndex: 0,
    answers: [],
  };
  const check = canPublishPaper([sheet]);
  assert.equal(check.allowed, false);
  assert.ok(check.reasons[0].includes('not yet Evaluated'));
});

test('formatStudentIdentity masks student name when anonymousEvaluation is on', () => {
  const student = { name: 'Aanya Sharma', rollNumber: '2026CS104', rollCode: 'RC-8841' };
  assert.equal(formatStudentIdentity(student, true), 'RC-8841');
  assert.equal(formatStudentIdentity(student, false), 'Aanya Sharma (2026CS104)');
});

test('parseUsersCsv parses valid rows and reports invalid rows cleanly', () => {
  const csv = [
    'name,email,role,rollOrSubjects,classId,section',
    'Riya Patel,riya@college.edu,student,2026CS110,cls-bsc1,A',
    'Bad Row,not-an-email,student,2026CS111,cls-bsc1,A',
    'Prof. Sen,sen@college.edu,teacher,subj-phys;subj-math,cls-bsc1,',
  ].join('\n');

  const parsed = parseUsersCsv(csv);
  assert.equal(parsed.validUsers.length, 2);
  assert.equal(parsed.errorCount, 1);
  assert.equal(computeSheetTotals({ answers: [] }).finalTotal, 0);
});

test('maths definite integral awards full marks without false-triggering misconception "24" inside intermediate step', () => {
  const mathQ3: Question = {
    id: 'q-math-3',
    paperId: 'paper-math-201',
    number: 3,
    label: 'Q3',
    text: 'Evaluate the definite integral ∫₁³ (x² + 4x - 1) dx.',
    type: 'maths',
    marks: 5,
    modelAnswer: 'Antiderivative F(x) = x³/3 + 2x² - x. F(3) - F(1) = 24 - 4/3 = 68/3 (22.67).',
    markingNotes: '2 marks for antiderivative, 3 marks for 68/3.',
    commonWrongAnswers: ['24', '72/3'],
    keyPoints: [
      {
        id: 'kp-m3-1',
        text: '1/3 x^3 + 2x^2 - x',
        marks: 2,
        alternativeWordings: ['x^3/3 + 4x^2/2 - x'],
      },
      {
        id: 'kp-m3-2',
        text: '24 - 4/3 = 68/3',
        marks: 3,
        alternativeWordings: ['68/3', '22.67'],
      },
    ],
  };

  const correctRes = evaluateAnswerAgainstRubric({
    ocrText: 'F(x) = [1/3 x^3 + 2x^2 - x]_1^3\n= (9 + 18 - 3) - (1/3 + 1)\n= 24 - 4/3 = 68/3 = 22.67',
    question: mathQ3,
    paperMode: 'maths',
    lowConfidenceWords: ['68/3', '22.67'],
  });

  assert.equal(correctRes.suggestedMarks, 5);
  assert.equal(correctRes.checks.aiJudge, 'agree');
  assert.equal(correctRes.checks.contradictionCheck, 'no_contradiction');
  assert.ok(correctRes.reviewReasons.includes('low_ocr_confidence'));
  assert.equal(correctRes.keyPointResults.every((r) => r.verdict === 'found'), true);

  const wrongRes = evaluateAnswerAgainstRubric({
    ocrText: 'F(3) = 24',
    question: mathQ3,
    paperMode: 'maths',
  });
  assert.equal(wrongRes.checks.contradictionCheck, 'contradiction_detected');
  assert.equal(wrongRes.suggestedMarks, 0);
});

test('empty OCR text is automatically flagged for low_ocr_confidence and teacher review', () => {
  const result = evaluateAnswerAgainstRubric({
    ocrText: '',
    question: sampleQuestion,
    paperMode: 'lenient',
  });

  assert.equal(result.suggestedMarks, 0);
  assert.equal(result.confidence, 'low');
  assert.ok(result.reviewReasons.includes('low_ocr_confidence'));
});

test('generateTemporaryPassword produces valid Eval#XXXX codes and parseUsersCsv honors custom default temp password', () => {
  const pwd = generateTemporaryPassword();
  assert.match(pwd, /^Eval#[A-Z0-9]{4}$/);

  const csv = [
    'name,email,role,rollOrSubjects,classId,section',
    'Aarav Mehta,aarav@inst.edu,student,2026CS201,,A',
    'Dr. Priya Nair,priya@inst.edu,teacher,subj-1,,',
  ].join('\n');

  const parsed = parseUsersCsv(csv, 'Eval#9988', 'cls-custom');
  assert.equal(parsed.validUsers.length, 2);
  assert.equal(parsed.validUsers[0].passwordHash, 'Eval#9988');
  assert.equal(parsed.validUsers[0].classId, 'cls-custom');
  assert.equal(parsed.validUsers[1].passwordHash, 'Eval#9988');
});

test('conservation of energy phrasing with trailing cannot does not false-trigger NLI contradiction', () => {
  const q: Question = {
    ...sampleQuestion,
    marks: 20,
    commonWrongAnswers: [],
    keyPoints: [
      { id: 'kp-ce', text: 'conservation of energy', marks: 20, alternativeWordings: [] },
    ],
  };
  const res = evaluateAnswerAgainstRubric({
    ocrText: 'Law of conservation of energy states energy cannot be created or destroyed.',
    question: q,
    paperMode: 'lenient',
  });
  assert.equal(res.checks.contradictionCheck, 'no_contradiction');
  assert.equal(res.suggestedMarks, 20);
  assert.equal(res.confidence, 'high');
});

