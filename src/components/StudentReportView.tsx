import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import {
  NormalizedQuestion,
  StudentReportData,
  PaperReportData,
} from './report/types';
import {
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Award,
  ListChecks,
  BarChart2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface StudentReportViewProps {
  sheetId: number | string;
  onBack?: () => void;
}

/**
 * Normalizes question numbers so "Q.1 (A) (i)" or "1 (A) (i)" always renders
 * with a single "Q.", preventing "QQ.1 (A) (i)" duplicate prefixes.
 */
export function formatQuestionNumber(qNo: string | number | undefined): string {
  if (qNo === undefined || qNo === null || qNo === '') return 'Q.1';
  let s = String(qNo).trim();
  s = s.replace(/^(q\.?)+/i, '').trim();
  return `Q.${s}`;
}

export const StudentReportView: React.FC<StudentReportViewProps> = ({
  sheetId,
}) => {
  const [state] = useSheetStore();

  const activeSheetId = String(sheetId || state.sheetId || '');

  // Tab switcher: 'questions' (Question-Wise Marks & Rubric) | 'analytics' (Analytics & Charts)
  const [activeTab, setActiveTab] = useState<'questions' | 'analytics'>('questions');
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  // Section filter
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  // Data fetching states
  const [studentReport, setStudentReport] = useState<StudentReportData | null>(null);
  const [reviewData, setReviewData] = useState<any | null>(null);
  const [paperReport, setPaperReport] = useState<PaperReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch Student Report
  const fetchStudentReport = useCallback(async (sId: string) => {
    if (!sId) return;
    try {
      const data = await apiClient.get<StudentReportData>(`/api/sheets/${sId}/report`);
      setStudentReport(data);
      return data;
    } catch (err: any) {
      console.error('Failed to fetch student report:', err);
      setErrorMessage(err.message || 'Failed to load student evaluation report');
      return null;
    }
  }, []);

  // 2. Fetch Review Data
  const fetchReviewData = useCallback(async (sId: string) => {
    if (!sId) return;
    try {
      const data = await apiClient.get<any>(`/api/sheets/${sId}/review`);
      setReviewData(data);
      return data;
    } catch (err: any) {
      console.warn('Failed to fetch review data:', err);
      return null;
    }
  }, []);

  // 3. Fetch Paper Reports (for cohort benchmark)
  const fetchPaperReports = useCallback(async (paperId: string) => {
    if (!paperId) return;
    try {
      const data = await apiClient.get<PaperReportData>(`/api/papers/${paperId}/reports`);
      setPaperReport(data);
      return data;
    } catch (err: any) {
      console.warn('Paper reports cohort data error:', err);
      return null;
    }
  }, []);

  // Initial and reactive load whenever activeSheetId changes
  useEffect(() => {
    let active = true;

    const loadAll = async () => {
      if (!activeSheetId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const [sRep, rev] = await Promise.all([
        fetchStudentReport(activeSheetId),
        fetchReviewData(activeSheetId),
      ]);

      if (!active) return;

      const pId = sRep?.paper_id || rev?.paper?.id || state.paperId;
      if (pId) {
        await fetchPaperReports(pId);
      }

      if (active) {
        setIsLoading(false);
      }
    };

    loadAll();

    return () => {
      active = false;
    };
  }, [activeSheetId, state.paperId, fetchStudentReport, fetchReviewData, fetchPaperReports]);

  // Normalize questions from review and report endpoints
  const normalizedQuestions: NormalizedQuestion[] = useMemo(() => {
    const evals = reviewData?.evaluations || [];
    const repQuestions = studentReport?.questions || [];

    if (evals.length > 0) {
      return evals.map((e: any, idx: number) => {
        const repMatch = repQuestions.find(
          (rq: any) => rq.question_id === e.question_id || rq.eval_id === e.eval_id
        );

        let parsedPages: number[] = [1];
        if (Array.isArray(e.page_numbers) && e.page_numbers.length > 0) {
          parsedPages = e.page_numbers.map((p: any) => {
            const num = parseInt(p, 10);
            return isNaN(num) ? 1 : num === 0 ? 1 : num;
          });
        }

        const rawQNo = e.q_no || e.question_key || repMatch?.q_no || `${idx + 1}`;
        const isCounted = e.is_counted !== undefined ? (e.is_counted !== 0 && e.is_counted !== false) : (repMatch?.is_counted !== undefined ? (repMatch.is_counted !== 0 && repMatch.is_counted !== false) : true);

        return {
          eval_id: e.eval_id || `eval_${idx}`,
          question_id: e.question_id || `q_${idx}`,
          question_key: e.key || e.question_key || `Q${idx + 1}`,
          q_no: rawQNo,
          question_text: e.text || e.question_text || repMatch?.question_text || `Question ${idx + 1}`,
          section_name: e.section_name || repMatch?.section_name || '',
          question_type: e.question_type || repMatch?.question_type || '',
          max_marks: e.max_marks ?? repMatch?.max_marks ?? 1,
          ai_marks: e.ai_marks ?? repMatch?.ai_marks,
          final_marks: e.final_marks ?? repMatch?.final_marks ?? 0,
          reason: e.reason || repMatch?.reason || '',
          evidence_quote: e.evidence_quote || repMatch?.evidence_quote || '',
          is_counted: isCounted,
          flags: Array.isArray(e.flags) ? e.flags : [],
          resolved: e.resolved ?? repMatch?.resolved ?? 1,
          strictness_used: e.strictness_used || reviewData?.paper?.strictness_level || studentReport?.paper_strictness || 3,
          page_numbers: parsedPages,
          bbox: e.bbox || e.bbox_json || repMatch?.bbox_json || null,
          ocr_text: e.ocr_text || e.extracted_text || repMatch?.extracted_text || '',
          legibility: 0.94,
          reference: e.reference || {
            source: 'Model Key',
            model_answer: e.model_answer || '',
            key_points: e.key_points || [],
          },
          verdicts: Array.isArray(e.verdicts) ? e.verdicts : [],
        };
      });
    }

    if (repQuestions.length > 0) {
      return repQuestions.map((rq: any, idx: number) => {
        const rawQNo = rq.q_no || rq.question_key || `${idx + 1}`;
        const isCounted = rq.is_counted !== undefined ? (rq.is_counted !== 0 && rq.is_counted !== false) : true;
        return {
          eval_id: rq.eval_id || `eval_${idx}`,
          question_id: rq.question_id || `q_${idx}`,
          question_key: rq.question_key || `Q${idx + 1}`,
          q_no: rawQNo,
          question_text: rq.question_text || `Question ${idx + 1}`,
          section_name: rq.section_name || '',
          question_type: rq.question_type || '',
          max_marks: rq.max_marks || 1,
          ai_marks: rq.ai_marks,
          final_marks: rq.final_marks || 0,
          reason: rq.reason || '',
          evidence_quote: rq.evidence_quote || '',
          is_counted: isCounted,
          flags: [],
          resolved: rq.resolved ?? 1,
          strictness_used: rq.strictness_used || studentReport?.paper_strictness || 3,
          page_numbers: [1],
          bbox: rq.bbox_json || null,
          ocr_text: rq.extracted_text || '',
          legibility: 0.94,
          reference: {
            source: 'Model Key',
            model_answer: '',
            key_points: [],
          },
          verdicts: [],
        };
      });
    }

    return [];
  }, [reviewData, studentReport]);

  // Section names list for filter
  const distinctSections = useMemo(() => {
    const set = new Set<string>();
    normalizedQuestions.forEach((q) => {
      if (q.section_name?.trim()) {
        set.add(q.section_name.trim());
      }
    });
    return Array.from(set);
  }, [normalizedQuestions]);

  // Filtered questions for tab 1
  const displayedQuestions = useMemo(() => {
    if (sectionFilter === 'all') return normalizedQuestions;
    return normalizedQuestions.filter(
      (q) => q.section_name?.trim().toLowerCase() === sectionFilter.trim().toLowerCase()
    );
  }, [normalizedQuestions, sectionFilter]);

  // Dynamic Sectional Performance Math:
  // ONLY sum questions where is_counted === true so max marks equals exactly the paper total!
  const sectionalBreakdown = useMemo(() => {
    const map = new Map<string, { earned: number; max: number; count: number; qLabels: string[] }>();
    normalizedQuestions.forEach((q) => {
      const isCounted = q.is_counted !== undefined ? Boolean(q.is_counted) : true;
      if (!isCounted) return; // Do not sum excluded/optional choice questions into section max marks!

      const sec = q.section_name?.trim() || 'General';
      const curr = map.get(sec) || { earned: 0, max: 0, count: 0, qLabels: [] };
      curr.earned += q.final_marks || 0;
      curr.max += q.max_marks || 0;
      curr.count += 1;
      curr.qLabels.push(formatQuestionNumber(q.q_no));
      map.set(sec, curr);
    });

    return Array.from(map.entries()).map(([name, data]) => {
      const pct = data.max > 0 ? (data.earned / data.max) * 100 : 0;
      return {
        name,
        earned: data.earned,
        max: data.max,
        count: data.count,
        pct,
        qLabels: data.qLabels,
      };
    });
  }, [normalizedQuestions]);

  // Candidate KPI Calculations
  const totalScore = studentReport?.total_score ?? reviewData?.sheet?.total_score ?? 0;
  const maxMarks = studentReport?.max_marks ?? reviewData?.sheet?.max_marks ?? 100;
  const percentage = studentReport?.percentage ?? (maxMarks > 0 ? (totalScore / maxMarks) * 100 : 0);
  const grade = studentReport?.grade || reviewData?.sheet?.grade || '—';
  const isPass = percentage >= 40;
  const totalLost = Math.max(0, maxMarks - totalScore);

  const studentName = studentReport?.student_name || reviewData?.sheet?.student_name || state.studentName || 'Student';
  const rollNumber = studentReport?.roll_number || reviewData?.sheet?.roll_number || state.rollNumber || '—';
  const className = studentReport?.class_name || reviewData?.sheet?.class_name || '';
  const examTitle = studentReport?.paper_title || reviewData?.paper?.title || state.paperTitle || 'Examination';
  const subject = studentReport?.subject || reviewData?.paper?.subject_domain || '';
  const strictnessLevel = studentReport?.paper_strictness || reviewData?.paper?.strictness_level || 3;

  // Toggle question detail accordion
  const toggleQuestionExpand = (qId: string) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  // Donut calculations
  const C_DONUT = 301.59;
  const scoredFraction = maxMarks > 0 ? totalScore / maxMarks : 0;
  const scoredDash = (scoredFraction * C_DONUT).toFixed(2);
  const lostFraction = maxMarks > 0 ? totalLost / maxMarks : 0;
  const lostDash = (lostFraction * C_DONUT).toFixed(2);

  return (
    <div className="w-full h-full overflow-y-auto bg-[#F6F7F5] dark:bg-[#111312] p-4 md:p-6 print:p-0 print:bg-white select-text">
      {isLoading ? (
        <div className="h-96 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#0F5132] dark:border-[#1F6E4A] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono font-medium text-[#6B7280] dark:text-[#68706C]">Loading official student report card...</span>
        </div>
      ) : errorMessage ? (
        <div className="h-96 flex flex-col items-center justify-center p-8 space-y-3 text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-[#2B191D] text-rose-600 dark:text-[#E57D8A] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <span className="text-rose-600 dark:text-[#E57D8A] font-bold text-sm">{errorMessage}</span>
          <button
            onClick={() => activeSheetId && fetchStudentReport(activeSheetId)}
            className="px-4 py-2 rounded-xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] text-xs font-semibold border border-[#0F5132]/20 dark:border-[#294236] hover:bg-[#d8eade] cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      ) : (
        <div className="max-w-[1280px] mx-auto space-y-5 print:max-w-none">
          {/* ==================================================================== */}
          {/* 1. CANDIDATE & RESULT HEADER CARD                                   */}
          {/* ==================================================================== */}
          <section className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-5 md:p-6 shadow-none flex flex-col lg:flex-row lg:items-center justify-between gap-6 print:border-none print:p-0">
            {/* Left: Candidate Information Strip */}
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] font-semibold text-[10px] uppercase tracking-wider border border-[#0F5132]/20 dark:border-[#294236]">
                  <Award className="w-3 h-3" />
                  <span>Official Statement of Marks &amp; Rubric Audit</span>
                </span>
                <span className="text-xs text-[#6B7280] dark:text-[#68706C] font-mono">
                  Sheet ID: {activeSheetId.slice(0, 8)}...
                </span>
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight">
                  {studentName}
                </h1>
                <div className="flex items-center gap-2 text-xs font-mono text-[#6B7280] dark:text-[#68706C] mt-1">
                  <span>Roll No:</span>
                  <strong className="text-[#111827] dark:text-[#ECEEED] font-semibold">{rollNumber}</strong>
                  {className && (
                    <>
                      <span>·</span>
                      <span>{className}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Assessment Meta Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <div className="px-3 py-1 rounded-lg bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] text-[#111827] dark:text-[#ECEEED] font-medium">
                  <strong>Exam:</strong> {examTitle}
                </div>
                {subject && (
                  <div className="px-3 py-1 rounded-lg bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] text-[#4B5563] dark:text-[#969E9A]">
                    <strong>Subject:</strong> {subject}
                  </div>
                )}
                <div className="px-3 py-1 rounded-lg bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] text-[#4B5563] dark:text-[#969E9A]">
                  <strong>Strictness:</strong> Level {strictnessLevel} / 5
                </div>
              </div>
            </div>

            {/* Right: Aggregate Score & Result Pill */}
            <div className="flex items-center gap-4 bg-[#F6F7F5] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-2xl p-4 md:p-5 shrink-0">
              {/* Circular SVG percentage indicator */}
              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" fill="transparent" r="48" stroke="#E2E8E4" strokeWidth="12" className="stroke-[#E2E8E4] dark:stroke-[#2A2F2C]" />
                  <circle
                    cx="60"
                    cy="60"
                    fill="transparent"
                    r="48"
                    stroke="#0F5132"
                    strokeDasharray={`${scoredDash} ${C_DONUT}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    strokeWidth="12"
                    className="stroke-[#0F5132] dark:stroke-[#1F6E4A]"
                  />
                </svg>
                <div className="absolute text-center flex flex-col items-center">
                  <span className="text-sm font-bold font-mono text-[#0F5132] dark:text-[#7CC9A3] leading-none">
                    {percentage.toFixed(1)}%
                  </span>
                  <span className="text-[9px] font-mono text-[#6B7280] dark:text-[#68706C] mt-0.5">Score</span>
                </div>
              </div>

              {/* Score numbers, Grade & PASS / RE-APPEAR pill */}
              <div className="space-y-1.5 font-mono">
                <div>
                  <div className="text-2xl font-bold text-[#111827] dark:text-[#ECEEED] leading-none">
                    {totalScore.toFixed(1)} <span className="text-sm font-normal text-[#6B7280] dark:text-[#68706C]">/ {maxMarks.toFixed(1)} M</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] text-xs font-bold text-[#111827] dark:text-[#ECEEED]">
                    Grade {grade}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                      isPass
                        ? 'bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-[#0F5132]/20 dark:border-[#294236]'
                        : 'bg-rose-100 dark:bg-[#2B191D] text-rose-800 dark:text-[#E57D8A] border border-rose-200 dark:border-[#45262C]'
                    }`}
                  >
                    {isPass ? 'PASS' : 'RE-APPEAR'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ==================================================================== */}
          {/* 2. FULL-WIDTH TAB SWITCHER                                           */}
          {/* ==================================================================== */}
          <div className="flex items-center justify-between border-b border-[#E2E8E4] dark:border-[#2A2F2C] pb-3 print:hidden">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('questions')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                  activeTab === 'questions'
                    ? 'bg-[#0F5132] text-white dark:bg-[#1F6E4A]'
                    : 'bg-[#F1F4F2] text-[#4B5563] hover:bg-[#E2E8E4] hover:text-[#111827] dark:bg-[#202422] dark:text-[#969E9A] dark:hover:bg-[#2A2F2C] dark:hover:text-[#ECEEED]'
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>Question-Wise Marks &amp; Rubric Feedback</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                  activeTab === 'analytics'
                    ? 'bg-[#0F5132] text-white dark:bg-[#1F6E4A]'
                    : 'bg-[#F1F4F2] text-[#4B5563] hover:bg-[#E2E8E4] hover:text-[#111827] dark:bg-[#202422] dark:text-[#969E9A] dark:hover:bg-[#2A2F2C] dark:hover:text-[#ECEEED]'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>Analytics &amp; Charts</span>
              </button>
            </div>

            {/* Right: Section Filter if on Tab 1 */}
            {activeTab === 'questions' && distinctSections.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#6B7280] dark:text-[#68706C]">Filter Section:</span>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="h-8 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg px-2.5 font-semibold text-[#111827] dark:text-[#ECEEED] focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Sections ({normalizedQuestions.length} Qs)</option>
                  {distinctSections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ==================================================================== */}
          {/* TAB 1: QUESTION-WISE MARKS & RUBRIC FEEDBACK                        */}
          {/* ==================================================================== */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl overflow-hidden shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F1F4F2] dark:bg-[#202422] border-b border-[#E2E8E4] dark:border-[#2F3532] text-[#4B5563] dark:text-[#969E9A] font-semibold">
                        <th className="py-3 px-4 w-28">Q. No.</th>
                        <th className="py-3 px-4 min-w-[220px]">Question / Criteria</th>
                        <th className="py-3 px-3 text-right w-20">Max</th>
                        <th className="py-3 px-3 text-right w-20">Awarded</th>
                        <th className="py-3 px-3 text-right w-16">%</th>
                        <th className="py-3 px-4 min-w-[280px]">Rubric Evaluation Remarks</th>
                        <th className="py-3 px-4 text-center w-28">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8E4] dark:divide-[#2A2F2C]">
                      {displayedQuestions.map((q) => {
                        const formattedQ = formatQuestionNumber(q.q_no);
                        const qMax = q.max_marks || 1;
                        const qEarned = q.final_marks || 0;
                        const pct = Math.min(100, Math.max(0, (qEarned / qMax) * 100));
                        const isCounted = q.is_counted !== undefined ? Boolean(q.is_counted) : true;
                        const isExpanded = Boolean(expandedQuestions[q.eval_id]);

                        let statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-[#0F5132]/20 dark:border-[#294236]">
                            Full Marks
                          </span>
                        );
                        if (!isCounted) {
                          statusBadge = (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-[#202422] text-[#6B7280] dark:text-[#68706C] border border-slate-200 dark:border-[#2F3532]">
                              Excluded Option
                            </span>
                          );
                        } else if (pct < 40) {
                          statusBadge = (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-[#2B191D] text-rose-700 dark:text-[#E57D8A] border border-rose-200 dark:border-[#45262C]">
                              Zero / Deduction
                            </span>
                          );
                        } else if (pct < 90) {
                          statusBadge = (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-[#2B2416] text-amber-800 dark:text-[#E5B567] border border-amber-200 dark:border-[#42361F]">
                              Partial Marks
                            </span>
                          );
                        }

                        return (
                          <React.Fragment key={q.eval_id}>
                            <tr
                              onClick={() => toggleQuestionExpand(q.eval_id)}
                              className={`hover:bg-[#F6F7F5] dark:hover:bg-[#202422] transition-colors cursor-pointer ${
                                !isCounted ? 'opacity-60 bg-slate-50/50 dark:bg-[#161817]' : ''
                              }`}
                            >
                              {/* Q. No. */}
                              <td className="py-3 px-4 font-mono font-bold text-[#111827] dark:text-[#ECEEED] whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#68706C]" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#68706C]" />
                                  )}
                                  <span>{formattedQ}</span>
                                </div>
                              </td>

                              {/* Question Prompt */}
                              <td className="py-3 px-4">
                                <div className="font-medium text-[#111827] dark:text-[#ECEEED] line-clamp-2">
                                  {q.question_text}
                                </div>
                                {q.section_name && (
                                  <span className="text-[10px] text-[#6B7280] dark:text-[#68706C] font-mono">
                                    {q.section_name}
                                  </span>
                                )}
                              </td>

                              {/* Max Marks */}
                              <td className="py-3 px-3 text-right font-mono text-[#6B7280] dark:text-[#68706C]">
                                {qMax.toFixed(1)}
                              </td>

                              {/* Awarded */}
                              <td className="py-3 px-3 text-right font-mono font-bold text-[#111827] dark:text-[#ECEEED]">
                                {qEarned.toFixed(1)}
                              </td>

                              {/* % */}
                              <td className="py-3 px-3 text-right font-mono text-[#4B5563] dark:text-[#969E9A]">
                                {Math.round(pct)}%
                              </td>

                              {/* Remarks */}
                              <td className="py-3 px-4 text-[#4B5563] dark:text-[#969E9A] leading-relaxed">
                                <div className="line-clamp-2">
                                  {q.reason || 'Graded accurately against rubric model answer key.'}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {statusBadge}
                              </td>
                            </tr>

                            {/* Expanded Details Row */}
                            {isExpanded && (
                              <tr className="bg-[#F8FAFC] dark:bg-[#151716] border-b border-[#E2E8E4] dark:border-[#2A2F2C]">
                                <td colSpan={7} className="p-4 space-y-3">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    {/* Student Transcription */}
                                    <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-xl p-3 space-y-1.5">
                                      <span className="font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider text-[10px]">
                                        Student Answer Extract (OCR):
                                      </span>
                                      <p className="text-[#4B5563] dark:text-[#969E9A] leading-relaxed font-mono text-[11px] bg-[#F1F4F2] dark:bg-[#202422] p-2.5 rounded-lg border border-[#E2E8E4] dark:border-[#2F3532] whitespace-pre-wrap">
                                        {q.ocr_text || 'No transcribed answer extract available for this item.'}
                                      </p>
                                    </div>

                                    {/* Evaluator Diagnostic Breakdown */}
                                    <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-xl p-3 space-y-1.5">
                                      <span className="font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider text-[10px]">
                                        Evaluation Verdict &amp; Evidence:
                                      </span>
                                      <div className="space-y-1.5">
                                        <p className="text-[#111827] dark:text-[#ECEEED] text-xs">
                                          {q.reason || 'Full points awarded according to standard rubric key.'}
                                        </p>
                                        {q.evidence_quote && (
                                          <div className="bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#0F5132]/20 dark:border-[#294236] p-2 rounded text-[11px] text-[#0F5132] dark:text-[#7CC9A3] italic">
                                            "{q.evidence_quote}"
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Grand Total Summary Bar */}
                <div className="bg-[#E8F3EE] dark:bg-[#1A2B23] border-t border-[#0F5132]/20 dark:border-[#294236] p-4 px-6 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-[#0F5132] dark:text-[#7CC9A3] uppercase tracking-wider text-sm font-sans">
                      Grand Total:
                    </span>
                    <span className="text-[#111827] dark:text-[#ECEEED]">
                      {normalizedQuestions.filter((q) => q.is_counted !== false).length} Counted Questions
                    </span>
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[#4B5563] dark:text-[#969E9A]">Aggregate Marks: </span>
                      <strong className="text-base font-bold text-[#111827] dark:text-[#ECEEED]">
                        {totalScore.toFixed(1)} / {maxMarks.toFixed(1)} M
                      </strong>
                    </div>

                    <div>
                      <span className="text-[#4B5563] dark:text-[#969E9A]">Score Percentage: </span>
                      <strong className="text-base font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                        {percentage.toFixed(1)}%
                      </strong>
                    </div>

                    <div className="flex items-center gap-1.5 font-sans">
                      <span className="px-2 py-0.5 rounded bg-white dark:bg-[#181B19] border border-[#0F5132]/20 dark:border-[#294236] font-bold text-xs text-[#111827] dark:text-[#ECEEED]">
                        Grade {grade}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#0F5132] dark:bg-[#1F6E4A] text-white font-bold text-xs">
                        {isPass ? 'PASS' : 'RE-APPEAR'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 2: ANALYTICS & CHARTS                                            */}
          {/* ==================================================================== */}
          {activeTab === 'analytics' && (
            <div className="space-y-5">
              {/* 2.1 Full-Width Question-by-Question Marks Bar Chart (Zero Clipping) */}
              <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-5 shadow-none space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED] flex items-center gap-2">
                      <span>Question-Wise Marks Telemetry</span>
                      <span className="text-xs font-mono font-normal text-[#6B7280] dark:text-[#68706C]">
                        ({normalizedQuestions.length} Total Evaluated Questions)
                      </span>
                    </h3>
                    <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
                      Bar heights represent marks obtained vs maximum marks with color-coded evaluation status.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#0F5132] dark:bg-[#1F6E4A]" />
                      <span className="text-[#4B5563] dark:text-[#969E9A]">Full Marks</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 dark:bg-[#E5B567]" />
                      <span className="text-[#4B5563] dark:text-[#969E9A]">Partial</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 dark:bg-[#E57D8A]" />
                      <span className="text-[#4B5563] dark:text-[#969E9A]">Zero / Deduction</span>
                    </span>
                  </div>
                </div>

                {/* Horizontal Scroll Bar Canvas so labels NEVER clip */}
                <div className="bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-4 overflow-x-auto scrollbar-thin">
                  <div
                    className="h-44 flex items-end gap-2 pt-6 pb-2 min-w-full"
                    style={{ minWidth: normalizedQuestions.length > 12 ? `${normalizedQuestions.length * 60}px` : '100%' }}
                  >
                    {normalizedQuestions.map((q, idx) => {
                      const formattedQ = formatQuestionNumber(q.q_no);
                      const qMax = q.max_marks || 1;
                      const qEarned = q.final_marks || 0;
                      const pct = Math.min(100, Math.max(0, (qEarned / qMax) * 100));
                      const isCounted = q.is_counted !== undefined ? Boolean(q.is_counted) : true;

                      let barColor = 'bg-[#0F5132] dark:bg-[#1F6E4A]';
                      if (!isCounted) {
                        barColor = 'bg-slate-400 dark:bg-[#68706C]';
                      } else if (pct < 40) {
                        barColor = 'bg-rose-500 dark:bg-[#E57D8A]';
                      } else if (pct < 90) {
                        barColor = 'bg-amber-500 dark:bg-[#E5B567]';
                      }

                      return (
                        <div
                          key={q.eval_id || idx}
                          className="flex-1 flex flex-col items-center justify-end h-full group"
                          title={`${formattedQ}: ${qEarned} / ${qMax} M (${Math.round(pct)}%)${!isCounted ? ' - Excluded option' : ''}`}
                        >
                          <div className="text-[10px] font-mono font-bold text-[#111827] dark:text-[#ECEEED] mb-1 opacity-80 group-hover:opacity-100">
                            {qEarned}/{qMax}
                          </div>
                          <div className="w-full max-w-[28px] h-full flex flex-col justify-end bg-[#E2E8E4] dark:bg-[#2A2F2C] rounded-t-md overflow-hidden">
                            <div
                              className={`w-full ${barColor} rounded-t-md transition-all duration-300`}
                              style={{ height: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-semibold text-[#4B5563] dark:text-[#969E9A] mt-1.5 truncate max-w-[55px] text-center" title={formattedQ}>
                            {formattedQ}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2.2 Sectional Performance Breakdown (Fixed Dynamic Math: Sums exactly to 54.0 M) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left Card: Sectional Breakdown */}
                <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-5 shadow-none space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED]">
                        Sectional Performance Breakdown
                      </h4>
                      <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
                        Dynamic sectional yields computed from active counted items (Total: {maxMarks.toFixed(1)} M).
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-[#0F5132] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] px-2.5 py-1 rounded-lg border border-[#0F5132]/20 dark:border-[#294236]">
                      {sectionalBreakdown.length} Sections
                    </span>
                  </div>

                  <div className="space-y-4 pt-1">
                    {sectionalBreakdown.map((sec, i) => {
                      const isHigh = sec.pct >= 80;
                      const isMid = sec.pct >= 50;
                      const barFill = isHigh
                        ? 'bg-[#0F5132] dark:bg-[#1F6E4A]'
                        : isMid
                        ? 'bg-amber-500 dark:bg-[#E5B567]'
                        : 'bg-rose-500 dark:bg-[#E57D8A]';

                      return (
                        <div key={i} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-[#111827] dark:text-[#ECEEED]">
                              {sec.name}
                            </span>
                            <div className="space-x-1.5 font-mono">
                              <span className="font-bold text-[#111827] dark:text-[#ECEEED]">
                                {sec.earned.toFixed(1)} / {sec.max.toFixed(1)} M
                              </span>
                              <span className="text-[#0F5132] dark:text-[#7CC9A3] font-semibold">
                                ({sec.pct.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-[#F1F4F2] dark:bg-[#202422] h-2.5 rounded-full overflow-hidden flex">
                            <div
                              className={`${barFill} h-full rounded-full transition-all duration-300`}
                              style={{ width: `${sec.pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-[#6B7280] dark:text-[#68706C] font-mono">
                            <span>{sec.qLabels.join(', ')}</span>
                            <span>{sec.count} Counted Items</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Card: Score Ratio Donut */}
                <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-5 shadow-none space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED]">
                        Total Marks Yield &amp; Deductions Split
                      </h4>
                      <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
                        Ratio between marks earned and marks lost across full examination.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-8 pt-2">
                    <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" fill="transparent" r="48" stroke="#F1F4F2" strokeWidth="14" className="stroke-[#F1F4F2] dark:stroke-[#202422]" />
                        <circle
                          cx="60"
                          cy="60"
                          fill="transparent"
                          r="48"
                          stroke="#0F5132"
                          strokeDasharray={`${scoredDash} ${C_DONUT}`}
                          strokeDashoffset="0"
                          strokeLinecap="round"
                          strokeWidth="14"
                          className="stroke-[#0F5132] dark:stroke-[#1F6E4A]"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          fill="transparent"
                          r="48"
                          stroke="#F43F5E"
                          strokeDasharray={`${lostDash} ${C_DONUT}`}
                          strokeDashoffset={`-${scoredDash}`}
                          strokeLinecap="round"
                          strokeWidth="14"
                          className="stroke-rose-500 dark:stroke-[#E57D8A]"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-xl font-mono font-bold text-[#111827] dark:text-[#ECEEED] leading-none">
                          {totalScore.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-mono text-[#6B7280] dark:text-[#68706C] mt-0.5">
                          / {maxMarks.toFixed(1)} M
                        </span>
                        <span className="text-[10px] font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs font-mono flex-1">
                      <div className="p-2.5 rounded-xl bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#0F5132]/20 dark:border-[#294236] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#0F5132] dark:bg-[#1F6E4A]" />
                          <span className="font-sans text-[#111827] dark:text-[#ECEEED] font-semibold">Marks Earned</span>
                        </div>
                        <span className="font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                          {totalScore.toFixed(1)} M ({percentage.toFixed(1)}%)
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-[#2B191D] border border-rose-200 dark:border-[#45262C] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 dark:bg-[#E57D8A]" />
                          <span className="font-sans text-[#111827] dark:text-[#ECEEED] font-semibold">Marks Lost</span>
                        </div>
                        <span className="font-bold text-rose-600 dark:text-[#E57D8A]">
                          {totalLost.toFixed(1)} M ({maxMarks > 0 ? ((totalLost / maxMarks) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
