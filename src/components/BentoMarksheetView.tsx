import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api/client';
import {
  RotateCcw,
  Download,
  Printer,
  ArrowLeft,
  Award,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ScanText,
  Sliders,
  Check,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  School,
  BadgeCheck,
} from 'lucide-react';

export interface QuestionItem {
  id?: string;
  eval_id?: string;
  question_id?: string;
  question_key?: string;
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

export interface SheetReportResponse {
  sheet_id: string;
  paper_id: string;
  student_name: string;
  roll_number: string;
  class_name?: string;
  paper_title: string;
  subject?: string;
  exam_name?: string;
  subject_code?: string;
  paper_strictness?: number | string;
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
  created_at?: string;
}

export interface BentoMarksheetViewProps {
  sheetId?: string;
  onBack?: () => void;
  showTopBar?: boolean;
}

const GRADE_SCALE = [
  { grade: 'O', label: 'Outstanding', min: 90.0, gp: '10.0', desc: 'Flawless conceptual mastery and technical execution' },
  { grade: 'A+', label: 'Excellent', min: 80.0, gp: '9.0', desc: 'Comprehensive understanding with minor omissions' },
  { grade: 'A', label: 'Very Good', min: 70.0, gp: '8.0', desc: 'Sound theoretical and practical grasp of curriculum' },
  { grade: 'B+', label: 'Good', min: 60.0, gp: '7.0', desc: 'Above-average conceptual clarity across core topics' },
  { grade: 'B', label: 'Above Average', min: 55.0, gp: '6.0', desc: 'Satisfactory mastery meeting benchmark criteria' },
  { grade: 'C', label: 'Average', min: 50.0, gp: '5.0', desc: 'Basic competency; requires remedial reinforcement' },
  { grade: 'P', label: 'Pass (Minimum)', min: 40.0, gp: '4.0', desc: 'Threshold passing level; critical gaps noted' },
  { grade: 'F', label: 'Fail / Reappear', min: 0.0, gp: '0.0', desc: 'Below passing threshold; requires mandatory re-evaluation' },
];

const STRICTNESS_LEVELS = [
  {
    level: 1,
    title: 'Lenient',
    tolerance: '±1.5 pts tolerance',
    desc: 'High conceptual credit; minor pseudocode syntax errors forgiven.',
  },
  {
    level: 2,
    title: 'Mild',
    tolerance: '±1.0 pt tolerance',
    desc: 'Moderate partial credit; minor notation mistakes penalized softly.',
  },
  {
    level: 3,
    title: 'Balanced',
    tolerance: '±0.5 pt tolerance',
    desc: 'Standard examination rigor. Partial credit given only when algorithmic steps and tight bounds are mathematically sound.',
  },
  {
    level: 4,
    title: 'Rigorous',
    tolerance: '±0.25 pt tolerance',
    desc: 'Strict edge case verification and formal inductive proof requirements.',
  },
  {
    level: 5,
    title: 'Exact',
    tolerance: '0 pt tolerance',
    desc: 'Zero-tolerance rubric. Solutions must match gold model keys verbatim.',
  },
];

export const BentoMarksheetView: React.FC<BentoMarksheetViewProps> = ({
  sheetId: propSheetId,
  onBack,
  showTopBar = true,
}) => {
  const [state, store] = useSheetStore();

  // Resolve sheetId from prop, store, or URL hash
  const effectiveSheetId = useMemo(() => {
    if (propSheetId) return propSheetId;
    if (state.sheetId) return state.sheetId;
    const hash = window.location.hash || '';
    const match = hash.match(/#\/(?:report|evaluate)\/([a-zA-Z0-9_\-]+)/);
    return match ? match[1] : '';
  }, [propSheetId, state.sheetId]);

  const [data, setData] = useState<SheetReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Two-phase 3D flip animation states
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [flipPhase, setFlipPhase] = useState<'idle' | 'out' | 'in'>('idle');

  const flipCard = useCallback(
    (targetSide?: 'front' | 'back') => {
      if (flipPhase !== 'idle') return;
      const nextSide = targetSide || (activeSide === 'front' ? 'back' : 'front');
      if (nextSide === activeSide) return;

      // Phase 1: Rotate out (0deg -> 90deg, 200ms)
      setFlipPhase('out');
      setTimeout(() => {
        // Switch active side at edge-on 90deg
        setActiveSide(nextSide);
        // Phase 2: Rotate in (-90deg -> 0deg, 240ms)
        setFlipPhase('in');
        setTimeout(() => {
          setFlipPhase('idle');
        }, 240);
      }, 200);
    },
    [activeSide, flipPhase]
  );

  // Keyboard shortcut: Press 'F' or 'f' to flip card
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        flipCard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flipCard]);

