import React from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { FileQuestion, Eye, CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';

export const EvaluateScreen: React.FC = () => {
  const [state, store] = useSheetStore();

  return (
    <div
      className={`h-full grid transition-all duration-200 min-h-0 ${
        state.isSidebarCollapsed
          ? 'grid-cols-[56px_1fr_380px]'
          : 'grid-cols-[280px_1fr_420px]'
      }`}
    >
      {/* 1. Left Collapsible Question Sidebar */}
      <aside
        aria-label="Question Navigator"
        className="border-r border-[var(--surface-border)] bg-[var(--surface-card)] flex flex-col min-h-0"
      >
        <div className="h-10 px-3 border-b border-[var(--surface-border)] flex items-center justify-between text-xs font-semibold text-[var(--ink-secondary)]">
          {!state.isSidebarCollapsed && <span>Questions</span>}
          <button
            type="button"
            onClick={() => store.toggleSidebar()}
            className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)] transition"
            title={state.isSidebarCollapsed ? 'Expand sidebar ([)' : 'Collapse sidebar ([)'}
          >
            {state.isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <div className="panel flex-1 p-2 space-y-1">
          <div className="text-center py-8 text-xs text-[var(--ink-muted)]">
            {!state.isSidebarCollapsed && (
              <p>No questions loaded. Select or upload a sheet to begin evaluation.</p>
            )}
          </div>
        </div>
      </aside>

      {/* 2. Centre Fixed Sheet Viewer */}
      <main
        aria-label="Sheet Viewer"
        className="flex flex-col min-h-0 bg-[var(--surface-subtle)] relative"
      >
        <div className="h-10 px-4 bg-[var(--surface-card)] border-b border-[var(--surface-border)] flex items-center justify-between text-xs text-[var(--ink-secondary)]">
          <span>Sheet Canvas</span>
          <div className="flex items-center gap-2">
            <span>Page 1 of 1</span>
          </div>
        </div>

        <div className="panel flex-1 flex items-center justify-center p-4">
          <div className="text-center text-[var(--ink-muted)] text-xs">
            <Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Sheet image preview will render here.</p>
          </div>
        </div>
      </main>

      {/* 3. Right Evaluation Cards */}
      <section
        aria-label="Evaluation Details"
        className="border-l border-[var(--surface-border)] bg-[var(--surface-card)] flex flex-col min-h-0"
      >
        <div className="h-10 px-4 border-b border-[var(--surface-border)] flex items-center justify-between text-xs font-semibold text-[var(--ink-secondary)]">
          <span>Question Evaluation</span>
        </div>

        <div className="panel flex-1 p-4 space-y-4">
          {/* Card 1: OCR Detected */}
          <div className="border border-[var(--surface-border)] rounded-lg p-3 bg-[var(--surface-canvas)]">
            <h4 className="text-xs font-semibold text-[var(--ink-secondary)] mb-2 uppercase tracking-wider">
              1. OCR Detected
            </h4>
            <p className="text-xs text-[var(--ink-muted)] italic">Awaiting question selection...</p>
          </div>

          {/* Card 2: Reference */}
          <div className="border border-[var(--surface-border)] rounded-lg p-3 bg-[var(--surface-canvas)]">
            <h4 className="text-xs font-semibold text-[var(--ink-secondary)] mb-2 uppercase tracking-wider">
              2. Reference
            </h4>
            <p className="text-xs text-[var(--ink-muted)] italic">Model answer & key points...</p>
          </div>

          {/* Card 3: Marks & Evidence */}
          <div className="border border-[var(--surface-border)] rounded-lg p-3 bg-[var(--surface-canvas)]">
            <h4 className="text-xs font-semibold text-[var(--ink-secondary)] mb-2 uppercase tracking-wider">
              3. Marks & Evidence
            </h4>
            <p className="text-xs text-[var(--ink-muted)] italic">Score breakdown & flags...</p>
          </div>
        </div>
      </section>
    </div>
  );
};
