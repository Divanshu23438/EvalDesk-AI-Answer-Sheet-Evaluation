import React, { useState, useEffect } from 'react';
import { Sparkles, X, Check } from 'lucide-react';
import { StrictnessPicker } from './StrictnessPicker';

interface RecheckPopoverProps {
  isOpen: boolean;
  initialLevel: number;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: (level: number, persistOverride: boolean) => Promise<void> | void;
}

export const RecheckPopover: React.FC<RecheckPopoverProps> = ({
  isOpen,
  initialLevel,
  isSaving,
  onClose,
  onConfirm,
}) => {
  const [level, setLevel] = useState<number>(initialLevel || 3);
  const [persistOverride, setPersistOverride] = useState<boolean>(false);

  useEffect(() => {
    setLevel(initialLevel || 3);
    setPersistOverride(false);
  }, [initialLevel, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(level, persistOverride);
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-[#E2E8E4] dark:border-[#2A2F2C] bg-white dark:bg-[#181B19] shadow-xl p-3 z-50 text-xs space-y-2.5">
      <div className="flex items-center justify-between border-b border-[#E2E8E4] dark:border-[#2F3532] pb-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-[#111827] dark:text-[#ECEEED]">
          <Sparkles className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3]" />
          <span>Recheck with AI</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-[#6B7280] dark:text-[#68706C] hover:text-[#111827] dark:hover:text-[#ECEEED] hover:bg-slate-100 dark:hover:bg-[#202422]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div>
          <label className="text-[11px] font-medium text-[#4B5563] dark:text-[#969E9A] block mb-1">
            Strictness for this recheck:
          </label>
          <div className="flex items-center justify-between">
            <StrictnessPicker
              compact
              value={level}
              onChange={(lvl) => setLevel(lvl || 3)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[11px] text-[#4B5563] dark:text-[#969E9A] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={persistOverride}
            onChange={(e) => setPersistOverride(e.target.checked)}
            className="rounded border-[#E2E8E4] dark:border-[#2F3532] text-[#0F5132] focus:ring-[#0F5132] bg-white dark:bg-[#202422]"
          />
          <span>Save as this question's strictness</span>
        </label>

        <div className="flex justify-end gap-1.5 pt-1 border-t border-[#E2E8E4] dark:border-[#2F3532]">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs rounded border border-[#E2E8E4] dark:border-[#2A2F2C] hover:bg-[#F1F4F2] dark:hover:bg-[#202422] text-[#4B5563] dark:text-[#969E9A]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-3 py-1 text-xs font-semibold rounded bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white disabled:opacity-40 flex items-center gap-1 shadow-none"
          >
            {isSaving ? (
              <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            <span>Recheck</span>
          </button>
        </div>
      </form>
    </div>
  );
};