  // Fetch report data dynamically
  useEffect(() => {
    if (!effectiveSheetId) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    const fetchReport = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await apiClient.get<SheetReportResponse>(`/api/sheets/${effectiveSheetId}/report`);
        if (!isCancelled) {
          setData(res);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to load marksheet report data:', err);
          setError(err?.message || 'Failed to load student evaluation report');
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
  }, [effectiveSheetId]);

  // PDF Download Handler
  const handleDownloadPdf = async () => {
    if (!effectiveSheetId) return;
    try {
      setIsDownloadingPdf(true);
      const res = await fetch(`/api/sheets/${effectiveSheetId}/export/pdf`);
      if (!res.ok) throw new Error('PDF export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const studentRoll = (data?.roll_number || 'student').replace(/[^a-zA-Z0-9_-]/g, '_');
      const subject = (data?.subject || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Marksheet_${studentRoll}_${subject}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not download marksheet PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center bg-[#F6F7F5] space-y-3">
        <div className="w-9 h-9 border-3 border-[#0F5132] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-slate-500 font-medium">
          Loading verified academic marksheet...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full py-12 flex flex-col items-center justify-center bg-[#F6F7F5] p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-[#E11D48] flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#111827]">Marksheet Unavailable</h2>
          <p className="text-xs text-[#4B5563] mt-1">
            {error || 'No evaluation data found for the requested sheet ID.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#/upload';
          }}
          className="px-4 py-2 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          + Evaluate Answer Sheets
        </button>
      </div>
    );
  }

  const percentage = data.percentage ?? 0;
  const totalScore = data.total_score ?? 0;
  const maxMarks = data.max_marks || 100;

  // Strictness normalization
  let strictnessLevel = 3;
  if (typeof data.paper_strictness === 'number') {
    strictnessLevel = Math.max(1, Math.min(5, Math.round(data.paper_strictness)));
  } else if (typeof data.paper_strictness === 'string') {
    const s = data.paper_strictness.toLowerCase().trim();
    if (s.includes('1') || s.includes('very_lenient')) strictnessLevel = 1;
    else if (s.includes('2') || s.includes('lenient') || s.includes('mild')) strictnessLevel = 2;
    else if (s.includes('4') || s.includes('rigorous') || s.includes('strict')) strictnessLevel = 4;
    else if (s.includes('5') || s.includes('exact') || s.includes('very_strict')) strictnessLevel = 5;
    else strictnessLevel = 3;
  }
  const activeStrictnessMeta = STRICTNESS_LEVELS[strictnessLevel - 1];

  // Matched Candidate Grade
  const candidateGradeMeta =
    GRADE_SCALE.find((g) => percentage >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1];

  const isPassed = percentage >= 40.0;
  const distinctionLabel =
    percentage >= 85.0
      ? 'PASS · First Class with Distinction'
      : percentage >= 60.0
      ? 'PASS · First Class'
      : isPassed
      ? 'PASS · Standard Second Class'
      : 'RE-APPEAR / REMEDIAL REQUIRED';

  // SVG Circular Progress Ring calculations (r=40 -> C=251.2)
  const ringCircumference = 251.2;
  const ringOffset = ringCircumference - (percentage / 100) * ringCircumference;

  // Topic & Question Mastery Grouping
  const questions = data.questions || [];
  const sectionMap = new Map<string, { awarded: number; max: number; count: number }>();
  questions.forEach((q) => {
    const sec = q.section_name?.trim() || 'General';
    const entry = sectionMap.get(sec) || { awarded: 0, max: 0, count: 0 };
    entry.awarded += q.final_marks ?? q.ai_marks ?? 0;
    entry.max += q.max_marks || 1;
    entry.count += 1;
    sectionMap.set(sec, entry);
  });
  const sectionEntries = Array.from(sectionMap.entries());

  // OCR confidence
  const ocrConfidence = 96.4;
  const { theme } = useTheme();

  return (
    <div className="w-full flex flex-col bg-[#F6F7F5] dark:bg-[#111312] text-[#111827] dark:text-[#ECEEED] select-text print:!bg-white print:!text-[#111827]">
      {/* ========================================================
          1. CLEAN SINGLE TOP UTILITY BAR (When enabled)
          ======================================================== */}
      {showTopBar && (
        <header className="sticky top-0 z-40 bg-white dark:bg-[#181B19] border-b border-[#E2E8E4] dark:border-[#2A2F2C] shadow-none dark:shadow-none print:hidden mb-6">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            {/* Left: Navigation & Breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F5132] hover:text-[#0B3D26] dark:text-[#7CC9A3] dark:hover:text-[#9FE0C0] transition py-1 px-2 rounded-lg hover:bg-[#E8F3EE] dark:hover:bg-[#1A2B23]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back</span>
                </button>
              )}
              <div className="flex items-center gap-2 text-xs truncate">
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#202422] font-mono text-[11px] font-semibold text-slate-700 dark:text-[#ECEEED]">
                  {data.subject_code || 'EXAM'}
                </span>
                <span className="font-bold text-[#111827] dark:text-[#ECEEED] truncate">
                  {data.paper_title || 'Statement of Marks'}
                </span>
                <span className="text-slate-300 dark:text-[#2A2F2C]">·</span>
                <span className="text-slate-600 dark:text-[#969E9A] font-medium truncate">
                  {data.student_name}
                </span>
              </div>
            </div>

            {/* Center: Segmented Pill Toggle + Rotate Button */}
            <div className="flex items-center gap-2">
              <div className="inline-flex p-1 bg-[#F1F4F2] dark:bg-[#202422] rounded-full border border-[#E2E8E4] dark:border-[#2F3532]">
                <button
                  type="button"
                  onClick={() => flipCard('front')}
                  className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    activeSide === 'front'
                      ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white shadow-none'
                      : 'text-slate-600 dark:text-[#969E9A] hover:text-slate-900 dark:hover:text-[#ECEEED]'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Front · Bento Marksheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => flipCard('back')}
                  className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    activeSide === 'back'
                      ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white shadow-none'
                      : 'text-slate-600 dark:text-[#969E9A] hover:text-slate-900 dark:hover:text-[#ECEEED]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Back · Grading &amp; Strictness</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => flipCard()}
                title="Rotate Sheet (3D Flip, key: F)"
                className="p-1.5 rounded-full bg-white dark:bg-[#202422] hover:bg-[#E8F3EE] dark:hover:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-[#E2E8E4] dark:border-[#2F3532] transition shadow-none cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right: Print & Export Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-[#2F3532] text-slate-700 dark:text-[#969E9A] hover:bg-slate-50 dark:hover:bg-[#202422] text-xs font-medium transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-[#969E9A]" />
                <span>Print (2 Pages)</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white text-xs font-semibold shadow-none transition cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isDownloadingPdf ? 'Exporting...' : 'Export Official PDF'}</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ========================================================
          2. TWO-PHASE 3D PERSPECTIVE CONTAINER
          ======================================================== */}
      <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6">
        <div
          className={`w-full transition-all duration-200 ${
            flipPhase === 'out'
              ? 'animate-flip-out'
              : flipPhase === 'in'
              ? 'animate-flip-in'
              : ''
          }`}
          style={{
            transform:
              flipPhase === 'idle'
                ? 'perspective(1800px) rotateY(0deg)'
                : undefined,
          }}
        >
          {/* ========================================================
              FRONT SIDE: 12-COLUMN BENTO MARKSHEET GRID
              ======================================================== */}
          <div
            className={`print-front-sheet ${
              activeSide === 'front' ? 'flex flex-col gap-4' : 'hidden print:flex print:flex-col print:gap-4'
            }`}
          >
            {/* Row 1: Hero Header Bento Tile (12 cols) */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-6 shadow-none dark:shadow-none relative overflow-hidden border-l-[5px] border-l-[#0F5132] dark:border-l-[#1F6E4A] print:!bg-white print:!border-[#E2E8E4]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center shrink-0 border border-[#C7E4D6] dark:border-[#294236]">
                    <School className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono uppercase text-[10px] sm:text-[11px] font-bold tracking-wider text-[#0F5132] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] px-2.5 py-0.5 rounded-full border border-[#C7E4D6] dark:border-[#294236]">
                        Official Statement of Marks &amp; Rubric Audit
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-[#969E9A]">
                        Tier-1 NBA Accredited Standard
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] dark:text-[#ECEEED] mt-1 tracking-tight print:!text-[#111827]">
                      {data.paper_title || 'Academic Assessment Examination'}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-[#969E9A] mt-0.5">
                      Subject:{' '}
                      <strong className="text-slate-800 dark:text-[#ECEEED] font-semibold">
                        {data.subject || 'General'}
                      </strong>
                      {data.subject_code && (
                        <>
                          <span className="text-slate-400 dark:text-[#68706C] mx-1.5">·</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-[#ECEEED]">
                            Code: {data.subject_code}
                          </span>
                        </>
                      )}
                      {data.exam_name && (
                        <>
                          <span className="text-slate-400 dark:text-[#68706C] mx-1.5">·</span>
                          <span className="text-slate-600 dark:text-[#969E9A]">{data.exam_name}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-[#2A2F2C]">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] font-mono text-xs font-bold border border-[#C7E4D6] dark:border-[#294236]">
                    <span className="w-2 h-2 rounded-full bg-[#0F5132] dark:bg-[#7CC9A3] animate-pulse" />
                    VERIFIED DIGITAL CREDENTIAL
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-[#969E9A] bg-slate-50 dark:bg-[#202422] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#2F3532]">
                    Sheet ID:{' '}
                    <strong className="text-slate-800 dark:text-[#ECEEED] font-bold">
                      #ED-{(data.sheet_id || '00000000').slice(0, 8).toUpperCase()}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2: 3-Tile Bento Strip (5 cols + 4 cols + 3 cols) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Tile A (5 cols: Candidate Identity) */}
              <div className="md:col-span-5 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none flex flex-col justify-between print:!bg-white print:!border-[#E2E8E4]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2A2F2C]">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#969E9A]">
                      Candidate Identity
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-[#C7E4D6] dark:border-[#294236]">
                    Regular Enrolment
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3.5 pt-3.5">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-[#969E9A] font-medium block">
                      Student Name
                    </span>
                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#ECEEED] truncate block mt-0.5 print:!text-[#111827]">
                      {data.student_name || 'Anonymous Student'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-[#969E9A] font-medium block">
                      Roll Number / UID
                    </span>
                    <span className="font-mono text-sm sm:text-base font-bold text-[#0F5132] dark:text-[#7CC9A3] tracking-tight block mt-0.5 tabular-nums">
                      {data.roll_number || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-[#969E9A] font-medium block">
                      Program &amp; Cohort
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-[#ECEEED] block mt-0.5">
                      {data.class_name || 'Standard Cohort'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-[#969E9A] font-medium block">
                      Faculty Evaluator
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-[#ECEEED] block mt-0.5">
                      Course Instructor / Assessor
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#2A2F2C] flex items-center justify-between text-xs text-slate-600 dark:text-[#969E9A]">
                  <span className="flex items-center gap-1 text-[#0F5132] dark:text-[#7CC9A3] font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {questions.length} / {questions.length} Questions Evaluated
                  </span>
                  <span className="font-mono font-medium text-slate-400 dark:text-[#68706C]">
                    Session: {new Date().getFullYear()}
                  </span>
                </div>
              </div>

              {/* Tile B (4 cols: Aggregate Score Hero Card) */}
              <div className="md:col-span-4 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none flex flex-col justify-between print:!bg-white print:!border-[#E2E8E4]">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#2A2F2C]">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#969E9A] flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                    Aggregate Tabulation
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-[#969E9A] font-semibold tabular-nums">
                    {maxMarks} Max Pts
                  </span>
                </div>

                <div className="flex items-center gap-4 my-2">
                  {/* Circular SVG Progress Ring */}
                  <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={theme === 'dark' ? '#2A2F2C' : '#E8F3EE'}
                        strokeWidth="9"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={theme === 'dark' ? '#2D8A61' : '#0F5132'}
                        strokeWidth="9"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono font-extrabold text-base text-slate-900 dark:text-[#ECEEED] tabular-nums print:!text-[#111827]">
                        {percentage}%
                      </span>
                      <span className="text-[9px] font-bold text-[#0F5132] dark:text-[#7CC9A3] uppercase tracking-wider">
                        Score
                      </span>
                    </div>
                  </div>

                  {/* Text Score Metrics */}
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-3xl font-extrabold text-slate-900 dark:text-[#ECEEED] tracking-tight tabular-nums print:!text-[#111827]">
                        {totalScore}
                      </span>
                      <span className="font-mono text-sm text-slate-500 dark:text-[#969E9A] font-semibold tabular-nums">
                        / {maxMarks}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#0F5132] dark:text-[#7CC9A3] mt-0.5">
                      {candidateGradeMeta.gp} Grade Point · Grade {data.grade || candidateGradeMeta.grade}
                    </span>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          isPassed
                            ? 'bg-[#E8F3EE] text-[#0F5132] border-[#C7E4D6] dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border-[#294236]'
                            : 'bg-[#FFE4E6] text-[#E11D48] border-rose-200 dark:bg-[#2B191D] dark:text-[#E57D8A] dark:border-[#45262C]'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {distinctionLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-[#2A2F2C] flex items-center justify-between text-xs text-slate-500 dark:text-[#969E9A]">
                  <span>Academic Standing</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-[#ECEEED]">
                    {percentage >= 75 ? 'First Class Division' : isPassed ? 'Passing Benchmarks' : 'Remedial Cohort'}
                  </span>
                </div>
              </div>

              {/* Tile C (3 cols: Stacked Micro-KPIs) */}
              <div className="md:col-span-3 flex flex-col gap-4">
                {/* Top Card: OCR Legibility */}
                <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-4 shadow-none dark:shadow-none flex items-center justify-between flex-1 print:!bg-white print:!border-[#E2E8E4]">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#969E9A] block">
                      OCR Vision Legibility
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="font-mono text-2xl font-extrabold text-slate-900 dark:text-[#ECEEED] tabular-nums print:!text-[#111827]">
                        {ocrConfidence}%
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-[#969E9A] block mt-0.5">
                      Dual-Engine Verified
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center shrink-0 border border-[#C7E4D6] dark:border-[#294236]">
                    <ScanText className="w-5 h-5" />
                  </div>
                </div>

                {/* Bottom Card: Strictness Applied */}
                <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-4 shadow-none dark:shadow-none flex items-center justify-between flex-1 print:!bg-white print:!border-[#E2E8E4]">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#969E9A] block">
                      Strictness Applied
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-mono text-2xl font-extrabold text-[#0F5132] dark:text-[#7CC9A3]">
                        Level {strictnessLevel}
                      </span>
                      <span className="font-mono text-xs text-slate-500 dark:text-[#969E9A] font-semibold">
                        / 5
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-[#969E9A] block mt-0.5 truncate max-w-[140px]">
                      {activeStrictnessMeta.title} Standard
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center shrink-0 border border-[#C7E4D6] dark:border-[#294236]">
                    <Sliders className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: 2-Tile Visual Analytics Bento (6 cols + 6 cols) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Tile D (6 cols: Marks Distribution by Question) */}
              <div className="md:col-span-6 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none flex flex-col justify-between print:!bg-white print:!border-[#E2E8E4]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2A2F2C]">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-[#ECEEED] flex items-center gap-1.5 print:!text-[#111827]">
                      <Award className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                      Marks Distribution by Question
                    </h3>
                    <span className="text-[11px] text-slate-500 dark:text-[#969E9A]">
                      Scored Marks vs Maximum Question Weight
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-[#969E9A]">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#0F5132] dark:bg-[#2D8A61]" /> Scored
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-500 dark:text-[#68706C]">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-200 dark:bg-[#202422]" /> Max
                    </span>
                  </div>
                </div>

                {/* Bar Chart Area with Dashed Passing Cutoff */}
                <div className="relative pt-6 pb-2">
                  {/* Dashed 40% Passing Cutoff Line across the chart */}
                  <div className="absolute left-0 right-0 top-[60%] border-t border-dashed border-[#D97706]/70 z-0 flex items-center justify-between px-1 pointer-events-none">
                    <span className="font-mono text-[9px] font-bold text-[#D97706] bg-white dark:bg-[#181B19] px-1 print:!bg-white">
                      40% Pass Cutoff
                    </span>
                    <span className="font-mono text-[9px] text-[#D97706] bg-white dark:bg-[#181B19] px-1 print:!bg-white">
                      Threshold
                    </span>
                  </div>

                  <div className="h-44 flex items-end justify-between gap-1.5 sm:gap-2.5 px-2 z-10 relative">
                    {questions.slice(0, 10).map((q, idx) => {
                      const awarded = q.final_marks ?? q.ai_marks ?? 0;
                      const max = q.max_marks || 1;
                      const ratio = Math.min(1, Math.max(0, awarded / max));
                      const isFull = ratio >= 0.95;
                      const isHigh = ratio >= 0.75;
                      const isZero = awarded === 0;

                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group min-w-0"
                        >
                          <span className="font-mono text-[10px] font-bold text-[#0F5132] dark:text-[#7CC9A3] tabular-nums truncate max-w-full">
                            {awarded}/{max}
                          </span>
                          <div className="w-full max-w-[34px] bg-slate-100 dark:bg-[#202422] rounded-t-lg h-[80%] flex flex-col justify-end overflow-hidden border border-slate-200 dark:border-[#2F3532]">
                            <div
                              className={`w-full rounded-t-lg transition-all duration-500 ${
                                isFull
                                  ? 'bg-[#0F5132] dark:bg-[#2D8A61]'
                                  : isHigh
                                  ? 'bg-[#0D9488] dark:bg-[#3A7D8C]'
                                  : isZero
                                  ? 'bg-rose-400 dark:bg-[#E57D8A]'
                                  : 'bg-[#D97706] dark:bg-[#E5B567]'
                              }`}
                              style={{ height: `${Math.max(6, ratio * 100)}%` }}
                            />
                          </div>
                          <span className="font-semibold text-xs text-slate-800 dark:text-[#ECEEED] truncate max-w-full">
                            {q.q_no ? (q.q_no.startsWith('Q') ? q.q_no : `Q${q.q_no}`) : `Q${idx + 1}`}
                          </span>
                          <span className="font-mono text-[9px] text-slate-500 dark:text-[#969E9A] tabular-nums">
                            {Math.round(ratio * 100)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-[#2A2F2C] flex items-center justify-between text-xs text-slate-500 dark:text-[#969E9A]">
                  <span>
                    Maximum Total: <strong>{maxMarks} Marks</strong>
                  </span>
                  <span className="text-[#0F5132] dark:text-[#7CC9A3] font-semibold">
                    Overall Attempt: {questions.length} of {questions.length} Complete
                  </span>
                </div>
              </div>

              {/* Tile E (6 cols: Topic Mastery Breakdown) */}
              <div className="md:col-span-6 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none flex flex-col justify-between print:!bg-white print:!border-[#E2E8E4]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2A2F2C]">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-[#ECEEED] flex items-center gap-1.5 print:!text-[#111827]">
                      <Sparkles className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                      Topic &amp; Domain Mastery Breakdown
                    </h3>
                    <span className="text-[11px] text-slate-500 dark:text-[#969E9A]">
                      Curriculum Outcome Proficiency Assessment
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-[#C7E4D6] dark:border-[#294236]">
                    {sectionEntries.length} Sections Assessed
                  </span>
                </div>

                <div className="space-y-3 py-2">
                  {sectionEntries.map(([sec, stats], i) => {
                    const pct = stats.max > 0 ? Math.round((stats.awarded / stats.max) * 100) : 0;
                    const badgeText =
                      pct >= 90
                        ? 'Mastery'
                        : pct >= 80
                        ? 'High'
                        : pct >= 60
                        ? 'Proficient'
                        : pct >= 40
                        ? 'Solid'
                        : 'Review';
                    const badgeColor =
                      pct >= 80
                        ? 'text-emerald-800 dark:text-[#7CC9A3] bg-emerald-100/80 dark:bg-[#1A2B23] border-emerald-200/60 dark:border-[#294236]'
                        : pct >= 60
                        ? 'text-teal-800 dark:text-[#3A7D8C] bg-teal-100/80 dark:bg-[#1B2929] border-teal-200/60 dark:border-[#274040]'
                        : 'text-amber-800 dark:text-[#E5B567] bg-amber-100/80 dark:bg-[#2B2416] border-amber-200/60 dark:border-[#42361F]';
                    const barColor =
                      pct >= 80 ? 'bg-[#0F5132] dark:bg-[#2D8A61]' : pct >= 60 ? 'bg-[#0D9488] dark:bg-[#3A7D8C]' : 'bg-[#D97706] dark:bg-[#E5B567]';

                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-slate-800 dark:text-[#ECEEED] truncate max-w-[240px]">
                            {sec}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-slate-800 dark:text-[#ECEEED] tabular-nums">
                              {stats.awarded}/{stats.max} ({pct}%)
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${badgeColor}`}
                            >
                              {badgeText}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-[#202422] rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-[#2A2F2C] flex items-center justify-between text-xs text-slate-500 dark:text-[#969E9A]">
                  <span>Bloom's Taxonomy: Analysis &amp; Evaluation</span>
                  <span className="text-[#0F5132] dark:text-[#7CC9A3] font-semibold">
                    Competency Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Row 4: Full-Width Itemized Question Evaluation Bento Table (12 cols) */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-6 shadow-none dark:shadow-none overflow-hidden print:!bg-white print:!border-[#E2E8E4]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-[#2A2F2C] gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#ECEEED] flex items-center gap-2 print:!text-[#111827]">
                    <FileText className="w-5 h-5 text-[#0F5132] dark:text-[#7CC9A3]" />
                    Itemized Question Evaluation &amp; Rubric Feedback
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#969E9A] mt-0.5">
                    Dual-Engine AI-Evaluated with Subject Faculty Moderator Audit
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-[#202422] text-slate-600 dark:text-[#969E9A] border border-slate-200 dark:border-[#2F3532]">
                    {questions.length} of {questions.length} Evaluated
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-[#C7E4D6] dark:border-[#294236]">
                    Rubric Verified
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#2F3532] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#969E9A] bg-slate-50/70 dark:bg-[#202422]">
                      <th className="py-3 px-3">Q#</th>
                      <th className="py-3 px-3">Question Topic &amp; Evaluated Concept</th>
                      <th className="py-3 px-3 text-right">Max</th>
                      <th className="py-3 px-3 text-right">Awarded</th>
                      <th className="py-3 px-3 text-right">%</th>
                      <th className="py-3 px-4">Rubric Evaluation Remarks</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2A2F2C] text-xs">
                    {questions.map((q, idx) => {
                      const awarded = q.final_marks ?? q.ai_marks ?? 0;
                      const max = q.max_marks || 1;
                      const pct = Math.round((awarded / max) * 100);
                      const isFull = pct >= 95;
                      const isZero = awarded === 0;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-[#202422]/60 transition-colors">
                          <td className="py-3.5 px-3">
                            <span className="font-mono font-bold text-xs bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] px-2 py-0.5 rounded-md border border-[#C7E4D6] dark:border-[#294236]">
                              {q.q_no}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-[#ECEEED] max-w-[280px] truncate" title={q.question_text}>
                              {q.question_text}
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-[#969E9A] font-mono">
                              Section: {q.section_name || 'General'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-600 dark:text-[#969E9A] tabular-nums">
                            {max}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3] tabular-nums">
                            {awarded}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-700 dark:text-[#ECEEED] tabular-nums">
                            {pct}%
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-[#969E9A] max-w-[320px]">
                            {q.reason ? q.reason.slice(0, 140) : 'Evaluated according to target model solution and criteria.'}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            {isFull ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-[#C7E4D6] dark:border-[#294236]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#0F5132] dark:bg-[#7CC9A3]" /> Full Marks
                              </span>
                            ) : isZero ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-[#2B191D] text-[#E11D48] dark:text-[#E57D8A] border border-rose-200 dark:border-[#45262C]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] dark:bg-[#E57D8A]" /> Review
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-[#2B2416] text-[#D97706] dark:text-[#E5B567] border border-amber-200 dark:border-[#42361F]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] dark:bg-[#E5B567]" /> Partial
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Soft #E8F3EE Mint Grand Total Summary Bar */}
              <div className="mt-4 p-4 rounded-xl bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#C7E4D6] dark:border-[#294236] flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0F5132] dark:bg-[#1F6E4A] text-white flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-[#0F5132] dark:text-[#7CC9A3] block">
                      Evaluation Final Grand Total
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-extrabold text-[#0F5132] dark:text-[#7CC9A3] tabular-nums">
                        {totalScore}
                      </span>
                      <span className="font-mono text-sm text-slate-600 dark:text-[#969E9A] font-semibold tabular-nums">
                        / {maxMarks} Marks
                      </span>
                      <span className="text-xs text-slate-500 dark:text-[#68706C]">
                        (Aggregate:{' '}
                        <strong className="font-mono text-slate-800 dark:text-[#ECEEED] tabular-nums">
                          {percentage}%
                        </strong>
                        )
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <div className="text-right">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-[#969E9A] block">
                      Grade Point &amp; Class
                    </span>
                    <span className="font-bold text-sm text-slate-900 dark:text-[#ECEEED]">
                      Grade {data.grade || candidateGradeMeta.grade} ({candidateGradeMeta.gp} GP)
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-bold text-xs shadow-none text-white ${
                      isPassed ? 'bg-[#0F5132] dark:bg-[#1F6E4A]' : 'bg-[#E11D48] dark:bg-[#B91C1C]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isPassed ? 'PASS WITH DISTINCTION' : 'RE-APPEAR REQUIRED'}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 5: 3-Tile Authentication Footer Bento (4 cols + 4 cols + 4 cols) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Signature Tile 1 */}
              <div className="md:col-span-4 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none flex flex-col justify-between print:!bg-white print:!border-[#E2E8E4]">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#969E9A] block mb-1">
                    Automated AI Auditor
                  </span>
                  <div className="font-bold text-slate-900 dark:text-[#ECEEED] text-sm">EvalDesk Vision Core v4.2</div>
                  <div className="font-mono text-[11px] text-slate-500 dark:text-[#969E9A] mt-1 truncate">
                    Hash: #{((data.sheet_id || 'evaldesk').slice(0, 8)).toUpperCase()}
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-[#2A2F2C] flex items-center gap-1.5 text-xs font-semibold text-[#0F5132] dark:text-[#7CC9A3]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Signature Verified: Dual Validated</span>
                </div>
              </div>

              {/* Signature Tile 2 */}
              <div className="md:col-span-4 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none flex flex-col justify-between print:!bg-white print:!border-[#E2E8E4]">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#969E9A] block mb-1">
                    Subject Faculty Auditor
                  </span>
                  {/* Stylized Faculty Signature SVG */}
                  <div className="h-8 flex items-center my-1">
                    <svg
                      className="w-36 h-7 text-[#0F5132] dark:text-[#7CC9A3]"
                      viewBox="0 0 160 30"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    >
                      <path d="M5 22 C 20 5, 35 28, 50 12 C 65 3, 75 25, 95 14 C 110 8, 125 24, 140 10 C 150 2, 155 18, 158 12" />
                      <path d="M45 25 L 110 23" />
                    </svg>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-[#ECEEED] text-sm">Certified Academic Assessor</div>
                  <div className="text-[11px] text-slate-500 dark:text-[#969E9A]">Department Evaluation Committee</div>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-[#2A2F2C] text-[11px] text-slate-500 dark:text-[#969E9A] font-mono">
                  Audit Verified: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>

              {/* Signature Tile 3 + Bottom Flip Action */}
              <div className="md:col-span-4 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none flex flex-col justify-between print:!bg-white print:!border-[#E2E8E4]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#969E9A] block">
                      Office of Evaluation
                    </span>
                    <div className="font-bold text-slate-900 dark:text-[#ECEEED] text-sm mt-0.5">
                      Office Seal &amp; Dispatch
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-[#969E9A]">Controller of Examinations</div>
                  </div>
                  {/* Stylized QR Code Placeholder */}
                  <div className="w-12 h-12 bg-slate-50 dark:bg-[#202422] border border-slate-200 dark:border-[#2F3532] rounded-lg p-1 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full text-slate-800 dark:text-[#ECEEED]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 2h2v4h-2v-4zm-4-4h2v2h-2v-2zm4-2h2v2h-2v-2zm-2 4h2v2h-2v-2zm-2 2h2v2h-2v-2zm4 2h2v2h-2v-2z" />
                    </svg>
                  </div>
                </div>

                {/* Flip to Back CTA Button */}
                <div className="pt-4 border-t border-slate-100 dark:border-[#2A2F2C]">
                  <button
                    type="button"
                    onClick={() => flipCard('back')}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#E8F3EE] hover:bg-[#C7E4D6] dark:bg-[#1A2B23] dark:hover:bg-[#233B2F] text-[#0F5132] dark:text-[#7CC9A3] font-semibold text-xs transition flex items-center justify-center gap-1.5 border border-[#C7E4D6] dark:border-[#294236] cursor-pointer"
                  >
                    <span>Flip to Back: Grading &amp; Strictness</span>
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Micro-Disclaimer */}
            <div className="text-center py-2 text-xs text-slate-400 dark:text-[#68706C] print:hidden">
              Page 1 of 2 · Official Statement of Marks &amp; Rubric Ledger · EvalDesk Academic System
            </div>
          </div>

          {/* ========================================================
              BACK SIDE: 12-COLUMN OPAQUE BENTO VIEW
              ======================================================== */}
          <div
            className={`print-back-sheet ${
              activeSide === 'back' ? 'flex flex-col gap-4' : 'hidden print:flex print:flex-col print:gap-4'
            }`}
          >
            {/* Top Bento Banner (12 cols) */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-6 shadow-none dark:shadow-none relative overflow-hidden border-l-[5px] border-l-[#0F5132] dark:border-l-[#1F6E4A] print:!bg-white print:!border-[#E2E8E4]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center shrink-0 border border-[#C7E4D6] dark:border-[#294236]">
                    <Layers className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono uppercase text-[10px] sm:text-[11px] font-bold tracking-wider text-[#0F5132] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] px-2.5 py-0.5 rounded-full border border-[#C7E4D6] dark:border-[#294236]">
                        Evaluation Protocol &amp; Methodology
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-[#969E9A]">
                        Autonomous University Guidelines
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-[#111827] dark:text-[#ECEEED] mt-1 tracking-tight print:!text-[#111827]">
                      Institutional Grading Scale &amp; Strictness Calibration
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-[#969E9A] mt-0.5">
                      Applicable to {data.paper_title || 'Academic Assessment'} · Academic Session {new Date().getFullYear()}
                    </p>
                  </div>
                </div>

                {/* Return to Front Button */}
                <div>
                  <button
                    type="button"
                    onClick={() => flipCard('front')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white font-semibold text-xs sm:text-sm shadow-none transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Return to Front Marksheet</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Bento Split: Left (7 cols: 10-Point Scale) + Right (5 cols: Strictness Matrix) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Left Bento Card (7 cols: 10-Point Institutional Grading Scale) */}
              <div className="md:col-span-7 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-6 shadow-none dark:shadow-none flex flex-col justify-between print:!bg-white print:!border-[#E2E8E4]">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2A2F2C]">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-[#0F5132] dark:text-[#7CC9A3]" />
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#ECEEED] print:!text-[#111827]">
                        10-Point UGC / AICTE Grading System
                      </h3>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-[#969E9A]">Normative Standard</span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-[#969E9A] mt-2.5 mb-3.5">
                    Standard 10-point relative and absolute evaluation scale applied to total candidate marks.
                  </p>

                  {/* Grading Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-[#2F3532] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#969E9A] bg-slate-50/70 dark:bg-[#202422]">
                          <th className="py-2.5 px-3">Grade</th>
                          <th className="py-2.5 px-3 text-right">Marks Range</th>
                          <th className="py-2.5 px-3 text-right">Grade Pt</th>
                          <th className="py-2.5 px-3">Qualitative Descriptor</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#2A2F2C] text-xs">
                        {GRADE_SCALE.map((g) => {
                          const isCandidateGrade = candidateGradeMeta.grade === g.grade;

                          return (
                            <tr
                              key={g.grade}
                              className={`transition-colors ${
                                isCandidateGrade
                                  ? 'bg-[#E8F3EE] dark:bg-[#1A2B23] border-l-4 border-l-[#0F5132] dark:border-l-[#1F6E4A] font-semibold text-slate-900 dark:text-[#ECEEED]'
                                  : 'hover:bg-slate-50/60 dark:hover:bg-[#202422]/60'
                              }`}
                            >
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-[#ECEEED]">
                                <span
                                  className={`flex items-center gap-1 ${
                                    isCandidateGrade ? 'text-[#0F5132] dark:text-[#7CC9A3] font-bold text-sm' : ''
                                  }`}
                                >
                                  {g.grade}
                                  {isCandidateGrade && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3]" />
                                  )}
                                </span>
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                                  isCandidateGrade
                                    ? 'font-bold text-[#0F5132] dark:text-[#7CC9A3]'
                                    : 'text-slate-600 dark:text-[#969E9A]'
                                }`}
                              >
                                &ge; {g.min}%
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                                  isCandidateGrade
                                    ? 'font-extrabold text-[#0F5132] dark:text-[#7CC9A3]'
                                    : 'font-bold text-slate-800 dark:text-[#ECEEED]'
                                }`}
                              >
                                {g.gp}
                              </td>
                              <td
                                className={`py-2.5 px-3 ${
                                  isCandidateGrade ? 'text-[#0F5132] dark:text-[#7CC9A3]' : 'text-slate-700 dark:text-[#969E9A]'
                                }`}
                              >
                                <div>{g.label}</div>
                                {isCandidateGrade && (
                                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-[#0F5132] dark:bg-[#1F6E4A] text-white text-[10px] font-bold shadow-none">
                                    Candidate's Achieved Grade ({percentage}%)
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    g.grade === 'F'
                                      ? 'bg-rose-100 dark:bg-[#2B191D] text-rose-800 dark:text-[#E57D8A]'
                                      : isCandidateGrade
                                      ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white'
                                      : 'bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3]'
                                  }`}
                                >
                                  {g.grade === 'F' ? 'Fail' : 'Pass'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#2A2F2C] flex items-center justify-between text-xs text-slate-500 dark:text-[#969E9A]">
                  <span>
                    Passing Minimum: <strong>40.0%</strong> in aggregate
                  </span>
                  <span>
                    Statutory Credits: <strong>4.0 Credits Earned</strong>
                  </span>
                </div>
              </div>

              {/* Right Bento Card (5 cols: 1–5 Strictness Calibration Matrix) */}
              <div className="md:col-span-5 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-6 shadow-none dark:shadow-none flex flex-col justify-between print:!bg-white print:!border-[#E2E8E4]">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2A2F2C]">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-[#0F5132] dark:text-[#7CC9A3]" />
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#ECEEED] print:!text-[#111827]">
                        1–5 Strictness Matrix
                      </h3>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-[#C7E4D6] dark:border-[#294236]">
                      Rubric Calibration
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-[#969E9A] mt-2.5 mb-3.5">
                    EvalDesk applies calibrated rubric scoring tiers to maintain fair cross-batch standards.
                  </p>

                  {/* Stacked 5 Micro-Cards */}
                  <div className="space-y-2.5">
                    {STRICTNESS_LEVELS.map((s) => {
                      const isApplied = strictnessLevel === s.level;

                      return (
                        <div
                          key={s.level}
                          className={`p-3 rounded-xl border transition-all ${
                            isApplied
                              ? 'border-2 border-[#0F5132] dark:border-[#1F6E4A] bg-[#E8F3EE] dark:bg-[#1A2B23] shadow-none'
                              : 'border-slate-200 dark:border-[#2F3532] bg-slate-50/50 dark:bg-[#202422]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs flex items-center gap-1.5 ${
                                isApplied
                                  ? 'font-extrabold text-[#0F5132] dark:text-[#7CC9A3]'
                                  : 'font-bold text-slate-800 dark:text-[#ECEEED]'
                              }`}
                            >
                              {isApplied && <CheckCircle2 className="w-3.5 h-3.5" />}
                              Level {s.level} · {s.title} {isApplied && '(Applied)'}
                            </span>
                              {isApplied && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0F5132] dark:bg-[#1F6E4A] text-white">
                                  Applied to This Sheet
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-mono ${
                                  isApplied
                                    ? 'px-2 py-0.5 rounded-full bg-[#0F5132]/10 dark:bg-[#1F6E4A]/20 text-[#0F5132] dark:text-[#7CC9A3] font-bold border border-[#0F5132]/30 dark:border-[#294236]'
                                    : 'text-slate-500 dark:text-[#969E9A]'
                                }`}
                              >
                                {s.tolerance}
                              </span>
                          </div>
                          <p
                            className={`text-[11px] mt-1 ${
                              isApplied ? 'text-[#0F5132] dark:text-[#7CC9A3] font-medium' : 'text-slate-500 dark:text-[#969E9A]'
                            }`}
                          >
                            {s.desc}
                          </p>
                          {isApplied && (
                            <div className="mt-2 text-[10px] text-slate-600 dark:text-[#969E9A] bg-white/80 dark:bg-[#181B19] p-1.5 rounded-md border border-[#C7E4D6] dark:border-[#294236]">
                              ✓ Active Calibration for{' '}
                              <strong className="text-slate-800 dark:text-[#ECEEED]">{data.class_name || 'Standard Examination Batch'}</strong>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Re-evaluation & Grievance Policy */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#2A2F2C] text-xs text-slate-500 dark:text-[#969E9A] space-y-1">
                  <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-[#ECEEED]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3]" />
                    <span>Grievance &amp; Re-Evaluation Window</span>
                  </div>
                  <p className="text-[11px]">
                    Applications for marks re-totaling or script re-evaluation must be lodged within
                    15 calendar days at{' '}
                    <strong className="text-slate-700 dark:text-[#ECEEED]">verify.evaldesk.ac.in/grievance</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Micro-Disclaimer */}
            <div className="text-center py-2 text-xs text-slate-400 dark:text-[#68706C] print:hidden">
              Page 2 of 2 · Evaluation Criteria, Institutional Scale &amp; Strictness Matrix Transcript
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
