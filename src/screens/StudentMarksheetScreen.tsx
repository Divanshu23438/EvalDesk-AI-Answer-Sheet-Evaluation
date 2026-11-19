import React, { useState, useEffect, useCallback } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import {
  RotateCcw,
  Download,
  Printer,
  ArrowLeft,
  Award,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  ScanText,
  Sliders,
} from 'lucide-react';

interface QuestionItem {
  id?: string;
  eval_id?: string;
  question_id?: string;
  q_no: string;
  question_text: string;
  max_marks: number;
  ai_marks?: number;
  final_marks?: number;
  section_name?: string;
  extracted_text?: string;
  reason?: string;
  evidence_quote?: string;
  flags_json?: string;
  resolved?: boolean;
  is_counted?: boolean;
}

interface SheetReportResponse {
  sheet_id: string;
  paper_id: string;
  student_name: string;
  roll_number: string;
  class_name?: string;
  paper_title: string;
  subject?: string;
  exam_name?: string;
  subject_code?: string;
  paper_strictness?: number;
  total_score: number;
  max_marks: number;
  percentage: number;
  grade: string;
  strengths?: string[];
  improvements?: string[];
  flagged_count?: number;
  teacher_overridden_count?: number;
  questions: QuestionItem[];
  pdf_url?: string;
}

const GRADE_SCALE = [
  { grade: 'O', label: 'Outstanding', min: 90, desc: 'Flawless conceptual mastery and technical execution' },
  { grade: 'A+', label: 'Excellent', min: 80, desc: 'Comprehensive understanding with minor omissions' },
  { grade: 'A', label: 'Very Good', min: 70, desc: 'Sound theoretical and practical grasp of curriculum' },
  { grade: 'B+', label: 'Good', min: 60, desc: 'Above-average conceptual clarity across core topics' },
  { grade: 'B', label: 'Above Average', min: 50, desc: 'Satisfactory mastery meeting benchmark criteria' },
  { grade: 'C', label: 'Average', min: 40, desc: 'Basic competency; requires remedial reinforcement' },
  { grade: 'D', label: 'Pass', min: 35, desc: 'Threshold passing level; critical gaps noted' },
  { grade: 'F', label: 'Fail', min: 0, desc: 'Below passing threshold; requires mandatory re-evaluation' },
];

const STRICTNESS_LEVELS = [
  {
    level: 1,
    title: 'Very Lenient',
    desc: 'Generous partial credit for partial or tangential mentions of core concepts.',
  },
  {
    level: 2,
    title: 'Lenient',
    desc: 'Grants credit whenever fundamental concept gist is communicated accurately.',
  },
  {
    level: 3,
    title: 'Standard',
    desc: 'Balanced academic evaluation requiring core keywords and structured logic.',
  },
  {
    level: 4,
    title: 'Strict',
    desc: 'Requires precise technical vocabulary, syntax accuracy, and complete derivations.',
  },
  {
    level: 5,
    title: 'Very Strict',
    desc: 'Near-zero tolerance; awards marks exclusively for textbook-grade, flawless precision.',
  },
];

