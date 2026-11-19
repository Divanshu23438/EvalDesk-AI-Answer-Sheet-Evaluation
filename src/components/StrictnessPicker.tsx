import React from 'react';

export interface StrictnessLevelInfo {
  level: number;
  name: string;
  shortDesc: string;
}

export const STRICTNESS_LEVELS: StrictnessLevelInfo[] = [
  { level: 1, name: 'Lenient', shortDesc: 'Concept-first; rewards broad understanding, very high OCR tolerance.' },
  { level: 2, name: 'Supportive', shortDesc: 'Generous partial credit; accepts synonyms, ignores minor slips.' },
  { level: 3, name: 'Balanced', shortDesc: 'Standard rubric; proportional step-marking, accurate terminology.' },
  { level: 4, name: 'Rigorous', shortDesc: 'Technical precision; demands formal terms, strict deductions.' },
  { level: 5, name: 'Strict', shortDesc: 'Exact-match; textbook definitions, near-binary per rubric point.' },
];

export interface StrictnessPickerProps {
  value: number | null;
  onChange: (level: any) => void;
  disabled?: boolean;
  compact?: boolean;
  inheritLabel?: string;
}

export const StrictnessPicker: React.FC<StrictnessPickerProps> = ({
  value,
  onChange,
  disabled = false,
  compact = false,
  inheritLabel,
}) => {
  const currentLevel = value ? Math.max(1, Math.min(5, value)) : 3;
  const currentInfo = STRICTNESS_LEVELS.find((l) => l.level === currentLevel) || STRICTNESS_LEVELS[2];

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1">
        {inheritLabel && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded transition ${
              value === null
                ? 'bg-slate-700 dark:bg-[#2A2F2C] text-white shadow-none'
                : 'bg-slate-100 dark:bg-[#202422] text-slate-600 dark:text-[#969E9A] hover:bg-slate-200 dark:hover:bg-[#2F3532]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Inherit strictness from paper settings"
          >
            {inheritLabel}
          </button>
        )}
        <div className="inline-flex rounded-md border border-slate-200 dark:border-[#2F3532] p-0.5 bg-slate-50 dark:bg-[#202422] gap-0.5">
          {STRICTNESS_LEVELS.map((item) => {
            const isSelected = value === item.level;
            return (
              <button
                key={item.level}
                type="button"
                disabled={disabled}
                onClick={() => onChange(item.level)}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition ${
                  isSelected
                    ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white shadow-none'
                    : 'text-slate-600 dark:text-[#969E9A] hover:text-[#0F5132] dark:hover:text-[#7CC9A3] hover:bg-white dark:hover:bg-[#181B19]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={`Level ${item.level}: ${item.name} — ${item.shortDesc}`}
              >
                {item.level}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 dark:bg-[#202422] rounded-lg border border-slate-200 dark:border-[#2F3532]">
        {STRICTNESS_LEVELS.map((item) => {
          const isSelected = currentLevel === item.level;
          return (
            <button
              key={item.level}
              type="button"
              disabled={disabled}
              onClick={() => onChange(item.level)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-md text-center transition ${
                isSelected
                  ? 'bg-white dark:bg-[#181B19] text-[#0B3D26] dark:text-[#7CC9A3] font-bold shadow-none border border-[#0F5132]/20 dark:border-[#294236]'
                  : 'text-slate-600 dark:text-[#969E9A] hover:text-slate-900 dark:hover:text-[#ECEEED] hover:bg-slate-50 dark:hover:bg-[#181B19] font-medium'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-xs">{item.level}</span>
              <span className="text-[10px] truncate max-w-full leading-tight">{item.name}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-600 dark:text-[#969E9A] leading-tight min-h-[1.2rem]">
        <strong className="text-slate-800 dark:text-[#ECEEED]">Level {currentInfo.level} ({currentInfo.name}):</strong> {currentInfo.shortDesc}
      </p>
    </div>
  );
};
