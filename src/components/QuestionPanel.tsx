import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Flag,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { ReviewQuestionItem } from './QuestionSidebar';

interface QuestionPanelProps {
  questions: ReviewQuestionItem[];
  activeKey: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectQuestion: (key: string) => void;
}

export type QuestionFilter = 'all' | 'flagged' | 'checked';

export const QuestionPanel: React.FC<QuestionPanelProps> = ({
  questions,
  activeKey,
  isCollapsed,
  onToggleCollapse,
  onSelectQuestion,
}) => {
  const [filter, setFilter] = useState<QuestionFilter>('all');
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll active question into view in panel
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeKey, isCollapsed]);

  // Counts for tabs
  const flaggedCount = questions.filter(
    (q) => (q.flags && q.flags.length > 0 && !q.resolved) || q.status === 'flagged' || q.status === 'failed'
  ).length;
  const checkedCount = questions.filter(
    (q) => Boolean(q.resolved) && q.status !== 'failed'
  ).length;

  const filteredQuestions = questions.filter((q) => {
    const isFlg = (q.flags && q.flags.length > 0 && !q.resolved) || q.status === 'flagged' || q.status === 'failed';
    const isChk = Boolean(q.resolved) && q.status !== 'failed';
    if (filter === 'flagged') return isFlg;
    if (filter === 'checked') return isChk;
    return true;
  });

  const getQuestionStatus = (q: ReviewQuestionItem): 'failed' | 'flagged' | 'approved' | 'pending' => {
    if (q.status === 'failed') return 'failed';
    if ((q.flags && q.flags.length > 0 && !q.resolved) || q.status === 'flagged') return 'flagged';
    if (q.resolved) return 'approved';
    return 'pending';
  };

  // ----------------------------------------------------
  // Collapsed 44px Rail View
  // ----------------------------------------------------
  if (isCollapsed) {
    return (
      <aside
        aria-label="Question Navigation Rail"
        className="w-[44px] shrink-0 border-l border-slate-200 bg-slate-50 flex flex-col items-center py-2 select-none z-10 transition-all duration-200"
      >
        <button
          type="button"
          data-testid="expand-question-panel"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 mb-2 transition"
          title="Expand Question Panel ([)"
          aria-label="Expand Question Panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 w-full overflow-y-auto space-y-1.5 px-1 py-1 flex flex-col items-center">
          {questions.map((q, idx) => {
            const key = q.question_key || q.key;
            const isActive = key === activeKey;
            const status = getQuestionStatus(q);
            const dotColor =
              status === 'failed'
                ? 'bg-rose-500 text-white'
                : status === 'flagged'
                ? 'bg-amber-500 text-white'
                : status === 'approved'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-200 text-slate-600';

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectQuestion(key)}
                className={`w-7 h-7 rounded-md font-mono text-[10px] font-bold flex items-center justify-center transition-all ${dotColor} ${
                  isActive ? 'ring-2 ring-indigo-600 scale-105' : 'hover:opacity-90'
                }`}
                title={`Q.${q.q_no} · ${q.final_marks !== undefined ? q.final_marks : q.ai_marks}/${q.max_marks}M (${status})`}
              >
                {q.q_no}
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  // ----------------------------------------------------
  // Expanded Question Panel (~280px)
  // ----------------------------------------------------
  return (
    <aside
      aria-label="Question Panel"
      className="w-72 shrink-0 border-l border-slate-200 bg-white flex flex-col h-full overflow-hidden select-none z-10 shadow-xs"
    >
      {/* Panel Header */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800">
          <span>Question Panel</span>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-200/80 px-1.5 py-0.2 rounded-full">
            {questions.length}
          </span>
        </div>
        <button
          type="button"
          data-testid="collapse-question-panel"
          onClick={onToggleCollapse}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          title="Collapse Panel ([)"
          aria-label="Collapse Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs: All | Flagged | Checked */}
      <div className="p-2 border-b border-slate-100 flex items-center gap-1 bg-slate-50/40 text-xs">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`flex-1 py-1 px-1.5 text-[11px] font-semibold rounded-md transition text-center ${
            filter === 'all'
              ? 'bg-white text-indigo-700 shadow-xs border border-indigo-100'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All ({questions.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('flagged')}
          className={`flex-1 py-1 px-1.5 text-[11px] font-semibold rounded-md transition text-center ${
            filter === 'flagged'
              ? 'bg-amber-50 text-amber-800 shadow-xs border border-amber-200'
              : 'text-slate-600 hover:text-amber-800 hover:bg-amber-50/50'
          }`}
        >
          Flagged ({flaggedCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter('checked')}
          className={`flex-1 py-1 px-1.5 text-[11px] font-semibold rounded-md transition text-center ${
            filter === 'checked'
              ? 'bg-emerald-50 text-emerald-800 shadow-xs border border-emerald-200'
              : 'text-slate-600 hover:text-emerald-800 hover:bg-emerald-50/50'
          }`}
        >
          Checked ({checkedCount})
        </button>
      </div>

      {/* Question List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredQuestions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No questions match this filter.
          </div>
        ) : (
          filteredQuestions.map((q) => {
            const key = q.question_key || q.key;
            const isActive = key === activeKey;
            const status = getQuestionStatus(q);
            const score = q.final_marks !== undefined ? q.final_marks : q.ai_marks;
            const hasOverride =
              q.strictness_source === 'question' ||
              (q.strictness_override !== undefined && q.strictness_override !== null);
            const overrideLevel = q.strictness_used || q.strictness_override;

            return (
              <button
                key={key}
                ref={isActive ? activeItemRef : null}
                type="button"
                onClick={() => onSelectQuestion(key)}
                className={`w-full p-2.5 rounded-lg border text-left transition flex items-center justify-between gap-2 ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-300'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Status Indicator Dot */}
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      status === 'failed'
                        ? 'bg-rose-500 ring-2 ring-rose-200'
                        : status === 'flagged'
                        ? 'bg-amber-500 ring-2 ring-amber-200'
                        : status === 'approved'
                        ? 'bg-emerald-500 ring-2 ring-emerald-200'
                        : 'bg-slate-300'
                    }`}
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-900">
                        Q.{q.q_no}
                      </span>
                      {hasOverride && (
                        <span
                          className="px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-100 text-purple-700"
                          title={`Strictness Override: Level ${overrideLevel}/5`}
                        >
                          S.{overrideLevel}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate max-w-[140px]">
                      {q.question_text || q.text || 'Question'}
                    </p>
                  </div>
                </div>

                {/* Score & Status Badge */}
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-slate-800 block">
                    {status === 'failed' ? '–' : `${score}/${q.max_marks}`}
                  </span>
                  <span
                    className={`text-[9px] font-semibold uppercase ${
                      status === 'failed'
                        ? 'text-rose-600'
                        : status === 'flagged'
                        ? 'text-amber-600'
                        : status === 'approved'
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {status}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
