import React, { useEffect, useState } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import {
  FileCheck2,
  AlertTriangle,
  Award,
  ScanText,
  BookOpen,
  Plus,
  ArrowRight,
  TrendingUp,
  BarChart2,
  Clock,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

interface DashboardSummary {
  total_evaluated: number;
  needs_review_count: number;
  avg_score_pct: number;
  avg_ocr_confidence: number;
  total_papers: number;
  subject_performance: Array<{
    subject: string;
    exam_count: number;
    sheets_count: number;
    avg_pct: number;
  }>;
  score_distribution: {
    high: number;
    average: number;
    needs_attention: number;
  };
  evaluation_history_trend: Array<{
    date: string;
    count: number;
    avg_pct: number;
  }>;
  recent_sheets: Array<{
    sheet_id: string;
    student_name: string;
    roll_number: string;
    class_name: string;
    subject: string;
    exam_title: string;
    score: number;
    max_marks: number;
    percentage: number;
    grade: string;
    status: string;
    updated_at: string;
  }>;
}

function getDynamicGreeting(): { greeting: string; dateStr: string } {
  const now = new Date();
  const hour = now.getHours();
  let greeting: string;
  if (hour < 12) {
    greeting = 'Good morning';
  } else if (hour < 17) {
    greeting = 'Good afternoon';
  } else {
    greeting = 'Good evening';
  }
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return { greeting, dateStr };
}

export const DashboardScreen: React.FC = () => {
  const [, store] = useSheetStore();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const fetchSummary = async () => {
      try {
        setIsLoading(true);
        const res = await apiClient.get<DashboardSummary>('/api/dashboard/summary');
        if (!isCancelled) {
          setData(res);
          setError(null);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || 'Failed to load dashboard metrics');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchSummary();
    return () => {
      isCancelled = true;
    };
  }, []);

  const totalSheetsDistribution = data
    ? (data.score_distribution.high +
        data.score_distribution.average +
        data.score_distribution.needs_attention) || 1
    : 1;

  const { greeting, dateStr } = getDynamicGreeting();

  return (
    <div className="h-full flex flex-col bg-[#F6F7F5] dark:bg-[#111312] overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none">
        <div>
          <h1 className="text-xl font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight flex items-center gap-2">
            <span>Evaluation Dashboard</span>
            <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-[#0F5132]/20 dark:border-[#294236]">
              Live Real-Time
            </span>
          </h1>
          <p className="text-xs text-[#4B5563] dark:text-[#969E9A] mt-0.5">
            {greeting} &mdash; {dateStr}
          </p>
          <p className="text-xs text-slate-500 dark:text-[#68706C] mt-1">
            Real-time assessment metrics, class accuracy indicators, and recent evaluations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => store.setStep('upload')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white text-xs font-semibold shadow-none transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Evaluation</span>
        </button>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-7 h-7 border-2 border-[#0F5132] dark:border-[#1F6E4A] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-500 dark:text-[#969E9A]">Calculating dashboard statistics...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-rose-50 dark:bg-[#2B191D] border border-rose-200 dark:border-[#45262C] text-rose-700 dark:text-[#E57D8A] px-4 py-3 rounded-xl text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="underline font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* 5 KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Card 1: Sheets Evaluated */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-4 flex flex-col justify-between shadow-none dark:shadow-none hover:border-slate-300 dark:hover:border-[#3D4440] transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#969E9A] uppercase tracking-wider">
                  Sheets Evaluated
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center border border-[#C7E4D6] dark:border-[#294236]">
                  <FileCheck2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-[#ECEEED] tracking-tight tabular-nums">
                  {data.total_evaluated}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-[#68706C] mt-0.5 block">Submissions processed</span>
              </div>
            </div>

            {/* Card 2: Needs Review */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-4 flex flex-col justify-between shadow-none dark:shadow-none hover:border-slate-300 dark:hover:border-[#3D4440] transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#969E9A] uppercase tracking-wider">
                  Needs Review
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-[#2B2416] text-amber-600 dark:text-[#E5B567] flex items-center justify-center border border-amber-200 dark:border-[#42361F]">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-amber-600 dark:text-[#E5B567] tracking-tight tabular-nums">
                  {data.needs_review_count}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-[#68706C] mt-0.5 block">Flagged / Pending checks</span>
              </div>
            </div>

            {/* Card 3: Class Average % */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-4 flex flex-col justify-between shadow-none dark:shadow-none hover:border-slate-300 dark:hover:border-[#3D4440] transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#969E9A] uppercase tracking-wider">
                  Class Average %
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-[#1A2B23] text-emerald-600 dark:text-[#7CC9A3] flex items-center justify-center border border-emerald-200 dark:border-[#294236]">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-[#7CC9A3] tracking-tight tabular-nums">
                  {data.avg_score_pct}%
                </div>
                <span className="text-[11px] text-slate-500 dark:text-[#68706C] mt-0.5 block">Overall performance</span>
              </div>
            </div>

            {/* Card 4: Avg OCR Legibility % */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-4 flex flex-col justify-between shadow-none dark:shadow-none hover:border-slate-300 dark:hover:border-[#3D4440] transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#969E9A] uppercase tracking-wider">
                  Avg OCR Legibility
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#E8F3EE] dark:bg-[#1B2929] text-[#0D9488] dark:text-[#3A7D8C] flex items-center justify-center border border-teal-200 dark:border-[#274040]">
                  <ScanText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-[#0D9488] dark:text-[#5EB5A6] tracking-tight tabular-nums">
                  {data.avg_ocr_confidence}%
                </div>
                <span className="text-[11px] text-slate-500 dark:text-[#68706C] mt-0.5 block">OCR legibility score</span>
              </div>
            </div>

            {/* Card 5: Question Papers */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-4 flex flex-col justify-between shadow-none dark:shadow-none hover:border-slate-300 dark:hover:border-[#3D4440] transition-colors col-span-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#969E9A] uppercase tracking-wider">
                  Question Papers
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#E8F3EE] dark:bg-[#1B2929] text-[#0D9488] dark:text-[#3A7D8C] flex items-center justify-center border border-teal-200 dark:border-[#274040]">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-[#0D9488] dark:text-[#5EB5A6] tracking-tight tabular-nums">
                  {data.total_papers}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-[#68706C] mt-0.5 block">Configured assessments</span>
              </div>
            </div>
          </div>

          {/* Graphs Section (2-Column Responsive Grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Graph 1: Subject-Wise Performance */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                    <h2 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight">
                      Subject-Wise Average Performance
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-[#969E9A] font-mono">
                    {data.subject_performance.length} Subjects
                  </span>
                </div>

                {data.subject_performance.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-[#68706C] py-10 text-center">
                    No evaluated subjects available yet.
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {data.subject_performance.map((sub, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 dark:text-[#ECEEED] truncate max-w-[220px]">
                            {sub.subject}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-slate-400 dark:text-[#68706C] font-mono">
                              {sub.sheets_count} sheets ({sub.exam_count} exams)
                            </span>
                            <span className="font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3] tabular-nums">
                              {sub.avg_pct}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-[#202422] overflow-hidden">
                          <div
                            className="h-full bg-[#0F5132] dark:bg-[#2D8A61] rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, sub.avg_pct))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-[#2A2F2C] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#969E9A]">
                <span>Metrics derived from finalized student scores</span>
                <span className="font-medium text-[#0F5132] dark:text-[#7CC9A3]">Scale: 0% – 100%</span>
              </div>
            </div>

            {/* Graph 2: Evaluation Trend & Score Mastery Distribution */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                    <h2 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight">
                      Score Mastery &amp; Evaluation Activity
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-[#969E9A] font-mono">Real Activity</span>
                </div>

                {/* Score Mastery Summary Cards */}
                <div className="grid grid-cols-3 gap-2.5 mb-5">
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-[#1A2B23] border border-emerald-100 dark:border-[#294236] text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-[#7CC9A3] block">
                      High (≥75%)
                    </span>
                    <span className="text-lg font-bold font-mono text-emerald-800 dark:text-[#ECEEED] tabular-nums block mt-1">
                      {data.score_distribution.high}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-[#7CC9A3] font-mono">
                      {Math.round((data.score_distribution.high / totalSheetsDistribution) * 100)}%
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#E8F3EE]/70 dark:bg-[#202422] border border-[#0F5132]/10 dark:border-[#2F3532] text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F5132] dark:text-[#7CC9A3] block">
                      Average (50-74%)
                    </span>
                    <span className="text-lg font-bold font-mono text-[#0F5132] dark:text-[#ECEEED] tabular-nums block mt-1">
                      {data.score_distribution.average}
                    </span>
                    <span className="text-[10px] text-[#0F5132] dark:text-[#7CC9A3] font-mono">
                      {Math.round((data.score_distribution.average / totalSheetsDistribution) * 100)}%
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-[#2B191D] border border-rose-100 dark:border-[#45262C] text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-[#E57D8A] block">
                      Attention (&lt;50%)
                    </span>
                    <span className="text-lg font-bold font-mono text-rose-800 dark:text-[#ECEEED] tabular-nums block mt-1">
                      {data.score_distribution.needs_attention}
                    </span>
                    <span className="text-[10px] text-rose-600 dark:text-[#E57D8A] font-mono">
                      {Math.round((data.score_distribution.needs_attention / totalSheetsDistribution) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Daily Activity Bars */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-[#969E9A] block">
                    Recent Evaluation Activity:
                  </span>
                  {data.evaluation_history_trend.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-[#68706C] py-4 text-center">
                      No evaluation history recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.evaluation_history_trend.map((tr, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532]">
                          <span className="font-mono text-slate-600 dark:text-[#969E9A] text-[11px]">{tr.date}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-slate-800 dark:text-[#ECEEED] font-mono">
                              {tr.count} {tr.count === 1 ? 'sheet' : 'sheets'}
                            </span>
                            <span className="text-emerald-700 dark:text-[#7CC9A3] font-bold font-mono text-[11px]">
                              avg {tr.avg_pct}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-[#2A2F2C] flex items-center justify-between text-[11px] text-slate-500 dark:text-[#969E9A]">
                <span>Distribution based on total sheet submissions</span>
                <span className="font-medium text-slate-700 dark:text-[#ECEEED] font-mono">
                  {data.total_evaluated} total sheets
                </span>
              </div>
            </div>
          </div>

          {/* Recent Evaluated Sheets Table */}
          <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                <h2 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight">
                  Recent Evaluated Sheets
                </h2>
              </div>
              <button
                type="button"
                onClick={() => store.setStep('history')}
                className="text-xs font-semibold text-[#0F5132] hover:text-[#0B3D26] dark:text-[#7CC9A3] dark:hover:text-[#9FE0C0] flex items-center gap-1 cursor-pointer"
              >
                <span>View Full History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {data.recent_sheets.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-[#68706C] text-xs">
                No evaluated answer sheets found. Upload sheets to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8E4] dark:border-[#2F3532] bg-[#F1F4F2] dark:bg-[#202422] text-slate-500 dark:text-[#969E9A] font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Roll No.</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Class</th>
                      <th className="py-2.5 px-3">Subject / Exam</th>
                      <th className="py-2.5 px-3 text-center">Marks</th>
                      <th className="py-2.5 px-3 text-center">Score %</th>
                      <th className="py-2.5 px-3 text-center">Grade</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2A2F2C]">
                    {data.recent_sheets.map((sh) => (
                      <tr key={sh.sheet_id} className="hover:bg-slate-50/80 dark:hover:bg-[#202422]/60 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-[#ECEEED]">
                          {sh.roll_number || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-[#ECEEED]">
                          {sh.student_name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-[#969E9A]">
                          {sh.class_name || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-[#969E9A] truncate max-w-[200px]" title={`${sh.subject} - ${sh.exam_title}`}>
                          <span className="font-medium text-slate-800 dark:text-[#ECEEED]">{sh.subject}</span>
                          <span className="text-slate-400 dark:text-[#68706C] block text-[11px] truncate">{sh.exam_title}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800 dark:text-[#ECEEED]">
                          {sh.score} / {sh.max_marks}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                          {sh.percentage}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-[#ECEEED]">
                          {sh.grade || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              sh.status === 'evaluated' || sh.status === 'ready'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border-[#294236]'
                                : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-[#2B2416] dark:text-[#E5B567] dark:border-[#42361F]'
                            }`}
                          >
                            {sh.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => store.setStep('evaluate', sh.sheet_id)}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-[#202422] hover:bg-slate-200 dark:hover:bg-[#2F3532] text-slate-700 dark:text-[#ECEEED] border border-slate-200 dark:border-[#2F3532] text-[11px] font-medium transition cursor-pointer"
                              title="Open Evaluation"
                            >
                              Evaluate
                            </button>
                            <button
                              type="button"
                              onClick={() => store.setStep('report', sh.sheet_id)}
                              className="px-2 py-1 rounded bg-[#E8F3EE] hover:bg-[#E8F3EE]/80 dark:bg-[#1A2B23] dark:hover:bg-[#233B2F] text-[#0F5132] dark:text-[#7CC9A3] text-[11px] font-semibold border border-[#0F5132]/20 dark:border-[#294236] transition cursor-pointer flex items-center gap-1"
                              title="View Sheet Report"
                            >
                              <span>Report</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
