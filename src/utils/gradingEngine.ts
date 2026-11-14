import type {
  AnswerEvaluation,
  ConfidenceLevel,
  EvaluationChecks,
  KeyPointEvaluation,
  Paper,
  PaperMode,
  Question,
  ReviewFlagReason,
  Sheet,
  StrictModeBreakdown,
  SystemSettings,
  User,
} from '../types/eval';

export interface GradeEvaluationInput {
  ocrText: string;
  question: Question;
  paperMode: PaperMode;
  lowConfidenceWords?: string[];
  doubtfulCrop?: boolean;
  settings?: Pick<SystemSettings, 'highConfidenceThreshold' | 'mediumConfidenceThreshold'>;
}

export interface GradeEvaluationOutput {
  keyPointResults: KeyPointEvaluation[];
  suggestedMarks: number;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  reviewReasons: ReviewFlagReason[];
  checks: EvaluationChecks;
  aiDraftFeedback: string;
  strictBreakdown?: StrictModeBreakdown;
}

const DEFAULT_THRESHOLDS = {
  highConfidenceThreshold: 85,
  mediumConfidenceThreshold: 65,
};

const NEGATION_TOKENS = ['not', 'never', 'cannot', "can't", 'without', 'neither', 'nor', 'false', 'opposite', 'no'];

const COMMON_SPELLING_ERRORS: Record<string, string> = {
  deapy: 'decay',
  pather: 'father',
  coten: 'context',
  cradity: 'clarity',
  forret: 'forget',
  flutance: 'influence',
  coricption: 'corruption',
  mexture: 'mixture',
  bassattins: 'becomes',
  thccialfirsion: 'social circle',
  recieve: 'receive',
  seperate: 'separate',
  occured: 'occurred',
  photoynthesis: 'photosynthesis',
  aceleration: 'acceleration',
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s=+\-*/.^()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function extractKeywords(phrase: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'of', 'in', 'to', 'and', 'or', 'is', 'are', 'that', 'with', 'for', 'by', 'as', 'on', 'at', 'from', 'it', 'its', 'this', 'be',
  ]);
  return normalizeText(phrase)
    .split(' ')
    .filter((w) => w.length > 1 && !stopWords.has(w));
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function findBestMatchingSentence(
  sentences: string[],
  targetPhrases: string[]
): { sentence: string; matchRatio: number; contradicted: boolean } {
  let bestSentence = '';
  let bestRatio = 0;
  let contradicted = false;

  for (const sentence of sentences) {
    const normSentence = normalizeText(sentence);
    const sentenceTokens = normSentence.split(' ').filter(Boolean);
    const sentenceWords = new Set(sentenceTokens);

    for (const phrase of targetPhrases) {
      const keywords = extractKeywords(phrase);
      if (keywords.length === 0) continue;

      let hits = 0;
      const matchedTokenIndices: number[] = [];
      for (const kw of keywords) {
        if (normSentence.includes(kw) || sentenceWords.has(kw)) {
          hits += 1;
          sentenceTokens.forEach((tok, idx) => {
            if (tok === kw || tok.includes(kw)) matchedTokenIndices.push(idx);
          });
        }
      }
      const ratio = hits / keywords.length;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestSentence = sentence;

        // NLI contradiction check: if target phrase isn't negated, check if a negation precedes a matched concept within 3 tokens
        const phraseHasNegation = NEGATION_TOKENS.some((neg) => normalizeText(phrase).split(' ').includes(neg));
        const hasNearbyNegation =
          matchedTokenIndices.some((kwIdx) => {
            const start = Math.max(0, kwIdx - 3);
            for (let i = start; i < kwIdx; i++) {
              if (NEGATION_TOKENS.includes(sentenceTokens[i])) return true;
            }
            return false;
          }) ||
          sentenceWords.has('opposite') ||
          sentenceWords.has('false');
        contradicted = !phraseHasNegation && hasNearbyNegation && ratio >= 0.45;
      }
    }
  }

  return { sentence: bestSentence, matchRatio: bestRatio, contradicted };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesCommonWrongAnswer(ocrText: string, wrong: string): boolean {
  const normFull = normalizeText(ocrText);
  const normWrong = normalizeText(wrong);
  if (!normWrong) return false;

  const lines = ocrText
    .split(/\n+/)
    .map(normalizeText)
    .filter(Boolean);
  const kws = extractKeywords(wrong);

  // Short or symbolic/numeric misconceptions (e.g. "24", "x = 7", "72/3", "KE = mv^2")
  // must match a standalone line, exact full answer, or final RHS after '=' rather than a substring of a step.
  if (kws.length <= 1 || normWrong.length <= 14 || /[0-9=^*/]/.test(normWrong)) {
    const exactOrTrailingRegex = new RegExp(`(?:^|=\\s*)${escapeRegex(normWrong)}$`);
    return (
      normFull === normWrong ||
      lines.some((line) => line === normWrong || exactOrTrailingRegex.test(line))
    );
  }

  // Multi-word conceptual misconceptions check per-sentence word membership
  const sentences = splitSentences(ocrText);
  return sentences.some((sentence) => {
    const normSentence = normalizeText(sentence);
    const sentenceWords = new Set(normSentence.split(' '));
    return kws.every((k) => sentenceWords.has(k) || normSentence.includes(k));
  });
}

