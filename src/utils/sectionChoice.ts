export interface PaperSectionRule {
  section_name: string;
  instructions?: string;
  attempt_limit: number;
  total_questions?: number;
  marks_per_question: number;
  section_max_marks: number;
}

export interface GeneratedAnswerKeyItem {
  q_no: string;
  section_name?: string;
  model_answer: string;
  key_points: string[];
  max_marks: number;
}

export interface GeneratedAnswerKey {
  paper_title?: string;
  paper_max_marks: number;
  sections: PaperSectionRule[];
  questions: GeneratedAnswerKeyItem[];
}

export interface EvaluatedReviewItem {
  eval_id?: string;
  question_id?: string;
  q_no: string;
  question_key?: string;
  question_text?: string;
  section_name?: string;
  transcribed_text: string;
  diagram_notes: string;
  confidence: 'high' | 'medium' | 'low';
  suggested_marks?: number;
  finalMarks: number;
  max_marks: number;
  feedback?: string;
  reason: string;
  resolved: boolean;
  attempted: boolean;
  isCounted: boolean;
  statusLabel: string;
  evidence_quote?: string;
  page_numbers?: number[];
  bbox_json?: any;
  model_answer?: string;
  key_points?: Array<{ text: string; marks: number; accept_if?: string; reject_if?: string }>;
  flags?: string[];
  teacher_override_reason?: string;
}

export interface SectionRuleSummary {
  section_name: string;
  instructions: string;
  attempt_limit: number;
  total_questions: number;
  marks_per_question: number;
  section_max_marks: number;
  attempted_count: number;
  counted_count: number;
  section_score: number;
  items: EvaluatedReviewItem[];
}

export interface EvaluatedPaperSummary {
  totalScore: number;
  paperMaxMarks: number;
  percentage: number;
  grade: string;
  sections: SectionRuleSummary[];
  reviewItems: EvaluatedReviewItem[];
}

export function normalizeQuestionKey(qNo: string): string {
  return qNo
    .toLowerCase()
    .replace(/^(question|ans|answer|q)[\s.:_-]*/i, '')
    .replace(/[^\w]/g, '')
    .trim();
}

export function matchQuestionNumbers(a: string, b: string): boolean {
  const normA = normalizeQuestionKey(a);
  const normB = normalizeQuestionKey(b);
  if (normA === normB) return true;

  // Normalize roman numerals (i, ii, iii, iv, v, vi, vii, viii, ix, x)
  const normalizeRoman = (str: string) => {
    return str
      .replace(/viii/g, '8')
      .replace(/vii/g, '7')
      .replace(/iii/g, '3')
      .replace(/iv/g, '4')
      .replace(/ix/g, '9')
      .replace(/vi/g, '6')
      .replace(/ii/g, '2')
      .replace(/v/g, '5')
      .replace(/x/g, '10')
      .replace(/i/g, '1');
  };

  return normalizeRoman(normA) === normalizeRoman(normB);
}

