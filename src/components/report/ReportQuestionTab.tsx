import React from 'react';
import { NormalizedQuestion } from './types';

interface ReportQuestionTabProps {
  question: NormalizedQuestion | null;
}

export const ReportQuestionTab: React.FC<ReportQuestionTabProps> = ({ question }) => {
  if (!question) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-[#6B7280] dark:text-[#68706C] text-xs font-mono">
        No question selected.
      </div>
    );
  }

  const qMax = question.max_marks || 1;
  const qEarned = question.final_marks ?? 0;
  const pct = Math.round((qEarned / qMax) * 100);
  const leg = question.legibility ?? 1.0;
  const legDisplay = Math.round(leg > 1 ? leg : leg * 100);

  // Score badge style
  let scoreBadgeClass = 'bg-emerald-50 dark:bg-[#1A2B23] border-emerald-200 dark:border-[#294236] text-emerald-800 dark:text-[#7CC9A3]';
  if (pct < 40) {
    scoreBadgeClass = 'bg-rose-50 dark:bg-[#2B191D] border-rose-200 dark:border-[#45262C] text-rose-800 dark:text-[#E57D8A]';
  } else if (pct < 90) {
    scoreBadgeClass = 'bg-amber-50 dark:bg-[#2B2416] border-amber-200 dark:border-[#42361F] text-amber-800 dark:text-[#E5B567]';
  }

  // 1. Correct criteria
  const correctVerdicts = (question.verdicts || []).filter(
    (v) => (v.verdict === 'full' || v.verdict === 'met' || (v.marks_awarded ?? 0) > 0)
  );
  const correctMarks = correctVerdicts.reduce((sum, v) => sum + (v.marks_awarded ?? 0), 0);

  // 2. Deductions
  const deductionMarks = Math.max(0, qMax - qEarned);
  const deductionFlags = (question.flags || []).filter(
    (f) => f.severity === 'amber' || f.severity === 'red' || f.code?.includes('DEDUCT') || f.name?.includes('Deduct')
  );
  const deductionVerdicts = (question.verdicts || []).filter(
    (v) => (v.marks_awarded ?? 0) < (v.marks_available ?? 0)
  );
  const deductionCount = Math.max(deductionFlags.length, deductionVerdicts.length > 0 ? 1 : 0);

  // 3. Missing points
  const missingVerdicts = (question.verdicts || []).filter(
    (v) => v.verdict === 'none' || v.verdict === 'missed' || (v.marks_awarded ?? 0) === 0
  );
  const missingPointsCount = missingVerdicts.length;
  const potentialMissingMarks = missingVerdicts.reduce(
    (sum, v) => sum + (v.marks_available ?? 0),
    0
  );

  // 4. OCR review notes
  const ocrFlags = (question.flags || []).filter(
    (f) =>
      f.code?.toLowerCase().includes('ocr') ||
      f.name?.toLowerCase().includes('ocr') ||
      f.reason?.toLowerCase().includes('ocr') ||
      f.reason?.toLowerCase().includes('legib')
  );
  const ocrNotesCount = Math.max(1, ocrFlags.length);

  // Derive weak concept pills
  const weakConcepts: string[] = [];
  missingVerdicts.forEach((mv) => {
    const text = mv.point || mv.text || '';
    if (text) weakConcepts.push(`Missing: ${text.slice(0, 40)}`);
  });
  deductionFlags.forEach((df) => {
    weakConcepts.push(`Flag: ${df.name || df.code || 'Rubric deviation'}`);
  });

  return (
    <div className="h-full flex flex-col overflow-y-auto p-5 space-y-4">
      {/* Question Header Card */}
      <div className="p-4 rounded-xl bg-[#F6F7F5] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] flex items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md bg-[#0F5132] dark:bg-[#1F6E4A] text-white font-mono font-bold text-xs">
              Q{question.q_no} {question.section_name ? `· ${question.section_name}` : ''}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-[#2F3532] text-[#4B5563] dark:text-[#969E9A] font-mono text-[11px] font-medium">
              Strictness: {question.strictness_used}/5
            </span>
          </div>
          <p className="text-xs text-[#111827] dark:text-[#ECEEED] font-medium leading-relaxed">
            {question.question_text}
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-end space-y-1">
          <span
            className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-xs tabular-nums ${scoreBadgeClass}`}
          >
            {qEarned.toFixed(1)} / {qMax.toFixed(1)} ({pct}%)
          </span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-[#1A2B23] text-emerald-700 dark:text-[#7CC9A3] font-mono text-[10px] font-semibold border border-emerald-200 dark:border-[#294236]">
            OCR {legDisplay}%
          </span>
        </div>
      </div>

      {/* AI Feedback & Weak Concepts Card */}
      <div className="p-4 rounded-xl bg-[#E8F3EE]/40 dark:bg-[#1A2B23]/40 border border-[#E8F3EE] dark:border-[#294236] space-y-2">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3] shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14H8a4 4 0 01-.97-7.881 4.01 4.01 0 017.94 0A4 4 0 0112 14z" />
          </svg>
          <span className="font-bold text-[#111827] dark:text-[#ECEEED] text-xs tracking-wide">AI Diagnostic Feedback</span>
        </div>

        <p className="text-xs text-[#4B5563] dark:text-[#969E9A] leading-relaxed">
          {question.reason ||
            (pct >= 90
              ? 'Student demonstrated comprehensive understanding of required rubric criteria with clear explanations.'
              : pct >= 50
              ? 'Student answer demonstrated partial grasp of key concepts, but lacked thorough technical detail on required components.'
              : 'Answer did not adequately cover the required concepts according to the evaluation rubric.')}
        </p>

        {weakConcepts.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {weakConcepts.slice(0, 4).map((concept, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-[#2B191D] border border-rose-200 dark:border-[#45262C] text-rose-700 dark:text-[#E57D8A] font-mono text-[11px] font-semibold truncate max-w-[280px]"
                title={concept}
              >
                {concept}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Auto-Sized 2-Column Comparison Box Dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        {/* Left Column: Student Answer (OCR) */}
        <details className="group rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] overflow-hidden flex flex-col justify-start" open>
          <summary className="px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer select-none hover:bg-[#F1F4F2] dark:hover:bg-[#202422] transition-colors list-none">
            <span className="text-xs font-semibold text-[#111827] dark:text-[#ECEEED]">Student Answer (OCR)</span>
            <div className="flex items-center space-x-2">
              <span className="whitespace-nowrap shrink-0 text-[11px] font-mono text-[#6B7280] dark:text-[#68706C]">
                Match {legDisplay}%
              </span>
              <svg
                className="w-3.5 h-3.5 text-slate-400 dark:text-[#68706C] group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
          </summary>
          <div className="px-3.5 pb-3.5 pt-2 border-t border-[#E2E8E4] dark:border-[#2F3532] text-[13px] text-[#111827] dark:text-[#ECEEED] leading-relaxed whitespace-pre-wrap break-words select-text">
            {question.ocr_text || '(No OCR extracted text for this question)'}
          </div>
        </details>

        {/* Right Column: Expected Answer */}
        <details className="group rounded-xl bg-[#E8F3EE]/35 dark:bg-[#1A2B23]/35 border border-[#E8F3EE] dark:border-[#294236] overflow-hidden flex flex-col justify-start" open>
          <summary className="px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer select-none hover:bg-[#E8F3EE]/70 dark:hover:bg-[#1A2B23]/70 transition-colors list-none">
            <span className="text-xs font-semibold text-[#111827] dark:text-[#ECEEED]">Expected Answer</span>
            <div className="flex items-center space-x-2">
              <span className="whitespace-nowrap shrink-0 text-[11px] font-mono text-[#0F5132] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] px-2 py-0.5 rounded-full border border-[#0F5132]/20 dark:border-[#294236]">
                {question.reference?.source || 'Model Key'}
              </span>
              <svg
                className="w-3.5 h-3.5 text-slate-400 dark:text-[#68706C] group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
          </summary>
          <div className="px-3.5 pb-3.5 pt-2 border-t border-[#E8F3EE]/60 dark:border-[#294236]/60 text-[13px] text-[#4B5563] dark:text-[#969E9A] leading-relaxed whitespace-pre-wrap break-words select-text">
            {question.reference?.model_answer ? (
              question.reference.model_answer
            ) : question.reference?.key_points && question.reference.key_points.length > 0 ? (
              <ul className="list-disc pl-4 space-y-1">
                {question.reference.key_points.map((kp: any, i: number) => (
                  <li key={i}>
                    {typeof kp === 'object' ? `${kp.text || kp.point} (${kp.marks || 1}M)` : String(kp)}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-slate-400 dark:text-[#68706C] italic">No formal model answer registered for this question.</span>
            )}
          </div>
        </details>
      </div>

      {/* 4 Collapsible <details> Accordion Dropdown Boxes */}
      <div className="space-y-2.5">
        {/* 1. Correct */}
        <details className="group border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-xl bg-white dark:bg-[#181B19] overflow-hidden" open>
          <summary className="px-4 py-2.5 flex items-center justify-between cursor-pointer text-xs font-semibold select-none hover:bg-[#F1F4F2] dark:hover:bg-[#202422] transition-colors list-none">
            <div className="flex items-center space-x-2">
              <span className="text-[#0F5132] dark:text-[#7CC9A3] font-bold">✓ Correct ({correctVerdicts.length})</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-[#1A2B23] text-emerald-700 dark:text-[#7CC9A3] text-[10px] font-mono border border-emerald-200 dark:border-[#294236] font-bold">
                {correctVerdicts.length}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[#0F5132] dark:text-[#7CC9A3] font-bold tabular-nums">
                +{correctMarks.toFixed(1)} M
              </span>
              <svg
                className="w-3.5 h-3.5 text-slate-400 dark:text-[#68706C] group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
          </summary>
          <div className="px-4 py-2.5 bg-[#F6F7F5]/50 dark:bg-[#202422]/50 border-t border-[#E2E8E4] dark:border-[#2F3532] text-xs text-[#4B5563] dark:text-[#969E9A] leading-relaxed space-y-2">
            {correctVerdicts.length > 0 ? (
              correctVerdicts.map((v, i) => (
                <div key={i} className="flex items-start justify-between gap-2 border-b border-[#E2E8E4] dark:border-[#2F3532] last:border-0 pb-1.5 last:pb-0">
                  <div className="space-y-0.5">
                    <p className="font-medium text-[#111827] dark:text-[#ECEEED]">
                      {v.point || v.text || `Verified criterion ${i + 1}`}
                    </p>
                    {v.quote && (
                      <p className="text-[11px] text-[#6B7280] dark:text-[#68706C] font-mono italic pl-2 border-l border-emerald-400">
                        &ldquo;{v.quote}&rdquo;
                      </p>
                    )}
                  </div>
                  <span className="font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3] shrink-0 text-[11px]">
                    +{(v.marks_awarded ?? 0).toFixed(1)} M
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 dark:text-[#68706C] italic">No fully awarded points recorded for this question.</p>
            )}
          </div>
        </details>

        {/* 2. Deductions */}
        <details className="group border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-xl bg-white dark:bg-[#181B19] overflow-hidden" open>
          <summary className="px-4 py-2.5 flex items-center justify-between cursor-pointer text-xs font-semibold select-none hover:bg-[#F1F4F2] dark:hover:bg-[#202422] transition-colors list-none">
            <div className="flex items-center space-x-2">
              <span className="text-rose-600 dark:text-[#E57D8A] font-bold">⊗ Deductions ({deductionCount})</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-50 dark:bg-[#2B191D] text-rose-700 dark:text-[#E57D8A] text-[10px] font-mono border border-rose-200 dark:border-[#45262C] font-bold">
                {deductionCount}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-rose-600 dark:text-[#E57D8A] font-bold tabular-nums">
                -{deductionMarks.toFixed(1)} M
              </span>
              <svg
                className="w-3.5 h-3.5 text-slate-400 dark:text-[#68706C] group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
          </summary>
          <div className="px-4 py-2.5 bg-[#F6F7F5]/50 dark:bg-[#202422]/50 border-t border-[#E2E8E4] dark:border-[#2F3532] text-xs text-[#4B5563] dark:text-[#969E9A] leading-relaxed space-y-2">
            {deductionMarks > 0 ? (
              <div className="space-y-1.5">
                <p>
                  Marks deduction applied based on rubric strictness {question.strictness_used}/5.
                </p>
                {deductionFlags.map((df, i) => (
                  <div key={i} className="p-2 rounded bg-rose-50/70 dark:bg-[#2B191D]/70 border border-rose-100 dark:border-[#45262C] text-[11px] text-rose-800 dark:text-[#E57D8A]">
                    <span className="font-bold">{df.name || df.code}:</span> {df.reason || df.message || 'Rubric deviation detected.'}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 dark:text-[#68706C] italic">No deductions applied. Full credit granted for attempted criteria.</p>
            )}
          </div>
        </details>

        {/* 3. Missing Points */}
        <details className="group border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-xl bg-white dark:bg-[#181B19] overflow-hidden" open>
          <summary className="px-4 py-2.5 flex items-center justify-between cursor-pointer text-xs font-semibold select-none hover:bg-[#F1F4F2] dark:hover:bg-[#202422] transition-colors list-none">
            <div className="flex items-center space-x-2">
              <span className="text-amber-600 dark:text-[#E5B567] font-bold">⚠ Missing Points ({missingPointsCount})</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-50 dark:bg-[#2B2416] text-amber-800 dark:text-[#E5B567] text-[10px] font-mono border border-amber-200 dark:border-[#42361F] font-bold">
                {missingPointsCount}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-amber-700 dark:text-[#E5B567] font-semibold text-[11px]">
                Potential +{potentialMissingMarks.toFixed(1)} M
              </span>
              <svg
                className="w-3.5 h-3.5 text-slate-400 dark:text-[#68706C] group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
          </summary>
          <div className="px-4 py-2.5 bg-[#F6F7F5]/50 dark:bg-[#202422]/50 border-t border-[#E2E8E4] dark:border-[#2F3532] text-xs text-[#4B5563] dark:text-[#969E9A] leading-relaxed space-y-2">
            {missingVerdicts.length > 0 ? (
              missingVerdicts.map((mv, i) => (
                <div key={i} className="flex items-start justify-between gap-2 border-b border-[#E2E8E4] dark:border-[#2F3532] last:border-0 pb-1.5 last:pb-0">
                  <div className="space-y-0.5">
                    <p className="font-medium text-[#111827] dark:text-[#ECEEED]">
                      {mv.point || mv.text || `Required point ${i + 1}`}
                    </p>
                    {mv.reason && (
                      <p className="text-[11px] text-[#6B7280] dark:text-[#68706C]">{mv.reason}</p>
                    )}
                  </div>
                  <span className="font-mono text-amber-700 dark:text-[#E5B567] shrink-0 text-[11px]">
                    +{(mv.marks_available ?? 0).toFixed(1)} M
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 dark:text-[#68706C] italic">All expected key concepts were addressed in the answer.</p>
            )}
          </div>
        </details>

        {/* 4. OCR Review Note */}
        <details className="group border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-xl bg-white dark:bg-[#181B19] overflow-hidden" open>
          <summary className="px-4 py-2.5 flex items-center justify-between cursor-pointer text-xs font-semibold select-none hover:bg-[#F1F4F2] dark:hover:bg-[#202422] transition-colors list-none">
            <div className="flex items-center space-x-2">
              <span className="text-[#111827] dark:text-[#ECEEED] font-bold">🛡 OCR Review Note ({ocrNotesCount})</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#F1F4F2] dark:bg-[#202422] text-[#4B5563] dark:text-[#969E9A] text-[10px] font-mono border border-[#E2E8E4] dark:border-[#2F3532] font-bold">
                {ocrNotesCount}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[#0F5132] dark:text-[#7CC9A3] font-semibold text-[11px]">
                {legDisplay}% Confidence
              </span>
              <svg
                className="w-3.5 h-3.5 text-slate-400 dark:text-[#68706C] group-open:rotate-180 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
          </summary>
          <div className="px-4 py-2.5 bg-[#F6F7F5]/50 dark:bg-[#202422]/50 border-t border-[#E2E8E4] dark:border-[#2F3532] text-xs text-[#4B5563] dark:text-[#969E9A] leading-relaxed">
            Handwriting legibility is assessed at {legDisplay}%. Dual Engine OCR scanned {question.ocr_text?.length || 0} characters across answer region.
            {ocrFlags.length > 0 ? (
              <div className="mt-2 space-y-1">
                {ocrFlags.map((of, i) => (
                  <p key={i} className="text-amber-700 dark:text-[#E5B567] font-medium text-[11px]">
                    ⚠ {of.name || of.code}: {of.reason || of.message}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[#6B7280] dark:text-[#68706C] mt-1">
                No transcription ambiguity detected. Handwriting clarity conforms to standard readability benchmarks.
              </p>
            )}
          </div>
        </details>
      </div>
    </div>
  );
};