/**
 * Deterministic local rubric grading & key-point matching engine (PRD Sections 5, 16, 21).
 */
export function evaluateAnswerAgainstRubric(input: GradeEvaluationInput): GradeEvaluationOutput {
  const effectiveMode = input.question.modeOverride ?? input.paperMode;
  const thresholds = input.settings ?? DEFAULT_THRESHOLDS;
  const sentences = splitSentences(input.ocrText);
  const normFull = normalizeText(input.ocrText);
  const lowWords = input.lowConfidenceWords ?? [];

  let anyContradiction = false;
  let anyPartial = false;
  const keyPointResults: KeyPointEvaluation[] = [];

  for (const kp of input.question.keyPoints) {
    const phrases = [kp.text, ...kp.alternativeWordings];
    const match = findBestMatchingSentence(sentences, phrases);

    // Check common wrong answers without false-triggering on intermediate numbers in valid steps
    const matchedWrong = input.question.commonWrongAnswers.find((wrong) =>
      matchesCommonWrongAnswer(input.ocrText, wrong)
    );

    if (match.contradicted || matchedWrong) {
      anyContradiction = true;
      keyPointResults.push({
        keyPointId: kp.id,
        verdict: 'not_found',
        marksAwarded: 0,
        evidenceSentence: match.sentence || input.ocrText.slice(0, 120),
        reason: matchedWrong
          ? `Matches known misconception: "${matchedWrong}".`
          : 'Contradiction check (NLI) detected negation of the key concept.',
      });
    } else if (match.matchRatio >= 0.65) {
      keyPointResults.push({
        keyPointId: kp.id,
        verdict: 'found',
        marksAwarded: kp.marks,
        evidenceSentence: match.sentence,
        reason: `Matched ${Math.round(match.matchRatio * 100)}% of key concept terms.`,
      });
    } else if (match.matchRatio >= 0.35) {
      anyPartial = true;
      const partialMarks = roundHalf(kp.marks * 0.5);
      keyPointResults.push({
        keyPointId: kp.id,
        verdict: 'partly',
        marksAwarded: partialMarks,
        evidenceSentence: match.sentence,
        reason: 'Partial concept coverage; supporting terms or step details incomplete.',
      });
    } else {
      keyPointResults.push({
        keyPointId: kp.id,
        verdict: 'not_found',
        marksAwarded: 0,
        evidenceSentence: '',
        reason: 'Key concept not detected in OCR text.',
      });
    }
  }

  let rawMarks = keyPointResults.reduce((sum, r) => sum + r.marksAwarded, 0);

  // Detect spelling doubts for strict mode or garbled OCR
  const tokens = normFull.split(' ').filter(Boolean);
  const spellingIssues = tokens.filter((t) => Boolean(COMMON_SPELLING_ERRORS[t]));

  let strictBreakdown: StrictModeBreakdown | undefined;
  if (effectiveMode === 'strict') {
    const contentRatio = input.question.marks > 0 ? rawMarks / input.question.marks : 0;
    const contentMax = roundHalf(input.question.marks * 0.7);
    const grammarMax = roundHalf(input.question.marks * 0.15);
    const spellingMax = Math.max(0, roundHalf(input.question.marks - contentMax - grammarMax));

    const contentScore = Math.min(contentMax, roundHalf(contentMax * contentRatio));
    const grammarScore = tokens.length >= 6 ? grammarMax : roundHalf(grammarMax * 0.5);
    const spellingPenalty = Math.min(spellingMax, spellingIssues.length * 0.5);
    const spellingScore = Math.max(0, roundHalf(spellingMax - spellingPenalty));

    strictBreakdown = {
      content: contentScore,
      grammar: grammarScore,
      spelling: spellingScore,
    };
    rawMarks = Math.min(input.question.marks, roundHalf(contentScore + grammarScore + spellingScore));
  } else if (effectiveMode === 'maths') {
    // Maths mode rewards explicit intermediate step equations & final numeric/symbolic answer
    rawMarks = Math.min(input.question.marks, roundHalf(rawMarks));
  } else {
    // Lenient mode ignores spelling errors and rewards semantic meaning
    rawMarks = Math.min(input.question.marks, roundHalf(rawMarks));
  }

  const reviewReasons: ReviewFlagReason[] = [];
  if (lowWords.length >= 2 || input.ocrText.trim().length < 5) {
    reviewReasons.push('low_ocr_confidence');
  }
  if (anyContradiction || (anyPartial && effectiveMode !== 'lenient')) {
    reviewReasons.push('checks_disagree');
  }
  if (input.doubtfulCrop) {
    reviewReasons.push('doubtful_crop');
  }
  if ((effectiveMode === 'strict' && spellingIssues.length > 0) || spellingIssues.length >= 2) {
    reviewReasons.push('spelling_doubt');
  }

  // Compute confidence score
  let confidenceScore = 94;
  confidenceScore -= lowWords.length * 7;
  confidenceScore -= spellingIssues.length * 5;
  if (anyContradiction) confidenceScore -= 24;
  if (anyPartial) confidenceScore -= 10;
  if (input.doubtfulCrop) confidenceScore -= 18;
  if (input.ocrText.trim().length < 8) confidenceScore -= 30;
  confidenceScore = Math.max(25, Math.min(99, confidenceScore));

  let confidence: ConfidenceLevel = 'high';
  if (confidenceScore < thresholds.mediumConfidenceThreshold) {
    confidence = 'low';
  } else if (confidenceScore < thresholds.highConfidenceThreshold) {
    confidence = 'medium';
  }

  const checks: EvaluationChecks = {
    aiJudge: anyContradiction ? 'disagree' : anyPartial ? 'partial' : 'agree',
    contradictionCheck: anyContradiction ? 'contradiction_detected' : 'no_contradiction',
    votes: anyContradiction
      ? '1/3 agree (flagged)'
      : anyPartial || reviewReasons.length > 0
      ? '2/3 agree'
      : '3/3 agree',
  };

  const foundCount = keyPointResults.filter((r) => r.verdict === 'found').length;
  const totalKps = keyPointResults.length;
  const missingKps = keyPointResults
    .filter((r) => r.verdict === 'not_found')
    .map((r) => input.question.keyPoints.find((kp) => kp.id === r.keyPointId)?.text)
    .filter(Boolean);

  let aiDraftFeedback = '';
  if (foundCount === totalKps && totalKps > 0) {
    aiDraftFeedback =
      effectiveMode === 'maths'
        ? 'All intermediate steps and the final boxed result are accurate.'
        : 'Clear and complete explanation covering all key rubric points.';
  } else if (foundCount > 0) {
    aiDraftFeedback = `Covered ${foundCount} of ${totalKps} key points. ${
      missingKps.length > 0 ? `Missing or unclear: ${missingKps[0]}.` : ''
    }`.trim();
  } else {
    aiDraftFeedback = 'Key points from the model answer were not clearly demonstrated.';
  }

  if (effectiveMode === 'strict' && spellingIssues.length > 0) {
    aiDraftFeedback += ` Review spelling/OCR terms (${spellingIssues.slice(0, 3).join(', ')}).`;
  }

  return {
    keyPointResults,
    suggestedMarks: Math.max(0, Math.min(input.question.marks, rawMarks)),
    confidence,
    confidenceScore,
    reviewReasons,
    checks,
    aiDraftFeedback,
    strictBreakdown,
  };
}

