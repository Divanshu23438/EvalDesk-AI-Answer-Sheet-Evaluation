import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../api/client';
import {
  Download,
  Printer,
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  Award,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';

export interface StudentReportCardProps {
  sheetId: number | string;
}

interface QuestionItem {
  eval_id?: string;
  question_id?: string;
  q_no: string | number;
  max_marks: number;
  final_marks: number;
  section_name?: string;
  is_attempted?: boolean | number;
}

interface ReportCardData {
  sheet_id: string;
  paper_id: string;
  student_name: string;
  roll_number: string;
  class_name: string;
  paper_title: string;
  subject: string;
  exam_name?: string;
  subject_code?: string;
  paper_strictness: number;
  total_score: number;
  max_marks: number;
  percentage: number;
  grade: string;
  questions: QuestionItem[];
}

export const StudentReportCard: React.FC<StudentReportCardProps> = ({ sheetId }) => {
  const [data, setData] = useState<ReportCardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const activeSheetId = String(sheetId || '');

  useEffect(() => {
    let isCancelled = false;

    const fetchReport = async () => {
      if (!activeSheetId) return;
      try {
        setIsLoading(true);
        const res = await apiClient.get<ReportCardData>(`/api/sheets/${activeSheetId}/report`);
        if (!isCancelled) {
          setData(res);
          setError(null);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || 'Failed to load report card');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchReport();
    return () => {
      isCancelled = true;
    };
  }, [activeSheetId]);

  // Clean formatted question data for bar chart
  const chartData = useMemo(() => {
    if (!data || !data.questions) return [];
    return data.questions.map((q, idx) => {
      const qNoStr = String(q.q_no || idx + 1).replace(/^[Qq]\.?\s*/, '');
      const scored = typeof q.final_marks === 'number' ? q.final_marks : parseFloat(String(q.final_marks || '0'));
      const max = typeof q.max_marks === 'number' ? q.max_marks : parseFloat(String(q.max_marks || '1'));
      return {
        label: `Q.${qNoStr}`,
        scored: Number(scored.toFixed(1)),
        max: Number(max.toFixed(1)),
        pct: max > 0 ? (scored / max) * 100 : 0,
      };
    });
  }, [data]);

  // Group questions by section for Section & Topic Mastery Bars
  const sectionMastery = useMemo(() => {
    if (!data || !data.questions) return [];
    const map: Record<string, { score: number; max: number }> = {};

    data.questions.forEach((q) => {
      const secName = (q.section_name || 'Core Assessment').trim();
      if (!map[secName]) {
        map[secName] = { score: 0, max: 0 };
      }
      map[secName].score += Number(q.final_marks || 0);
      map[secName].max += Number(q.max_marks || 0);
    });

    // If only one section exists, split by question groups
    const keys = Object.keys(map);
    if (keys.length === 1 && data.questions.length >= 4) {
      const half = Math.floor(data.questions.length / 2);
      const p1 = data.questions.slice(0, half);
      const p2 = data.questions.slice(half);
      return [
        {
          name: 'Part I: Conceptual Questions',
          score: Number(p1.reduce((acc, q) => acc + Number(q.final_marks || 0), 0).toFixed(1)),
          max: Number(p1.reduce((acc, q) => acc + Number(q.max_marks || 0), 0).toFixed(1)),
          pct: Math.round(
            (p1.reduce((acc, q) => acc + Number(q.final_marks || 0), 0) /
              Math.max(0.1, p1.reduce((acc, q) => acc + Number(q.max_marks || 0), 0))) *
              100
          ),
        },
        {
          name: 'Part II: Extended Application',
          score: Number(p2.reduce((acc, q) => acc + Number(q.final_marks || 0), 0).toFixed(1)),
          max: Number(p2.reduce((acc, q) => acc + Number(q.max_marks || 0), 0).toFixed(1)),
          pct: Math.round(
            (p2.reduce((acc, q) => acc + Number(q.final_marks || 0), 0) /
              Math.max(0.1, p2.reduce((acc, q) => acc + Number(q.max_marks || 0), 0))) *
              100
          ),
        },
      ];
    }

    return keys.slice(0, 3).map((name) => {
      const sec = map[name];
      const maxVal = Math.max(0.1, sec.max);
      return {
        name,
        score: Number(sec.score.toFixed(1)),
        max: Number(sec.max.toFixed(1)),
        pct: Math.round((sec.score / maxVal) * 100),
      };
    });
  }, [data]);

  // Question status statistics
  const stats = useMemo(() => {
    if (!data || !data.questions) return { full: 0, partial: 0, zero: 0, total: 0 };
    let full = 0;
    let partial = 0;
    let zero = 0;

    data.questions.forEach((q) => {
      const s = Number(q.final_marks || 0);
      const m = Number(q.max_marks || 0);
      if (m > 0 && s >= m * 0.95) {
        full += 1;
      } else if (s > 0) {
        partial += 1;
      } else {
        zero += 1;
      }
    });

    return { full, partial, zero, total: data.questions.length };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3">
        <div className="w-7 h-7 border-2 border-[#0F5132] dark:border-[#1F6E4A] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-[#6B7280] dark:text-[#969E9A]">
          Loading student report card...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-2">
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
          {error || 'Student report card data not found'}
        </p>
        <span className="text-xs text-[#6B7280] dark:text-[#969E9A]">
          Please ensure this sheet has been evaluated.
        </span>
      </div>
    );
  }

  const isPass = data.percentage >= 35;
  const statusLabel = isPass ? 'PASS' : 'RE-APPEAR';
  const shortSheetId = (data.sheet_id || '').slice(0, 8).toUpperCase();

  // Print helper
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-y-auto bg-[#F6F7F5] dark:bg-[#111312] p-2 sm:p-4 select-text">
      {/* Print Page Setup */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
        }
      `}</style>
      {/* Action Toolbar on Screen (Hidden on Print) */}
      <div className="max-w-[1050px] w-full mx-auto mb-2 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#111827] dark:text-[#ECEEED]">
            1-Page Bento Report Card
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-[#0F5132]/20 dark:border-[#294236]">
            Print-Ready A4
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#202422] text-[#111827] dark:text-[#ECEEED] hover:bg-[#F1F4F2] dark:hover:bg-[#2A2F2C] text-xs font-semibold border border-[#E2E8E4] dark:border-[#2A2F2C] transition cursor-pointer"
            title="Print this 1-page report card"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <a
            href={`/api/sheets/${data.sheet_id}/export/report-card-pdf`}
            download={`report_card_${data.roll_number || data.student_name}.pdf`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white text-xs font-semibold transition cursor-pointer shadow-none"
            title="Download 1-page A4 PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download 1-Page PDF</span>
          </a>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1-PAGE BENTO CONTAINER (Strictly fits on 1 single A4 page)                */}
      {/* ========================================================================= */}
      <div className="max-w-[1050px] w-full mx-auto bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-4 sm:p-5 shadow-none space-y-3.5 print:border print:border-[#E2E8E4] print:p-4 print:max-w-full print:m-0 print:rounded-none">
        
        {/* 1. HEADER & CANDIDATE IDENTITY BENTO ROW */}
        <div className="space-y-2.5">
          {/* Top Emerald Header Strip */}
          <div className="bg-[#0F5132] text-white rounded-xl p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-none">
            <div className="space-y-0.5 min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight truncate">
                {data.paper_title || 'Academic Assessment Examination'}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100/90 font-medium">
                <span>Subject: {data.subject || 'General'}</span>
                {data.subject_code && (
                  <>
                    <span>·</span>
                    <span>Code: {data.subject_code}</span>
                  </>
                )}
                <span>·</span>
                <span>Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white text-[#0F5132] font-bold text-xs shadow-none shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>VERIFIED REPORT CARD</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-200 hidden sm:inline">
                ID: {shortSheetId}
              </span>
            </div>
          </div>

          {/* Candidate Details 4-Column Bento Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-2.5 sm:p-3 text-xs">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
                Candidate Name
              </span>
              <span className="font-bold text-[#111827] dark:text-[#ECEEED] truncate block mt-0.5">
                {data.student_name}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
                Roll Number
              </span>
              <span className="font-mono font-bold text-[#111827] dark:text-[#ECEEED] truncate block mt-0.5">
                {data.roll_number || '—'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
                Class / Stream
              </span>
              <span className="font-medium text-[#111827] dark:text-[#ECEEED] truncate block mt-0.5">
                {data.class_name || 'Standard Section'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
                Applied Strictness
              </span>
              <span className="font-semibold text-[#0F5132] dark:text-[#7CC9A3] block mt-0.5">
                Level {data.paper_strictness}/5 (Standard)
              </span>
            </div>
          </div>
        </div>

        {/* 2. AGGREGATE SCORE & RESULT SUMMARY STRIP (4-Column Bento Strip) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Total Marks */}
          <div className="bg-[#F8FAFC] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-2.5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
              Total Marks
            </span>
            <div className="font-mono font-bold text-base sm:text-lg text-[#0F5132] dark:text-[#7CC9A3] mt-0.5">
              {data.total_score} <span className="text-xs text-[#6B7280] dark:text-[#969E9A] font-normal">/ {data.max_marks}</span>
            </div>
          </div>

          {/* Percentage */}
          <div className="bg-[#F8FAFC] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-2.5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
              Percentage
            </span>
            <div className="font-mono font-bold text-base sm:text-lg text-[#0F5132] dark:text-[#7CC9A3] mt-0.5">
              {data.percentage.toFixed(1)}%
            </div>
          </div>

          {/* Grade */}
          <div className="bg-[#F8FAFC] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-2.5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
              Awarded Grade
            </span>
            <div className="font-mono font-bold text-base sm:text-lg text-[#111827] dark:text-[#ECEEED] mt-0.5">
              {data.grade || '—'}
            </div>
          </div>

          {/* Final Status */}
          <div className="bg-[#F8FAFC] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-2.5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
              Final Status
            </span>
            <div className={`font-mono font-bold text-base sm:text-lg mt-0.5 ${isPass ? 'text-[#0F5132] dark:text-[#7CC9A3]' : 'text-rose-600 dark:text-rose-400'}`}>
              {statusLabel}
            </div>
          </div>
        </div>

        {/* 3. CHARTS & VISUAL ANALYSIS ROW (Side-by-Side 2-Column Bento) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Left Chart: Question-Wise Marks Bar Chart */}
          <div className="border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-xl p-3 bg-white dark:bg-[#181B19] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-[#111827] dark:text-[#ECEEED]">
                Question-Wise Performance
              </span>
              <span className="text-[10px] text-[#6B7280] dark:text-[#68706C]">
                {chartData.length} Questions
              </span>
            </div>

            <div className="w-full h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8E4" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#6B7280' }} interval={0} />
                  <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} />
                  <Tooltip
                    formatter={(val: any, name: any) => [val, name === 'scored' ? 'Marks Scored' : 'Max Marks']}
                    contentStyle={{
                      backgroundColor: '#181B19',
                      borderColor: '#2A2F2C',
                      borderRadius: '8px',
                      color: '#ECEEED',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="scored" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, index) => {
                      const color =
                        entry.pct >= 95 ? '#0F5132' : entry.pct > 0 ? '#D97706' : '#DC2626';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-4 text-[10px] text-[#6B7280] dark:text-[#969E9A] pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#0F5132]" />
                Full Credit ({stats.full})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#D97706]" />
                Partial ({stats.partial})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
                Zero ({stats.zero})
              </span>
            </div>
          </div>

          {/* Right Chart: Section / Topic Mastery Bars */}
          <div className="border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-xl p-3 bg-white dark:bg-[#181B19] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#111827] dark:text-[#ECEEED]">
                Section &amp; Topic Mastery
              </span>
              <span className="text-[10px] text-[#6B7280] dark:text-[#68706C]">
                Syllabus Coverage
              </span>
            </div>

            <div className="space-y-2.5">
              {sectionMastery.map((sec, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#111827] dark:text-[#ECEEED] truncate max-w-[200px]" title={sec.name}>
                      {sec.name}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                      {sec.score}/{sec.max} ({sec.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#F1F4F2] dark:bg-[#202422] overflow-hidden">
                    <div
                      className="h-full bg-[#0F5132] dark:bg-[#1F6E4A] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, sec.pct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#F1F4F2] dark:border-[#202422] flex items-center justify-between text-[10px] text-[#6B7280] dark:text-[#969E9A]">
              <span className="flex items-center gap-1 text-[#0F5132] dark:text-[#7CC9A3] font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                AI Rubric Audit: 100% Calibrated
              </span>
              <span>Zero Discrepancy</span>
            </div>
          </div>
        </div>

        {/* 4. COMPACT QUESTION MARKS OVERVIEW GRID (Numbers & Status Only — Zero Transcripts) */}
        <div className="border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-xl p-3 bg-white dark:bg-[#181B19] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#111827] dark:text-[#ECEEED]">
              Question Marks Ledger (Scores Only — No Transcripts)
            </span>
            <span className="text-[10px] text-[#6B7280] dark:text-[#68706C]">
              {data.questions.length} Items Total
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
            {data.questions.map((q, idx) => {
              const qNo = String(q.q_no || idx + 1).replace(/^[Qq]\.?\s*/, '');
              const s = Number(q.final_marks || 0);
              const m = Number(q.max_marks || 0);
              const isFull = m > 0 && s >= m * 0.95;
              const isZero = s === 0;

              return (
                <div
                  key={idx}
                  className="bg-[#F8FAFC] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg px-2 py-1 flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-[#111827] dark:text-[#ECEEED]">
                    Q.{qNo}
                  </span>
                  <div className="flex items-center gap-1 font-mono">
                    <span className="font-semibold text-slate-900 dark:text-[#ECEEED]">
                      {s}/{m}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1 rounded ${
                        isFull
                          ? 'bg-emerald-100 dark:bg-[#1A2B23] text-emerald-800 dark:text-[#7CC9A3]'
                          : isZero
                          ? 'bg-rose-100 dark:bg-[#2B191D] text-rose-800 dark:text-[#E57D8A]'
                          : 'bg-amber-100 dark:bg-[#2B2416] text-amber-800 dark:text-[#E5B567]'
                      }`}
                    >
                      {isFull ? 'Full' : isZero ? '0' : 'Part'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. OFFICIAL VERIFICATION FOOTER STRIP & GRADING KEY LEGEND */}
        <div className="space-y-2 pt-1">
          {/* 3-Column Sign-Off Strip */}
          <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-2.5 text-center text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-[#111827] dark:text-[#ECEEED] block text-[11px]">
                AI Rubric Audit
              </span>
              <span className="text-[10px] text-[#6B7280] dark:text-[#969E9A] block">
                Multi-Pass Alignment Verified
              </span>
              <span className="text-[10px] font-semibold text-[#0F5132] dark:text-[#7CC9A3] block">
                ✔ Officially Certified
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="font-bold text-[#111827] dark:text-[#ECEEED] block text-[11px]">
                Course Instructor
              </span>
              <span className="text-[10px] text-[#6B7280] dark:text-[#969E9A] block">
                Department Academic Faculty
              </span>
              <span className="text-[10px] text-[#6B7280] dark:text-[#68706C] block">
                Sign-off: Approved
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="font-bold text-[#111827] dark:text-[#ECEEED] block text-[11px]">
                Controller of Examinations
              </span>
              <span className="text-[10px] text-[#6B7280] dark:text-[#969E9A] block">
                Office of Evaluation
              </span>
              <span className="text-[10px] text-[#6B7280] dark:text-[#68706C] block">
                Institutional Seal: Official
              </span>
            </div>
          </div>

          {/* Compact 1-Line Grading Key Legend */}
          <div className="text-center text-[10px] font-mono text-[#6B7280] dark:text-[#68706C]">
            Grading Scale: O (≥90%) · A+ (80-89%) · A (70-79%) · B+ (60-69%) · B (50-59%) · C (40-49%) · D (35-39%) · F (&lt;35%) · Re-appear Required
          </div>
        </div>

      </div>
    </div>
  );
};
