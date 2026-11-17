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
    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-slate-200 bg-white shadow-xl p-3 z-50 text-xs space-y-2.5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Recheck with AI</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div>
          <label className="text-[11px] font-medium text-slate-700 block mb-1">
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

        <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={persistOverride}
            onChange={(e) => setPersistOverride(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>Save as this question's strictness</span>
        </label>

        <div className="flex justify-end gap-1.5 pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-3 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 flex items-center gap-1 shadow-xs"
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
