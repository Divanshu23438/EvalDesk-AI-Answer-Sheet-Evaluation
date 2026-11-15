import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOcrTrendSeries,
  buildUnifiedOcrAuditRows,
  computeExtractedConfidenceScore,
  computeOcrAuditStats,
  confidenceLevelToScore,
  filterOcrAuditRows,
} from './ocrAudit';
import type { OcrAuditRecord, Sheet } from '../types/eval';

test('confidenceLevelToScore and computeExtractedConfidenceScore map confidence levels accurately', () => {
  assert.equal(confidenceLevelToScore('high'), 95);
  assert.equal(confidenceLevelToScore('medium'), 75);
  assert.equal(confidenceLevelToScore('low'), 45);
  assert.equal(computeExtractedConfidenceScore([]), 0);
  assert.equal(
    computeExtractedConfidenceScore([
      { confidence: 'high' },
      { confidence: 'medium' },
      { confidence: 'high' },
    ]),
    88
  );
});

test('buildUnifiedOcrAuditRows merges context, server, and sheet records without duplicates', () => {
  const ctxRecord: OcrAuditRecord = {
    id: 'ocr-1',
    sheetId: 'sheet-1',
    fileName: 'scan_01.jpg',
    paperId: 'paper-1',
    subjectLabel: 'PHYS 101',
    timestamp: '2026-11-13T10:00:00.000Z',
    engine: 'gemini',
    engineLabel: 'OCR Engine: Gemini (Primary)',
    model: 'gemini-3.5-flash-lite',
    confidenceScore: 95,
    confidence: 'high',
    questionCount: 3,
    fallbackTriggered: false,
    evaluatedWithRubric: true,
  };

  const duplicateServerRecord: OcrAuditRecord = {
    ...ctxRecord,
    id: 'srv-1',
  };

  const uniqueServerRecord: OcrAuditRecord = {
    id: 'srv-2',
    fileName: 'scan_02.jpg',
    timestamp: '2026-11-13T10:05:00.000Z',
    engine: 'groq',
    engineLabel: 'OCR Engine: Groq (Fallback)',
    model: 'qwen/qwen3.8-27b',
    confidenceScore: 82,
    confidence: 'medium',
    questionCount: 2,
    fallbackTriggered: true,
    fallbackReason: 'Gemini 429 rate limit',
    evaluatedWithRubric: false,
  };

  const sheets: Sheet[] = [
    {
      id: 'sheet-1',
      paperId: 'paper-1',
      studentId: 'stu-1',
      pages: ['img1.jpg'],
      status: 'ready_for_review',
      quality: { blurOk: true, tiltDegrees: 0.4, missingPages: false, notes: 'ok' },
      spotCheckCompleted: false,
      timeSpentSeconds: 0,
      lastQuestionIndex: 0,
      answers: [
        {
          questionId: 'q1',
          ocrText: 'ans',
          originalOcrText: 'ans',
          lowConfidenceWords: [],
          boundingBox: { pageIndex: 0, topPct: 10, leftPct: 5, widthPct: 90, heightPct: 20 },
          lineCrops: [],
          confidence: 'high',
          confidenceScore: 90,
          reviewReasons: [],
          flagResolved: true,
          keyPointResults: [],
          checks: { aiJudge: 'agree', contradictionCheck: 'no_contradiction', votes: '3/3' },
          suggestedMarks: 4,
          finalMarks: 4,
          source: 'ai',
          teacherOverride: false,
          feedback: '',
          aiDraftFeedback: '',
          acceptedByTeacher: false,
          history: [],
        },
      ],
    },
    {
      id: 'sheet-2',
      paperId: 'paper-1',
      studentId: 'stu-1',
      pages: ['img2.jpg'],
      status: 'evaluated',
      ocrEngine: 'local',
      ocrModel: 'EvalDesk Rubric OCR',
      processedAt: '2026-11-13T10:10:00.000Z',
      quality: { blurOk: true, tiltDegrees: 0.2, missingPages: false, notes: 'ok' },
      spotCheckCompleted: false,
      timeSpentSeconds: 12,
      lastQuestionIndex: 0,
      answers: [
        {
          questionId: 'q1',
          ocrText: 'ans 2',
          originalOcrText: 'ans 2',
          lowConfidenceWords: [],
          boundingBox: { pageIndex: 0, topPct: 10, leftPct: 5, widthPct: 90, heightPct: 20 },
          lineCrops: [],
          confidence: 'medium',
          confidenceScore: 76,
          reviewReasons: [],
          flagResolved: true,
          keyPointResults: [],
          checks: { aiJudge: 'agree', contradictionCheck: 'no_contradiction', votes: '3/3' },
          suggestedMarks: 3,
          finalMarks: 3,
          source: 'ai',
          teacherOverride: false,
          feedback: '',
          aiDraftFeedback: '',
          acceptedByTeacher: false,
          history: [],
        },
      ],
    },
  ];

  const merged = buildUnifiedOcrAuditRows({
    ocrAuditLogs: [ctxRecord],
    serverAuditLogs: [duplicateServerRecord, uniqueServerRecord],
    sheets,
    papers: [],
    subjects: [],
    users: [],
  });

  // sheet-1 is deduped via seenSheetIds, srv-1 deduped via signature -> total 3 unique rows
  assert.equal(merged.length, 3);
  assert.equal(merged[0].id, 'sheet-audit-sheet-2');
  assert.equal(merged[1].id, 'srv-2');
  assert.equal(merged[2].id, 'ocr-1');
});

