import type {
  ConfidenceLevel,
  OcrAuditRecord,
  OcrEngineType,
  Paper,
  Sheet,
  Subject,
  SystemSettings,
  User,
} from '../types/eval';
import type { ServerExtractedQuestion } from './apiOcr';

export function confidenceLevelToScore(level: ConfidenceLevel | string | undefined): number {
  const normalized = String(level || '').toLowerCase().trim();
  if (normalized === 'high') return 95;
  if (normalized === 'low') return 45;
  return 75;
}

export function scoreToConfidenceLevel(
  score: number,
  settings?: Pick<SystemSettings, 'highConfidenceThreshold' | 'mediumConfidenceThreshold'>
): ConfidenceLevel {
  const highThresh = settings?.highConfidenceThreshold ?? 85;
  const medThresh = settings?.mediumConfidenceThreshold ?? 65;
  if (score >= highThresh) return 'high';
  if (score >= medThresh) return 'medium';
  return 'low';
}

export function computeExtractedConfidenceScore(questions: Pick<ServerExtractedQuestion, 'confidence'>[]): number {
  if (!questions || questions.length === 0) return 0;
  const total = questions.reduce((sum, q) => sum + confidenceLevelToScore(q.confidence), 0);
  return Math.round(total / questions.length);
}

export function computeSheetConfidenceScore(sheet: Pick<Sheet, 'answers'>): number {
  if (!sheet.answers || sheet.answers.length === 0) return 0;
  const total = sheet.answers.reduce((sum, a) => sum + (Number(a.confidenceScore) || 0), 0);
  return Math.round(total / sheet.answers.length);
}

export function getEngineDisplayLabel(engine: OcrEngineType): string {
  if (engine === 'gemini') return 'OCR Engine: Gemini (Primary)';
  if (engine === 'groq') return 'OCR Engine: Groq (Fallback)';
  return 'OCR Engine: Local Queue';
}

export interface UnifiedOcrAuditInput {
  ocrAuditLogs: OcrAuditRecord[];
  serverAuditLogs?: OcrAuditRecord[];
  sheets: Sheet[];
  papers: Paper[];
  subjects: Subject[];
  users: User[];
  settings?: Pick<SystemSettings, 'highConfidenceThreshold' | 'mediumConfidenceThreshold'>;
}

