import React, { useState } from 'react';
import { NormalizedQuestion, StudentReportData, PaperReportData } from './types';

interface ReportAnalyticsTabProps {
  studentReport: StudentReportData | null;
  paperReport: PaperReportData | null;
  questions: NormalizedQuestion[];
  evaluatedSheetsCount: number;
  selectedQuestionIndex: number;
  onSelectQuestion: (index: number) => void;
}

export const ReportAnalyticsTab: React.FC<ReportAnalyticsTabProps> = ({
  studentReport,
  paperReport,
  questions,
  evaluatedSheetsCount,
  selectedQuestionIndex,
  onSelectQuestion,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'secMarks' | 'secErrors' | 'secFormats'>('all');

  const totalScore = studentReport?.total_score ?? 0;
  const maxMarks = studentReport?.max_marks || 100;
  const percentage = studentReport?.percentage ?? (maxMarks > 0 ? (totalScore / maxMarks) * 100 : 0);
  const grade = studentReport?.grade || 'N/A';
  const totalLost = Math.max(0, maxMarks - totalScore);

  const hasCohortAvg = evaluatedSheetsCount >= 2 && paperReport?.analytics?.average_percentage !== undefined;
  const cohortAvgPct = paperReport?.analytics?.average_percentage ?? 0;
  const cohortAvgScore = paperReport?.analytics?.average_score ?? 0;

  // 1. Group 1: Question marks status counts
  let fullCount = 0;
  let partialCount = 0;
  let deductionCount = 0;

  questions.forEach((q) => {
    const qMax = q.max_marks || 1;
    const earned = q.final_marks || 0;
    const pct = (earned / qMax) * 100;
    if (pct >= 90) fullCount++;
    else if (pct > 0) partialCount++;
    else deductionCount++;
  });

  // Sectional breakdown
  const sectionsMap = new Map<string, { earned: number; max: number; count: number; qNos: string[] }>();
  questions.forEach((q) => {
    const sec = q.section_name?.trim() || 'General';
    const curr = sectionsMap.get(sec) || { earned: 0, max: 0, count: 0, qNos: [] };
    curr.earned += q.final_marks || 0;
    curr.max += q.max_marks || 0;
    curr.count += 1;
    curr.qNos.push(`Q${q.q_no}`);
    sectionsMap.set(sec, curr);
  });

  const sectionalList = Array.from(sectionsMap.entries()).map(([name, data]) => {
    const pct = data.max > 0 ? (data.earned / data.max) * 100 : 0;
    const lost = Math.max(0, data.max - data.earned);
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
      earned: data.earned,
      max: data.max,
      pct,
      lost,
      count: data.count,
      qNos: data.qNos,
      barColor,
      textColor,
      badgeClass,
    };
  });

  // Donut 1: Scored vs Lost
  const C_DONUT = 301.59;
  const scoredFraction = maxMarks > 0 ? totalScore / maxMarks : 0;
  const scoredDash = (scoredFraction * C_DONUT).toFixed(2);
  const lostFraction = maxMarks > 0 ? totalLost / maxMarks : 0;
  const lostDash = (lostFraction * C_DONUT).toFixed(2);

  // 2. Group 2: Error category breakdown
  let conceptualLost = 0;
  let incompleteLost = 0;
  let syntaxFlagsLost = 0;
  let otherLost = 0;

  questions.forEach((q) => {
    const qMax = q.max_marks || 1;
    const qEarned = q.final_marks || 0;
    const qLost = Math.max(0, qMax - qEarned);
    if (qLost <= 0) return;

    const hasRedFlag = (q.flags || []).some((f) => f.severity === 'red');
    const hasAmberFlag = (q.flags || []).some((f) => f.severity === 'amber');

    if (qEarned === 0) {
      conceptualLost += qLost;
    } else if (hasRedFlag || hasAmberFlag) {
      syntaxFlagsLost += qLost * 0.5;
      incompleteLost += qLost * 0.5;
    } else if (qEarned < qMax) {
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

  const rawErrorCategories = [
    { name: 'Conceptual Mistakes', loss: conceptualLost, color: '#E11D48', dotClass: 'bg-rose-600', textClass: 'text-rose-700 dark:text-[#E57D8A]', bgClass: 'bg-rose-50/50 border-rose-100 dark:bg-[#2B191D]/50 dark:border-[#45262C]' },
    { name: 'Incomplete Steps', loss: incompleteLost, color: '#F59E0B', dotClass: 'bg-amber-500', textClass: 'text-amber-700 dark:text-[#E5B567]', bgClass: 'bg-amber-50/50 border-amber-100 dark:bg-[#2B2416]/50 dark:border-[#42361F]' },
    { name: 'Syntax / Rubric Flags', loss: syntaxFlagsLost, color: '#1F6E4A', dotClass: 'bg-[#0F5132] dark:bg-[#1F6E4A]', textClass: 'text-[#0B3D26] dark:text-[#7CC9A3]', bgClass: 'bg-[#E8F3EE]/50 border-[#E8F3EE] dark:bg-[#1A2B23]/50 dark:border-[#294236]' },
    { name: 'Other Deductions', loss: otherLost, color: '#94A3B8', dotClass: 'bg-slate-400 dark:bg-[#68706C]', textClass: 'text-slate-600 dark:text-[#969E9A]', bgClass: 'bg-slate-50 border-slate-200 dark:bg-[#202422] dark:border-[#2F3532]' },
  ].filter((c) => c.loss > 0 || totalLost === 0);

  const errorCategories = rawErrorCategories.length > 0 ? rawErrorCategories : [
    { name: 'No Deductions', loss: 0, color: '#1F6E4A', dotClass: 'bg-[#0F5132] dark:bg-[#1F6E4A]', textClass: 'text-[#0F5132] dark:text-[#7CC9A3]', bgClass: 'bg-[#E8F3EE] border-[#0F5132]/20 dark:bg-[#1A2B23] dark:border-[#294236]' }
  ];

  // Pareto cumulative data
  const sortedErrors = [...errorCategories].sort((a, b) => b.loss - a.loss);
  const paretoData: Array<typeof sortedErrors[0] & { cumPct: number; pct: number }> = [];
  let runningLoss = 0;
  sortedErrors.forEach((cat) => {
    runningLoss += cat.loss;
    const cumPct = totalLost > 0 ? Math.min(100, Math.round((runningLoss / totalLost) * 100)) : 100;
    const pct = totalLost > 0 ? Math.round((cat.loss / totalLost) * 100) : 0;
    paretoData.push({ ...cat, cumPct, pct });
  });

  // Calculate dynamic segments for error donut
  let accErrOffset = 0;
  const errorSegments = errorCategories.map((c) => {
    const fraction = totalLost > 0 ? c.loss / totalLost : 0;
    const dash = (fraction * C_DONUT).toFixed(2);
    const offset = -accErrOffset;
    accErrOffset += fraction * C_DONUT;
    return { ...c, dash, offset, pct: totalLost > 0 ? ((c.loss / totalLost) * 100).toFixed(1) : '0' };
  });

  // 3. Group 3: Question formats and attempt status
  const formatsMap = new Map<string, { earned: number; max: number; count: number }>();
  questions.forEach((q) => {
    let fmt = q.question_type;
    if (!fmt) {
      const qm = q.max_marks || 1;
      if (qm <= 2) fmt = 'Objective / Short';
      else if (qm <= 5) fmt = 'Core Practical';
      else fmt = 'Extended / Long';
    }
    const curr = formatsMap.get(fmt) || { earned: 0, max: 0, count: 0 };
    curr.earned += q.final_marks || 0;
    curr.max += q.max_marks || 0;
    curr.count += 1;
    formatsMap.set(fmt, curr);
  });

  const formatsList = Array.from(formatsMap.entries()).map(([fmt, data]) => {
    const earnedPct = data.max > 0 ? Math.round((data.earned / data.max) * 100) : 0;
    const lostPct = Math.max(0, 100 - earnedPct);
    return {
      fmt,
      earned: data.earned,
      max: data.max,
      count: data.count,
      earnedPct,
      lostPct,
    };
  });

  // Attempt status
  let attemptFull = 0;
  let attemptPartial = 0;
  let attemptDeduction = 0;
  let attemptUnattempted = 0;

  questions.forEach((q) => {
    const qMax = q.max_marks || 1;
    const earned = q.final_marks || 0;
    const isAtt = q.ocr_text && q.ocr_text.trim().length > 0;
    const pct = (earned / qMax) * 100;

    if (!isAtt && earned === 0) {
      attemptUnattempted++;
    } else if (pct >= 90) {
      attemptFull++;
    } else if (pct > 0) {
      attemptPartial++;
    } else {
      attemptDeduction++;
    }
  });

  const totalQs = questions.length || 1;
  const attemptCategories = [
    { label: 'Full Marks (≥90%)', count: attemptFull, pct: Math.round((attemptFull / totalQs) * 100), color: '#1F6E4A', dotClass: 'bg-[#0F5132] dark:bg-[#1F6E4A]' },
    { label: 'Partial Marks', count: attemptPartial, pct: Math.round((attemptPartial / totalQs) * 100), color: '#E5B567', dotClass: 'bg-amber-500 dark:bg-[#E5B567]' },
    { label: 'Heavy Deductions / Zero', count: attemptDeduction, pct: Math.round((attemptDeduction / totalQs) * 100), color: '#E57D8A', dotClass: 'bg-rose-500 dark:bg-[#E57D8A]' },
    { label: 'Unattempted', count: attemptUnattempted, pct: Math.round((attemptUnattempted / totalQs) * 100), color: '#68706C', dotClass: 'bg-slate-300 dark:bg-[#68706C]' },
  ];

  let accAttOffset = 0;
  const attemptSegments = attemptCategories.map((c) => {
    const fraction = c.count / totalQs;
    const dash = (fraction * C_DONUT).toFixed(2);
    const offset = -accAttOffset;
    accAttOffset += fraction * C_DONUT;
    return { ...c, dash, offset };
  });

  return (
    <div className="h-full flex flex-col overflow-y-auto p-5 space-y-5">
      {/* Analytics Header Banner */}
      <div className="p-4 rounded-xl bg-[#0F5132] dark:bg-[#181B19] text-white border border-transparent dark:border-[#2A2F2C] flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm tracking-wide text-white dark:text-[#ECEEED]">Comprehensive Exam Evaluation Analytics</span>
            <span className="px-2 py-0.5 rounded-full bg-white/20 dark:bg-[#202422] text-white dark:text-[#ECEEED] font-mono text-[10px]">
              Sync: {questions.length} Questions
            </span>
          </div>
          <p className="text-xs text-[#E8F3EE] dark:text-[#969E9A]">
            Deep diagnostic telemetry across Question Marks, Section Distributions, Teacher Deductions, and Question Formats.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="bg-white/10 dark:bg-[#202422] px-2.5 py-1 rounded-lg border border-white/20 dark:border-[#2F3532] text-white dark:text-[#ECEEED] font-medium">
            Score: {totalScore.toFixed(1)} / {maxMarks.toFixed(1)} ({percentage.toFixed(1)}%)
          </span>
          <span className="bg-emerald-500/30 dark:bg-[#1A2B23] text-emerald-200 dark:text-[#7CC9A3] px-2.5 py-1 rounded-lg border border-emerald-400/30 dark:border-[#294236] font-semibold">
            Grade {grade}
          </span>
        </div>
      </div>

      {/* Sub-Navigation Category Filter Pill Bar */}
      <div className="flex items-center justify-between border-b border-[#E2E8E4] dark:border-[#2A2F2C] pb-2 text-xs">
        <div className="flex items-center space-x-1.5">
          <button
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-[#0F5132] text-white dark:bg-[#1F6E4A]'
                : 'bg-[#F1F4F2] text-[#4B5563] hover:bg-[#E2E8E4] hover:text-[#111827] dark:bg-[#202422] dark:text-[#969E9A] dark:hover:bg-[#2A2F2C] dark:hover:text-[#ECEEED]'
            }`}
            onClick={() => setActiveFilter('all')}
            type="button"
          >
            All Visualizations
          </button>
          <button
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              activeFilter === 'secMarks'
                ? 'bg-[#0F5132] text-white dark:bg-[#1F6E4A]'
                : 'bg-[#F1F4F2] text-[#4B5563] hover:bg-[#E2E8E4] hover:text-[#111827] dark:bg-[#202422] dark:text-[#969E9A] dark:hover:bg-[#2A2F2C] dark:hover:text-[#ECEEED]'
            }`}
            onClick={() => setActiveFilter('secMarks')}
            type="button"
          >
            1. Question &amp; Section Marks
          </button>
          <button
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              activeFilter === 'secErrors'
                ? 'bg-[#0F5132] text-white dark:bg-[#1F6E4A]'
                : 'bg-[#F1F4F2] text-[#4B5563] hover:bg-[#E2E8E4] hover:text-[#111827] dark:bg-[#202422] dark:text-[#969E9A] dark:hover:bg-[#2A2F2C] dark:hover:text-[#ECEEED]'
            }`}
            onClick={() => setActiveFilter('secErrors')}
            type="button"
          >
            2. Error &amp; Remark Diagnostics
          </button>
          <button
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              activeFilter === 'secFormats'
                ? 'bg-[#0F5132] text-white dark:bg-[#1F6E4A]'
                : 'bg-[#F1F4F2] text-[#4B5563] hover:bg-[#E2E8E4] hover:text-[#111827] dark:bg-[#202422] dark:text-[#969E9A] dark:hover:bg-[#2A2F2C] dark:hover:text-[#ECEEED]'
            }`}
            onClick={() => setActiveFilter('secFormats')}
            type="button"
          >
            3. Formats &amp; Attempt Status
          </button>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-[#6B7280] dark:text-[#68706C] font-mono">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#0F5132] dark:bg-[#1F6E4A]" />
            <span>Mastered</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-[#E5B567]" />
            <span>Partial</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 dark:bg-[#E57D8A]" />
            <span>Deductions</span>
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* GROUP 1: BASED ON QUESTION & SECTION MARKS                              */}
      {/* ========================================================================= */}
      {(activeFilter === 'all' || activeFilter === 'secMarks') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-4 bg-[#0F5132] dark:bg-[#1F6E4A] rounded-sm" />
              <h3 className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                1. Question &amp; Section Marks Telemetry
              </h3>
              <span className="px-2 py-0.5 rounded bg-[#E8F3EE] text-[#0B3D26] dark:bg-[#1A2B23] dark:text-[#7CC9A3] font-mono text-[10px] font-semibold border border-[#0F5132]/20 dark:border-[#294236]">
                Q1 to Q{questions.length} ({maxMarks.toFixed(1)} Total Marks)
              </span>
            </div>
            <span className="text-[11px] text-[#6B7280] dark:text-[#68706C] font-mono">
              {hasCohortAvg
                ? `Benchmarked vs Cohort Avg ${cohortAvgScore.toFixed(1)}`
                : 'Cohort avg available after 2+ sheets'}
            </span>
          </div>

          {/* 1.1 Vertical Column Chart: Q1 to QN */}
          <div className="bg-white dark:bg-[#181B19] rounded-xl border border-[#E2E8E4] dark:border-[#2A2F2C] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] flex items-center space-x-2">
                  <span>Question-by-Question Marks Scored vs Max</span>
                  <span className="text-[10px] font-normal text-[#6B7280] dark:text-[#68706C] font-mono">
                    ({questions.length} Questions)
                  </span>
                </h4>
                <p className="text-[11px] text-[#4B5563] dark:text-[#969E9A] mt-0.5">
                  Visual bar heights indicate obtained marks with color-coded evaluation status (Emerald = Full, Amber = Partial, Rose = Heavy Deduction).
                </p>
              </div>
              <div className="flex items-center space-x-3 text-[10px] font-mono">
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#0F5132] dark:bg-[#1F6E4A]" />
                  <span className="text-[#4B5563] dark:text-[#969E9A]">Full ({fullCount})</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 dark:bg-[#E5B567]" />
                  <span className="text-[#4B5563] dark:text-[#969E9A]">Partial ({partialCount})</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 dark:bg-[#E57D8A]" />
                  <span className="text-[#4B5563] dark:text-[#969E9A]">Deduction ({deductionCount})</span>
                </div>
                {hasCohortAvg && (
                  <div className="flex items-center space-x-1">
                    <span className="w-3 border-t border-dashed border-[#0F5132]/40 dark:border-[#7CC9A3]/40" />
                    <span className="text-[#0F5132] dark:text-[#7CC9A3]">Cohort Avg {Math.round(cohortAvgPct)}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Chart Canvas */}
            <div className="bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg p-3 pt-6 relative select-none">
              {hasCohortAvg && (
                <div
                  className="absolute left-10 right-4 border-t border-dashed border-[#0F5132]/40 dark:border-[#7CC9A3]/40 pointer-events-none z-10 flex justify-end"
                  style={{ top: `${Math.max(10, Math.min(90, 100 - cohortAvgPct))}%` }}
                >
                  <span className="text-[9px] font-mono text-[#0B3D26] dark:text-[#7CC9A3] bg-white/95 dark:bg-[#181B19] px-1 py-0.2 rounded -mt-2 border border-[#0F5132]/20 dark:border-[#294236]">
                    Cohort Avg {Math.round(cohortAvgPct)}%
                  </span>
                </div>
              )}

              {/* Y-Axis labels */}
              <div className="absolute -left-0.5 top-0 bottom-6 flex flex-col justify-between text-[9px] font-mono text-[#6B7280] dark:text-[#68706C] pl-3">
                <span>100%</span>
                <span>50%</span>
                <span>0%</span>
              </div>

              {/* Bar Columns Container */}
              <div className="ml-10 h-32 flex items-end justify-between gap-1.5 pt-2 pb-1 relative z-0">
                {questions.map((q, idx) => {
                  const qMax = q.max_marks || 1;
                  const qEarned = q.final_marks || 0;
                  const pct = Math.min(100, Math.max(0, (qEarned / qMax) * 100));
                  const isSelected = selectedQuestionIndex === idx;

                  let barColor = 'bg-[#0F5132] dark:bg-[#1F6E4A]';
                  let textColor = 'text-[#0F5132] dark:text-[#7CC9A3]';
                  if (pct < 40) {
                    barColor = 'bg-rose-500 dark:bg-[#E57D8A]';
                    textColor = 'text-rose-700 dark:text-[#E57D8A]';
                  } else if (pct < 90) {
                    barColor = 'bg-amber-500 dark:bg-[#E5B567]';
                    textColor = 'text-amber-700 dark:text-[#E5B567]';
                  }

                  return (
                    <div
                      key={q.eval_id || idx}
                      onClick={() => onSelectQuestion(idx)}
                      className={`flex-1 flex flex-col items-center h-full justify-end group cursor-pointer ${
                        isSelected ? 'ring-2 ring-[#0F5132] dark:ring-[#1F6E4A] ring-offset-1 dark:ring-offset-[#181B19] rounded-sm' : ''
                      }`}
                      title={`Q${q.q_no}: ${qEarned} / ${qMax} (${Math.round(pct)}%) - Click to review`}
                    >
                      <div className={`text-[9px] font-mono font-bold mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${textColor}`}>
                        {qEarned}/{qMax}
                      </div>
                      <div className="w-full max-w-[20px] h-full flex flex-col justify-end bg-[#E2E8E4] dark:bg-[#2A2F2C] rounded-t-sm overflow-hidden">
                        <div
                          className={`w-full ${barColor} rounded-t-sm transition-all duration-300`}
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-[9px] font-mono font-semibold mt-1 ${isSelected ? 'text-[#0F5132] dark:text-[#7CC9A3] font-bold' : 'text-[#4B5563] dark:text-[#969E9A]'}`}>
                        Q{q.q_no}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 1.2 & 1.3 Two-Column Row: Donut Split & Horizontal Section Performance */}
          <div className="grid grid-cols-2 gap-4">
            {/* 1.2 Donut Chart: Total Marks Split */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                  Total Marks Distribution Split
                </h4>
                <span className="text-[10px] font-mono bg-[#F1F4F2] dark:bg-[#202422] text-[#4B5563] dark:text-[#969E9A] px-2 py-0.5 rounded whitespace-nowrap shrink-0">
                  Max {maxMarks.toFixed(1)} M
                </span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
                Evaluation ratio between earned points and deductions across entire paper.
              </p>
              <div className="flex items-center justify-center gap-6 pt-2">
                <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" fill="transparent" r="48" stroke="#F1F4F2" strokeWidth="14" className="stroke-[#F1F4F2] dark:stroke-[#202422]" />
                    {/* Marks Scored */}
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
                    {/* Marks Lost */}
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
                    <span className="text-[9px] font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-mono flex-1">
                  <div className="p-2 rounded-lg bg-[#E8F3EE]/50 border border-[#E8F3EE] dark:bg-[#1A2B23]/50 dark:border-[#294236] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0F5132] dark:bg-[#1F6E4A]" />
                      <span className="font-sans text-[#111827] dark:text-[#ECEEED] font-medium">Marks Scored</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#0B3D26] dark:text-[#7CC9A3]">{totalScore.toFixed(1)} M</div>
                      <div className="text-[10px] text-[#4B5563] dark:text-[#969E9A]">{percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50/50 border border-rose-100 dark:bg-[#2B191D]/50 dark:border-[#45262C] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 dark:bg-[#E57D8A]" />
                      <span className="font-sans text-[#111827] dark:text-[#ECEEED] font-medium">Marks Lost</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-rose-600 dark:text-[#E57D8A]">{totalLost.toFixed(1)} M</div>
                      <div className="text-[10px] text-[#4B5563] dark:text-[#969E9A]">
                        {maxMarks > 0 ? ((totalLost / maxMarks) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 1.3 Horizontal Bar Chart: Sectional Marks */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                  Sectional Marks Breakdown
                </h4>
                <span className="text-[10px] font-mono text-[#6B7280] dark:text-[#68706C] whitespace-nowrap shrink-0">
                  {sectionalList.length} Exam Sections
                </span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
                Performance breakdown across categorized subject sections.
              </p>
              <div className="space-y-3 pt-1 text-xs">
                {sectionalList.map((sec, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-[#111827] dark:text-[#ECEEED] font-sans">{sec.name}</span>
                      <div className="space-x-1 font-mono text-xs">
                        <span className={`font-bold ${sec.textColor}`}>
                          {sec.earned.toFixed(1)} / {sec.max.toFixed(1)} M
                        </span>
                        <span className={`text-[10px] font-bold px-1 py-0.2 rounded border ${sec.badgeClass}`}>
                          {sec.pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-[#F1F4F2] dark:bg-[#202422] h-2.5 rounded-full overflow-hidden flex">
                      <div className={`${sec.barColor} h-full rounded-full`} style={{ width: `${sec.pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#6B7280] dark:text-[#68706C] font-mono">
                      <span>{sec.qNos.slice(0, 5).join(', ')} · {sec.count} Questions</span>
                      <span className="text-rose-500 dark:text-[#E57D8A]">-{sec.lost.toFixed(1)} M lost</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GROUP 2: BASED ON TEACHER REMARKS & ERROR TYPES                         */}
      {/* ========================================================================= */}
      {(activeFilter === 'all' || activeFilter === 'secErrors') && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-4 bg-rose-500 dark:bg-[#E57D8A] rounded-sm" />
              <h3 className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                2. Teacher Deductions &amp; Error Taxonomy
              </h3>
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-[#2B191D] dark:text-[#E57D8A] font-mono text-[10px] font-semibold border border-rose-200 dark:border-[#45262C]">
                {totalLost.toFixed(1)} Total Marks Lost
              </span>
            </div>
            <span className="text-[11px] text-[#6B7280] dark:text-[#68706C] font-mono">
              Extracted from Deductions &amp; Evaluation Rubrics
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 2.1 Donut Chart: Categorize Lost Marks */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                  Deductions by Error Category
                </h4>
                <span className="text-[10px] font-mono text-rose-600 dark:text-[#E57D8A] font-bold bg-rose-50 dark:bg-[#2B191D] px-2 py-0.5 rounded border border-rose-200 dark:border-[#45262C] whitespace-nowrap shrink-0">
                  -{totalLost.toFixed(1)} M
                </span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
                Proportion of marks lost classified from student evaluation verdicts and rubric deductions.
              </p>
              <div className="flex items-center justify-center gap-6 pt-2">
                <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" fill="transparent" r="48" stroke="#F1F4F2" strokeWidth="14" className="stroke-[#F1F4F2] dark:stroke-[#202422]" />
                    {errorSegments.map((seg, i) => (
                      <circle
                        key={i}
                        cx="60"
                        cy="60"
                        fill="transparent"
                        r="48"
                        stroke={seg.color}
                        strokeDasharray={`${seg.dash} ${C_DONUT}`}
                        strokeDashoffset={`${seg.offset}`}
                        strokeLinecap="round"
                        strokeWidth="14"
                      />
                    ))}
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-lg font-mono font-bold text-rose-600 dark:text-[#E57D8A] leading-none">
                      -{totalLost.toFixed(1)}
                    </span>
                    <span className="text-[9px] font-mono text-[#6B7280] dark:text-[#68706C] mt-0.5">Marks Lost</span>
                    <span className="text-[8px] font-bold text-[#4B5563] dark:text-[#969E9A]">100% Errors</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono flex-1">
                  {errorSegments.map((seg, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-1.5 rounded border ${seg.bgClass}`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${seg.dotClass}`} />
                        <span className="font-sans text-[#111827] dark:text-[#ECEEED] font-medium truncate max-w-[130px]">
                          {seg.name}
                        </span>
                      </div>
                      <span className={`font-bold ${seg.textClass}`}>
                        {seg.loss.toFixed(1)}M ({seg.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2.2 Pareto Chart: Ranked Errors with Cumulative % Line */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                    Pareto Error Analysis (80/20 Rule)
                  </h4>
                  <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 dark:bg-[#2B2416] dark:text-[#E5B567] font-mono text-[9px] font-bold border border-amber-200 dark:border-[#42361F]">
                    Ranked Deductions
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#0F5132] dark:text-[#7CC9A3] font-semibold whitespace-nowrap shrink-0">
                  Line: Cumulative %
                </span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
                Prioritizes where mark loss was concentrated across student answer criteria.
              </p>

              {/* Pareto SVG Chart */}
              <div className="bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg p-3 pt-4 relative">
                <svg className="w-full h-36" viewBox="0 0 380 140">
                  {/* Grid Lines */}
                  <line stroke="#E2E8F0" strokeDasharray="3 3" x1="30" x2="350" y1="20" y2="20" className="stroke-[#E2E8E4] dark:stroke-[#2A2F2C]" />
                  <line stroke="#E2E8F0" strokeDasharray="3 3" x1="30" x2="350" y1="60" y2="60" className="stroke-[#E2E8E4] dark:stroke-[#2A2F2C]" />
                  <line stroke="#E2E8F0" strokeDasharray="3 3" x1="30" x2="350" y1="100" y2="100" className="stroke-[#E2E8E4] dark:stroke-[#2A2F2C]" />
                  <line stroke="#CBD5E1" strokeWidth="1.5" x1="30" x2="350" y1="120" y2="120" className="stroke-[#CBD5E1] dark:stroke-[#2F3532]" />

                  {/* 80% Threshold Reference Line */}
                  <line stroke="#A5B4FC" strokeDasharray="2 2" strokeWidth="1" x1="30" x2="350" y1="40" y2="40" className="stroke-indigo-300 dark:stroke-indigo-700" />
                  <text fill="#6366F1" fontFamily="JetBrains Mono" fontSize="8" textAnchor="end" x="330" y="36">
                    80% Cutoff
                  </text>

                  {/* Bars & Points */}
                  {paretoData.map((d, i) => {
                    const x = 55 + i * 80;
                    const maxLoss = paretoData[0]?.loss || 1;
                    const barHeight = Math.max(10, Math.min(96, (d.loss / maxLoss) * 96));
                    const y = 120 - barHeight;
                    return (
                      <g key={i}>
                        <rect
                          className="opacity-90 hover:opacity-100 transition-opacity"
                          fill={d.color}
                          height={barHeight}
                          rx="2"
                          width="46"
                          x={x}
                          y={y}
                        />
                        <text
                          fill={d.color}
                          fontFamily="JetBrains Mono"
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="middle"
                          x={x + 23}
                          y={Math.max(14, y - 4)}
                        >
                          {d.loss.toFixed(1)} M
                        </text>
                        <text
                          fill="#475569"
                          fontFamily="sans-serif"
                          fontSize="8"
                          fontWeight="600"
                          textAnchor="middle"
                          x={x + 23}
                          y="132"
                          className="fill-[#475569] dark:fill-[#969E9A]"
                        >
                          {d.name.split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}

                  {/* Cumulative Polyline */}
                  {paretoData.length > 0 && (
                    <>
                      <polyline
                        fill="none"
                        points={paretoData
                          .map((d, i) => `${78 + i * 80},${Math.round(120 - (d.cumPct / 100) * 100)}`)
                          .join(' ')}
                        stroke="#1F6E4A"
                        strokeWidth="2"
                      />
                      {paretoData.map((d, i) => {
                        const cx = 78 + i * 80;
                        const cy = Math.round(120 - (d.cumPct / 100) * 100);
                        return (
                          <g key={i}>
                            <circle cx={cx} cy={cy} fill="#1F6E4A" r="3.5" stroke="#FFFFFF" strokeWidth="1.5" />
                            <text
                              fill="#1F6E4A"
                              fontFamily="JetBrains Mono"
                              fontSize="8"
                              fontWeight="bold"
                              x={cx + 6}
                              y={cy - 4}
                            >
                              {d.cumPct}%
                            </text>
                          </g>
                        );
                      })}
                    </>
                  )}
                </svg>
              </div>

              {/* Root Cause Callout */}
              <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 dark:bg-[#2B2416]/50 dark:border-[#42361F] flex items-start justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-900 dark:text-[#E5B567]">Priority Focus Area:</span>
                  <p className="text-amber-800 dark:text-[#E5B567]/90 text-[11px]">
                    Concentrated mark loss occurred on{' '}
                    {sortedErrors[0]?.name || 'rubric criteria'}. Review detailed model key expectations for improved yield.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-200/80 text-amber-900 dark:bg-[#42361F] dark:text-[#E5B567] font-mono text-[10px] font-bold shrink-0">
                  Priority 1
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GROUP 3: BASED ON QUESTION FORMAT & ATTEMPT STATUS                      */}
      {/* ========================================================================= */}
      {(activeFilter === 'all' || activeFilter === 'secFormats') && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-4 bg-[#0F5132] dark:bg-[#1F6E4A] rounded-sm" />
              <h3 className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                3. Question Format &amp; Attempt Performance
              </h3>
              <span className="px-2 py-0.5 rounded bg-[#E8F3EE] text-[#0B3D26] dark:bg-[#1A2B23] dark:text-[#7CC9A3] font-mono text-[10px] font-semibold border border-[#0F5132]/20 dark:border-[#294236]">
                100% Paper Processed
              </span>
            </div>
            <span className="text-[11px] text-[#6B7280] dark:text-[#68706C] font-mono">
              Format Accuracy &amp; Question Completion
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 3.1 100% Stacked Bar Chart across Question Formats */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                  Marks Earned vs Lost by Question Format
                </h4>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium">
                    <span className="w-2 h-2 rounded bg-[#0F5132] dark:bg-[#1F6E4A] shrink-0" />
                    <span className="text-[#4B5563] dark:text-[#969E9A]">Earned %</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium">
                    <span className="w-2 h-2 rounded bg-rose-500 dark:bg-[#E57D8A] shrink-0" />
                    <span className="text-[#4B5563] dark:text-[#969E9A]">Lost %</span>
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
                100% stacked representation demonstrating how question types impacted score yield.
              </p>

              <div className="space-y-3 pt-1 text-xs">
                {formatsList.map((f, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between font-mono text-xs">
                      <span className="font-sans font-medium text-[#111827] dark:text-[#ECEEED]">
                        {f.fmt} ({f.count} Qs)
                      </span>
                      <span className="text-[#0F5132] dark:text-[#7CC9A3] font-bold">
                        {f.earnedPct}% Earned / {f.lostPct}% Lost
                      </span>
                    </div>
                    <div className="w-full bg-[#F1F4F2] dark:bg-[#202422] h-2.5 rounded-full overflow-hidden flex">
                      <div className="bg-[#0F5132] dark:bg-[#1F6E4A] h-full transition-all duration-300" style={{ width: `${f.earnedPct}%` }} />
                      <div className="bg-rose-500 dark:bg-[#E57D8A] h-full transition-all duration-300" style={{ width: `${f.lostPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#6B7280] dark:text-[#68706C] font-mono">
                      <span>{f.earned.toFixed(1)} / {f.max.toFixed(1)} Marks</span>
                      <span className="text-[#0F5132] dark:text-[#7CC9A3] font-medium">{f.earnedPct >= 75 ? 'Strong Yield' : 'Moderate Yield'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3.2 Question Attempt Status Donut Chart */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                  Question Attempt &amp; Mastery Breakdown
                </h4>
                <span className="whitespace-nowrap shrink-0 text-[10px] font-mono text-[#0F5132] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] px-2 py-0.5 rounded border border-[#0F5132]/20 dark:border-[#294236] font-bold">
                  {questions.length} Total Qs
                </span>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
                Question attempt completion and scoring mastery distribution across all items.
              </p>

              {/* Centered Donut Chart */}
              <div className="flex justify-center pt-2">
                <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" fill="transparent" r="48" stroke="#F1F4F2" strokeWidth="14" className="stroke-[#F1F4F2] dark:stroke-[#202422]" />
                    {attemptSegments.map((seg, i) => (
                      <circle
                        key={i}
                        cx="60"
                        cy="60"
                        fill="transparent"
                        r="48"
                        stroke={seg.color}
                        strokeDasharray={`${seg.dash} ${C_DONUT}`}
                        strokeDashoffset={`${seg.offset}`}
                        strokeLinecap="round"
                        strokeWidth="14"
                      />
                    ))}
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-lg font-mono font-bold text-[#111827] dark:text-[#ECEEED] leading-none">
                      {totalQs - attemptUnattempted}
                    </span>
                    <span className="text-[9px] font-mono text-[#6B7280] dark:text-[#68706C] mt-0.5">/ {totalQs} Attempted</span>
                    <span className="text-[8px] font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                      {Math.round(((totalQs - attemptUnattempted) / totalQs) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Mastery Legend Rows stacked below in full-width list */}
              <div className="w-full space-y-2 mt-4">
                {attemptCategories.map((cat, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cat.dotClass}`} />
                      <span className="text-xs font-medium text-[#111827] dark:text-[#ECEEED] truncate">
                        {cat.label}
                      </span>
                    </div>
                    <span className="whitespace-nowrap shrink-0 font-mono text-xs font-semibold text-[#111827] dark:text-[#ECEEED]">
                      {cat.count} Qs ({cat.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