export function applySectionChoiceRules(
  answerKey: GeneratedAnswerKey,
  evaluatedQuestions: Array<{
    q_no: string;
    transcribed_text?: string;
    diagram_notes?: string;
    confidence?: 'high' | 'medium' | 'low';
    suggested_marks?: number;
    max_marks?: number;
    feedback?: string;
  }>
): EvaluatedPaperSummary {
  const answerKeyQuestions = answerKey?.questions || [];
  const sections = answerKey?.sections || [];

  const matchedStudentIndices = new Set<number>();

  const findStudentMatch = (targetQNo: string): { question: typeof evaluatedQuestions[0]; index: number } | null => {
    for (let i = 0; i < evaluatedQuestions.length; i++) {
      if (!matchedStudentIndices.has(i) && matchQuestionNumbers(targetQNo, evaluatedQuestions[i].q_no)) {
        return { question: evaluatedQuestions[i], index: i };
      }
    }
    for (let i = 0; i < evaluatedQuestions.length; i++) {
      if (matchQuestionNumbers(targetQNo, evaluatedQuestions[i].q_no)) {
        return { question: evaluatedQuestions[i], index: i };
      }
    }
    return null;
  };

  const sectionMap = new Map<string, GeneratedAnswerKeyItem[]>();

  if (sections.length > 0) {
    for (const sec of sections) {
      sectionMap.set(sec.section_name, []);
    }
    for (const q of answerKeyQuestions) {
      const secName = q.section_name || sections[0].section_name;
      if (!sectionMap.has(secName)) {
        sectionMap.set(secName, []);
      }
      sectionMap.get(secName)!.push(q);
    }
  } else {
    sectionMap.set('All Questions', answerKeyQuestions);
  }

  const sectionSummaries: SectionRuleSummary[] = [];
  const allReviewItems: EvaluatedReviewItem[] = [];

  for (const [secName, qList] of sectionMap.entries()) {
    const secRule = sections.find((s) => s.section_name.toLowerCase() === secName.toLowerCase());
    const attempt_limit = secRule ? secRule.attempt_limit : qList.length;
    const marks_per_question = secRule ? secRule.marks_per_question : (qList[0]?.max_marks || 1);
    const section_max_marks = secRule ? secRule.section_max_marks : (attempt_limit * marks_per_question);

    const sectionItems: EvaluatedReviewItem[] = [];

    for (const keyQ of qList) {
      const match = findStudentMatch(keyQ.q_no);
      if (match) {
        matchedStudentIndices.add(match.index);
        const sq = match.question;
        const hasContent = Boolean(sq.transcribed_text?.trim() || sq.diagram_notes?.trim());
        const suggestedMarks = typeof sq.suggested_marks === 'number' ? sq.suggested_marks : 0;
        const reason =
          sq.confidence !== 'high'
            ? 'Low OCR confidence'
            : sq.diagram_notes
            ? 'Diagram or equation needs teacher verification'
            : !hasContent
            ? 'Blank or ambiguous answer'
            : '';

        sectionItems.push({
          q_no: keyQ.q_no,
          section_name: secName,
          transcribed_text: sq.transcribed_text || '',
          diagram_notes: sq.diagram_notes || '',
          confidence: sq.confidence || 'medium',
          suggested_marks: suggestedMarks,
          max_marks: keyQ.max_marks,
          feedback: sq.feedback || '',
          reason,
          finalMarks: suggestedMarks,
          resolved: !reason,
          attempted: hasContent || suggestedMarks > 0,
          isCounted: false,
          statusLabel: 'Pending',
        });
      } else {
        sectionItems.push({
          q_no: keyQ.q_no,
          section_name: secName,
          transcribed_text: '',
          diagram_notes: '',
          confidence: 'high',
          suggested_marks: 0,
          max_marks: keyQ.max_marks,
          feedback: 'Question not attempted by student.',
          reason: '',
          finalMarks: 0,
          resolved: true,
          attempted: false,
          isCounted: false,
          statusLabel: 'Optional — Not Attempted',
        });
      }
    }

    const attemptedItems = sectionItems.filter((item) => item.attempted);
    const unattemptedItems = sectionItems.filter((item) => !item.attempted);
    const isChoiceSection = qList.length > attempt_limit;

    if (isChoiceSection) {
      for (const item of unattemptedItems) {
        item.isCounted = false;
        item.finalMarks = 0;
        item.statusLabel = 'Optional — Not Attempted';
        item.reason = '';
        item.resolved = true;
      }

      attemptedItems.sort((a, b) => b.finalMarks - a.finalMarks);

      for (let i = 0; i < attemptedItems.length; i++) {
        const item = attemptedItems[i];
        if (i < attempt_limit) {
          item.isCounted = true;
          item.statusLabel = item.resolved ? 'Auto-Verified' : 'Reviewed';
        } else {
          item.isCounted = false;
          item.statusLabel = 'Optional / Extra — Not Counted';
          item.reason = `Extra question attempted beyond section limit of ${attempt_limit}; top ${attempt_limit} scores counted`;
          item.resolved = true;
        }
      }
    } else {
      for (const item of attemptedItems) {
        item.isCounted = true;
        item.statusLabel = item.resolved ? 'Auto-Verified' : 'Reviewed';
      }
      for (const item of unattemptedItems) {
        item.isCounted = true;
        item.finalMarks = 0;
        item.statusLabel = 'Unattempted (0 Marks)';
        item.reason = 'Compulsory question not attempted';
        item.resolved = true;
      }
    }

    const countedItems = sectionItems.filter((item) => item.isCounted);
    const rawSectionScore = countedItems.reduce((sum, item) => sum + item.finalMarks, 0);
    const sectionScore = Math.min(section_max_marks, rawSectionScore);

    sectionSummaries.push({
      section_name: secName,
      instructions: secRule?.instructions || (isChoiceSection ? `Attempt any ${attempt_limit} of ${qList.length}` : 'All compulsory'),
      attempt_limit,
      total_questions: qList.length,
      marks_per_question,
      section_max_marks,
      attempted_count: attemptedItems.length,
      counted_count: countedItems.length,
      section_score: sectionScore,
      items: sectionItems,
    });

    allReviewItems.push(...sectionItems);
  }

  evaluatedQuestions.forEach((sq, idx) => {
    if (!matchedStudentIndices.has(idx)) {
      allReviewItems.push({
        q_no: sq.q_no,
        transcribed_text: sq.transcribed_text || '',
        diagram_notes: sq.diagram_notes || '',
        confidence: sq.confidence || 'low',
        suggested_marks: sq.suggested_marks ?? 0,
        finalMarks: sq.suggested_marks ?? 0,
        max_marks: sq.max_marks ?? 5,
        feedback: sq.feedback || '',
        reason: 'Unmapped question from answer sheet',
        resolved: false,
        attempted: true,
        isCounted: false,
        statusLabel: 'Extra / Unmapped Question',
      });
    }
  });

  const totalScore = sectionSummaries.reduce((sum, s) => sum + s.section_score, 0);
  let paperMaxMarks = answerKey.paper_max_marks || 0;
  if (!paperMaxMarks) {
    paperMaxMarks = sectionSummaries.reduce((sum, s) => sum + s.section_max_marks, 0);
  }
  if (!paperMaxMarks) {
    paperMaxMarks = 60;
  }

  const percentage = Math.min(100, Math.round((totalScore / paperMaxMarks) * 100));
  const grade =
    percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : 'Needs support';

  return {
    totalScore,
    paperMaxMarks,
    percentage,
    grade,
    sections: sectionSummaries,
    reviewItems: allReviewItems,
  };
}
