import React, { useEffect, useState, useMemo } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import {
  FileCheck2,
  Plus,
  ArrowRight,
  ExternalLink,
  Search,
  FileSpreadsheet,
  Download,
} from 'lucide-react';

interface DashboardSummary {
  kpis: {
    avg_score_pct: number;
    total_evaluated: number;
    total_sheets: number;
    needs_review_count: number;
    total_questions: number;
    avg_ocr_confidence: number;
    total_papers: number;
  };
  batch_bars: Array<{
    paper_id: string;
    title: string;
    subject: string;
    evaluated_count: number;
    total_count: number;
  }>;
  paper_question_bars: Array<{
    paper_id: string;
    title: string;
    question_count: number;
    avg_ocr_confidence: number;
  }>;
  evaluation_timeline: Array<{
    date: string;
    label: string;
    evaluated_count: number;
    avg_score_pct: number;
  }>;
  subject_mastery: Array<{
    subject: string;
    total_items: number;
    full_marks_pct: number;
    good_pct: number;
    partial_pct: number;
    low_pct: number;
  }>;
  recent_results: Array<{
    sheet_id: string;
    paper_id: string;
    student_name: string;
    roll_number: string;
    class_name: string;
    subject: string;
    exam_title: string;
    score: number;
    max_marks: number;
    percentage: number;
    ocr_confidence: number;
    full_q_count: number;
    good_q_count: number;
    partial_q_count: number;
    low_q_count: number;
    status: string;
    evaluated_at: string;
  }>;
}

