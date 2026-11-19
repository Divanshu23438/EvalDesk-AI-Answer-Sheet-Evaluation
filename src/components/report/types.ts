export interface NormalizedQuestion {
  eval_id: string;
  question_id: string;
  question_key?: string;
  q_no: string | number;
  question_text: string;
  section_name?: string;
  question_type?: string;
  max_marks: number;
  ai_marks?: number;
  final_marks: number;
  reason?: string;
  evidence_quote?: string;
  is_counted?: boolean;
  flags: Array<{
    code?: string;
    name?: string;
    severity?: string;
    message?: string;
    reason?: string;
  }>;
  resolved?: boolean | number;
  strictness_used: number;
  page_numbers: number[];
  bbox?: any;
  ocr_text: string;
  legibility: number;
  reference?: {
    source?: string;
    model_answer?: string;
    key_points?: any[];
    correct_option?: string | null;
  };
  verdicts: Array<{
    index?: number;
    text?: string;
    point?: string;
    marks_available?: number;
    marks_awarded?: number;
    verdict?: string;
    quote?: string;
    reason?: string;
  }>;
}

export interface StudentReportData {
  sheet_id: string;
  paper_id: string;
  student_name: string;
  roll_number: string;
  paper_title: string;
  paper_strictness?: number;
  class_name?: string;
  subject?: string;
  total_score: number;
  max_marks: number;
  percentage: number;
  grade: string;
  strengths: string[];
  improvements: string[];
  flagged_count: number;
  teacher_overridden_count: number;
  is_stale: boolean;
  pdf_url?: string;
  questions: any[];
}

export interface PaperAnalytics {
  total_students: number;
  max_marks: number;
  average_score: number;
  average_percentage: number;
  flagged_count: number;
  override_count: number;
  flag_rate?: number;
  teacher_change_rate?: number;
  score_distribution?: Array<{ range: string; label: string; count: number }>;
  strictness_distribution?: Array<{ level: number; name: string; count: number }>;
  paper_strictness?: number;
  is_single_sheet?: boolean;
}

export interface PaperReportData {
  status: string;
  paper_id?: string;
  paper_title: string;
  total_students: number;
  average_score: number;
  max_marks: number;
  excel_report_url?: string;
  paper_summary_pdf_url?: string;
  analytics: PaperAnalytics;
  question_stats: Array<{
    q_no: string | number;
    question_text: string;
    max_marks: number;
    avg_marks: number;
    accuracy_pct: number;
    miss_count: number;
    override_count: number;
  }>;
  most_missed_points: string[];
  suggestions: string[];
}

export interface SheetListItem {
  id: string;
  filename?: string;
  student_name: string;
  roll: string;
  status: string;
  stage?: string;
  page_count?: number;
}
