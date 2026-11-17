import React from 'react';

const LEVEL_NAMES: Record<number, string> = {
  1: 'Lenient',
  2: 'Supportive',
  3: 'Balanced',
  4: 'Rigorous',
  5: 'Strict',
};

const LEVEL_STYLES: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  2: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  3: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  4: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  5: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

interface StrictnessChipProps {
  level: number;
  source?: 'question' | 'paper' | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StrictnessChip: React.FC<StrictnessChipProps> = ({
  level,
  source,
  size = 'md',
  className = '',
}) => {
  const safeLevel = Math.max(1, Math.min(5, Math.round(level || 3)));
  const name = LEVEL_NAMES[safeLevel] || 'Balanced';
  const style = LEVEL_STYLES[safeLevel] || LEVEL_STYLES[3];
  const isOverride = source === 'question';

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${className}`}
      title={isOverride ? `Level ${safeLevel}: ${name} (Question override)` : `Level ${safeLevel}: ${name} (Paper standard)`}
    >
      <span>Strictness {safeLevel}/5</span>
      <span className="opacity-75 font-normal">· {name}</span>
      {isOverride && (
        <span className="font-mono text-[9px] px-1 rounded bg-white/70 border border-current opacity-90 uppercase">
          override
        </span>
      )}
    </span>
  );
};