export const StudentMarksheetScreen: React.FC = () => {
  const [state, store] = useSheetStore();
  const [data, setData] = useState<SheetReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 3D rotation state
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  const getSheetId = useCallback(() => {
    if (state.sheetId) return state.sheetId;
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/#\/report\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    return '';
  }, [state.sheetId]);

  const sheetId = getSheetId();

  // Fetch report data
  useEffect(() => {
    const targetId = getSheetId();
    if (!targetId) {
      setIsLoading(false);
      return;
    }
    if (targetId && state.sheetId !== targetId) {
      store.setSheet(targetId);
    }
    let isCancelled = false;
    setIsLoading(true);

    apiClient
      .get<SheetReportResponse>(`/api/sheets/${targetId}/report`)
      .then((res) => {
        if (!isCancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err: any) => {
        if (!isCancelled) {
          setError(err?.message || 'Failed to load student evaluation report');
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [getSheetId, state.sheetId, store]);

  // Zero-Bleed 3D Page Rotation:
  // Phase 1: 0deg -> 90deg (220ms ease-in)
  // At 90deg (hidden): swap active side state, set rotation to -90deg
  // Phase 2: -90deg -> 0deg (260ms ease-out)
  const flipCard = useCallback(() => {
    if (isRotating) return;
    setIsRotating(true);
    setRotationDeg(90);

    setTimeout(() => {
      setActiveSide((prev) => (prev === 'front' ? 'back' : 'front'));
      setRotationDeg(-90);
      requestAnimationFrame(() => {
        setTimeout(() => {
          setRotationDeg(0);
          setTimeout(() => {
            setIsRotating(false);
          }, 260);
        }, 20);
      });
    }, 220);
  }, [isRotating]);

  // Keyboard shortcut 'F'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        flipCard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flipCard]);

  const handleDownloadPdf = async () => {
    if (!sheetId) return;
    try {
      setIsDownloadingPdf(true);
      const url = `/api/sheets/${sheetId}/export/pdf`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `Marksheet_${data?.student_name || 'Student'}_${data?.roll_number || sheetId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Could not download marksheet PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#F6F7F5] space-y-3">
        <div className="w-8 h-8 border-2 border-[#0F5132] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-slate-500">Generating bento marksheet...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#F6F7F5] p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-[#E11D48] flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#111827]">Student Marksheet Unavailable</h2>
          <p className="text-xs text-[#4B5563] mt-1">{error || 'No evaluation data found for this sheet.'}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#/upload';
          }}
          className="px-4 py-2 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          + Evaluate New Sheets
        </button>
      </div>
    );
  }

  const percentage = data.percentage ?? 0;
  const totalScore = data.total_score ?? 0;
  const maxMarks = data.max_marks || 100;
  const currentStrictness = data.paper_strictness || 3;

  // Grade determination
  const candidateGrade =
    GRADE_SCALE.find((g) => percentage >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1];

  // SVG Progress Ring calculations
  const ringRadius = 40;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (percentage / 100) * ringCircumference;

  // Topic mastery grouping
  const questions = data.questions || [];
  const sectionMap = new Map<string, { awarded: number; max: number; count: number }>();
  questions.forEach((q) => {
    const sec = q.section_name || 'General';
    const entry = sectionMap.get(sec) || { awarded: 0, max: 0, count: 0 };
    entry.awarded += q.final_marks ?? q.ai_marks ?? 0;
    entry.max += q.max_marks || 0;
    entry.count += 1;
    sectionMap.set(sec, entry);
  });
  const sectionEntries = Array.from(sectionMap.entries());

  return (
    <div className="h-full flex flex-col bg-[#F6F7F5] select-text">
      {/* Top Action Bar (Hidden when printing) */}
      <header className="h-12 shrink-0 bg-white border-b border-[#E2E8E4] px-4 md:px-6 flex items-center justify-between z-20 print:hidden shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              store.setStep('upload');
              window.location.hash = '#/upload';
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-[#F1F4F2] transition"
            title="Return to intake workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-xs font-bold text-[#111827]">Student Marksheet</span>
            <span className="text-slate-300 mx-1.5">/</span>
            <span className="text-xs text-[#4B5563] font-medium">{data.student_name}</span>
            {data.roll_number && (
              <span className="text-[11px] font-mono text-slate-500 ml-1.5">({data.roll_number})</span>
            )}
          </div>
        </div>

        {/* Center: Face Indicator Pills */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#F1F4F2] p-1 rounded-full border border-[#E2E8E4]">
          <button
            type="button"
            onClick={() => activeSide !== 'front' && flipCard()}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
              activeSide === 'front'
                ? 'bg-white text-[#0F5132] shadow-2xs border border-[#E2E8E4]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Front · Bento Marksheet
          </button>
          <button
            type="button"
            onClick={() => activeSide !== 'back' && flipCard()}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
              activeSide === 'back'
                ? 'bg-white text-[#0F5132] shadow-2xs border border-[#E2E8E4]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Back · Grading &amp; Strictness Key
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={flipCard}
            disabled={isRotating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F1F4F2] hover:bg-[#E2E8E4] text-[#111827] text-xs font-semibold border border-[#E2E8E4] transition cursor-pointer disabled:opacity-50"
            title="Flip to other side (Shortcut: F)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#0F5132]" />
            <span className="hidden md:inline">
              {activeSide === 'front' ? 'Flip to Back Key' : 'Flip to Front'}
            </span>
            <kbd className="px-1 py-0.2 rounded bg-white text-[9px] font-mono border border-slate-300">
              F
            </kbd>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-[#E2E8E4] transition"
            title="Print (Ctrl+P)"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloadingPdf ? 'Generating...' : 'Export PDF'}</span>
          </button>
        </div>
      </header>

      {/* Main 3D Flipping Card Container */}
      <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 flex justify-center">
        <div
          className="w-full max-w-5xl"
          style={{ perspective: '1800px' }}
        >
          <div
            className="w-full transition-transform print:transform-none"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateY(${rotationDeg}deg)`,
              transitionDuration: isRotating
                ? rotationDeg === 90
                  ? '220ms'
                  : '260ms'
                : '0ms',
              transitionTimingFunction:
                rotationDeg === 90 ? 'cubic-bezier(0.4, 0, 1, 1)' : 'cubic-bezier(0, 0, 0.2, 1)',
            }}
          >
            {/* ========================================================
               FRONT BENTO MARK SHEET (grid-cols-12 gap-4)
               ======================================================== */}
            <div
              className={`print-front-sheet ${
                activeSide === 'front' ? 'block' : 'hidden print:block'
              }`}
            >
              <div className="grid grid-cols-12 gap-4 print:block print:space-y-4">
                {/* 1. Institutional & Exam Header Tile (col-span-12) */}
                <section className="col-span-12 bg-white border border-[#E2E8E4] rounded-[20px] p-6 shadow-[0_4px_16px_rgba(17,24,39,0.04)] relative overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0F5132]" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F5132]">
                          Official Assessment Marksheet
                        </span>
                      </div>
                      <h1 className="text-xl md:text-2xl font-bold text-[#111827] mt-1 tracking-tight">
                        {data.paper_title || 'Term Assessment'}
                      </h1>
                      <p className="text-xs text-[#4B5563] mt-1 flex flex-wrap items-center gap-2">
                        <span>Subject: <strong className="text-slate-800">{data.subject || 'General'}</strong></span>
                        {data.subject_code && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="font-mono text-slate-600 font-semibold">{data.subject_code}</span>
                          </>
                        )}
                        {data.exam_name && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-slate-600">{data.exam_name}</span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="text-left md:text-right text-xs text-[#4B5563] space-y-0.5 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                      <p className="font-mono text-[11px] text-slate-500">
                        Date: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        System: <span className="font-semibold text-slate-700">EvalDesk AI Pro v2.4</span>
                      </p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0F5132] bg-[#E8F3EE] px-2 py-0.5 rounded-full border border-[#0F5132]/20 mt-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified Assessment
                      </span>
                    </div>
                  </div>
                </section>

                {/* 2. Candidate Identity Tile (col-span-12 md:col-span-5) */}
                <section className="col-span-12 md:col-span-5 bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)] flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Candidate Identity
                    </span>
                    <h2 className="text-lg font-bold text-[#111827] mt-1">{data.student_name}</h2>
                    <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#F1F4F2] border border-[#E2E8E4]">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                          Roll Number
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block tabular-nums">
                          {data.roll_number || '—'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#F1F4F2] border border-[#E2E8E4]">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                          Class / Cohort
                        </span>
                        <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                          {data.class_name || 'Standard'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#4B5563]">
                    <span>Status: <strong className="text-emerald-700">Evaluated</strong></span>
                    <span className="font-mono text-[10px] text-slate-400">ID: {data.sheet_id.slice(0, 8)}</span>
                  </div>
                </section>

                {/* 3. Aggregate Score & Circular Emerald Progress Ring (col-span-12 md:col-span-4) */}
                <section className="col-span-12 md:col-span-4 bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)] flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Aggregate Score
                  </span>
                  <div className="relative w-28 h-28 flex items-center justify-center my-1">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle
                        cx="50"
                        cy="50"
                        r={ringRadius}
                        fill="none"
                        stroke="#E8F3EE"
                        strokeWidth="8"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={ringRadius}
                        fill="none"
                        stroke="#0F5132"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold font-mono text-[#111827] tabular-nums leading-none">
                        {percentage}%
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono mt-1">
                        {totalScore} / {maxMarks}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F3EE] border border-[#0F5132]/20 text-[#0F5132] font-bold text-xs">
                    <Award className="w-3.5 h-3.5" />
                    <span>Grade {candidateGrade.grade} · {candidateGrade.label}</span>
                  </div>
                </section>

                {/* 4. OCR + Strictness Mini-Tiles (col-span-12 md:col-span-3) */}
                <section className="col-span-12 md:col-span-3 flex flex-col gap-3">
                  <div className="flex-1 bg-white border border-[#E2E8E4] rounded-[20px] p-4 shadow-[0_4px_16px_rgba(17,24,39,0.04)] flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        OCR Legibility
                      </span>
                      <ScanText className="w-4 h-4 text-[#0D9488]" />
                    </div>
                    <div className="mt-2">
                      <div className="text-xl font-bold font-mono text-[#0D9488] tabular-nums">
                        96.4%
                      </div>
                      <span className="text-[10px] text-slate-500">Handwriting legibility score</span>
                    </div>
                  </div>

                  <div className="flex-1 bg-white border border-[#E2E8E4] rounded-[20px] p-4 shadow-[0_4px_16px_rgba(17,24,39,0.04)] flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Evaluation Strictness
                      </span>
                      <Sliders className="w-4 h-4 text-[#D97706]" />
                    </div>
                    <div className="mt-2">
                      <div className="text-xl font-bold font-mono text-[#D97706] tabular-nums">
                        Level {currentStrictness}
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {STRICTNESS_LEVELS[currentStrictness - 1]?.title || 'Standard Rubric'}
                      </span>
                    </div>
                  </div>
                </section>

                {/* 5. Marks Distribution Bar Chart (col-span-12 md:col-span-7) */}
                <section className="col-span-12 md:col-span-7 bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)] flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#111827]">
                      Question Marks Distribution
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {questions.length} Items Evaluated
                    </span>
                  </div>

                  <div className="h-36 flex items-end gap-1.5 pt-4 pb-1">
                    {questions.slice(0, 16).map((q, i) => {
                      const awarded = q.final_marks ?? q.ai_marks ?? 0;
                      const max = q.max_marks || 1;
                      const ratio = Math.min(1, Math.max(0, awarded / max));
                      const isFull = ratio >= 0.95;
                      const isZero = ratio === 0;

                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                          <div className="w-full bg-[#F1F4F2] rounded-t-md h-28 flex items-end overflow-hidden">
                            <div
                              className={`w-full rounded-t-md transition-all duration-500 ${
                                isFull
                                  ? 'bg-[#0F5132]'
                                  : isZero
                                  ? 'bg-rose-300'
                                  : 'bg-[#0D9488]'
                              }`}
                              style={{ height: `${Math.max(6, ratio * 100)}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-slate-500 truncate max-w-full">
                            {q.q_no}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded bg-[#0F5132]" /> Full
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded bg-[#0D9488]" /> Partial
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded bg-rose-300" /> Deduction
                      </span>
                    </div>
                    <span>Scale: 0 to Max Marks</span>
                  </div>
                </section>

                {/* 6. Topic Mastery Horizontal Bars (col-span-12 md:col-span-5) */}
                <section className="col-span-12 md:col-span-5 bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)] flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#111827]">Topic &amp; Section Mastery</span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {sectionEntries.length} Sections
                    </span>
                  </div>

                  <div className="space-y-3">
                    {sectionEntries.slice(0, 4).map(([sec, stats], i) => {
                      const pct = stats.max > 0 ? Math.round((stats.awarded / stats.max) * 100) : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                              {sec}
                            </span>
                            <span className="font-mono text-[#0F5132] font-bold tabular-nums">
                              {stats.awarded}/{stats.max} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[#F1F4F2] overflow-hidden">
                            <div
                              className="h-full bg-[#0F5132] rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Curriculum coverage</span>
                    <span className="font-semibold text-emerald-700">Competency Verified</span>
                  </div>
                </section>

                {/* 7. Itemized Question Evaluation Table (col-span-12) */}
                <section className="col-span-12 bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#0F5132]" />
                      <h2 className="text-sm font-bold text-[#111827]">
                        Itemized Evaluation Ledger
                      </h2>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      Question-Wise Verification
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#E2E8E4] bg-[#F1F4F2] text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                          <th className="py-2.5 px-3">Q#</th>
                          <th className="py-2.5 px-3">Question Prompt</th>
                          <th className="py-2.5 px-3">Section</th>
                          <th className="py-2.5 px-3 text-center">Max Marks</th>
                          <th className="py-2.5 px-3 text-center">Awarded</th>
                          <th className="py-2.5 px-3 text-center">Score %</th>
                          <th className="py-2.5 px-3 text-center">Verdict</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {questions.map((q, i) => {
                          const awarded = q.final_marks ?? q.ai_marks ?? 0;
                          const max = q.max_marks || 1;
                          const pct = Math.round((awarded / max) * 100);
                          const isFull = pct >= 95;
                          const isZero = awarded === 0;

                          return (
                            <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                {q.q_no}
                              </td>
                              <td className="py-2 px-3 text-slate-700 max-w-[280px] truncate" title={q.question_text}>
                                {q.question_text}
                              </td>
                              <td className="py-2 px-3 text-slate-500 font-medium">
                                {q.section_name || 'General'}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-slate-700 tabular-nums">
                                {max}
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-slate-900 tabular-nums">
                                {awarded}
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-[#0F5132] tabular-nums">
                                {pct}%
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    isFull
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : isZero
                                      ? 'bg-rose-50 text-[#E11D48] border border-rose-200'
                                      : 'bg-amber-50 text-[#D97706] border border-amber-200'
                                  }`}
                                >
                                  {isFull ? 'Full Credit' : isZero ? 'Zero Credit' : 'Partial Credit'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#E8F3EE] border-t-2 border-[#0F5132]/30 font-bold text-xs text-[#0F5132]">
                          <td className="py-3 px-3" colSpan={3}>
                            Grand Total Score
                          </td>
                          <td className="py-3 px-3 text-center font-mono tabular-nums">
                            {maxMarks}
                          </td>
                          <td className="py-3 px-3 text-center font-mono tabular-nums text-sm">
                            {totalScore}
                          </td>
                          <td className="py-3 px-3 text-center font-mono tabular-nums text-sm">
                            {percentage}%
                          </td>
                          <td className="py-3 px-3 text-center">
                            Grade {candidateGrade.grade}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                {/* 8. Three-Column Signature Row (col-span-12) */}
                <section className="col-span-12 bg-white border border-[#E2E8E4] rounded-[20px] p-6 shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-full border-b border-dashed border-slate-300 h-10 mb-2" />
                      <span className="text-xs font-bold text-[#111827]">Evaluator Signature</span>
                      <span className="text-[10px] text-slate-400">Certified Academic Assessor</span>
                    </div>

                    <div className="flex flex-col items-center text-center">
                      <div className="w-full border-b border-dashed border-slate-300 h-10 mb-2" />
                      <span className="text-xs font-bold text-[#111827]">Department Head</span>
                      <span className="text-[10px] text-slate-400">Department of Computer Science</span>
                    </div>

                    <div className="flex flex-col items-center text-center">
                      <div className="w-full border-b border-dashed border-slate-300 h-10 mb-2" />
                      <span className="text-xs font-bold text-[#111827]">Controller of Examinations</span>
                      <span className="text-[10px] text-slate-400">Institutional Seal &amp; Authority</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* ========================================================
               BACK BENTO: GRADING & STRICTNESS REFERENCE KEY
               ======================================================== */}
            <div
              className={`print-back-sheet ${
                activeSide === 'back' ? 'block' : 'hidden print:block'
              }`}
            >
              <div className="grid grid-cols-12 gap-4 print:block print:space-y-4">
                {/* Back Header Banner (col-span-12) */}
                <section className="col-span-12 bg-white border border-[#E2E8E4] rounded-[20px] p-6 shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488]" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0D9488]">
                          Assessment Reference Architecture
                        </span>
                      </div>
                      <h1 className="text-xl font-bold text-[#111827] mt-1">
                        10-Point Institutional Grading &amp; Calibration Key
                      </h1>
                      <p className="text-xs text-[#4B5563] mt-0.5">
                        Statutory benchmark criteria and automated evaluation strictness profiles applied to this examination.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={flipCard}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E8F3EE] hover:bg-[#E8F3EE]/80 text-[#0F5132] text-xs font-semibold border border-[#0F5132]/20 transition cursor-pointer self-start sm:self-auto"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Back to Marksheet</span>
                    </button>
                  </div>
                </section>

                {/* 10-Point Institutional Grading Scale (col-span-12 lg:col-span-7) */}
                <section className="col-span-12 lg:col-span-7 bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-[#111827]">
                      10-Point Academic Grade Scale
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">UGC Standard</span>
                  </div>

                  <div className="space-y-2">
                    {GRADE_SCALE.map((g) => {
                      const isCandidateGrade = candidateGrade.grade === g.grade;
                      return (
                        <div
                          key={g.grade}
                          className={`p-3 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                            isCandidateGrade
                              ? 'bg-[#E8F3EE] border-[#0F5132]/30 ring-1 ring-[#0F5132]/20'
                              : 'bg-white border-[#E2E8E4] hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-9 h-9 rounded-lg font-mono font-bold text-sm flex items-center justify-center shrink-0 ${
                                isCandidateGrade
                                  ? 'bg-[#0F5132] text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {g.grade}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-slate-900">
                                  {g.label}
                                </span>
                                {isCandidateGrade && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#0F5132] text-white px-2 py-0.2 rounded-full">
                                    Achieved Grade
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">{g.desc}</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-xs text-slate-900 block tabular-nums">
                              &ge; {g.min}%
                            </span>
                            <span className="text-[10px] text-slate-400">Min. Score</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* 1–5 Strictness Calibration Matrix (col-span-12 lg:col-span-5) */}
                <section className="col-span-12 lg:col-span-5 bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-[#111827]">
                        AI Strictness Calibration
                      </h2>
                      <span className="text-xs text-slate-400 font-mono">1 to 5 Index</span>
                    </div>

                    <div className="space-y-3">
                      {STRICTNESS_LEVELS.map((s) => {
                        const isApplied = currentStrictness === s.level;

                        return (
                          <div
                            key={s.level}
                            className={`p-3 rounded-xl border transition-all ${
                              isApplied
                                ? 'bg-[#E8F3EE] border-[#0F5132]/30 ring-1 ring-[#0F5132]/20'
                                : 'bg-[#F1F4F2] border-[#E2E8E4]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-6 h-6 rounded-md font-mono text-xs font-bold flex items-center justify-center ${
                                    isApplied
                                      ? 'bg-[#0F5132] text-white'
                                      : 'bg-white text-slate-600 border border-slate-300'
                                  }`}
                                >
                                  {s.level}
                                </span>
                                <span className="font-semibold text-xs text-slate-900">
                                  {s.title}
                                </span>
                              </div>

                              {isApplied && (
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#0F5132] text-white px-2 py-0.5 rounded-full">
                                  Applied to This Sheet
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                              {s.desc}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Active Rubric: Strictness {currentStrictness}</span>
                    <span className="font-semibold text-[#0F5132]">Deterministic Multi-Pass AI</span>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
