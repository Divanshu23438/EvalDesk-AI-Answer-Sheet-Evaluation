import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Flag,
  Dot,
  Circle,
  X,
  Filter,
} from 'lucide-react';

export interface ReviewQuestionItem {
  eval_id: string;
  question_id: string;
  question_key: string;
  key: string;
  q_no: string;
  text: string;
  question_text: string;
  options?: string[];
  options_json?: string;
  max_marks: number;
  ai_marks: number;
  final_marks: number;
  reason?: string;
  evidence_quote?: string;
  flags: Array<{ code: string; message: string }>;
  flags_json?: string;
  status: 'approved' | 'flagged' | 'pending' | 'failed';
  resolved: number | boolean;
  is_counted?: boolean;
  ocr_text?: string;
  extracted_text?: string;
  reader_texts?: Record<string, string>;
  legibility?: number;
  legibility_score?: number;
  page_numbers?: number[];
  bbox?: [number, number, number, number] | null;
  continues?: boolean;
  model_answer?: string;
  key_points?: Array<{ point: string; marks: number; accept_if?: string; reject_if?: string }>;
  reference?: {
    model_answer: string;
    key_points: Array<{ point: string; marks: number; accept_if?: string; reject_if?: string }>;
    source: string;
  };
  key_point_verdicts?: Array<{
    point: string;
    verdict: 'full' | 'partial' | 'none';
    quote: string;
  }>;
  strictness_used?: number;
  strictness_source?: 'paper' | 'question' | 'recheck';
  strictness_override?: number | null;
  error_message?: string | null;
}

interface QuestionSidebarProps {
  questions: ReviewQuestionItem[];
  activeKey: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectQuestion: (key: string) => void;
}

export type SidebarFilter = 'all' | 'flagged' | 'pending' | 'failed';