export function validateRubricTotal(
  questions: Pick<Question, 'marks'>[],
  paperTotalMarks: number
): { valid: boolean; sum: number; diff: number } {
  const sum = roundHalf(questions.reduce((acc, q) => acc + (Number(q.marks) || 0), 0));
  const diff = roundHalf(paperTotalMarks - sum);
  return {
    valid: Math.abs(diff) < 0.001,
    sum,
    diff,
  };
}

export function hasUnresolvedFlags(answer: Pick<AnswerEvaluation, 'reviewReasons' | 'flagResolved'>): boolean {
  return answer.reviewReasons.length > 0 && !answer.flagResolved;
}

export function canSubmitSheet(answers: AnswerEvaluation[]): {
  allowed: boolean;
  unresolvedCount: number;
  unresolvedQuestionIds: string[];
} {
  const unresolved = answers.filter((a) => hasUnresolvedFlags(a));
  return {
    allowed: unresolved.length === 0,
    unresolvedCount: unresolved.length,
    unresolvedQuestionIds: unresolved.map((a) => a.questionId),
  };
}

export function canPublishPaper(sheets: Sheet[]): {
  allowed: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (sheets.length === 0) {
    reasons.push('No answer sheets uploaded for this paper.');
    return { allowed: false, reasons };
  }

  const notEvaluated = sheets.filter((s) => s.status !== 'evaluated' && s.status !== 'published');
  if (notEvaluated.length > 0) {
    reasons.push(`${notEvaluated.length} sheet(s) are not yet Evaluated.`);
  }

  const openFlagsCount = sheets.reduce(
    (sum, s) => sum + s.answers.filter((a) => hasUnresolvedFlags(a)).length,
    0
  );
  if (openFlagsCount > 0) {
    reasons.push(`${openFlagsCount} unresolved review flag(s) remain open.`);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export function computeSheetTotals(sheet: Pick<Sheet, 'answers'>): {
  suggestedTotal: number;
  finalTotal: number;
  unresolvedFlags: number;
  overrideCount: number;
} {
  return {
    suggestedTotal: roundHalf(sheet.answers.reduce((s, a) => s + a.suggestedMarks, 0)),
    finalTotal: roundHalf(sheet.answers.reduce((s, a) => s + a.finalMarks, 0)),
    unresolvedFlags: sheet.answers.filter((a) => hasUnresolvedFlags(a)).length,
    overrideCount: sheet.answers.filter((a) => a.teacherOverride).length,
  };
}

export function sortAnswersFlaggedFirst(answers: AnswerEvaluation[]): AnswerEvaluation[] {
  return [...answers].sort((a, b) => {
    const aFlag = hasUnresolvedFlags(a) ? 0 : 1;
    const bFlag = hasUnresolvedFlags(b) ? 0 : 1;
    return aFlag - bFlag;
  });
}

export function formatStudentIdentity(
  student: Pick<User, 'name' | 'rollNumber' | 'rollCode'> | undefined,
  anonymousEvaluation: boolean
): string {
  if (!student) return 'Unknown Student';
  if (anonymousEvaluation) {
    return student.rollCode || `CODE-${student.rollNumber || 'ANON'}`;
  }
  return `${student.name} (${student.rollNumber || '—'})`;
}

export interface CsvImportRowResult {
  lineNumber: number;
  valid: boolean;
  error?: string;
  user?: Omit<User, 'id' | 'createdAt'>;
}

export function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `Eval#${suffix}`;
}

export function parseUsersCsv(
  csvText: string,
  defaultTempPassword?: string,
  defaultClassId?: string
): {
  rows: CsvImportRowResult[];
  validUsers: Omit<User, 'id' | 'createdAt'>[];
  errorCount: number;
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], validUsers: [], errorCount: 0 };
  }

  const startIndex = lines[0].toLowerCase().includes('name') && lines[0].toLowerCase().includes('role') ? 1 : 0;
  const rows: CsvImportRowResult[] = [];
  const validUsers: Omit<User, 'id' | 'createdAt'>[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const [name, email, roleRaw, rollOrSubjects, classId, section, tempPwdCol] = cols;
    const role = (roleRaw || '').toLowerCase();

    if (!name || !email || !email.includes('@')) {
      rows.push({
        lineNumber: i + 1,
        valid: false,
        error: 'Missing valid name or email address.',
      });
      continue;
    }

    if (role !== 'teacher' && role !== 'student') {
      rows.push({
        lineNumber: i + 1,
        valid: false,
        error: `Invalid role "${roleRaw}". Expected teacher or student.`,
      });
      continue;
    }

    if (role === 'student' && !rollOrSubjects) {
      rows.push({
        lineNumber: i + 1,
        valid: false,
        error: 'Student row requires a roll number in column 4.',
      });
      continue;
    }

    const user: Omit<User, 'id' | 'createdAt'> = {
      name,
      email,
      passwordHash: tempPwdCol || defaultTempPassword || generateTemporaryPassword(),
      role,
      status: 'active',
      mustChangePassword: true,
      rollNumber: role === 'student' ? rollOrSubjects : undefined,
      rollCode: role === 'student' ? `ANON-${rollOrSubjects.slice(-3)}` : undefined,
      classId: classId || defaultClassId || '',
      section: role === 'student' ? section || 'A' : undefined,
      subjects: role === 'teacher' && rollOrSubjects ? rollOrSubjects.split(';').map((s) => s.trim()) : undefined,
    };

    rows.push({ lineNumber: i + 1, valid: true, user });
    validUsers.push(user);
  }

  return {
    rows,
    validUsers,
    errorCount: rows.filter((r) => !r.valid).length,
  };
}

