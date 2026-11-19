import React from 'react';

const LEVEL_NAMES: Record<number, string> = {
  1: 'Lenient',
  2: 'Supportive',
  3: 'Balanced',
  4: 'Rigorous',
  5: 'Strict',
};

const LEVEL_STYLES: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-emerald-50 dark:bg-[#1A2B23]', text: 'text-emerald-700 dark:text-[#7CC9A3]', border: 'border-emerald-200 dark:border-[#294236]' },
  2: { bg: 'bg-teal-50 dark:bg-[#1A2826]', text: 'text-teal-700 dark:text-[#7CC0B5]', border: 'border-teal-200 dark:border-[#263D39]' },
  3: { bg: 'bg-[#E8F3EE] dark:bg-[#1A2B23]', text: 'text-[#0B3D26] dark:text-[#7CC9A3]', border: 'border-[#0F5132]/20 dark:border-[#294236]' },
  4: { bg: 'bg-[#E8F3EE] dark:bg-[#20272B]', text: 'text-[#0B3D26] dark:text-[#88B8C4]', border: 'border-[#0D9488]/20 dark:border-[#28383F]' },
  5: { bg: 'bg-rose-50 dark:bg-[#2B191D]', text: 'text-rose-700 dark:text-[#E57D8A]', border: 'border-rose-200 dark:border-[#45262C]' },
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
        <span className="font-mono text-[9px] px-1 rounded bg-white/70 dark:bg-[#181B19]/70 border border-current opacity-90 uppercase">
          override
        </span>
      )}
    </span>
  );
};
