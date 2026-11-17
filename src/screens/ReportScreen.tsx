import React, { useState, useEffect, useCallback } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import {
  Award,
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Users,
  Target,
} from 'lucide-react';

interface QuestionReportItem {
  eval_id: string;
  question_id: string;
  question_key?: string;
  q_no: string | number;
  question_text: string;
  max_marks: number;
  section_name?: string;
  ai_marks?: number;
  final_marks: number;
  reason?: string;
  evidence_quote?: string;
  is_counted?: boolean | number;
  flags_json?: string;
  resolved?: boolean | number;
  is_overridden?: boolean | number;
  strictness_used?: number;
}

interface StudentReportData {
  sheet_id: string;
  paper_id: string;
  student_name: string;
  roll_number: string;
  paper_title: string;
  paper_strictness?: number;
  total_score: number;
  max_marks: number;
  percentage: number;
  grade: string;
  strengths: string[];
  improvements: string[];
  flagged_count: number;
  teacher_overridden_count: number;
  is_stale: boolean;
  questions: QuestionReportItem[];
  pdf_url?: string;
}

interface ScoreDistributionItem {
  range: string;
  label: string;
  count: number;
}

interface StrictnessDistributionItem {
  level: number;
  name: string;
  count: number;
}

interface QuestionStatItem {
  q_no: string | number;
  question_text: string;
  max_marks: number;
  avg_marks: number;
  accuracy_pct: number;
  miss_count: number;
  override_count: number;
}

interface PaperAnalytics {
  total_students: number;
  max_marks: number;
  average_score: number;
  average_percentage: number;
  flagged_count: number;
  override_count: number;
  flag_rate?: number;
  teacher_change_rate?: number;
  score_distribution?: ScoreDistributionItem[];
  strictness_distribution?: StrictnessDistributionItem[];
  paper_strictness?: number;
  is_single_sheet?: boolean;
}

interface PaperReportData {
  status: string;
  paper_id?: string;
  paper_title: string;
  total_students: number;
  average_score: number;
  max_marks: number;
  excel_report_url?: string;
  paper_summary_pdf_url?: string;
  analytics: PaperAnalytics;
  question_stats: QuestionStatItem[];
  most_missed_points: string[];
  suggestions: string[];
}

interface SheetListItem {
  id: string;
  student_name: string;
  roll: string;
  status: string;
}