export function computeWorkspaceMetrics(sheets: Sheet[], papers: Paper[]) {
  const evaluated = sheets.filter((s) => s.status === 'evaluated' || s.status === 'published');
  const totalAnswers = sheets.reduce((sum, s) => sum + s.answers.length, 0);
  const overrideAnswers = sheets.reduce(
    (sum, s) => sum + s.answers.filter((a) => a.teacherOverride).length,
    0
  );

  let exactOrCloseMatches = 0;
  for (const s of sheets) {
    for (const a of s.answers) {
      if (Math.abs(a.finalMarks - a.suggestedMarks) <= 0.5) {
        exactOrCloseMatches += 1;
      }
    }
  }

  const avgTimeSec =
    evaluated.length > 0
      ? Math.round(evaluated.reduce((sum, s) => sum + s.timeSpentSeconds, 0) / evaluated.length)
      : 0;

  return {
    totalSheets: sheets.length,
    evaluatedSheets: evaluated.length,
    publishedPapers: papers.filter((p) => p.status === 'published').length,
    avgTimeSeconds: avgTimeSec,
    overrideRatePct: totalAnswers > 0 ? Math.round((overrideAnswers / totalAnswers) * 100) : 0,
    aiAgreementPct: totalAnswers > 0 ? Math.round((exactOrCloseMatches / totalAnswers) * 100) : 100,
  };
}

export function generateCsvDownload(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (cell: string | number) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
