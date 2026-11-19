import React from 'react';
import { NormalizedQuestion, StudentReportData, PaperReportData } from './types';

interface ReportOverviewTabProps {
  studentReport: StudentReportData | null;
  paperReport: PaperReportData | null;
  questions: NormalizedQuestion[];
  evaluatedSheetsCount: number;
  onSelectQuestion: (index: number) => void;
}

export const ReportOverviewTab: React.FC<ReportOverviewTabProps> = ({
  studentReport,
  paperReport,
  questions,
  evaluatedSheetsCount,
  onSelectQuestion,
}) => {
  const studentName = studentReport?.student_name || 'Student';
  const rollNumber = studentReport?.roll_number || '';
  const paperTitle = studentReport?.paper_title || 'Examination';
  const strictnessLevel = studentReport?.paper_strictness || 3;
  const totalScore = studentReport?.total_score ?? 0;
  const maxMarks = studentReport?.max_marks || 100;
  const percentage = studentReport?.percentage ?? (maxMarks > 0 ? (totalScore / maxMarks) * 100 : 0);
  const grade = studentReport?.grade || 'N/A';

  const initials = (() => {
    if (!studentName) return 'ST';
    const parts = studentName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return studentName.slice(0, 2).toUpperCase();
  })();

  // Compute average OCR confidence
  const avgOcr = (() => {
    if (!questions.length) return 94;
    const sum = questions.reduce((acc, q) => {
      const leg = q.legibility ?? 1.0;
      return acc + (leg > 1 ? leg : leg * 100);
    }, 0);
    return Math.round(sum / questions.length);
  })();

  // Cohort average check: only available when evaluated_sheets.length >= 2
  const hasCohortAvg = evaluatedSheetsCount >= 2 && paperReport?.analytics?.average_score !== undefined;
  const cohortAvgScore = paperReport?.analytics?.average_score ?? 0;
  const cohortAvgPct = paperReport?.analytics?.average_percentage ?? 0;
  const scoreDiff = totalScore - cohortAvgScore;

  // Unresolved / manual edit count
  const flaggedCount = studentReport?.flagged_count ?? 0;

  // Group by sections for Sectional Performance Breakdown
  const sectionsMap = new Map<string, { earned: number; max: number; count: number; qIndices: number[] }>();
  questions.forEach((q, idx) => {
    const sec = q.section_name?.trim() || 'General';
    const curr = sectionsMap.get(sec) || { earned: 0, max: 0, count: 0, qIndices: [] };
    curr.earned += q.final_marks || 0;
    curr.max += q.max_marks || 0;
    curr.count += 1;
    curr.qIndices.push(idx);
    sectionsMap.set(sec, curr);
  });

  const sectionalData = Array.from(sectionsMap.entries()).map(([name, data]) => {
    const pct = data.max > 0 ? (data.earned / data.max) * 100 : 0;
    let statusText = 'Needs Work';
    let statusBadgeClass = 'bg-rose-50 dark:bg-[#2B191D] text-rose-700 dark:text-[#E57D8A] border-rose-200 dark:border-[#45262C]';
    if (pct >= 80) {
      statusText = 'Excellent';
      statusBadgeClass = 'bg-emerald-50 dark:bg-[#1A2B23] text-emerald-700 dark:text-[#7CC9A3] border-emerald-200 dark:border-[#294236]';
    } else if (pct >= 50) {
      statusText = 'Good';
      statusBadgeClass = 'bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border-[#0F5132]/20 dark:border-[#294236]';
    }
    return {
      name,
      earned: data.earned,
      max: data.max,
      pct,
      statusText,
      statusBadgeClass,
      count: data.count,
    };
  });

  return (
    <div className="h-full flex flex-col overflow-y-auto p-5 space-y-4">
      {/* Student Summary Card */}
      <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-xl p-4 flex items-center justify-between shadow-none">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-full bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#0F5132]/20 dark:border-[#294236] flex items-center justify-center font-bold text-[#0F5132] dark:text-[#7CC9A3] text-sm shrink-0">
            {initials}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-[#111827] dark:text-[#ECEEED] text-sm">{studentName}</h3>
              <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-[#1A2B23] text-emerald-700 dark:text-[#7CC9A3] font-mono text-[10px] font-semibold border border-emerald-200 dark:border-[#294236]">
                Verified
              </span>
              <span className="px-2 py-0.5 rounded bg-[#F1F4F2] dark:bg-[#202422] text-[#4B5563] dark:text-[#969E9A] font-mono text-[10px] border border-[#E2E8E4] dark:border-[#2F3532]">
                Strictness: {strictnessLevel}/5
              </span>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#68706C] font-mono mt-0.5">
              Roll: {rollNumber || 'N/A'} · {paperTitle}
            </p>
          </div>
        </div>
        <div className="text-right font-mono text-xs text-[#6B7280] dark:text-[#68706C]">
          Evaluated: {new Date().toISOString().split('T')[0]}
        </div>
      </div>

      {/* 3 KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* KPI 1: TOTAL SCORE */}
        <div className="bg-white dark:bg-[#181B19] p-3.5 rounded-xl border border-[#E2E8E4] dark:border-[#2A2F2C] shadow-none">
          <div className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#68706C] tracking-wider">TOTAL SCORE</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-bold text-[#111827] dark:text-[#ECEEED] tabular-nums">
              {totalScore.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-400 dark:text-[#68706C]">/ {maxMarks.toFixed(1)}</span>
          </div>
          <div className="text-[10px] font-medium mt-1">
            {hasCohortAvg ? (
              <span className={scoreDiff >= 0 ? 'text-emerald-600 dark:text-[#7CC9A3]' : 'text-rose-600 dark:text-[#E57D8A]'}>
                {scoreDiff >= 0 ? '+' : ''}
                {scoreDiff.toFixed(1)} vs Cohort Avg ({cohortAvgScore.toFixed(1)})
              </span>
            ) : (
              <span className="text-slate-400 dark:text-[#68706C]">Cohort avg available after 2+ sheets</span>
            )}
          </div>
        </div>

        {/* KPI 2: GRADE & PERCENTAGE */}
        <div className="bg-white dark:bg-[#181B19] p-3.5 rounded-xl border border-[#E2E8E4] dark:border-[#2A2F2C] shadow-none">
          <div className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#68706C] tracking-wider">GRADE &amp; PERCENTAGE</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3] tabular-nums">
              {percentage.toFixed(1)}%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] text-[10px] font-bold border border-[#0F5132]/20 dark:border-[#294236]">
              Grade {grade}
            </span>
          </div>
          <div className="text-[10px] text-[#6B7280] dark:text-[#68706C] mt-1">
            {hasCohortAvg
              ? `Cohort Benchmark: ${cohortAvgPct.toFixed(1)}%`
              : 'Cohort avg available after 2+ sheets'}
          </div>
        </div>

        {/* KPI 3: AVG OCR CONFIDENCE */}
        <div className="bg-white dark:bg-[#181B19] p-3.5 rounded-xl border border-[#E2E8E4] dark:border-[#2A2F2C] shadow-none">
          <div className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#68706C] tracking-wider">AVG OCR CONFIDENCE</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-bold text-emerald-600 dark:text-[#7CC9A3] tabular-nums">
              {avgOcr}%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-[#1A2B23] text-emerald-700 dark:text-[#7CC9A3] text-[10px] font-bold border border-emerald-200 dark:border-[#294236]">
              Dual Engine
            </span>
          </div>
          <div className="text-[10px] text-[#6B7280] dark:text-[#68706C] mt-1">
            {flaggedCount > 0 ? `${flaggedCount} Flags Detected` : '0 Manual Edits Required'}
          </div>
        </div>
      </div>

      {/* AI Diagnostic Feedback Card */}
      <div className="p-4 rounded-xl bg-[#E8F3EE]/40 dark:bg-[#1A2B23]/40 border border-[#E8F3EE] dark:border-[#294236] space-y-2">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3] shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14H8a4 4 0 01-.97-7.881 4.01 4.01 0 017.94 0A4 4 0 0112 14z" />
          </svg>
          <span className="font-bold text-[#111827] dark:text-[#ECEEED] text-xs tracking-wide">AI Diagnostic Feedback</span>
        </div>

        {studentReport?.strengths && studentReport.strengths.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-emerald-800 dark:text-[#7CC9A3]">Demonstrated Strengths:</div>
            {studentReport.strengths.map((str, i) => (
              <p key={i} className="text-xs text-[#4B5563] dark:text-[#969E9A] leading-relaxed pl-2 border-l-2 border-emerald-500">
                {str}
              </p>
            ))}
          </div>
        )}

        {studentReport?.improvements && studentReport.improvements.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="text-[11px] font-semibold text-rose-800 dark:text-[#E57D8A]">Areas for Improvement &amp; Weak Concepts:</div>
            {studentReport.improvements.map((imp, i) => (
              <p key={i} className="text-xs text-[#4B5563] dark:text-[#969E9A] leading-relaxed pl-2 border-l-2 border-rose-500">
                {imp}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Marks & Score Distribution Bar Chart */}
      <div className="bg-white dark:bg-[#181B19] rounded-xl border border-[#E2E8E4] dark:border-[#2A2F2C] p-4 shadow-none space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] uppercase tracking-wider">
                Marks &amp; Score Distribution
              </h4>
              <span className="px-1.5 py-0.5 rounded bg-[#F1F4F2] dark:bg-[#202422] text-[#4B5563] dark:text-[#969E9A] font-mono text-[10px] font-medium border border-[#E2E8E4] dark:border-[#2F3532]">
                {questions.length > 0 ? `Q1 - Q${questions.length}` : 'All Questions'}
              </span>
            </div>
            <p className="text-[11px] text-[#6B7280] dark:text-[#68706C] mt-0.5">
              Click any question bar to jump to Question-wise Marks and view its booklet page.
            </p>
          </div>
          <div className="flex items-center space-x-3 text-[10px] font-mono">
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#0F5132] dark:bg-[#2D8A61]" />
              <span className="text-[#6B7280] dark:text-[#969E9A]">Full</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
              <span className="text-[#6B7280] dark:text-[#969E9A]">Partial</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
              <span className="text-[#6B7280] dark:text-[#969E9A]">Deduction</span>
            </div>
            {hasCohortAvg ? (
              <div className="flex items-center space-x-1">
                <span className="w-3 border-t border-dashed border-[#0F5132]/40" />
                <span className="text-[#0F5132] dark:text-[#7CC9A3]">Cohort Avg ({Math.round(cohortAvgPct)}%)</span>
              </div>
            ) : (
              <span className="text-slate-400 dark:text-[#68706C] text-[9px]">Cohort avg available after 2+ sheets</span>
            )}
          </div>
        </div>

        {/* SVG / Flex Column Chart Viewport */}
        <div className="bg-[#F6F7F5] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg p-3 pt-6 relative select-none">
          {/* Cohort Benchmark Line (Only when evaluated sheets >= 2) */}
          {hasCohortAvg && (
            <div
              className="absolute left-10 right-4 border-t border-dashed border-[#0F5132]/40 pointer-events-none z-10 flex justify-end"
              style={{ top: `${Math.max(10, Math.min(90, 100 - cohortAvgPct))}%` }}
            >
              <span className="text-[9px] font-mono text-[#0F5132] dark:text-[#7CC9A3] bg-white dark:bg-[#181B19] px-1 py-0.2 rounded -mt-2 border border-[#0F5132]/20 dark:border-[#294236]">
                Cohort Avg {Math.round(cohortAvgPct)}%
              </span>
            </div>
          )}

          {/* Grid lines */}
          <div className="absolute left-10 right-4 top-4 border-t border-slate-200/60 dark:border-[#2F3532]/60 pointer-events-none" />
          <div className="absolute left-10 right-4 top-1/2 border-t border-slate-200/60 dark:border-[#2F3532]/60 pointer-events-none" />
          <div className="absolute left-10 right-4 bottom-7 border-t border-slate-200/60 dark:border-[#2F3532]/60 pointer-events-none" />

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

              let barColor = 'bg-[#0F5132] dark:bg-[#2D8A61]';
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
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                  title={`Q${q.q_no}: ${qEarned} / ${qMax} (${Math.round(pct)}%) - Click to review`}
                >
                  <div className={`text-[9px] font-mono font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity ${textColor}`}>
                    {qEarned}/{qMax}
                  </div>
                  <div className="w-full max-w-[28px] h-full flex flex-col justify-end bg-slate-200/70 dark:bg-[#2A2F2C] rounded-t-sm overflow-hidden">
                    <div
                      className={`w-full ${barColor} rounded-t-sm transition-all duration-300 group-hover:brightness-110`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[#111827] dark:text-[#ECEEED] font-semibold mt-1.5">
                    Q{q.q_no}
                  </span>
                  <span className="text-[9px] font-mono text-[#6B7280] dark:text-[#68706C]">
                    {Math.round(pct)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Question Summary Table */}
      <div className="bg-white dark:bg-[#181B19] rounded-xl border border-[#E2E8E4] dark:border-[#2A2F2C] overflow-hidden shadow-none text-xs">
        <div className="px-4 py-2.5 bg-[#F1F4F2] dark:bg-[#202422] border-b border-[#E2E8E4] dark:border-[#2F3532] font-bold text-[#111827] dark:text-[#ECEEED] text-xs flex items-center justify-between">
          <span>Question Summary Table</span>
          <span className="text-[11px] font-normal text-[#6B7280] dark:text-[#68706C]">
            Click row to inspect answer &amp; OCR note
          </span>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8E4] dark:border-[#2F3532] text-[11px] text-[#6B7280] dark:text-[#68706C] bg-[#F1F4F2]/50 dark:bg-[#202422]/50">
              <th className="py-2 px-3 pl-4">Q#</th>
              <th className="py-2 px-3">Question Prompt &amp; Section</th>
              <th className="py-2 px-3">Score</th>
              <th className="py-2 px-3">OCR Accuracy</th>
              <th className="py-2 px-3 pr-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#2F3532] font-mono text-xs">
            {questions.map((q, idx) => {
              const qMax = q.max_marks || 1;
              const qEarned = q.final_marks || 0;
              const pct = (qEarned / qMax) * 100;
              const leg = q.legibility ?? 1.0;
              const legDisplay = Math.round(leg > 1 ? leg : leg * 100);

              let statusBadge = (
                <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-[#1A2B23] text-emerald-700 dark:text-[#7CC9A3] text-[10px] font-bold border border-emerald-200 dark:border-[#294236]">
                  Full
                </span>
              );
              let scoreColor = 'text-emerald-600 dark:text-[#7CC9A3]';

              if (pct < 40) {
                statusBadge = (
                  <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-[#2B191D] text-rose-700 dark:text-[#E57D8A] text-[10px] font-bold border border-rose-200 dark:border-[#45262C]">
                    Deduction
                  </span>
                );
                scoreColor = 'text-rose-600 dark:text-[#E57D8A]';
              } else if (pct < 90) {
                statusBadge = (
                  <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-[#2B2416] text-amber-800 dark:text-[#E5B567] text-[10px] font-bold border border-amber-200 dark:border-[#42361F]">
                    Partial
                  </span>
                );
                scoreColor = 'text-amber-600 dark:text-[#E5B567]';
              }

              return (
                <tr
                  key={q.eval_id || idx}
                  onClick={() => onSelectQuestion(idx)}
                  className="hover:bg-[#E8F3EE]/40 dark:hover:bg-[#1A2B23]/40 cursor-pointer transition-colors"
                >
                  <td className="py-2 px-3 pl-4 font-bold text-[#111827] dark:text-[#ECEEED]">
                    Q{q.q_no}
                  </td>
                  <td className="py-2 px-3 font-sans text-[#4B5563] dark:text-[#969E9A] truncate max-w-[280px]">
                    {q.section_name && (
                      <span className="text-slate-400 dark:text-[#68706C] font-mono text-[11px] mr-1">
                        {q.section_name} ·
                      </span>
                    )}
                    <span title={q.question_text}>{q.question_text}</span>
                  </td>
                  <td className={`py-2 px-3 font-bold tabular-nums ${scoreColor}`}>
                    {qEarned.toFixed(1)}{' '}
                    <span className="text-slate-400 dark:text-[#68706C] font-normal">/ {qMax.toFixed(1)}</span>
                  </td>
                  <td className="py-2 px-3 text-[#4B5563] dark:text-[#969E9A] tabular-nums">
                    {legDisplay}%
                  </td>
                  <td className="py-2 px-3 pr-4 text-right font-sans">
                    {statusBadge}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sectional Performance Breakdown Table */}
      <div className="bg-white dark:bg-[#181B19] rounded-xl border border-[#E2E8E4] dark:border-[#2A2F2C] overflow-hidden shadow-none text-xs">
        <div className="px-4 py-2.5 bg-[#F1F4F2] dark:bg-[#202422] border-b border-[#E2E8E4] dark:border-[#2F3532] font-bold text-[#111827] dark:text-[#ECEEED] text-xs">
          Sectional Performance Breakdown
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8E4] dark:border-[#2F3532] text-[11px] text-[#6B7280] dark:text-[#68706C] bg-[#F1F4F2]/50 dark:bg-[#202422]/50">
              <th className="p-2.5 pl-4">Section</th>
              <th className="p-2.5">Score</th>
              <th className="p-2.5">Accuracy</th>
              <th className="p-2.5 pr-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#2F3532] font-mono text-xs">
            {sectionalData.map((sec, i) => (
              <tr key={i} className="hover:bg-[#F1F4F2]/50 dark:hover:bg-[#202422]/50 transition-colors">
                <td className="p-2.5 pl-4 font-sans text-[#111827] dark:text-[#ECEEED] font-medium">
                  {sec.name} ({sec.count} Qs)
                </td>
                <td className="p-2.5 font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                  {sec.earned.toFixed(1)} / {sec.max.toFixed(1)}
                </td>
                <td className="p-2.5 text-[#4B5563] dark:text-[#969E9A]">
                  {sec.pct.toFixed(1)}%
                </td>
                <td className="p-2.5 pr-4 text-right font-sans">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${sec.statusBadgeClass}`}>
                    {sec.statusText}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
