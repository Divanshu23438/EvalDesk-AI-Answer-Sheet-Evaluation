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
    <div className="h-full flex flex-col bg-[#F6F7F5] overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
        <div>
          <h1 className="text-xl font-bold text-[#111827] tracking-tight flex items-center gap-2">
            <span>Evaluation Dashboard</span>
            <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#E8F3EE] text-[#0F5132] border border-[#0F5132]/20">
              Live Real-Time
            </span>
          </h1>
          <p className="text-xs text-[#4B5563] mt-0.5">
            {greeting} &mdash; {dateStr}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Real-time assessment metrics, class accuracy indicators, and recent evaluations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => store.setStep('upload')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Evaluation</span>
        </button>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="w-7 h-7 border-2 border-[#0F5132] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-500">Calculating dashboard statistics...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs flex items-center justify-between">
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
            <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Sheets Evaluated
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#E8F3EE] text-[#0F5132] flex items-center justify-center">
                  <FileCheck2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">
                  {data.total_evaluated}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Submissions processed</span>
              </div>
            </div>

            {/* Card 2: Needs Review */}
            <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Needs Review
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-amber-600 tracking-tight tabular-nums">
                  {data.needs_review_count}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Flagged / Pending checks</span>
              </div>
            </div>

            {/* Card 3: Class Average % */}
            <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Class Average %
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-emerald-600 tracking-tight tabular-nums">
                  {data.avg_score_pct}%
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Overall performance</span>
              </div>
            </div>

            {/* Card 4: Avg OCR Legibility % */}
            <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Avg OCR Legibility
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#E8F3EE] text-[#0D9488] flex items-center justify-center">
                  <ScanText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-[#0D9488] tracking-tight tabular-nums">
                  {data.avg_ocr_confidence}%
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">OCR legibility score</span>
              </div>
            </div>

            {/* Card 5: Question Papers */}
            <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition-colors col-span-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Question Papers
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#E8F3EE] text-[#0D9488] flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-[#0D9488] tracking-tight tabular-nums">
                  {data.total_papers}
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Configured assessments</span>
              </div>
            </div>
          </div>

          {/* Graphs Section (2-Column Responsive Grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Graph 1: Subject-Wise Performance */}
            <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-[#0F5132]" />
                    <h2 className="text-sm font-bold text-[#111827] tracking-tight">
                      Subject-Wise Average Performance
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {data.subject_performance.length} Subjects
                  </span>
                </div>

                {data.subject_performance.length === 0 ? (
                  <p className="text-xs text-slate-400 py-10 text-center">
                    No evaluated subjects available yet.
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {data.subject_performance.map((sub, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                            {sub.subject}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {sub.sheets_count} sheets ({sub.exam_count} exams)
                            </span>
                            <span className="font-mono font-bold text-[#0F5132] tabular-nums">
                              {sub.avg_pct}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#0F5132] rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, sub.avg_pct))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Metrics derived from finalized student scores</span>
                <span className="font-medium text-[#0F5132]">Scale: 0% – 100%</span>
              </div>
            </div>

            {/* Graph 2: Evaluation Trend & Score Mastery Distribution */}
            <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#0F5132]" />
                    <h2 className="text-sm font-bold text-[#111827] tracking-tight">
                      Score Mastery &amp; Evaluation Activity
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">Real Activity</span>
                </div>

                {/* Score Mastery Summary Cards */}
                <div className="grid grid-cols-3 gap-2.5 mb-5">
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                      High (≥75%)
                    </span>
                    <span className="text-lg font-bold font-mono text-emerald-800 tabular-nums block mt-1">
                      {data.score_distribution.high}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-mono">
                      {Math.round((data.score_distribution.high / totalSheetsDistribution) * 100)}%
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#E8F3EE]/70 border border-[#0F5132]/10 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F5132] block">
                      Average (50-74%)
                    </span>
                    <span className="text-lg font-bold font-mono text-[#0F5132] tabular-nums block mt-1">
                      {data.score_distribution.average}
                    </span>
                    <span className="text-[10px] text-[#0F5132] font-mono">
                      {Math.round((data.score_distribution.average / totalSheetsDistribution) * 100)}%
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                      Attention (&lt;50%)
                    </span>
                    <span className="text-lg font-bold font-mono text-rose-800 tabular-nums block mt-1">
                      {data.score_distribution.needs_attention}
                    </span>
                    <span className="text-[10px] text-rose-600 font-mono">
                      {Math.round((data.score_distribution.needs_attention / totalSheetsDistribution) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Daily Activity Bars */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-slate-600 block">
                    Recent Evaluation Activity:
                  </span>
                  {data.evaluation_history_trend.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">
                      No evaluation history recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {data.evaluation_history_trend.map((tr, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="font-mono text-slate-600 text-[11px]">{tr.date}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-slate-800 font-mono">
                              {tr.count} {tr.count === 1 ? 'sheet' : 'sheets'}
                            </span>
                            <span className="text-emerald-700 font-bold font-mono text-[11px]">
                              avg {tr.avg_pct}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Distribution based on total sheet submissions</span>
                <span className="font-medium text-slate-700 font-mono">
                  {data.total_evaluated} total sheets
                </span>
              </div>
            </div>
          </div>

          {/* Recent Evaluated Sheets Table */}
          <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0F5132]" />
                <h2 className="text-sm font-bold text-[#111827] tracking-tight">
                  Recent Evaluated Sheets
                </h2>
              </div>
              <button
                type="button"
                onClick={() => store.setStep('history')}
                className="text-xs font-semibold text-[#0F5132] hover:text-[#0B3D26] flex items-center gap-1 cursor-pointer"
              >
                <span>View Full History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {data.recent_sheets.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No evaluated answer sheets found. Upload sheets to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8E4] bg-[#F1F4F2] text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
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
                  <tbody className="divide-y divide-slate-100">
                    {data.recent_sheets.map((sh) => (
                      <tr key={sh.sheet_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {sh.roll_number || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {sh.student_name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {sh.class_name || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[200px]" title={`${sh.subject} - ${sh.exam_title}`}>
                          <span className="font-medium text-slate-800">{sh.subject}</span>
                          <span className="text-slate-400 block text-[11px] truncate">{sh.exam_title}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800">
                          {sh.score} / {sh.max_marks}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-[#0F5132]">
                          {sh.percentage}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                          {sh.grade || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              sh.status === 'evaluated' || sh.status === 'ready'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
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
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition cursor-pointer"
                              title="Open Evaluation"
                            >
                              Evaluate
                            </button>
                            <button
                              type="button"
                              onClick={() => store.setStep('report', sh.sheet_id)}
                              className="px-2 py-1 rounded bg-[#E8F3EE] hover:bg-[#E8F3EE]/80 text-[#0F5132] text-[11px] font-semibold border border-[#0F5132]/20 transition cursor-pointer flex items-center gap-1"
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