export function buildUnifiedOcrAuditRows(input: UnifiedOcrAuditInput): OcrAuditRecord[] {
  const {
    ocrAuditLogs,
    serverAuditLogs = [],
    sheets,
    papers,
    subjects,
    users,
    settings,
  } = input;

  const byId = new Map<string, OcrAuditRecord>();
  const seenSheetIds = new Set<string>();
  const seenSignatures = new Set<string>();

  const makeSignature = (r: OcrAuditRecord) =>
    `${r.fileName.toLowerCase()}::${r.engine}::${r.timestamp.slice(0, 19)}`;

  for (const rec of ocrAuditLogs) {
    byId.set(rec.id, rec);
    if (rec.sheetId) seenSheetIds.add(rec.sheetId);
    seenSignatures.add(makeSignature(rec));
  }

  for (const srv of serverAuditLogs) {
    if (byId.has(srv.id) || seenSignatures.has(makeSignature(srv))) continue;
    byId.set(srv.id, srv);
    if (srv.sheetId) seenSheetIds.add(srv.sheetId);
    seenSignatures.add(makeSignature(srv));
  }

  for (const sheet of sheets) {
    if (seenSheetIds.has(sheet.id)) continue;
    if (sheet.status === 'uploaded' && sheet.answers.length === 0) continue;

    const paper = papers.find((p) => p.id === sheet.paperId);
    const subject = paper ? subjects.find((s) => s.id === paper.subjectId) : undefined;
    const student = users.find((u) => u.id === sheet.studentId);
    const confidenceScore = computeSheetConfidenceScore(sheet);
    const engine: OcrEngineType = sheet.ocrEngine ?? 'local';
    const model =
      sheet.ocrModel ??
      (engine === 'gemini'
        ? 'gemini-3.8-flash'
        : engine === 'groq'
        ? 'qwen/qwen3.8-27b'
        : 'EvalDesk Rubric OCR');
    const timestamp =
      sheet.processedAt ||
      sheet.submittedAt ||
      sheet.publishedAt ||
      new Date().toISOString();

    const derived: OcrAuditRecord = {
      id: `sheet-audit-${sheet.id}`,
      sheetId: sheet.id,
      fileName: `${student?.rollNumber || sheet.id} (${sheet.pages.length}p)`,
      paperId: sheet.paperId,
      subjectLabel: subject ? `${subject.code} — ${subject.name}` : sheet.paperId,
      studentLabel: student ? `${student.name} (${student.rollNumber || student.rollCode || ''})` : undefined,
      timestamp,
      engine,
      engineLabel: getEngineDisplayLabel(engine),
      model,
      confidenceScore,
      confidence: scoreToConfidenceLevel(confidenceScore, settings),
      questionCount: sheet.answers.length,
      fallbackTriggered: engine === 'groq',
      fallbackReason: engine === 'groq' ? 'Groq fallback processed' : null,
      evaluatedWithRubric: sheet.answers.length > 0,
    };

    byId.set(derived.id, derived);
    seenSheetIds.add(sheet.id);
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export type EngineFilterOption = 'all' | OcrEngineType;

export function filterOcrAuditRows(
  rows: OcrAuditRecord[],
  options: { engineFilter: EngineFilterOption; searchQuery?: string }
): OcrAuditRecord[] {
  const { engineFilter, searchQuery = '' } = options;
  const q = searchQuery.trim().toLowerCase();

  return rows.filter((row) => {
    if (engineFilter !== 'all' && row.engine !== engineFilter) return false;
    if (!q) return true;
    const hay = [
      row.fileName,
      row.subjectLabel,
      row.studentLabel,
      row.paperId,
      row.sheetId,
      row.model,
      row.engineLabel,
      row.fallbackReason,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export interface OcrAuditStats {
  totalProcessed: number;
  avgConfidencePct: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  geminiCount: number;
  groqCount: number;
  localCount: number;
  fallbackCount: number;
  fallbackRatePct: number;
  geminiSharePct: number;
  groqSharePct: number;
  localSharePct: number;
}

export function computeOcrAuditStats(rows: OcrAuditRecord[]): OcrAuditStats {
  const total = rows.length;
  if (total === 0) {
    return {
      totalProcessed: 0,
      avgConfidencePct: 0,
      highConfidenceCount: 0,
      mediumConfidenceCount: 0,
      lowConfidenceCount: 0,
      geminiCount: 0,
      groqCount: 0,
      localCount: 0,
      fallbackCount: 0,
      fallbackRatePct: 0,
      geminiSharePct: 0,
      groqSharePct: 0,
      localSharePct: 0,
    };
  }

  let confidenceSum = 0;
  let highConfidenceCount = 0;
  let mediumConfidenceCount = 0;
  let lowConfidenceCount = 0;
  let geminiCount = 0;
  let groqCount = 0;
  let localCount = 0;
  let fallbackCount = 0;

  for (const r of rows) {
    confidenceSum += r.confidenceScore;
    if (r.confidence === 'high') highConfidenceCount++;
    else if (r.confidence === 'medium') mediumConfidenceCount++;
    else lowConfidenceCount++;

    if (r.engine === 'gemini') geminiCount++;
    else if (r.engine === 'groq') groqCount++;
    else localCount++;

    if (r.fallbackTriggered || r.engine === 'groq') fallbackCount++;
  }

  return {
    totalProcessed: total,
    avgConfidencePct: Math.round((confidenceSum / total) * 10) / 10,
    highConfidenceCount,
    mediumConfidenceCount,
    lowConfidenceCount,
    geminiCount,
    groqCount,
    localCount,
    fallbackCount,
    fallbackRatePct: Math.round((fallbackCount / total) * 100),
    geminiSharePct: Math.round((geminiCount / total) * 100),
    groqSharePct: Math.round((groqCount / total) * 100),
    localSharePct: Math.round((localCount / total) * 100),
  };
}

export interface OcrTrendPoint {
  index: number;
  id: string;
  timestamp: string;
  timeLabel: string;
  shortLabel: string;
  fileName: string;
  engine: OcrEngineType;
  engineLabel: string;
  model: string;
  confidenceScore: number;
  rollingAvg: number;
  geminiConfidence: number | null;
  groqConfidence: number | null;
  localConfidence: number | null;
  questionCount: number;
}

export function buildOcrTrendSeries(rows: OcrAuditRecord[]): OcrTrendPoint[] {
  if (rows.length === 0) return [];
  const chronological = [...rows].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let cumulative = 0;
  return chronological.map((row, idx) => {
    cumulative += row.confidenceScore;
    const d = new Date(row.timestamp);
    const validDate = !Number.isNaN(d.getTime());
    const timeLabel = validDate
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : `#${idx + 1}`;
    const shortLabel = `#${idx + 1} · ${timeLabel}`;

    return {
      index: idx + 1,
      id: row.id,
      timestamp: row.timestamp,
      timeLabel,
      shortLabel,
      fileName: row.fileName,
      engine: row.engine,
      engineLabel: row.engineLabel,
      model: row.model,
      confidenceScore: row.confidenceScore,
      rollingAvg: Math.round((cumulative / (idx + 1)) * 10) / 10,
      geminiConfidence: row.engine === 'gemini' ? row.confidenceScore : null,
      groqConfidence: row.engine === 'groq' ? row.confidenceScore : null,
      localConfidence: row.engine === 'local' ? row.confidenceScore : null,
      questionCount: row.questionCount,
    };
  });
}
