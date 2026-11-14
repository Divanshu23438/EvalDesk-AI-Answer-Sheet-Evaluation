import { Cpu, FileText } from 'lucide-react';
import type {
  ServerEvaluateSheetResult,
  ServerExtractedQuestion,
} from '../../utils/apiOcr';
import { ConfidenceBadge } from './StatusBadge';

interface ServerOcrResultPanelProps {
  result: ServerEvaluateSheetResult;
  onUpdateQuestion?: (index: number, patch: Partial<ServerExtractedQuestion>) => void;
  onApplyQuestion?: (question: ServerExtractedQuestion) => void;
  applyButtonLabel?: string;
}

export function ServerOcrResultPanel({
  result,
  onUpdateQuestion,
  onApplyQuestion,
  applyButtonLabel = 'Apply to Question',
}: ServerOcrResultPanelProps) {
  const isGroq = result.engine === 'groq';

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden space-y-0">
      {/* Header with Engine Badge */}
      <div className="px-4 py-3 bg-[#f8f9ff] border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold ${
              isGroq
                ? 'bg-[#fff8e1] border-[#ffb865] text-[#875200]'
                : 'bg-[#e8f5e9] border-[#88d982] text-[#196b22]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span>{result.engineLabel}</span>
          </span>
          <span className="text-[11px] font-mono text-[#64748b] bg-white px-2 py-0.5 rounded border border-[#e2e8f0]">
            {result.model}
          </span>
          {result.fallbackTriggered && result.fallbackReason && (
            <span className="text-[11px] text-[#875200]">
              ({result.fallbackReason})
            </span>
          )}
        </div>

        <span className="text-[11px] font-medium text-[#64748b]">
          {result.evaluatedWithRubric
            ? `${result.questions.length} question(s) extracted & graded`
            : `${result.questions.length} question(s) · Raw verbatim OCR`}
        </span>
      </div>

      {/* Extracted Questions List */}
      <div className="divide-y divide-[#e2e8f0]">
        {result.questions.length === 0 ? (
          <div className="p-5 text-center text-xs text-[#64748b]">
            No handwritten answers detected in the uploaded sheet.
          </div>
        ) : (
          result.questions.map((q, idx) => (
            <div key={`${q.q_no}-${idx}`} className="p-4 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-[#005dac] bg-[#eff4ff] px-2 py-0.5 rounded border border-[#a5c8ff]">
                    {q.q_no}
                  </span>
                  <ConfidenceBadge level={q.confidence} />
                </div>

                <div className="flex items-center gap-2">
                  {result.evaluatedWithRubric &&
                    typeof q.suggested_marks === 'number' &&
                    typeof q.max_marks === 'number' && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[#64748b]">Marks:</span>
                        {onUpdateQuestion ? (
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            max={q.max_marks > 0 ? q.max_marks : undefined}
                            aria-label={`${q.q_no} marks`}
                            value={q.suggested_marks}
                            onChange={(e) =>
                              onUpdateQuestion(idx, {
                                suggested_marks: Number(e.target.value) || 0,
                              })
                            }
                            className="w-16 rounded border border-[#005dac] px-2 py-0.5 text-right font-mono font-semibold text-[#0b1c30] tabular-nums"
                          />
                        ) : (
                          <span className="font-mono font-semibold text-[#0b1c30]">
                            {q.suggested_marks}
                          </span>
                        )}
                        <span className="font-mono text-[#64748b]">/ {q.max_marks}</span>
                      </div>
                    )}

                  {onApplyQuestion && (
                    <button
                      type="button"
                      onClick={() => onApplyQuestion(q)}
                      className="px-2.5 py-1 rounded border border-[#005dac] text-[#005dac] hover:bg-[#eff4ff] text-[11px] font-semibold"
                    >
                      {applyButtonLabel}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-[#414752] flex items-center gap-1">
                  <FileText className="w-3 h-3 text-[#64748b]" />
                  <span>Verbatim Transcribed Answer</span>
                </div>
                <div className="p-2.5 rounded border border-[#e2e8f0] bg-[#f8f9ff] font-mono text-xs text-[#0b1c30] whitespace-pre-wrap leading-relaxed">
                  {q.transcribed_text || '(Empty response)'}
                </div>
              </div>

              {q.diagram_notes && (
                <div className="px-2.5 py-1.5 rounded border border-[#ffddba] bg-[#fff8e1]/70 text-[11px] text-[#875200]">
                  <strong>Diagram / Equation Notes:</strong> {q.diagram_notes}
                </div>
              )}

              {result.evaluatedWithRubric && q.feedback !== undefined && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-[#414752]">
                    AI Evaluation Feedback ({q.q_no})
                  </label>
                  {onUpdateQuestion ? (
                    <textarea
                      rows={2}
                      value={q.feedback}
                      onChange={(e) =>
                        onUpdateQuestion(idx, { feedback: e.target.value })
                      }
                      className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 text-xs text-[#0b1c30]"
                    />
                  ) : (
                    <div className="p-2 rounded border border-[#e2e8f0] bg-white text-xs text-[#414752]">
                      {q.feedback}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
