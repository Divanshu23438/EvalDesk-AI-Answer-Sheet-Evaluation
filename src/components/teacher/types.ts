export type CheckingMode = 'strict' | 'lenient' | 'maths';
export type SetupStep = 'setup' | 'upload' | 'status' | 'review' | 'report' | 'library' | 'verify';

export const modeLabels: Record<CheckingMode, string> = {
  strict: 'Strict (Grammar & spelling count)',
  lenient: 'Lenient (Meaning counts, spelling ignored)',
  maths: 'Maths (Method marks + final answer)',
};

export function formatBytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const formatQNo = (qNo?: string | number): string => {
  if (!qNo) return '';
  const s = String(qNo).trim();
  const cleaned = s.replace(/^(?:Q\.?)+/i, '').trim();
  return `Q.${cleaned}`;
};

export interface SavedPaper {
  id: string;
  title: string;
  subject: string;
  total_marks: number;
  strictness: string;
  checking_medium: string;
  has_answer_key: number;
  is_locked: number;
  created_at: string;
}

export interface TrainingLine {
  id: string;
  sheet_id: string;
  line_index: number;
  image_path: string;
  ai_text: string;
  verified_text: string;
  provenance: string;
  is_sample: number;
  student_name?: string;
  roll_number?: string;
}

export interface UISectionRule {
  id?: string;
  name: string;
  instructions?: string;
  attempt_n: number;
  total_questions: number;
  marks_each: number;
  section_marks: number;
  policy: 'best_n' | 'first_n_answered';
}

export interface UIQuestion {
  key: string;
  q_no: string;
  question_text: string;
  max_marks: number;
  question_type: string;
  section_name: string;
  section_id?: string;
  options: string[];
  word_limit?: number;
}

export interface UIKeyPoint {
  text: string;
  marks: number;
  accept_if?: string;
  reject_if?: string;
}

export interface UIReferenceItem {
  id?: string;
  key: string;
  question_id?: string;
  model_answer: string;
  word_count?: number;
  key_points: UIKeyPoint[];
  accepted_alternatives?: string[];
  common_mistakes?: string[];
  correct_option?: string | null;
  confidence?: number;
  source?: string;
  disagreements?: string[];
}

export interface UISheetSummary {
  id: string;
  student_name: string;
  roll_number: string;
  status: string;
  total_score: number;
  max_marks: number;
  percentage: number;
  grade: string;
  unresolved_flags_count: number;
  total_flags_count: number;
  created_at: string;
}

export interface ReportData {
  paper_title?: string;
  total_students?: number;
  average_score?: number;
  max_marks?: number;
  excel_report_url?: string;
  paper_summary_pdf_url?: string;
  student_reports?: Array<{
    type: string;
    student_name: string;
    roll_number: string;
    url: string;
  }>;
}