export const QuestionSidebar: React.FC<QuestionSidebarProps> = ({
  questions,
  activeKey,
  isCollapsed,
  onToggleCollapse,
  onSelectQuestion,
}) => {
  const [filter, setFilter] = useState<SidebarFilter>('all');
  const [hoveredQ, setHoveredQ] = useState<ReviewQuestionItem | null>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll the active question into view inside sidebar
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeKey, filter]);

  // Compute status counts
  const flaggedCount = questions.filter(
    (q) => (q.flags && q.flags.length > 0 && !q.resolved) || q.status === 'flagged'
  ).length;
  const failedCount = questions.filter((q) => q.status === 'failed').length;
  const pendingCount = questions.filter((q) => !q.resolved && q.status !== 'failed').length;

  const filteredQuestions = questions.filter((q) => {
    const isFlagged = (q.flags && q.flags.length > 0 && !q.resolved) || q.status === 'flagged';
    const isFailed = q.status === 'failed';
    const isApproved = Boolean(q.resolved) && !isFailed;

    if (filter === 'flagged') return isFlagged;
    if (filter === 'failed') return isFailed;
    if (filter === 'pending') return !isApproved && !isFailed;
    return true;
  });

  const getQuestionStatus = (
    q: ReviewQuestionItem
  ): { type: 'approved' | 'flagged' | 'failed' | 'pending'; icon: React.ReactNode } => {
    if (q.status === 'failed') {
      return { type: 'failed', icon: <X className="w-3.5 h-3.5 text-[var(--status-failed)]" /> };
    }
    if ((q.flags && q.flags.length > 0 && !q.resolved) || q.status === 'flagged') {
      return { type: 'flagged', icon: <Flag className="w-3 h-3 text-[var(--status-flagged)]" /> };
    }
    if (q.resolved) {
      return { type: 'approved', icon: <Check className="w-3.5 h-3.5 text-[var(--status-approved)]" /> };
    }
    return { type: 'pending', icon: <Circle className="w-2.5 h-2.5 text-[var(--ink-muted)]" /> };
  };

  return (
    <aside
      aria-label="Question Navigator"
      className="border-r border-[var(--surface-border)] bg-[var(--surface-card)] flex flex-col min-h-0 h-full select-none relative"
    >
      {/* Header & Toggle */}
      <div className="h-10 px-2.5 border-b border-[var(--surface-border)] flex items-center justify-between text-xs font-semibold text-[var(--ink-secondary)] shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate">Questions</span>
            <span className="text-[11px] text-[var(--ink-muted)] tabular-nums">
              ({questions.length})
            </span>
          </div>
        ) : (
          <span className="text-[10px] uppercase font-bold text-[var(--ink-muted)] mx-auto">Q</span>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-[var(--surface-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)] transition"
          title={isCollapsed ? 'Expand sidebar ([)' : 'Collapse sidebar ([)'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Filter Chips (Visible when expanded) */}
      {!isCollapsed && (
        <div className="px-2 py-1.5 border-b border-[var(--surface-border)] flex items-center gap-1 overflow-x-auto shrink-0 bg-[var(--surface-canvas)]">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition ${
              filter === 'all'
                ? 'bg-[var(--ink-primary)] text-white'
                : 'text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('flagged')}
            className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition flex items-center gap-1 ${
              filter === 'flagged'
                ? 'bg-[var(--status-flagged)] text-white'
                : 'text-[var(--status-flagged)] hover:bg-[var(--status-flagged-bg)]'
            }`}
          >
            ⚑ {flaggedCount}
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition ${
              filter === 'pending'
                ? 'bg-[var(--ink-secondary)] text-white'
                : 'text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            Pending
          </button>
          {failedCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter('failed')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded-full transition text-[var(--status-failed)] ${
                filter === 'failed'
                  ? 'bg-[var(--status-failed)] text-white'
                  : 'hover:bg-[var(--status-failed-bg)]'
              }`}
            >
              ✕ {failedCount}
            </button>
          )}
        </div>
      )}

      {/* Questions Scrollable List */}
      <div className="panel flex-1 overflow-y-auto p-1.5 space-y-1">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-6 text-xs text-[var(--ink-muted)]">
            {!isCollapsed && <p>No questions match filter.</p>}
          </div>
        ) : (
          filteredQuestions.map((q) => {
            const qKey = q.question_key || q.key;
            const isCurrent = qKey === activeKey;
            const statusInfo = getQuestionStatus(q);

            return (
              <div key={qKey} className="relative">
                <button
                  ref={isCurrent ? activeItemRef : null}
                  type="button"
                  onClick={() => onSelectQuestion(qKey)}
                  onMouseEnter={() => setHoveredQ(q)}
                  onMouseLeave={() => setHoveredQ(null)}
                  className={`w-full text-left rounded-md transition flex items-center ${
                    isCollapsed ? 'justify-center p-2' : 'p-2 justify-between gap-2'
                  } ${
                    isCurrent
                      ? 'bg-[var(--accent-indigo-subtle)] text-[var(--accent-indigo)] font-semibold border border-[var(--accent-indigo-border)] shadow-xs'
                      : 'hover:bg-[var(--surface-hover)] text-[var(--ink-primary)]'
                  }`}
                  title={isCollapsed ? `Q${q.q_no}: ${q.text || q.question_text}` : undefined}
                >
                  {isCollapsed ? (
                    /* Collapsed View: Just pill with number and status icon */
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[11px] font-bold tabular-nums">Q{q.q_no}</span>
                      <span className="w-3 h-3 flex items-center justify-center">
                        {statusInfo.icon}
                      </span>
                    </div>
                  ) : (
                    /* Expanded View: Question number, truncated text, marks & status icon */
                    <>
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className="w-7 h-5 rounded bg-[var(--surface-subtle)] text-[11px] font-bold text-[var(--ink-secondary)] flex items-center justify-center shrink-0 tabular-nums">
                          Q{q.q_no}
                        </span>
                        <span className="text-xs truncate font-normal text-[var(--ink-primary)]">
                          {q.text || q.question_text}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-xs">
                        <span className="text-[11px] text-[var(--ink-muted)] tabular-nums">
                          {q.final_marks !== undefined ? q.final_marks : q.ai_marks}/{q.max_marks}M
                        </span>
                        <span className="w-4 h-4 flex items-center justify-center">
                          {statusInfo.icon}
                        </span>
                      </div>
                    </>
                  )}
                </button>

                {/* Hover Tooltip showing Bilingual Text & MCQ options */}
                {hoveredQ?.question_id === q.question_id && !isCollapsed && (
                  <div className="absolute left-full top-0 ml-2 w-72 p-3 bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-lg shadow-lg z-50 pointer-events-none text-xs">
                    <p className="font-semibold text-[var(--ink-primary)] mb-1">
                      Question {q.q_no} ({q.max_marks} Marks)
                    </p>
                    <p className="text-[var(--ink-secondary)] leading-relaxed mb-2">
                      {q.text || q.question_text}
                    </p>
                    {q.options && q.options.length > 0 && (
                      <div className="pt-2 border-t border-[var(--surface-border)] space-y-1">
                        <span className="text-[10px] uppercase font-bold text-[var(--ink-muted)]">
                          Options:
                        </span>
                        {q.options.map((opt, i) => (
                          <div key={i} className="text-[11px] text-[var(--ink-muted)]">
                            • {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
