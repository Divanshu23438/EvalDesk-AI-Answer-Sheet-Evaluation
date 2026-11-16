import React from 'react';

interface ActionBarProps {
  leftContent?: React.ReactNode;
  centerContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  leftContent,
  centerContent,
  rightContent,
}) => {
  return (
    <footer
      role="toolbar"
      aria-label="Action bar"
      className="h-[56px] bg-[var(--surface-card)] border-t border-[var(--surface-border)] px-4 flex items-center justify-between z-20 shrink-0 select-none"
    >
      <div className="flex items-center gap-3 min-w-0">
        {leftContent}
      </div>

      <div className="flex items-center gap-3 min-w-0 text-xs text-[var(--ink-secondary)]">
        {centerContent}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {rightContent}
      </div>
    </footer>
  );
};
