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
  const teacherOverrides = studentReport?.teacher_overridden_count ?? 0;

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
    let statusText = 'Mastery';
    let statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (pct < 50) {
      statusText = 'Needs Support';
      statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    } else if (pct < 75) {
      statusText = 'Partial';
      statusBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (pct < 90) {
      statusText = 'Good';
      statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
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
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-sm shrink-0">
            {initials}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-sm">{studentName}</h3>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px] font-semibold border border-emerald-200">
                Verified
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                Strictness: {strictnessLevel}/5
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Roll: {rollNumber || 'N/A'} · {paperTitle}
            </p>
          </div>
        </div>
        <div className="text-right font-mono text-xs text-slate-500">
          Evaluated: {new Date().toISOString().split('T')[0]}
        </div>
      </div>

      {/* 3 KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* KPI 1: TOTAL SCORE */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">TOTAL SCORE</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-bold text-slate-900 tabular-nums">
              {totalScore.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-400">/ {maxMarks.toFixed(1)}</span>
          </div>
          <div className="text-[10px] font-medium mt-1">
            {hasCohortAvg ? (
              <span className={scoreDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {scoreDiff >= 0 ? '+' : ''}
                {scoreDiff.toFixed(1)} vs Cohort Avg ({cohortAvgScore.toFixed(1)})
              </span>
            ) : (
              <span className="text-slate-400">Cohort avg available after 2+ sheets</span>
            )}
          </div>
        </div>

        {/* KPI 2: GRADE & PERCENTAGE */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">GRADE &amp; PERCENTAGE</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-bold text-indigo-600 tabular-nums">
              {percentage.toFixed(1)}%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
              Grade {grade}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {hasCohortAvg
              ? `Cohort Benchmark: ${cohortAvgPct.toFixed(1)}%`
              : 'Cohort avg available after 2+ sheets'}
          </div>
        </div>

        {/* KPI 3: AVG OCR CONFIDENCE */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">AVG OCR CONFIDENCE</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-bold text-emerald-600 tabular-nums">
              {avgOcr}%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              Dual Engine
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {flaggedCount > 0 ? `${flaggedCount} Flags Detected` : '0 Manual Edits Required'}
          </div>
        </div>
      </div>

      {/* AI Diagnostic Feedback Card (Strengths & Weak Concepts) */}
      <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-2">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14H8a4 4 0 01-.97-7.881 4.01 4.01 0 017.94 0A4 4 0 0112 14z" />
          </svg>
          <span className="font-bold text-slate-900 text-xs tracking-wide">AI Diagnostic Feedback</span>
        </div>

        {studentReport?.strengths && studentReport.strengths.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-emerald-800">Demonstrated Strengths:</div>
            {studentReport.strengths.map((str, i) => (
              <p key={i} className="text-xs text-slate-700 leading-relaxed pl-2 border-l-2 border-emerald-400">
                {str}
              </p>
            ))}
          </div>
        )}

        {studentReport?.improvements && studentReport.improvements.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="text-[11px] font-semibold text-rose-800">Areas for Improvement &amp; Weak Concepts:</div>
            {studentReport.improvements.map((imp, i) => (
              <p key={i} className="text-xs text-slate-700 leading-relaxed pl-2 border-l-2 border-rose-400">
                {imp}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Marks & Score Distribution Bar Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Marks &amp; Score Distribution
              </h4>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-medium">
                {questions.length > 0 ? `Q1 - Q${questions.length}` : 'All Questions'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click any question bar to jump to Question-wise Marks and view its booklet page.
            </p>
          </div>
          <div className="flex items-center space-x-3 text-[10px] font-mono">
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span className="text-slate-600">Full</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
              <span className="text-slate-600">Partial</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
              <span className="text-slate-600">Deduction</span>
            </div>
            {hasCohortAvg ? (
              <div className="flex items-center space-x-1">
                <span className="w-3 border-t border-dashed border-indigo-400" />
                <span className="text-indigo-600">Cohort Avg ({Math.round(cohortAvgPct)}%)</span>
              </div>
            ) : (
              <span className="text-slate-400 text-[9px]">Cohort avg available after 2+ sheets</span>
            )}
          </div>
        </div>

        {/* SVG / Flex Column Chart Viewport */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-lg p-3 pt-6 relative select-none">
          {/* Cohort Benchmark Line (Only when evaluated sheets >= 2) */}
          {hasCohortAvg && (
            <div
              className="absolute left-10 right-4 border-t border-dashed border-indigo-400/80 pointer-events-none z-10 flex justify-end"
              style={{ top: `${Math.max(10, Math.min(90, 100 - cohortAvgPct))}%` }}
            >
              <span className="text-[9px] font-mono text-indigo-700 bg-white/95 px-1 py-0.2 rounded -mt-2 border border-indigo-200">
                Cohort Avg {Math.round(cohortAvgPct)}%
              </span>
            </div>
          )}

          {/* Grid lines */}
          <div className="absolute left-10 right-4 top-4 border-t border-slate-200/60 pointer-events-none" />
          <div className="absolute left-10 right-4 top-1/2 border-t border-slate-200/60 pointer-events-none" />
          <div className="absolute left-10 right-4 bottom-7 border-t border-slate-200/60 pointer-events-none" />

          {/* Y-Axis labels */}
          <div className="absolute -left-0.5 top-0 bottom-6 flex flex-col justify-between text-[9px] font-mono text-slate-400 pl-3">
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

              let barColor = 'bg-emerald-500';
              let textColor = 'text-emerald-700';
              if (pct < 40) {
                barColor = 'bg-rose-500';
                textColor = 'text-rose-700';
              } else if (pct < 90) {
                barColor = 'bg-amber-500';
                textColor = 'text-amber-700';
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
                  <div className="w-full max-w-[28px] h-full flex flex-col justify-end bg-slate-200/70 rounded-t-sm overflow-hidden">
                    <div
                      className={`w-full ${barColor} rounded-t-sm transition-all duration-300 group-hover:brightness-110`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-700 font-semibold mt-1.5">
                    Q{q.q_no}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500">
                    {Math.round(pct)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Question Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs text-xs">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-xs flex items-center justify-between">
          <span>Question Summary Table</span>
          <span className="text-[11px] font-normal text-slate-500">
            Click row to inspect answer &amp; OCR note
          </span>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] text-slate-500 bg-slate-50/50">
              <th className="py-2 px-3 pl-4">Q#</th>
              <th className="py-2 px-3">Question Prompt &amp; Section</th>
              <th className="py-2 px-3">Score</th>
              <th className="py-2 px-3">OCR Accuracy</th>
              <th className="py-2 px-3 pr-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-xs">
            {questions.map((q, idx) => {
              const qMax = q.max_marks || 1;
              const qEarned = q.final_marks || 0;
              const pct = (qEarned / qMax) * 100;
              const leg = q.legibility ?? 1.0;
              const legDisplay = Math.round(leg > 1 ? leg : leg * 100);

              let statusBadge = (
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                  Full
                </span>
              );
              let scoreColor = 'text-emerald-600';

              if (pct < 40) {
                statusBadge = (
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                    Deduction
                  </span>
                );
                scoreColor = 'text-rose-600';
              } else if (pct < 90) {
                statusBadge = (
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                    Partial
                  </span>
                );
                scoreColor = 'text-amber-600';
              }

              return (
                <tr
                  key={q.eval_id || idx}
                  onClick={() => onSelectQuestion(idx)}
                  className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                >
                  <td className="py-2 px-3 pl-4 font-bold text-slate-900">
                    Q{q.q_no}
                  </td>
                  <td className="py-2 px-3 font-sans text-slate-700 truncate max-w-[280px]">
                    {q.section_name && (
                      <span className="text-slate-400 font-mono text-[11px] mr-1">
                        {q.section_name} ·
                      </span>
                    )}
                    <span title={q.question_text}>{q.question_text}</span>
                  </td>
                  <td className={`py-2 px-3 font-bold tabular-nums ${scoreColor}`}>
                    {qEarned.toFixed(1)}{' '}
                    <span className="text-slate-400 font-normal">/ {qMax.toFixed(1)}</span>
                  </td>
                  <td className="py-2 px-3 text-slate-600 tabular-nums">
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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs text-xs">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-xs">
          Sectional Performance Breakdown
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] text-slate-500 bg-slate-50/50">
              <th className="p-2.5 pl-4">Section</th>
              <th className="p-2.5">Score</th>
              <th className="p-2.5">Accuracy</th>
              <th className="p-2.5 pr-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-xs">
            {sectionalData.map((sec, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="p-2.5 pl-4 font-sans text-slate-800 font-medium">
                  {sec.name} ({sec.count} Qs)
                </td>
                <td className="p-2.5 font-bold text-indigo-700">
                  {sec.earned.toFixed(1)} / {sec.max.toFixed(1)}
                </td>
                <td className="p-2.5 text-slate-600">
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