test('computeOcrAuditStats and filterOcrAuditRows calculate KPI percentages correctly', () => {
  const rows: OcrAuditRecord[] = [
    {
      id: 'a',
      fileName: 'p1.jpg',
      timestamp: '2026-11-13T09:00:00Z',
      engine: 'gemini',
      engineLabel: 'OCR Engine: Gemini (Primary)',
      model: 'gemini-3.5-flash-lite',
      confidenceScore: 95,
      confidence: 'high',
      questionCount: 3,
      fallbackTriggered: false,
      evaluatedWithRubric: true,
    },
    {
      id: 'b',
      fileName: 'p2.jpg',
      timestamp: '2026-11-13T09:10:00Z',
      engine: 'groq',
      engineLabel: 'OCR Engine: Groq (Fallback)',
      model: 'qwen/qwen3.8-27b',
      confidenceScore: 85,
      confidence: 'high',
      questionCount: 2,
      fallbackTriggered: true,
      evaluatedWithRubric: false,
    },
    {
      id: 'c',
      fileName: 'p3.jpg',
      timestamp: '2026-11-13T09:20:00Z',
      engine: 'local',
      engineLabel: 'OCR Engine: Local Queue',
      model: 'EvalDesk Rubric OCR',
      confidenceScore: 60,
      confidence: 'low',
      questionCount: 1,
      fallbackTriggered: false,
      evaluatedWithRubric: true,
    },
  ];

  const stats = computeOcrAuditStats(rows);
  assert.equal(stats.totalProcessed, 3);
  assert.equal(stats.avgConfidencePct, 80);
  assert.equal(stats.geminiCount, 1);
  assert.equal(stats.groqCount, 1);
  assert.equal(stats.localCount, 1);
  assert.equal(stats.fallbackCount, 1);
  assert.equal(stats.fallbackRatePct, 33);

  const groqOnly = filterOcrAuditRows(rows, { engineFilter: 'groq', searchQuery: 'p2' });
  assert.equal(groqOnly.length, 1);
  assert.equal(groqOnly[0].id, 'b');
});

test('buildOcrTrendSeries orders points chronologically and computes rolling averages', () => {
  const rows: OcrAuditRecord[] = [
    {
      id: 'later',
      fileName: 'later.jpg',
      timestamp: '2026-11-13T10:30:00Z',
      engine: 'groq',
      engineLabel: 'OCR Engine: Groq (Fallback)',
      model: 'qwen/qwen3.8-27b',
      confidenceScore: 70,
      confidence: 'medium',
      questionCount: 2,
      fallbackTriggered: true,
      evaluatedWithRubric: false,
    },
    {
      id: 'earlier',
      fileName: 'earlier.jpg',
      timestamp: '2026-11-13T10:00:00Z',
      engine: 'gemini',
      engineLabel: 'OCR Engine: Gemini (Primary)',
      model: 'gemini-3.5-flash-lite',
      confidenceScore: 90,
      confidence: 'high',
      questionCount: 3,
      fallbackTriggered: false,
      evaluatedWithRubric: true,
    },
  ];

  const series = buildOcrTrendSeries(rows);
  assert.equal(series.length, 2);
  assert.equal(series[0].id, 'earlier');
  assert.equal(series[0].rollingAvg, 90);
  assert.equal(series[0].geminiConfidence, 90);
  assert.equal(series[0].groqConfidence, null);
  assert.equal(series[1].id, 'later');
  assert.equal(series[1].rollingAvg, 80);
  assert.equal(series[1].groqConfidence, 70);
  assert.equal(series[1].geminiConfidence, null);
});