export const DashboardScreen: React.FC = () => {
  const [, store] = useSheetStore();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);

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

  // Greeting & Date
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';
  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const kpis = data?.kpis || {
    avg_score_pct: (data as any)?.avg_score_pct || 0,
    total_evaluated: (data as any)?.total_evaluated || 0,
    total_sheets: (data as any)?.total_sheets || 0,
    needs_review_count: (data as any)?.needs_review_count || 0,
    total_questions: (data as any)?.total_questions || 0,
    avg_ocr_confidence: (data as any)?.avg_ocr_confidence || 0,
    total_papers: (data as any)?.total_papers || 0,
  };

  const batchBars = data?.batch_bars || [];
  const paperQuestionBars = data?.paper_question_bars || [];
  const evaluationTimeline = data?.evaluation_timeline || [];
  const subjectMastery = data?.subject_mastery || [];
  const recentResults = data?.recent_results || [];

  // Filtered recent results
  const filteredResults = useMemo(() => {
    if (!searchFilter.trim()) return recentResults;
    const q = searchFilter.toLowerCase();
    return recentResults.filter(
      (r) =>
        r.student_name.toLowerCase().includes(q) ||
        r.roll_number.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.exam_title.toLowerCase().includes(q)
    );
  }, [recentResults, searchFilter]);

  // SVG Progress Ring calculations (radius 38, circumference 238.76)
  const clampedScorePct = Math.min(100, Math.max(0, kpis.avg_score_pct));
  const strokeDashoffset = 238.76 - (clampedScorePct / 100) * 238.76;

  // Spline calculations for Evaluation Timeline
  const timelinePoints = useMemo(() => {
    if (evaluationTimeline.length === 0) return [];
    const count = evaluationTimeline.length;
    const maxVal = Math.max(...evaluationTimeline.map((t) => t.evaluated_count), 5);

    return evaluationTimeline.map((item, idx) => {
      const x = count > 1 ? 45 + (idx / (count - 1)) * 510 : 300;
      const y = 165 - (item.evaluated_count / maxVal) * 125;
      return { x, y, item };
    });
  }, [evaluationTimeline]);

  // Generate cubic bezier path for spline curve
  const { splinePath, areaPath } = useMemo(() => {
    if (timelinePoints.length === 0) return { splinePath: '', areaPath: '' };
    if (timelinePoints.length === 1) {
      const p = timelinePoints[0];
      return {
        splinePath: `M ${p.x - 20},${p.y} L ${p.x + 20},${p.y}`,
        areaPath: `M ${p.x - 20},165 L ${p.x - 20},${p.y} L ${p.x + 20},${p.y} L ${p.x + 20},165 Z`,
      };
    }

    let splineD = `M ${timelinePoints[0].x},${timelinePoints[0].y}`;
    for (let i = 0; i < timelinePoints.length - 1; i++) {
      const p0 = timelinePoints[i];
      const p1 = timelinePoints[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      const cy1 = p0.y;
      const cx2 = p0.x + (p1.x - p0.x) / 2;
      const cy2 = p1.y;
      splineD += ` C ${cx1},${cy1} ${cx2},${cy2} ${p1.x},${p1.y}`;
    }

    const first = timelinePoints[0];
    const last = timelinePoints[timelinePoints.length - 1];
    const areaD = `${splineD} L ${last.x},165 L ${first.x},165 Z`;

    return { splinePath: splineD, areaPath: areaD };
  }, [timelinePoints]);

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FD] overflow-y-auto">
      {/* Sticky Top Header Bar */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 px-6 md:px-8 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {greeting}
          </h1>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            Today is {todayFormatted} • Academic Evaluation Workspace
          </p>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              store.setStep('reports');
              window.location.hash = '#/reports';
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
            title="Export Class Results"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Class Results</span>
          </button>

          <button
            type="button"
            onClick={() => {
              store.setStep('upload');
              window.location.hash = '#/upload';
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            title="Evaluate New Answer Sheets"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Evaluate Sheets</span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="p-6 md:p-8 space-y-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono text-slate-500">Loading academic metrics...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="underline font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {data && !isLoading && (
          <>
            {/* Top 3-Card Bento Row */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5" data-purpose="metric-cards">
              {/* Card 1: Average Score & Circular Progress Ring */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
                <div className="space-y-3">
                  <span className="text-xs font-semibold text-slate-400">Average Score</span>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-slate-900">
                        {kpis.avg_score_pct}%
                      </span>
                      <span className="text-xs font-semibold text-slate-500">Overall</span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 mt-1">
                      {kpis.total_evaluated} / {kpis.total_sheets} graded
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                    <span className="p-1 rounded bg-indigo-50 text-indigo-600">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                        <path
                          clipRule="evenodd"
                          d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                          fillRule="evenodd"
                        />
                      </svg>
                    </span>
                    <span className="leading-tight">AI &amp; Rubric evaluated score</span>
                  </div>
                </div>

                {/* Circular Gauge SVG */}
                <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" fill="transparent" r="38" stroke="#F1F3F9" strokeWidth="9" />
                    <circle
                      className="transition-all duration-1000 ease-out"
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="38"
                      stroke="#7C3AED"
                      strokeDasharray="238.76"
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      strokeWidth="9"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {kpis.avg_score_pct}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Sheets Evaluated & Vertical Capsule Bar Rhythm */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400">Sheets Evaluated</span>
                    <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
                      {kpis.total_evaluated}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 mt-1">
                      <span>Needs review: {kpis.needs_review_count}</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                </div>

                {/* Vertical Capsule Bar Rhythm from batch_bars */}
                <div className="flex items-end justify-between h-14 pt-4 px-1 gap-1.5">
                  {batchBars.length === 0 ? (
                    <div className="w-full flex items-center justify-center text-[11px] text-slate-400 italic">
                      0 papers in batch
                    </div>
                  ) : (
                    batchBars.map((b) => {
                      const fraction = b.total_count > 0 ? b.evaluated_count / b.total_count : 0;
                      const heightPx = Math.max(8, Math.round(fraction * 40));
                      return (
                        <div
                          key={b.paper_id}
                          className={`w-2 rounded-full transition-all duration-500 ${
                            fraction >= 1
                              ? 'bg-indigo-600'
                              : fraction > 0.5
                              ? 'bg-indigo-500'
                              : 'bg-indigo-300'
                          }`}
                          style={{ height: `${heightPx}px` }}
                          title={`${b.title}: ${b.evaluated_count}/${b.total_count} evaluated (${b.subject})`}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              {/* Card 3: Question Bank & OCR & Teal Capsule Stack */}
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400">Question Bank &amp; OCR</span>
                    <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
                      {kpis.total_questions}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1">
                      <span>OCR Legibility: {kpis.avg_ocr_confidence}%</span>
                    </div>
                  </div>

                  {/* Teal Capsule Stack from paper_question_bars */}
                  <div className="flex items-center gap-1.5 h-12">
                    {paperQuestionBars.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">0 questions</span>
                    ) : (
                      (() => {
                        const maxQs = Math.max(...paperQuestionBars.map((p) => p.question_count), 1);
                        return paperQuestionBars.map((pq) => {
                          const fraction = pq.question_count / maxQs;
                          const heightPx = Math.max(12, Math.round(fraction * 36));
                          return (
                            <span
                              key={pq.paper_id}
                              className={`w-2 rounded-full inline-block transition-all ${
                                pq.avg_ocr_confidence >= 80
                                  ? 'bg-teal-500'
                                  : pq.avg_ocr_confidence >= 50
                                  ? 'bg-teal-400'
                                  : 'bg-teal-300'
                              }`}
                              style={{ height: `${heightPx}px` }}
                              title={`${pq.title}: ${pq.question_count} Qs, OCR: ${pq.avg_ocr_confidence}%`}
                            />
                          );
                        });
                      })()
                    )}
                  </div>
                </div>

                {/* Footer Descriptor */}
                <div className="flex items-center gap-2 pt-3 text-[11px] text-slate-400">
                  <span className="w-4 h-4 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-[10px]">
                    ?
                  </span>
                  <span className="leading-tight">
                    Configured assessments: {kpis.total_papers} papers in bank
                  </span>
                </div>
              </div>
            </section>

            {/* Middle Analytics 2-Column Row */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Spline Curve Chart: Evaluations Over Time (Col 6) */}
              <div
                className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between"
                data-purpose="exam-times-chart"
              >
                <div>
                  <div className="flex items-center justify-between pb-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Evaluations Over Time</h3>
                      <p className="text-xs text-slate-400">Daily evaluation volume and average score</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-xs">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                        <span>Timeline</span>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-5 my-2 text-xs font-medium text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED]" /> Active Evaluations
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-200" /> Evaluation Activity
                    </span>
                  </div>
                </div>

                {/* SVG Spline Curve Area Chart */}
                <div className="relative w-full h-56 mt-2">
                  {evaluationTimeline.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                      <p className="text-xs text-slate-400">No evaluation timeline recorded yet.</p>
                      <button
                        type="button"
                        onClick={() => {
                          store.setStep('upload');
                          window.location.hash = '#/upload';
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                      >
                        + Evaluate New Sheets
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 600 220">
                        <defs>
                          <linearGradient id="purpleGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.32" />
                            <stop offset="100%" stopColor="#C4B5FD" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Horizontal Reference Gridlines */}
                        <line stroke="#F1F5F9" strokeWidth="1.2" x1="30" x2="590" y1="30" y2="30" />
                        <line stroke="#F1F5F9" strokeWidth="1.2" x1="30" x2="590" y1="75" y2="75" />
                        <line stroke="#F1F5F9" strokeWidth="1.2" x1="30" x2="590" y1="120" y2="120" />
                        <line stroke="#F1F5F9" strokeWidth="1.2" x1="30" x2="590" y1="165" y2="165" />

                        {/* Vertical subtle column background rects */}
                        {timelinePoints.map((p, idx) => (
                          <rect
                            key={idx}
                            fill="#F5F3FF"
                            height={165 - p.y}
                            opacity="0.8"
                            rx="4"
                            width="10"
                            x={p.x - 5}
                            y={p.y}
                          />
                        ))}

                        {/* Spline Area Fill */}
                        {areaPath && <path d={areaPath} fill="url(#purpleGradient)" />}

                        {/* Spline Stroke Curve */}
                        {splinePath && (
                          <path
                            className="spline-glow"
                            d={splinePath}
                            fill="none"
                            stroke="#7C3AED"
                            strokeLinecap="round"
                            strokeWidth="2.5"
                          />
                        )}

                        {/* Data point nodes */}
                        {timelinePoints.map((p, idx) => (
                          <circle
                            key={idx}
                            cx={p.x}
                            cy={p.y}
                            fill="#FFFFFF"
                            r={hoveredPointIdx === idx ? 5.5 : 3.5}
                            stroke="#7C3AED"
                            strokeWidth={hoveredPointIdx === idx ? 2.5 : 2}
                            className="cursor-pointer transition-all"
                            onMouseEnter={() => setHoveredPointIdx(idx)}
                            onMouseLeave={() => setHoveredPointIdx(null)}
                          />
                        ))}

                        {/* Axis Labels (X) */}
                        {timelinePoints.map((p, idx) => (
                          <text
                            key={idx}
                            fill="#94A3B8"
                            fontFamily="sans-serif"
                            fontSize="10"
                            textAnchor="middle"
                            x={p.x}
                            y="190"
                          >
                            {p.item.label}
                          </text>
                        ))}
                      </svg>

                      {/* Interactive Hover Tooltip */}
                      {hoveredPointIdx !== null && timelinePoints[hoveredPointIdx] && (
                        <div
                          className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full bg-slate-900 text-white text-[11px] px-2.5 py-1.5 rounded-lg shadow-lg font-mono"
                          style={{
                            left: `${(timelinePoints[hoveredPointIdx].x / 600) * 100}%`,
                            top: `${(timelinePoints[hoveredPointIdx].y / 220) * 100 - 8}%`,
                          }}
                        >
                          <div className="font-bold">{timelinePoints[hoveredPointIdx].item.label}</div>
                          <div>{timelinePoints[hoveredPointIdx].item.evaluated_count} evaluated</div>
                          <div className="text-emerald-300">
                            Avg: {timelinePoints[hoveredPointIdx].item.avg_score_pct}%
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Right Card: Average Results by Subject (Col 6) */}
              <div
                className="lg:col-span-6 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between"
                data-purpose="test-questions-breakdown"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Average Results by Subject</h3>
                  </div>

                  {/* Multi-color Legend */}
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-medium text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED]" /> Full Marks (&ge;85%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]" /> Good (65&ndash;84%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Partial (40&ndash;64%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" /> Low (&lt;40%)
                    </span>
                  </div>
                </div>

                {/* Segmented Horizontal Subject Bars */}
                {subjectMastery.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <p className="text-xs text-slate-400">No subject mastery data available yet.</p>
                    <button
                      type="button"
                      onClick={() => {
                        store.setStep('upload');
                        window.location.hash = '#/upload';
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                    >
                      + Evaluate New Sheets
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 my-auto pt-4">
                    {subjectMastery.map((item) => (
                      <div key={item.subject} className="grid grid-cols-12 items-center gap-2">
                        <span
                          className="col-span-3 text-xs font-semibold text-slate-700 truncate"
                          title={item.subject}
                        >
                          {item.subject}
                        </span>
                        <div className="col-span-9 flex items-center gap-1.5 h-3">
                          {item.full_marks_pct > 0 && (
                            <div
                              className="h-full rounded-full bg-[#7C3AED] transition-all duration-500"
                              style={{ width: `${item.full_marks_pct}%` }}
                              title={`Full Marks: ${item.full_marks_pct}%`}
                            />
                          )}
                          {item.good_pct > 0 && (
                            <div
                              className="h-full rounded-full bg-[#14B8A6] transition-all duration-500"
                              style={{ width: `${item.good_pct}%` }}
                              title={`Good: ${item.good_pct}%`}
                            />
                          )}
                          {item.partial_pct > 0 && (
                            <div
                              className="h-full rounded-full bg-[#F59E0B] transition-all duration-500"
                              style={{ width: `${item.partial_pct}%` }}
                              title={`Partial: ${item.partial_pct}%`}
                            />
                          )}
                          {item.low_pct > 0 && (
                            <div
                              className="h-full rounded-full bg-[#EA580C] transition-all duration-500"
                              style={{ width: `${item.low_pct}%` }}
                              title={`Low: ${item.low_pct}%`}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pass Mark Incremental Scale */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span className="font-semibold text-slate-600">Pass Mark :</span>
                  <span>10</span>
                  <span>20</span>
                  <span>30</span>
                  <span>40</span>
                  <span>50</span>
                  <span>60</span>
                  <span>70</span>
                  <span>80</span>
                  <span>90</span>
                  <span>100</span>
                </div>
              </div>
            </section>

            {/* Bottom Table: Recent Evaluated Results */}
            <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm" data-purpose="browse-results-table">
              {/* Table Header Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 mb-4">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Recent Evaluated Results</h3>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Filter student or subject..."
                      className="bg-slate-50 text-xs text-slate-700 pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      store.setStep('history');
                      window.location.hash = '#/history';
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Full History</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Table Body */}
              {filteredResults.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-3">
                  <p>No evaluated answer sheets found. Upload sheets to get started.</p>
                  <button
                    type="button"
                    onClick={() => {
                      store.setStep('upload');
                      window.location.hash = '#/upload';
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Evaluate New Sheets</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-400 font-semibold border-b border-slate-100/80">
                        <th className="py-3 px-3">Student &amp; Roll No.</th>
                        <th className="py-3 px-3">Subject &amp; Exam</th>
                        <th className="py-3 px-3">Total Score</th>
                        <th className="py-3 px-3">OCR Confidence</th>
                        <th className="py-3 px-3">Score Breakdown</th>
                        <th className="py-3 px-3">Evaluated Date</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredResults.map((sh) => {
                        const initials = sh.student_name
                          ? sh.student_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()
                          : 'ST';

                        const formattedDate = sh.evaluated_at
                          ? new Date(sh.evaluated_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—';

                        const activeBars =
                          sh.ocr_confidence >= 80 ? 4 : sh.ocr_confidence >= 60 ? 3 : sh.ocr_confidence >= 40 ? 2 : 1;

                        return (
                          <tr key={sh.sheet_id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex-shrink-0 flex items-center justify-center font-bold text-indigo-800 text-xs">
                                  {initials}
                                </div>
                                <div>
                                  <span className="font-semibold text-slate-800 block">
                                    {sh.student_name}
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-400">
                                    {sh.roll_number || 'No roll'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-800 block">{sh.subject}</span>
                              <span
                                className="text-slate-400 block text-[11px] truncate max-w-[180px]"
                                title={sh.exam_title}
                              >
                                {sh.exam_title}
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <span
                                className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs border ${
                                  sh.percentage >= 75
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                    : sh.percentage >= 50
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                                    : 'bg-amber-50 text-amber-700 border-amber-200/60'
                                }`}
                              >
                                {sh.score} / {sh.max_marks} ({sh.percentage}%)
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <div className="flex items-end gap-0.5 h-3">
                                  <span
                                    className={`w-1 rounded-sm ${
                                      activeBars >= 1 ? 'bg-emerald-500 h-1.5' : 'bg-slate-200 h-1.5'
                                    }`}
                                  />
                                  <span
                                    className={`w-1 rounded-sm ${
                                      activeBars >= 2 ? 'bg-emerald-500 h-2' : 'bg-slate-200 h-2'
                                    }`}
                                  />
                                  <span
                                    className={`w-1 rounded-sm ${
                                      activeBars >= 3 ? 'bg-emerald-500 h-2.5' : 'bg-slate-200 h-2.5'
                                    }`}
                                  />
                                  <span
                                    className={`w-1 rounded-sm ${
                                      activeBars >= 4 ? 'bg-emerald-500 h-3' : 'bg-slate-200 h-3'
                                    }`}
                                  />
                                </div>
                                <span className="font-mono text-[11px] text-slate-600">
                                  {sh.ocr_confidence}%
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div
                                className="flex items-center gap-1"
                                title={`Full: ${sh.full_q_count}, Good: ${sh.good_q_count}, Partial: ${sh.partial_q_count}, Low: ${sh.low_q_count}`}
                              >
                                <span
                                  className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200"
                                  title="Full Marks (>=85%)"
                                >
                                  {sh.full_q_count}F
                                </span>
                                <span
                                  className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-teal-50 text-teal-700 border border-teal-200"
                                  title="Good (65-84%)"
                                >
                                  {sh.good_q_count}G
                                </span>
                                <span
                                  className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200"
                                  title="Partial (40-64%)"
                                >
                                  {sh.partial_q_count}P
                                </span>
                                <span
                                  className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-rose-50 text-rose-700 border border-rose-200"
                                  title="Low (<40%)"
                                >
                                  {sh.low_q_count}L
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-3 font-medium text-slate-600">
                              {formattedDate}
                            </td>

                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  sh.status === 'ready' || sh.status === 'evaluated'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {sh.status}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    store.setStep('evaluate', sh.sheet_id);
                                    window.location.hash = `#/evaluate/${sh.sheet_id}`;
                                  }}
                                  className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition cursor-pointer"
                                  title="Open Evaluation"
                                >
                                  Evaluate
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    store.setStep('report', sh.sheet_id);
                                    window.location.hash = `#/report/${sh.sheet_id}`;
                                  }}
                                  className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                                  title="View Sheet Report"
                                >
                                  <span>Report</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    window.open(`/api/sheets/${sh.sheet_id}/export/pdf`, '_blank');
                                  }}
                                  className="p-1 rounded hover:text-slate-600 hover:bg-slate-100 text-slate-400 transition cursor-pointer"
                                  title="Download PDF Marksheet"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};