export const ReportScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'student' | 'paper'>('student');
  const [state, store] = useSheetStore();

  const [studentReport, setStudentReport] = useState<StudentReportData | null>(null);
  const [paperReport, setPaperReport] = useState<PaperReportData | null>(null);
  const [allSheets, setAllSheets] = useState<SheetListItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load student report data
  const loadStudentReport = useCallback(async (sheetId: string) => {
    if (!sheetId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.get<StudentReportData>(`/api/sheets/${sheetId}/report`);
      setStudentReport(res);
      if (res.paper_id && !state.paperId) {
        store.setPaper({
          id: res.paper_id,
          title: res.paper_title,
          totalMarks: res.max_marks,
          questionCount: state.paperQuestionCount,
          isLocked: true,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load student report card');
    } finally {
      setIsLoading(false);
    }
  }, [state.paperId, state.paperQuestionCount, store]);

  // Load paper analytics data
  const loadPaperReport = useCallback(async (paperId: string) => {
    if (!paperId) return;
    try {
      const res = await apiClient.get<PaperReportData>(`/api/papers/${paperId}/reports`);
      setPaperReport(res);
    } catch (err: any) {
      // Paper report might be empty if 0 sheets
      console.warn('Paper report fetch error:', err.message);
    }
  }, []);

  // Load all sheets to feed "Next sheet"
  const loadPaperSheets = useCallback(async (paperId: string) => {
    if (!paperId) return;
    try {
      const res = await apiClient.get<{ sheets: SheetListItem[] }>(`/api/papers/${paperId}/sheets`);
      setAllSheets(res.sheets || []);
    } catch (err: any) {
      console.warn('Paper sheets fetch error:', err.message);
    }
  }, []);

  useEffect(() => {
    if (state.sheetId) {
      loadStudentReport(state.sheetId);
    }
  }, [state.sheetId, loadStudentReport]);

  useEffect(() => {
    const pId = state.paperId || studentReport?.paper_id;
    if (pId) {
      loadPaperReport(pId);
      loadPaperSheets(pId);
    }
  }, [state.paperId, studentReport?.paper_id, loadPaperReport, loadPaperSheets]);

  // Force regenerate
  const handleRegenerate = async () => {
    if (!state.sheetId) return;
    setIsRegenerating(true);
    try {
      const res = await apiClient.post<StudentReportData>(`/api/sheets/${state.sheetId}/report/regenerate`);
      setStudentReport(res);
      const pId = state.paperId || res.paper_id;
      if (pId) {
        await loadPaperReport(pId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to regenerate report');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Back to review
  const handleBackToReview = () => {
    if (state.sheetId) {
      store.setStep('evaluate');
      window.location.hash = `#/evaluate/${state.sheetId}`;
    } else {
      store.setStep('upload');
      window.location.hash = '#/upload';
    }
  };

  // Next sheet navigation
  const handleNextSheet = () => {
    if (!allSheets.length) {
      store.setStep('upload');
      window.location.hash = '#/upload';
      return;
    }
    // Find first sheet that is not evaluated or different from current
    const pendingSheet = allSheets.find((s) => s.id !== state.sheetId && s.status !== 'evaluated');
    const nextCandidate = pendingSheet || allSheets.find((s) => s.id !== state.sheetId);

    if (nextCandidate) {
      store.setSheet(nextCandidate.id, nextCandidate.student_name, nextCandidate.roll);
      if (nextCandidate.status === 'evaluated' || nextCandidate.status === 'needs_review') {
        store.setStep('evaluate', nextCandidate.id);
      } else {
        store.setStep('upload');
      }
    } else {
      // All sheets evaluated
      store.setStep('upload');
      window.location.hash = '#/upload';
    }
  };

  // Download handler
  const handleDownload = (url?: string, fallbackName?: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fallbackName || 'download';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Listen to custom window events from Shell ActionBar
  useEffect(() => {
    const onBack = () => handleBackToReview();
    const onNext = () => handleNextSheet();
    const onPdf = () => {
      if (activeTab === 'student') {
        handleDownload(studentReport?.pdf_url, `report_card_${studentReport?.roll_number || 'student'}.pdf`);
      } else {
        handleDownload(paperReport?.paper_summary_pdf_url, 'paper_summary.pdf');
      }
    };
    const onExcel = () => {
      handleDownload(paperReport?.excel_report_url, 'class_results.xlsx');
    };

    window.addEventListener('evaldesk:report:back-review', onBack);
    window.addEventListener('evaldesk:report:next-sheet', onNext);
    window.addEventListener('evaldesk:report:download-pdf', onPdf);
    window.addEventListener('evaldesk:report:download-excel', onExcel);

    return () => {
      window.removeEventListener('evaldesk:report:back-review', onBack);
      window.removeEventListener('evaldesk:report:next-sheet', onNext);
      window.removeEventListener('evaldesk:report:download-pdf', onPdf);
      window.removeEventListener('evaldesk:report:download-excel', onExcel);
    };
  }, [activeTab, studentReport, paperReport, allSheets]);

  // Clean grade color
  const getGradeBadge = (grade: string) => {
    const g = grade.trim().toUpperCase();
    if (g.startsWith('A')) {
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
    }
    if (g.startsWith('B')) {
      return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30';
    }
    if (g.startsWith('C')) {
      return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    }
    return 'bg-rose-500/10 text-rose-600 border-rose-500/30';
  };

  return (
    <section
      aria-label="Report View"
      className="panel h-full flex flex-col p-4 space-y-3 min-h-0 overflow-hidden select-none bg-[var(--surface-canvas)]"
    >
      {/* Sub-header Tabs & Download Actions */}
      <div className="flex flex-wrap items-center justify-between border-b border-[var(--surface-border)] pb-2.5 shrink-0 gap-2">
        <div role="tablist" aria-label="Report Views" className="flex items-center gap-1.5 bg-[var(--surface-subtle)] p-0.5 rounded-lg border border-[var(--surface-border)]">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'student'}
            onClick={() => setActiveTab('student')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'student'
                ? 'bg-[var(--surface-card)] text-[var(--accent-indigo)] shadow-sm'
                : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Student Report Card</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'paper'}
            onClick={() => setActiveTab('paper')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'paper'
                ? 'bg-[var(--surface-card)] text-[var(--accent-indigo)] shadow-sm'
                : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Paper Analytics</span>
          </button>
        </div>

        {/* Status / Stale Warning & Real Downloads */}
        <div className="flex items-center gap-2">
          {studentReport?.is_stale && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Marks edited after report generation</span>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="ml-1 px-1.5 py-0.5 rounded bg-amber-600 text-white text-[11px] font-semibold hover:bg-amber-700 transition flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
            </div>
          )}

          {activeTab === 'student' ? (
            <button
              type="button"
              onClick={() => handleDownload(studentReport?.pdf_url, `report_card_${studentReport?.roll_number || 'student'}.pdf`)}
              disabled={!studentReport?.pdf_url}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--surface-border)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] text-[var(--ink-primary)] transition inline-flex items-center gap-1.5 shadow-sm disabled:opacity-40"
              title="Download Student Report Card PDF"
            >
              <FileText className="w-3.5 h-3.5 text-rose-500" />
              <span>Student PDF</span>
              <Download className="w-3 h-3 text-[var(--ink-muted)]" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleDownload(paperReport?.paper_summary_pdf_url, 'paper_summary.pdf')}
                disabled={!paperReport?.paper_summary_pdf_url}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--surface-border)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] text-[var(--ink-primary)] transition inline-flex items-center gap-1.5 shadow-sm disabled:opacity-40"
                title="Download Paper Summary PDF"
              >
                <FileText className="w-3.5 h-3.5 text-rose-500" />
                <span>Paper PDF</span>
                <Download className="w-3 h-3 text-[var(--ink-muted)]" />
              </button>
              <button
                type="button"
                onClick={() => handleDownload(paperReport?.excel_report_url, 'class_results.xlsx')}
                disabled={!paperReport?.excel_report_url}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--surface-border)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] text-[var(--ink-primary)] transition inline-flex items-center gap-1.5 shadow-sm disabled:opacity-40"
                title="Download Class Results Excel Workbook"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Class Excel</span>
                <Download className="w-3 h-3 text-[var(--ink-muted)]" />
              </button>
            </>
          )}

          <div className="h-4 w-[1px] bg-[var(--surface-border)] mx-1" />

          <button
            type="button"
            onClick={handleBackToReview}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--surface-border)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] text-[var(--ink-secondary)] transition inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back to Review</span>
          </button>

          <button
            type="button"
            onClick={handleNextSheet}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--accent-indigo)] hover:bg-[var(--accent-indigo-hover)] text-white transition inline-flex items-center gap-1 shadow-sm"
          >
            <span>Next Sheet</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => state.sheetId && loadStudentReport(state.sheetId)}
            className="px-2 py-0.5 rounded bg-rose-600 text-white font-medium hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area: Zero-scroll two-column layout */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'student' ? (
          /* ================= STUDENT REPORT TAB ================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-full min-h-0">
            {/* Left Column: Academic Summary & T7 Feedback (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-3 h-full min-h-0">
              {/* Score & Grade KPI Card */}
              <div className="panel border border-[var(--surface-border)] rounded-xl bg-[var(--surface-card)] p-4 shadow-sm shrink-0">
                <div className="flex items-center justify-between mb-3 border-b border-[var(--surface-border)] pb-2.5">
                  <div>
                    <h2 className="text-base font-bold text-[var(--ink-primary)]">
                      {studentReport?.student_name || 'Student Evaluation'}
                    </h2>
                    <p className="text-xs text-[var(--ink-secondary)]">
                      {studentReport?.roll_number ? `Roll No: ${studentReport.roll_number}` : 'Identity verified'} ·{' '}
                      <span className="truncate">{studentReport?.paper_title}</span>
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${getGradeBadge(
                      studentReport?.grade || 'Needs Support'
                    )}`}
                  >
                    Grade {studentReport?.grade || 'N/A'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                    <span className="text-[11px] font-medium text-[var(--ink-muted)] block mb-0.5">
                      Total Score
                    </span>
                    <div className="text-xl font-bold text-[var(--ink-primary)] tabular-nums">
                      {studentReport ? `${studentReport.total_score} / ${studentReport.max_marks}` : '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                    <span className="text-[11px] font-medium text-[var(--ink-muted)] block mb-0.5">
                      Percentage
                    </span>
                    <div className="text-xl font-bold text-[var(--accent-indigo)] tabular-nums">
                      {studentReport ? `${studentReport.percentage}%` : '—'}
                    </div>
                  </div>
                </div>

                {/* Quality & Audit Metrics */}
                <div className="mt-3 pt-2.5 border-t border-[var(--surface-border)] flex items-center justify-between text-xs text-[var(--ink-secondary)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--status-approved)]" />
                    Verified Questions: {studentReport?.questions.length || 0}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--status-flagged)]" />
                    Teacher Overrides: {studentReport?.teacher_overridden_count || 0}
                  </span>
                </div>
              </div>

              {/* T7 Strengths & Areas to Improve Card (Internal Scroll) */}
              <div className="panel border border-[var(--surface-border)] rounded-xl bg-[var(--surface-card)] p-4 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-secondary)] mb-2.5 flex items-center gap-1.5 shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-indigo)]" />
                  <span>Pedagogical Synthesis (Task T7)</span>
                </h3>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                  {/* Strengths */}
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Key Mastered Competencies</span>
                    </h4>
                    <ul className="space-y-1.5 text-xs text-[var(--ink-primary)] leading-relaxed">
                      {studentReport?.strengths && studentReport.strengths.length > 0 ? (
                        studentReport.strengths.map((str, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-500 font-bold shrink-0">•</span>
                            <span>{str}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-[var(--ink-muted)]">
                          Demonstrated clear foundational understanding on attempted questions.
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Areas to Improve */}
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Actionable Areas for Improvement</span>
                    </h4>
                    <ul className="space-y-1.5 text-xs text-[var(--ink-primary)] leading-relaxed">
                      {studentReport?.improvements && studentReport.improvements.length > 0 ? (
                        studentReport.improvements.map((imp, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-500 font-bold shrink-0">•</span>
                            <span>{imp}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-[var(--ink-muted)]">
                          Consistent mastery across criteria; continue refining technical precision.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Per-Question Marks Chart & Table (7 cols) */}
            <div className="lg:col-span-7 panel border border-[var(--surface-border)] rounded-xl bg-[var(--surface-card)] p-4 shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-secondary)] flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-indigo)]" />
                  <span>Question-by-Question Evaluation Breakdown</span>
                </h3>
                <span className="text-[11px] text-[var(--ink-muted)]">
                  {studentReport?.questions.length || 0} Questions Evaluated
                </span>
              </div>

              {/* Mini visual marks bar chart */}
              <div className="mb-3.5 p-3 rounded-lg bg-[var(--surface-subtle)] border border-[var(--surface-border)] shrink-0">
                <div className="text-[11px] font-semibold text-[var(--ink-secondary)] mb-2">
                  Score Distribution by Question
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 gap-1.5 items-end h-16">
                  {studentReport?.questions.map((q, idx) => {
                    const maxM = q.max_marks || 1;
                    const score = q.final_marks || 0;
                    const pct = Math.min(100, Math.max(0, (score / maxM) * 100));
                    const isOptional = q.is_counted === false || q.is_counted === 0;

                    let barColor = 'bg-[var(--accent-indigo)]';
                    if (isOptional) barColor = 'bg-slate-300 dark:bg-slate-600';
                    else if (pct >= 80) barColor = 'bg-emerald-500';
                    else if (pct > 0) barColor = 'bg-indigo-500';
                    else barColor = 'bg-rose-400';

                    return (
                      <div
                        key={q.eval_id || idx}
                        className="flex flex-col items-center h-full justify-end group relative"
                      >
                        <div
                          className={`w-full rounded-t transition-all duration-300 ${barColor}`}
                          style={{ height: `${Math.max(6, pct)}%` }}
                        />
                        <span className="text-[9px] text-[var(--ink-muted)] font-mono mt-1 truncate max-w-full">
                          {String(q.q_no).replace(/^[Qq]\.?\s*/, '')}
                        </span>

                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-1 hidden group-hover:block z-30 p-1.5 rounded bg-slate-900 text-white text-[10px] whitespace-nowrap shadow-md pointer-events-none">
                          <span className="font-bold">Q.{q.q_no}:</span> {score} / {maxM}M
                          {isOptional && ' (Optional)'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scrollable Questions Table */}
              <div className="flex-1 min-h-0 overflow-y-auto border border-[var(--surface-border)] rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[var(--surface-subtle)] sticky top-0 z-10 border-b border-[var(--surface-border)]">
                    <tr>
                      <th className="py-2 px-3 font-semibold text-[var(--ink-primary)] w-16">Q #</th>
                      <th className="py-2 px-3 font-semibold text-[var(--ink-primary)]">Question</th>
                      <th className="py-2 px-3 font-semibold text-[var(--ink-primary)] w-20 text-center">Max</th>
                      <th className="py-2 px-3 font-semibold text-[var(--ink-primary)] w-24 text-center">Awarded</th>
                      <th className="py-2 px-3 font-semibold text-[var(--ink-primary)] w-24 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {studentReport?.questions.map((q, idx) => {
                      const isOptional = q.is_counted === false || q.is_counted === 0;
                      return (
                        <tr
                          key={q.eval_id || idx}
                          className="hover:bg-[var(--surface-hover)] transition"
                        >
                          <td className="py-2.5 px-3 font-bold text-[var(--ink-primary)] font-mono">
                            <div className="flex items-center gap-1">
                              <span>Q.{String(q.q_no).replace(/^[Qq]\.?\s*/, '')}</span>
                              {q.strictness_used && studentReport?.paper_strictness && q.strictness_used !== studentReport.paper_strictness && (
                                <span
                                  className="px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-100 text-purple-700"
                                  title={`Strictness Override: Level ${q.strictness_used}/5 (Paper is Level ${studentReport.paper_strictness})`}
                                >
                                  S.{q.strictness_used}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-[var(--ink-primary)]">
                            <div className="line-clamp-2 leading-relaxed" title={q.question_text}>
                              {q.question_text}
                            </div>
                            {q.reason && (
                              <div className="text-[11px] text-[var(--ink-muted)] mt-0.5 line-clamp-1 italic">
                                {q.reason}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center text-[var(--ink-muted)] font-mono">
                            {q.max_marks}M
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-[var(--ink-primary)] font-mono">
                            {q.final_marks}M
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isOptional ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                Optional
                              </span>
                            ) : q.is_overridden ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                Overridden
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                Checked ✓
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* ================= PAPER ANALYTICS TAB ================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-full min-h-0">
            {/* Left Column: Class KPI & Distribution (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-3 h-full min-h-0">
              {/* Class KPI Card */}
              <div className="panel border border-[var(--surface-border)] rounded-xl bg-[var(--surface-card)] p-4 shadow-sm shrink-0">
                <div className="flex items-center justify-between mb-3 border-b border-[var(--surface-border)] pb-2.5">
                  <div>
                    <h2 className="text-base font-bold text-[var(--ink-primary)]">
                      Class Assessment Analytics
                    </h2>
                    <p className="text-xs text-[var(--ink-secondary)]">
                      {paperReport?.total_students
                        ? `Based on ${paperReport.total_students} evaluated sheet${
                            paperReport.total_students > 1 ? 's' : ''
                          }`
                        : 'No submissions evaluated yet'}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--accent-indigo-subtle)] text-[var(--accent-indigo)] flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{paperReport?.total_students || 0} Submissions</span>
                  </span>
                </div>

                {paperReport?.analytics?.is_single_sheet && (
                  <div className="mb-3 p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 text-xs flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 shrink-0" />
                    <span>Based on 1 sheet. Add more sheets to see comparative class statistics.</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                    <span className="text-[11px] font-medium text-[var(--ink-muted)] block mb-0.5">
                      Class Average Score
                    </span>
                    <div className="text-xl font-bold text-[var(--ink-primary)] tabular-nums">
                      {paperReport?.average_score !== undefined
                        ? `${paperReport.average_score} / ${paperReport.max_marks}`
                        : '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                    <span className="text-[11px] font-medium text-[var(--ink-muted)] block mb-0.5">
                      Class Average %
                    </span>
                    <div className="text-xl font-bold text-[var(--accent-indigo)] tabular-nums">
                      {paperReport?.analytics?.average_percentage !== undefined
                        ? `${paperReport.analytics.average_percentage}%`
                        : '—'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[var(--surface-border)] grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                    <span className="text-[10px] text-[var(--ink-muted)] block">Flag Rate</span>
                    <span className="font-bold text-[var(--status-flagged)]">
                      {paperReport?.analytics?.flag_rate !== undefined
                        ? `${paperReport.analytics.flag_rate}%`
                        : '0%'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                    <span className="text-[10px] text-[var(--ink-muted)] block">Teacher Override Rate</span>
                    <span className="font-bold text-[var(--accent-indigo)]">
                      {paperReport?.analytics?.teacher_change_rate !== undefined
                        ? `${paperReport.analytics.teacher_change_rate}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Score Distribution Card (Internal Scroll) */}
              <div className="panel border border-[var(--surface-border)] rounded-xl bg-[var(--surface-card)] p-4 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-secondary)] mb-2.5 flex items-center gap-1.5 shrink-0">
                  <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-indigo)]" />
                  <span>Score Cohort Distribution</span>
                </h3>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                  {paperReport?.analytics?.score_distribution &&
                  paperReport.analytics.score_distribution.length > 0 ? (
                    paperReport.analytics.score_distribution.map((cohort, idx) => {
                      const totalSt = paperReport.total_students || 1;
                      const pct = Math.round((cohort.count / totalSt) * 100);
                      return (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--surface-border)] space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[var(--ink-primary)]">
                              {cohort.range}{' '}
                              <span className="text-[var(--ink-muted)] font-normal">
                                ({cohort.label})
                              </span>
                            </span>
                            <span className="font-mono text-[var(--ink-primary)]">
                              {cohort.count} students ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[var(--surface-border)] overflow-hidden">
                            <div
                              className="h-full bg-[var(--accent-indigo)] rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-[var(--ink-muted)] text-center py-6">
                      Add more student sheets to populate score distribution cohorts.
                    </div>
                  )}
                </div>
              </div>

              {/* Strictness Level Distribution Card */}
              {paperReport?.analytics?.strictness_distribution && (
                <div className="panel border border-[var(--surface-border)] rounded-xl bg-[var(--surface-card)] p-3.5 shadow-sm shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-secondary)] flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-[var(--accent-indigo)]" />
                      <span>Strictness Distribution</span>
                    </h3>
                    <span className="text-[10px] text-[var(--ink-muted)] font-mono">
                      Standard: L.{paperReport.analytics.paper_strictness || 3}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    {paperReport.analytics.strictness_distribution.map((item) => (
                      <div key={item.level} className="p-1.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--surface-border)]">
                        <span className="text-[10px] font-bold block text-[var(--ink-secondary)]">L.{item.level}</span>
                        <span className="text-xs font-bold text-[var(--ink-primary)] block font-mono">{item.count}</span>
                        <span className="text-[8px] text-[var(--ink-muted)] truncate block">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Question Stats & Pedagogical Feedback (7 cols) */}
            <div className="lg:col-span-7 panel border border-[var(--surface-border)] rounded-xl bg-[var(--surface-card)] p-4 shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-secondary)] flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[var(--accent-indigo)]" />
                  <span>Class-Wide Question Accuracy & Deficits</span>
                </h3>
              </div>

              {/* Scrollable Questions Stats Table */}
              <div className="h-56 min-h-0 overflow-y-auto border border-[var(--surface-border)] rounded-lg shrink-0 mb-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[var(--surface-subtle)] sticky top-0 z-10 border-b border-[var(--surface-border)]">
                    <tr>
                      <th className="py-2 px-3 font-semibold text-[var(--ink-primary)] w-16">Q #</th>
                      <th className="py-2 px-3 font-semibold text-[var(--ink-primary)]">Question</th>
                      <th className="py-2 px-3 font-semibold text-[var(--ink-primary)] w-16 text-center">Max</th>
                      <th className="py-2 px-3 font-semibold text-[var(--ink-primary)] w-20 text-center">Avg</th>
                      <th className="py-2 px-3 font-semibold text-[var(--ink-primary)] w-20 text-center">Accuracy</th>
                      <th className="py-2 px-3 font-semibold text-[var(--ink-primary)] w-16 text-right">Missed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {paperReport?.question_stats && paperReport.question_stats.length > 0 ? (
                      paperReport.question_stats.map((stat, idx) => (
                        <tr key={idx} className="hover:bg-[var(--surface-hover)] transition">
                          <td className="py-2 px-3 font-bold text-[var(--ink-primary)] font-mono">
                            Q.{String(stat.q_no).replace(/^[Qq]\.?\s*/, '')}
                          </td>
                          <td className="py-2 px-3 text-[var(--ink-primary)]">
                            <div className="line-clamp-1" title={stat.question_text}>
                              {stat.question_text}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center text-[var(--ink-muted)] font-mono">
                            {stat.max_marks}M
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-[var(--ink-primary)] font-mono">
                            {stat.avg_marks}M
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                stat.accuracy_pct >= 75
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : stat.accuracy_pct >= 50
                                  ? 'bg-indigo-500/10 text-indigo-600'
                                  : 'bg-rose-500/10 text-rose-600'
                              }`}
                            >
                              {stat.accuracy_pct}%
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--ink-secondary)]">
                            {stat.miss_count}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[var(--ink-muted)]">
                          No question statistics generated yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Most-Missed Points & Paper Suggestions (Internal Scroll) */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                {/* Most-Missed Key Points */}
                <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                  <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400 mb-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Most-Missed Rubric Key Points Across Class</span>
                  </h4>
                  <ul className="space-y-1 text-xs text-[var(--ink-primary)]">
                    {paperReport?.most_missed_points && paperReport.most_missed_points.length > 0 ? (
                      paperReport.most_missed_points.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-rose-500 font-bold shrink-0">•</span>
                          <span>{pt}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[var(--ink-muted)]">
                        No widespread key-point deficits identified across student submissions.
                      </li>
                    )}
                  </ul>
                </div>

                {/* Suggestions to Improve Future Question Papers */}
                <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                  <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-1.5 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Paper Improvement Suggestions</span>
                  </h4>
                  <ul className="space-y-1 text-xs text-[var(--ink-primary)]">
                    {paperReport?.suggestions && paperReport.suggestions.length > 0 ? (
                      paperReport.suggestions.map((sug, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-indigo-500 font-bold shrink-0">•</span>
                          <span>{sug}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[var(--ink-muted)]">
                        Maintain clear sub-part demarcation and explicit mark weighting in instructions.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
