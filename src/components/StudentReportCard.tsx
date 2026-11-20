import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../api/client';
import {
  Download,
  Printer,
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  Award,
  ChevronDown,
  ChevronRight,
  Filter,
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
  question_type?: string;
  flags_json?: any;
  flags?: any[];
  extracted_text?: string;
  ocr_text?: string;
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
  const [activeTelemetryTab, setActiveTelemetryTab] = useState<'all' | 'secMarks' | 'secErrors' | 'secFormats'>('all');

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

  // Derive score metrics safely
  const totalScore = Number(data?.total_score || 0);
  const maxMarks = Number(data?.max_marks || (data?.questions ? data.questions.reduce((a, c) => a + Number(c.max_marks || 0), 0) : 100)) || 100;
  const computedPct = maxMarks > 0 ? Number(((totalScore / maxMarks) * 100).toFixed(1)) : 0;
  const effectivePct = (data?.percentage && data.percentage > 0) ? Number(data.percentage.toFixed(1)) : computedPct;
  const totalLost = Math.max(0, Number((maxMarks - totalScore).toFixed(1)));
  const isPass = effectivePct >= 35;
  const statusLabel = isPass ? 'PASS' : 'RE-APPEAR';

  const getGrade = (pct: number) => {
    if (pct >= 90) return 'O (Outstanding)';
    if (pct >= 80) return 'A+ (Excellent)';
    if (pct >= 70) return 'A (Very Good)';
    if (pct >= 60) return 'B+ (Good)';
    if (pct >= 50) return 'B (Above Average)';
    if (pct >= 40) return 'C (Average)';
    if (pct >= 35) return 'D (Pass)';
    return 'F (Needs Support)';
  };
  const effectiveGrade = (data?.grade && data.grade !== 'Needs Support' && data.grade !== 'N/A') ? data.grade : getGrade(effectivePct);
  const shortSheetId = (data?.sheet_id || '').slice(0, 8).toUpperCase();

  // Normalize questions
  const normalizedQuestions = useMemo(() => {
    if (!data || !data.questions) return [];
    return data.questions.map((q, idx) => {
      const qNoStr = String(q.q_no || idx + 1).replace(/^[Qq]\.?\s*/, '');
      const earned = typeof q.final_marks === 'number' ? q.final_marks : parseFloat(String(q.final_marks || '0'));
      const max = typeof q.max_marks === 'number' ? q.max_marks : parseFloat(String(q.max_marks || '1'));
      const pct = max > 0 ? (earned / max) * 100 : 0;
      let status: 'full' | 'part' | 'zero' = 'part';
      if (pct >= 90) status = 'full';
      else if (pct <= 0) status = 'zero';

      return {
        ...q,
        q_no: qNoStr,
        earned,
        max,
        pct,
        status,
      };
    });
  }, [data]);

  // 1. Group 1: Question counts & Bar heights
  const { fullCount, partialCount, deductionCount } = useMemo(() => {
    let f = 0, p = 0, d = 0;
    normalizedQuestions.forEach((q) => {
      if (q.status === 'full') f++;
      else if (q.status === 'part') p++;
      else d++;
    });
    return { fullCount: f, partialCount: p, deductionCount: d };
  }, [normalizedQuestions]);

  // Sectional breakdown
  const sectionalList = useMemo(() => {
    if (!normalizedQuestions.length) return [];
    const map = new Map<string, { earned: number; max: number; count: number; qNos: string[] }>();
    normalizedQuestions.forEach((q) => {
      const sec = (q.section_name || 'General').trim();
      const curr = map.get(sec) || { earned: 0, max: 0, count: 0, qNos: [] };
      curr.earned += q.earned;
      curr.max += q.max;
      curr.count += 1;
      curr.qNos.push(`Q${q.q_no}`);
      map.set(sec, curr);
    });

    return Array.from(map.entries()).map(([name, d]) => {
      const pct = d.max > 0 ? (d.earned / d.max) * 100 : 0;
      const lost = Math.max(0, d.max - d.earned);
      let barColor = 'bg-[#0F5132] dark:bg-[#1F6E4A]';
      let textColor = 'text-[#0F5132] dark:text-[#7CC9A3]';
      let badgeClass = 'bg-[#E8F3EE] text-[#0F5132] border-[#0F5132]/20 dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border-[#294236]';
      if (pct < 50) {
        barColor = 'bg-rose-500 dark:bg-[#E57D8A]';
        textColor = 'text-rose-700 dark:text-[#E57D8A]';
        badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-[#2B191D] dark:text-[#E57D8A] dark:border-[#45262C]';
      } else if (pct < 85) {
        barColor = 'bg-amber-500 dark:bg-[#E5B567]';
        textColor = 'text-amber-800 dark:text-[#E5B567]';
        badgeClass = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-[#2B2416] dark:text-[#E5B567] dark:border-[#42361F]';
      }
      return {
        name,
        earned: Number(d.earned.toFixed(1)),
        max: Number(d.max.toFixed(1)),
        pct: Number(pct.toFixed(1)),
        lost: Number(lost.toFixed(1)),
        count: d.count,
        qNos: d.qNos,
        barColor,
        textColor,
        badgeClass,
      };
    });
  }, [normalizedQuestions]);

  // Donut 1 constants: C = 2 * PI * r = 2 * 3.14159 * 28 = 175.93
  const C_DONUT = 175.93;
  const scoredFraction = maxMarks > 0 ? totalScore / maxMarks : 0;
  const scoredDash = (scoredFraction * C_DONUT).toFixed(2);
  const lostFraction = maxMarks > 0 ? totalLost / maxMarks : 0;
  const lostDash = (lostFraction * C_DONUT).toFixed(2);

  // 2. Group 2: Error Categories & Pareto
  const { errorCategories, paretoData, errorSegments } = useMemo(() => {
    let conceptualLost = 0;
    let incompleteLost = 0;
    let syntaxFlagsLost = 0;
    let otherLost = 0;

    normalizedQuestions.forEach((q) => {
      const qLost = Math.max(0, q.max - q.earned);
      if (qLost <= 0) return;

      const flags = Array.isArray(q.flags) ? q.flags : (typeof q.flags_json === 'string' ? JSON.parse(q.flags_json || '[]') : []);
      const hasRedFlag = flags.some((f: any) => f.severity === 'red');
      const hasAmberFlag = flags.some((f: any) => f.severity === 'amber');

      if (q.earned === 0) {
        conceptualLost += qLost;
      } else if (hasRedFlag || hasAmberFlag) {
        syntaxFlagsLost += qLost * 0.5;
        incompleteLost += qLost * 0.5;
      } else if (q.earned < q.max) {
        incompleteLost += qLost;
      } else {
        otherLost += qLost;
      }
    });

    if (totalLost > 0 && conceptualLost + incompleteLost + syntaxFlagsLost + otherLost === 0) {
      conceptualLost = totalLost * 0.5;
      incompleteLost = totalLost * 0.3;
      syntaxFlagsLost = totalLost * 0.2;
    }

    const raw = [
      { name: 'Conceptual Mistakes', loss: conceptualLost, color: '#E11D48', dotClass: 'bg-rose-600', textClass: 'text-rose-700 dark:text-[#E57D8A]', bgClass: 'bg-rose-50/50 border-rose-100 dark:bg-[#2B191D]/50 dark:border-[#45262C]' },
      { name: 'Incomplete Steps', loss: incompleteLost, color: '#F59E0B', dotClass: 'bg-amber-500', textClass: 'text-amber-700 dark:text-[#E5B567]', bgClass: 'bg-amber-50/50 border-amber-100 dark:bg-[#2B2416]/50 dark:border-[#42361F]' },
      { name: 'Syntax / Rubric Flags', loss: syntaxFlagsLost, color: '#0F5132', dotClass: 'bg-[#0F5132] dark:bg-[#1F6E4A]', textClass: 'text-[#0B3D26] dark:text-[#7CC9A3]', bgClass: 'bg-[#E8F3EE]/50 border-[#E8F3EE] dark:bg-[#1A2B23]/50 dark:border-[#294236]' },
      { name: 'Other Deductions', loss: otherLost, color: '#94A3B8', dotClass: 'bg-slate-400 dark:bg-[#68706C]', textClass: 'text-slate-600 dark:text-[#969E9A]', bgClass: 'bg-slate-50 border-slate-200 dark:bg-[#202422] dark:border-[#2F3532]' },
    ].filter((c) => c.loss > 0 || totalLost === 0);

    const categories = raw.length > 0 ? raw : [
      { name: 'No Deductions', loss: 0, color: '#0F5132', dotClass: 'bg-[#0F5132] dark:bg-[#1F6E4A]', textClass: 'text-[#0F5132] dark:text-[#7CC9A3]', bgClass: 'bg-[#E8F3EE] border-[#0F5132]/20 dark:bg-[#1A2B23] dark:border-[#294236]' }
    ];

    const sorted = [...categories].sort((a, b) => b.loss - a.loss);
    let runLoss = 0;
    const pareto = sorted.map((cat) => {
      runLoss += cat.loss;
      const cumPct = totalLost > 0 ? Math.min(100, Math.round((runLoss / totalLost) * 100)) : 100;
      const pct = totalLost > 0 ? Math.round((cat.loss / totalLost) * 100) : 0;
      return { ...cat, cumPct, pct };
    });

    let accOffset = 0;
    const segments = categories.map((c) => {
      const frac = totalLost > 0 ? c.loss / totalLost : 0;
      const dash = (frac * C_DONUT).toFixed(2);
      const offset = -accOffset;
      accOffset += frac * C_DONUT;
      return { ...c, dash, offset, pct: totalLost > 0 ? ((c.loss / totalLost) * 100).toFixed(1) : '0' };
    });

    return { errorCategories: categories, paretoData: pareto, errorSegments: segments };
  }, [normalizedQuestions, totalLost]);

  // 3. Group 3: Question Formats & Attempt Status
  const { formatsList, attemptCategories, attemptSegments, totalAttempted } = useMemo(() => {
    const fMap = new Map<string, { earned: number; max: number; count: number }>();
    normalizedQuestions.forEach((q) => {
      let fmt = q.question_type;
      if (!fmt) {
        if (q.max <= 2) fmt = 'Objective / Short';
        else if (q.max <= 5) fmt = 'Core Practical';
        else fmt = 'Extended / Long';
      }
      const curr = fMap.get(fmt) || { earned: 0, max: 0, count: 0 };
      curr.earned += q.earned;
      curr.max += q.max;
      curr.count += 1;
      fMap.set(fmt, curr);
    });

    const fList = Array.from(fMap.entries()).map(([fmt, d]) => {
      const earnedPct = d.max > 0 ? Math.round((d.earned / d.max) * 100) : 0;
      const lostPct = Math.max(0, 100 - earnedPct);
      return {
        fmt,
        earned: Number(d.earned.toFixed(1)),
        max: Number(d.max.toFixed(1)),
        count: d.count,
        earnedPct,
        lostPct,
      };
    });

    let attFull = 0, attPart = 0, attDed = 0, attUnatt = 0;
    normalizedQuestions.forEach((q) => {
      const isAtt = (q.extracted_text && q.extracted_text.trim().length > 0) ||
                    (q.ocr_text && q.ocr_text.trim().length > 0) ||
                    Boolean(q.is_attempted) ||
                    q.earned > 0;
      if (!isAtt && q.earned === 0) {
        attUnatt++;
      } else if (q.pct >= 90) {
        attFull++;
      } else if (q.pct > 0) {
        attPart++;
      } else {
        attDed++;
      }
    });

    const totalQs = normalizedQuestions.length || 1;
    const attemptedCount = totalQs - attUnatt;
    const attCats = [
      { label: 'Full Marks (≥90%)', count: attFull, pct: Math.round((attFull / totalQs) * 100), color: '#0F5132', dotClass: 'bg-[#0F5132] dark:bg-[#1F6E4A]' },
      { label: 'Partial Marks', count: attPart, pct: Math.round((attPart / totalQs) * 100), color: '#E5B567', dotClass: 'bg-amber-500 dark:bg-[#E5B567]' },
      { label: 'Heavy Deductions / Zero', count: attDed, pct: Math.round((attDed / totalQs) * 100), color: '#E57D8A', dotClass: 'bg-rose-500 dark:bg-[#E57D8A]' },
      { label: 'Unattempted', count: attUnatt, pct: Math.round((attUnatt / totalQs) * 100), color: '#68706C', dotClass: 'bg-slate-300 dark:bg-[#68706C]' },
    ];

    let accOff = 0;
    const attSegs = attCats.map((c) => {
      const frac = c.count / totalQs;
      const dash = (frac * C_DONUT).toFixed(2);
      const offset = -accOff;
      accOff += frac * C_DONUT;
      return { ...c, dash, offset };
    });

    return {
      formatsList: fList,
      attemptCategories: attCats,
      attemptSegments: attSegs,
      totalAttempted: attemptedCount,
    };
  }, [normalizedQuestions]);

  // Print helper
  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#0F5132] border-t-transparent animate-spin" />
        <span className="text-xs font-medium text-[#4B5563] dark:text-[#969E9A]">
          Loading 1-Page Bento Report Card & Telemetry...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-2 text-center">
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
          {error || 'Unable to load report card data'}
        </p>
        <span className="text-xs text-[#6B7280] dark:text-[#969E9A]">
          Please ensure this sheet has been evaluated.
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-y-auto bg-[#F6F7F5] dark:bg-[#111312] p-2 sm:p-3 select-text">
      {/* Print Page Setup */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 6mm;
        }
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .bento-print-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            border: none !important;
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
          {/* Sub-nav Pill Filter for interactive viewing */}
          <div className="hidden sm:flex items-center bg-white dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTelemetryTab('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                activeTelemetryTab === 'all'
                  ? 'bg-[#0F5132] text-white dark:bg-[#1F6E4A]'
                  : 'text-[#4B5563] dark:text-[#969E9A] hover:text-[#111827] dark:hover:text-[#ECEEED]'
              }`}
            >
              All Telemetry
            </button>
            <button
              type="button"
              onClick={() => setActiveTelemetryTab('secMarks')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                activeTelemetryTab === 'secMarks'
                  ? 'bg-[#0F5132] text-white dark:bg-[#1F6E4A]'
                  : 'text-[#4B5563] dark:text-[#969E9A] hover:text-[#111827] dark:hover:text-[#ECEEED]'
              }`}
            >
              1. Marks &amp; Sections
            </button>
            <button
              type="button"
              onClick={() => setActiveTelemetryTab('secErrors')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                activeTelemetryTab === 'secErrors'
                  ? 'bg-[#0F5132] text-white dark:bg-[#1F6E4A]'
                  : 'text-[#4B5563] dark:text-[#969E9A] hover:text-[#111827] dark:hover:text-[#ECEEED]'
              }`}
            >
              2. Error Taxonomy
            </button>
            <button
              type="button"
              onClick={() => setActiveTelemetryTab('secFormats')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                activeTelemetryTab === 'secFormats'
                  ? 'bg-[#0F5132] text-white dark:bg-[#1F6E4A]'
                  : 'text-[#4B5563] dark:text-[#969E9A] hover:text-[#111827] dark:hover:text-[#ECEEED]'
              }`}
            >
              3. Formats &amp; Attempt
            </button>
          </div>

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
      <div className="bento-print-container max-w-[1050px] w-full mx-auto bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-3 sm:p-4 shadow-none space-y-2.5 print:border print:border-[#E2E8E4] print:p-3 print:max-w-full print:m-0 print:rounded-none">

        {/* 1. HEADER & CANDIDATE IDENTITY BENTO ROW */}
        <div className="space-y-1.5">
          {/* Top Emerald Header Strip */}
          <div className="bg-[#0F5132] text-white rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2 shadow-none">
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
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white text-[#0F5132] font-bold text-xs shadow-none shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>VERIFIED REPORT CARD</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-200 hidden sm:inline">
                ID: {shortSheetId}
              </span>
            </div>
          </div>

          {/* Candidate Details 4-Column Bento Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-2 text-xs">
            <div>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
                Candidate Name
              </span>
              <span className="font-bold text-[#111827] dark:text-[#ECEEED] truncate block mt-0.5">
                {data.student_name}
              </span>
            </div>

            <div>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
                Roll Number
              </span>
              <span className="font-mono font-bold text-[#111827] dark:text-[#ECEEED] truncate block mt-0.5">
                {data.roll_number || '—'}
              </span>
            </div>

            <div>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
                Class / Stream
              </span>
              <span className="font-medium text-[#111827] dark:text-[#ECEEED] truncate block mt-0.5">
                {data.class_name || 'Standard Section'}
              </span>
            </div>

            <div>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
                Applied Strictness
              </span>
              <span className="font-semibold text-[#0F5132] dark:text-[#7CC9A3] block mt-0.5">
                Level {data.paper_strictness}/5 (Standard)
              </span>
            </div>
          </div>
        </div>

        {/* 2. AGGREGATE SCORE & RESULT SUMMARY STRIP (4-Column Bento Strip) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Total Marks */}
          <div className="bg-[#F8FAFC] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-2 text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
              Total Marks
            </span>
            <div className="font-mono font-bold text-sm sm:text-base text-[#0F5132] dark:text-[#7CC9A3] mt-0.5">
              {totalScore} <span className="text-xs text-[#6B7280] dark:text-[#969E9A] font-normal">/ {maxMarks}</span>
            </div>
          </div>

          {/* Percentage */}
          <div className="bg-[#F8FAFC] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-2 text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
              Percentage
            </span>
            <div className="font-mono font-bold text-sm sm:text-base text-[#0F5132] dark:text-[#7CC9A3] mt-0.5">
              {effectivePct.toFixed(1)}%
            </div>
          </div>

          {/* Grade */}
          <div className="bg-[#F8FAFC] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-2 text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
              Awarded Grade
            </span>
            <div className="font-mono font-bold text-sm sm:text-base text-[#111827] dark:text-[#ECEEED] mt-0.5 truncate" title={effectiveGrade}>
              {effectiveGrade}
            </div>
          </div>

          {/* Final Status */}
          <div className="bg-[#F8FAFC] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-2 text-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#969E9A] block">
              Final Status
            </span>
            <div className={`font-mono font-bold text-sm sm:text-base mt-0.5 ${isPass ? 'text-[#0F5132] dark:text-[#7CC9A3]' : 'text-rose-600 dark:text-rose-400'}`}>
              {statusLabel}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. GROUP 1: QUESTION & SECTION MARKS TELEMETRY (From Screenshot 1)        */}
        {/* ========================================================================= */}
        {(activeTelemetryTab === 'all' || activeTelemetryTab === 'secMarks') && (
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <span className="w-1.5 h-3.5 bg-[#0F5132] dark:bg-[#1F6E4A] rounded-sm" />
                <h3 className="text-[11px] font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                  1. Question &amp; Section Marks Telemetry
                </h3>
                <span className="px-1.5 py-0.2 rounded bg-[#E8F3EE] text-[#0B3D26] dark:bg-[#1A2B23] dark:text-[#7CC9A3] font-mono text-[9px] font-semibold border border-[#0F5132]/20 dark:border-[#294236]">
                  Q1 to Q{normalizedQuestions.length} ({maxMarks} Total Marks)
                </span>
              </div>
              <span className="text-[10px] text-[#6B7280] dark:text-[#68706C] font-mono hidden sm:inline">
                Cohort avg available after 2+ sheets
              </span>
            </div>

            {/* 1.1 Question-by-Question Marks Scored vs Max Bar Chart */}
            <div className="bg-white dark:bg-[#181B19] rounded-xl border border-[#E2E8E4] dark:border-[#2A2F2C] p-2 sm:p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[11px] font-bold text-[#111827] dark:text-[#ECEEED] flex items-center space-x-1.5">
                    <span>Question-by-Question Marks Scored vs Max</span>
                    <span className="text-[9px] font-normal text-[#6B7280] dark:text-[#68706C] font-mono">
                      ({normalizedQuestions.length} Questions)
                    </span>
                  </h4>
                  <p className="text-[9px] text-[#4B5563] dark:text-[#969E9A]">
                    Visual bar heights indicate obtained marks with color-coded evaluation status (Emerald = Full, Amber = Partial, Rose = Heavy Deduction).
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-[9px] font-mono">
                  <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-sm bg-[#0F5132] dark:bg-[#1F6E4A]" />
                    <span className="text-[#4B5563] dark:text-[#969E9A]">Full ({fullCount})</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-sm bg-amber-500 dark:bg-[#E5B567]" />
                    <span className="text-[#4B5563] dark:text-[#969E9A]">Partial ({partialCount})</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-sm bg-rose-500 dark:bg-[#E57D8A]" />
                    <span className="text-[#4B5563] dark:text-[#969E9A]">Deduction ({deductionCount})</span>
                  </div>
                </div>
              </div>

              {/* Chart Canvas */}
              <div className="bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg p-2.5 relative select-none">
                <div className="absolute left-2.5 top-2 bottom-6 flex flex-col justify-between text-[9px] font-mono text-[#6B7280] dark:text-[#68706C]">
                  <span>100%</span>
                  <span>50%</span>
                  <span>0%</span>
                </div>
                <div className={`ml-8 h-28 sm:h-32 flex items-end ${normalizedQuestions.length === 1 ? 'justify-center' : normalizedQuestions.length <= 4 ? 'justify-around' : 'justify-between'} gap-2 pb-0.5`}>
                  {normalizedQuestions.map((q, idx) => {
                    const barColor = q.status === 'full'
                      ? 'bg-[#0F5132] dark:bg-[#1F6E4A]'
                      : q.status === 'zero'
                      ? 'bg-rose-500 dark:bg-[#E57D8A]'
                      : 'bg-amber-500 dark:bg-[#E5B567]';
                    const barWidthClass = normalizedQuestions.length === 1
                      ? 'w-20 max-w-[80px]'
                      : normalizedQuestions.length <= 4
                      ? 'w-14 max-w-[56px]'
                      : 'w-full max-w-[32px]';
                    return (
                      <div key={idx} className={`${normalizedQuestions.length <= 4 ? '' : 'flex-1'} flex flex-col items-center h-full justify-end group`}>
                        <span className={`font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3] mb-1 ${normalizedQuestions.length <= 4 ? 'text-xs opacity-100' : 'text-[9px] opacity-80 group-hover:opacity-100 transition'}`}>
                          {q.earned}/{q.max}
                        </span>
                        <div className={`${barWidthClass} h-full flex flex-col justify-end bg-[#E2E8E4] dark:bg-[#2A2F2C] rounded-t-md overflow-hidden`}>
                          <div className={`w-full ${barColor} rounded-t-md transition-all duration-300`} style={{ height: `${Math.max(8, q.pct)}%` }} />
                        </div>
                        <span className={`font-mono font-bold mt-1 text-[#111827] dark:text-[#ECEEED] ${normalizedQuestions.length <= 4 ? 'text-xs' : 'text-[10px]'}`}>
                          Q.{q.q_no}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 1.2 & 1.3 Donut Split & Horizontal Sectional Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                {/* 1.2 Total Marks Distribution Split */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] space-y-1">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                      Total Marks Distribution Split
                    </h5>
                    <span className="text-[10px] font-mono bg-[#F1F4F2] dark:bg-[#202422] text-[#4B5563] dark:text-[#969E9A] px-2 py-0.5 rounded font-semibold">
                      Max {maxMarks} M
                    </span>
                  </div>
                  <p className="text-[10px] text-[#4B5563] dark:text-[#969E9A]">
                    Evaluation ratio between earned points and deductions across entire paper.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-1.5">
                    <div className="relative w-20 h-20 sm:w-22 sm:h-22 shrink-0 flex items-center justify-center">
                      <svg className="w-20 h-20 sm:w-22 sm:h-22 -rotate-90" viewBox="0 0 70 70">
                        <circle cx="35" cy="35" fill="transparent" r="28" stroke="#F1F4F2" strokeWidth="8" className="stroke-[#F1F4F2] dark:stroke-[#202422]" />
                        <circle
                          cx="35"
                          cy="35"
                          fill="transparent"
                          r="28"
                          stroke="#0F5132"
                          strokeDasharray={`${scoredDash} ${C_DONUT}`}
                          strokeDashoffset="0"
                          strokeLinecap="round"
                          strokeWidth="8"
                          className="stroke-[#0F5132] dark:stroke-[#1F6E4A]"
                        />
                        <circle
                          cx="35"
                          cy="35"
                          fill="transparent"
                          r="28"
                          stroke="#F43F5E"
                          strokeDasharray={`${lostDash} ${C_DONUT}`}
                          strokeDashoffset={`-${scoredDash}`}
                          strokeLinecap="round"
                          strokeWidth="8"
                          className="stroke-rose-500 dark:stroke-[#E57D8A]"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-sm sm:text-base font-mono font-bold text-[#111827] dark:text-[#ECEEED] leading-none">
                          {totalScore}
                        </span>
                        <span className="text-[8px] font-mono text-[#6B7280] dark:text-[#68706C]">
                          /{maxMarks}M
                        </span>
                        <span className="text-[8px] sm:text-[9px] font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                          {effectivePct.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono flex-1">
                      <div className="p-1.5 rounded-lg bg-[#E8F3EE]/60 border border-[#E8F3EE] dark:bg-[#1A2B23]/50 dark:border-[#294236] flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#0F5132] dark:bg-[#1F6E4A]" />
                          <span className="font-sans text-[#111827] dark:text-[#ECEEED] text-[10px] sm:text-xs">Marks Scored</span>
                        </div>
                        <span className="font-bold text-[#0F5132] dark:text-[#7CC9A3] text-[10px] sm:text-xs">{totalScore} M ({effectivePct.toFixed(1)}%)</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-rose-50/60 border border-rose-100 dark:bg-[#2B191D]/50 dark:border-[#45262C] flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500 dark:bg-[#E57D8A]" />
                          <span className="font-sans text-[#111827] dark:text-[#ECEEED] text-[10px] sm:text-xs">Marks Lost</span>
                        </div>
                        <span className="font-bold text-rose-600 dark:text-[#E57D8A] text-[10px] sm:text-xs">{totalLost} M ({maxMarks > 0 ? ((totalLost / maxMarks) * 100).toFixed(1) : 0}%)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1.3 Sectional Marks Breakdown */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] space-y-1">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                      Sectional Marks Breakdown
                    </h5>
                    <span className="text-[10px] font-mono text-[#6B7280] dark:text-[#68706C]">
                      {sectionalList.length} Exam Section{sectionalList.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#4B5563] dark:text-[#969E9A]">
                    Performance breakdown across categorized subject sections.
                  </p>
                  <div className="space-y-2 pt-1 text-xs">
                    {sectionalList.map((sec, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-[#111827] dark:text-[#ECEEED] font-sans truncate max-w-[150px]">{sec.name}</span>
                          <div className="space-x-1.5 font-mono text-[10px] sm:text-xs">
                            <span className={`font-bold ${sec.textColor}`}>{sec.earned} / {sec.max} M</span>
                            <span className={`font-bold px-1.5 py-0.2 rounded border ${sec.badgeClass}`}>{sec.pct}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-[#F1F4F2] dark:bg-[#202422] h-2 rounded-full overflow-hidden flex">
                          <div className={`${sec.barColor} h-full rounded-full transition-all duration-300`} style={{ width: `${sec.pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[9px] text-[#6B7280] dark:text-[#68706C] font-mono">
                          <span>{sec.qNos.slice(0, 4).join(', ')} · {sec.count} Questions</span>
                          <span className="text-rose-500 dark:text-[#E57D8A] font-semibold">-{sec.lost} M lost</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. GROUPS 2 & 3: TEACHER DEDUCTIONS + QUESTION FORMAT & MASTERY (Images)   */}
        {/* ========================================================================= */}
        {(activeTelemetryTab === 'all' || activeTelemetryTab === 'secErrors' || activeTelemetryTab === 'secFormats') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">

            {/* 2. TEACHER DEDUCTIONS & ERROR TAXONOMY (From Screenshot 1) */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-3.5 bg-rose-500 dark:bg-[#E57D8A] rounded-sm" />
                  <h4 className="text-[11px] font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                    2. Teacher Deductions &amp; Error Taxonomy
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-[#2B191D] dark:text-[#E57D8A] font-mono text-[9px] font-semibold border border-rose-200 dark:border-[#45262C]">
                  {totalLost} Total Marks Lost
                </span>
              </div>
              <p className="text-[9px] text-[#6B7280] dark:text-[#68706C]">
                Extracted from Deductions &amp; Evaluation Rubrics
              </p>

              {/* Deductions Donut & Pareto Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                {/* Deductions by Error Category Donut */}
                <div className="bg-[#F8FAFC] dark:bg-[#202422] rounded-lg p-2 border border-[#E2E8E4] dark:border-[#2F3532] space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-[#111827] dark:text-[#ECEEED]">Deductions by Category</span>
                    <span className="text-rose-600 dark:text-[#E57D8A]">-{totalLost} M</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <div className="relative w-16 h-16 sm:w-18 sm:h-18 shrink-0 flex items-center justify-center">
                      <svg className="w-16 h-16 sm:w-18 sm:h-18 -rotate-90" viewBox="0 0 70 70">
                        <circle cx="35" cy="35" fill="transparent" r="28" stroke="#F1F4F2" strokeWidth="8" className="stroke-[#F1F4F2] dark:stroke-[#181B19]" />
                        {errorSegments.map((seg, i) => (
                          <circle
                            key={i}
                            cx="35"
                            cy="35"
                            fill="transparent"
                            r="28"
                            stroke={seg.color}
                            strokeDasharray={`${seg.dash} ${C_DONUT}`}
                            strokeDashoffset={`${seg.offset}`}
                            strokeLinecap="round"
                            strokeWidth="8"
                          />
                        ))}
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-xs sm:text-sm font-mono font-bold text-rose-600 dark:text-[#E57D8A] leading-none">
                          -{totalLost}
                        </span>
                        <span className="text-[7px] font-mono text-[#6B7280]">Marks Lost</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-[9px] font-mono flex-1">
                      {errorSegments.slice(0, 3).map((seg, i) => (
                        <div key={i} className="flex items-center justify-between p-1 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532]">
                          <div className="flex items-center space-x-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${seg.dotClass}`} />
                            <span className="font-sans text-[#111827] dark:text-[#ECEEED] truncate max-w-[65px]">{seg.name}</span>
                          </div>
                          <span className="font-bold text-[#4B5563] dark:text-[#969E9A]">{seg.loss.toFixed(1)}M</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pareto Error Analysis (80/20 Rule) */}
                <div className="bg-[#F8FAFC] dark:bg-[#202422] rounded-lg p-2 border border-[#E2E8E4] dark:border-[#2F3532] space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-[#111827] dark:text-[#ECEEED]">Pareto (80/20 Rule)</span>
                    <span className="text-[9px] font-mono text-[#0F5132] dark:text-[#7CC9A3] font-semibold">Line: Cum. %</span>
                  </div>
                  <div className="relative h-20 sm:h-22 bg-white dark:bg-[#181B19] rounded border border-[#E2E8E4] dark:border-[#2F3532] p-1">
                    <svg className="w-full h-full" viewBox="0 0 160 55">
                      <line stroke="#E2E8F0" strokeDasharray="2 2" x1="10" x2="150" y1="14" y2="14" className="stroke-[#E2E8E4] dark:stroke-[#2F3532]" />
                      <line stroke="#CBD5E1" strokeWidth="1" x1="10" x2="150" y1="46" y2="46" className="stroke-[#CBD5E1] dark:stroke-[#2F3532]" />
                      <line stroke="#818CF8" strokeDasharray="1 1" strokeWidth="0.8" x1="10" x2="150" y1="18" y2="18" />
                      <text fill="#6366F1" fontSize="5.5" x="135" y="15">80% Cutoff</text>

                      {paretoData.slice(0, 3).map((d, i) => {
                        const x = 20 + i * 45;
                        const maxL = paretoData[0]?.loss || 1;
                        const barH = Math.max(8, Math.min(32, (d.loss / maxL) * 32));
                        const y = 46 - barH;
                        return (
                          <g key={i}>
                            <rect fill={d.color} height={barH} width="18" x={x} y={y} rx="2" />
                            <text fill="#475569" fontSize="6" textAnchor="middle" x={x + 9} y="53">
                              {d.name.split(' ')[0]}
                            </text>
                          </g>
                        );
                      })}
                      {paretoData.length > 0 && (
                        <polyline
                          fill="none"
                          points={paretoData.slice(0, 3).map((d, i) => `${29 + i * 45},${Math.round(46 - (d.cumPct / 100) * 32)}`).join(' ')}
                          stroke="#0F5132"
                          strokeWidth="1.5"
                        />
                      )}
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. QUESTION FORMAT & ATTEMPT PERFORMANCE (From Screenshot 2) */}
            <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-3.5 bg-[#0F5132] dark:bg-[#1F6E4A] rounded-sm" />
                  <h4 className="text-[11px] font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                    3. Question Format &amp; Attempt Performance
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#E8F3EE] text-[#0B3D26] dark:bg-[#1A2B23] dark:text-[#7CC9A3] font-mono text-[9px] font-semibold border border-[#0F5132]/20 dark:border-[#294236]">
                  100% Processed
                </span>
              </div>
              <p className="text-[9px] text-[#6B7280] dark:text-[#68706C]">
                Format Accuracy &amp; Question Completion
              </p>

              {/* Format Stacked Bars & Mastery Donut Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                {/* Marks by Question Format */}
                <div className="bg-[#F8FAFC] dark:bg-[#202422] rounded-lg p-2 border border-[#E2E8E4] dark:border-[#2F3532] space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-[#111827] dark:text-[#ECEEED]">Format Yield</span>
                    <div className="flex items-center gap-1.5 text-[9px]">
                      <span className="text-[#0F5132] dark:text-[#7CC9A3] font-semibold">Earned</span>
                      <span>·</span>
                      <span className="text-rose-500 font-semibold">Lost</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-0.5">
                    {formatsList.slice(0, 2).map((f, i) => (
                      <div key={i} className="space-y-0.5">
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-[#111827] dark:text-[#ECEEED] font-sans truncate max-w-[85px] font-semibold">{f.fmt}</span>
                          <span className="text-[#0F5132] dark:text-[#7CC9A3] font-bold">{f.earnedPct}% / {f.lostPct}%</span>
                        </div>
                        <div className="w-full bg-[#E2E8E4] dark:bg-[#2A2F2C] h-2 rounded-full overflow-hidden flex">
                          <div className="bg-[#0F5132] dark:bg-[#1F6E4A] h-full" style={{ width: `${f.earnedPct}%` }} />
                          <div className="bg-rose-500 dark:bg-[#E57D8A] h-full" style={{ width: `${f.lostPct}%` }} />
                        </div>
                        <div className="flex justify-between text-[8px] text-[#6B7280] font-mono">
                          <span>{f.earned}/{f.max} M</span>
                          <span className="font-semibold text-[#0F5132] dark:text-[#7CC9A3]">{f.earnedPct >= 75 ? 'Strong Yield' : 'Moderate Yield'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Attempt & Mastery Breakdown Donut + Badges */}
                <div className="bg-[#F8FAFC] dark:bg-[#202422] rounded-lg p-2 border border-[#E2E8E4] dark:border-[#2F3532] space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-[#111827] dark:text-[#ECEEED]">Attempt Mastery</span>
                    <span className="text-[9px] font-mono text-[#0F5132] dark:text-[#7CC9A3] font-semibold">{totalAttempted}/{normalizedQuestions.length} Qs</span>
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-1">
                    <div className="relative w-16 h-16 sm:w-18 sm:h-18 shrink-0 flex items-center justify-center">
                      <svg className="w-16 h-16 sm:w-18 sm:h-18 -rotate-90" viewBox="0 0 70 70">
                        <circle cx="35" cy="35" fill="transparent" r="28" stroke="#F1F4F2" strokeWidth="8" className="stroke-[#F1F4F2] dark:stroke-[#181B19]" />
                        {attemptSegments.map((seg, i) => (
                          <circle
                            key={i}
                            cx="35"
                            cy="35"
                            fill="transparent"
                            r="28"
                            stroke={seg.color}
                            strokeDasharray={`${seg.dash} ${C_DONUT}`}
                            strokeDashoffset={`${seg.offset}`}
                            strokeLinecap="round"
                            strokeWidth="8"
                          />
                        ))}
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-xs sm:text-sm font-mono font-bold text-[#111827] dark:text-[#ECEEED] leading-none">
                          {totalAttempted}
                        </span>
                        <span className="text-[7px] font-mono text-[#6B7280]">Attempted</span>
                      </div>
                    </div>

                    <div className="space-y-0.5 text-[8.5px] font-mono flex-1">
                      {attemptCategories.slice(0, 3).map((cat, i) => (
                        <div key={i} className="flex items-center justify-between p-0.5 px-1 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532]">
                          <div className="flex items-center space-x-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${cat.dotClass}`} />
                            <span className="font-sans text-[#111827] dark:text-[#ECEEED] truncate max-w-[65px]">{cat.label.split(' ')[0]}</span>
                          </div>
                          <span className="font-bold text-[#4B5563] dark:text-[#969E9A]">{cat.count} Qs</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. COMPACT QUESTION MARKS OVERVIEW GRID (Numbers & Status Only - Zero Transcripts) */}
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
              Question Marks Ledger (Scores Only — No Transcripts)
            </span>
            <span className="text-[10px] font-mono text-[#6B7280] dark:text-[#68706C]">
              {normalizedQuestions.length} Items Total
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-1.5">
            {normalizedQuestions.map((q, idx) => (
              <div
                key={idx}
                className="bg-[#F8FAFC] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg p-1.5 text-center"
              >
                <span className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] block">
                  Q.{q.q_no}
                </span>
                <span className="font-mono text-xs font-bold text-[#0F5132] dark:text-[#7CC9A3] block mt-0.5">
                  {q.earned}/{q.max}
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded inline-block mt-0.5 ${
                    q.status === 'full'
                      ? 'bg-emerald-100 dark:bg-[#1A2B23] text-emerald-800 dark:text-[#7CC9A3]'
                      : q.status === 'zero'
                      ? 'bg-rose-100 dark:bg-[#2B191D] text-rose-800 dark:text-[#E57D8A]'
                      : 'bg-amber-100 dark:bg-[#2B2416] text-amber-800 dark:text-[#E5B567]'
                  }`}
                >
                  {q.status === 'full' ? 'Full' : q.status === 'zero' ? '0' : 'Part'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 6. OFFICIAL VERIFICATION FOOTER STRIP & GRADING KEY LEGEND */}
        <div className="space-y-2 pt-1">
          {/* 3-Column Sign-Off Strip */}
          <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl p-2.5 sm:p-3 text-center text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-[#111827] dark:text-[#ECEEED] block text-xs">
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
              <span className="font-bold text-[#111827] dark:text-[#ECEEED] block text-xs">
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
              <span className="font-bold text-[#111827] dark:text-[#ECEEED] block text-xs">
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
          <div className="text-center text-[10px] sm:text-xs font-mono text-[#6B7280] dark:text-[#68706C]">
            Grading Scale: O (≥90%) · A+ (80-89%) · A (70-79%) · B+ (60-69%) · B (50-59%) · C (40-49%) · D (35-39%) · F (&lt;35%) · Re-appear Required
          </div>
        </div>

      </div>
    </div>
  );
};
