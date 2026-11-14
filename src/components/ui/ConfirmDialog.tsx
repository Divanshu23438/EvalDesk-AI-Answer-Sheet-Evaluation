import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  requireReason = false,
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Enter a short explanation...',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requireReason && !reason.trim()) {
      setError('A reason is required to continue.');
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white border border-[#e2e8f0] shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2.5">
            {danger && <AlertTriangle className="w-5 h-5 text-[#ba1a1a] shrink-0" aria-hidden="true" />}
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-[#0b1c30]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm text-[#414752] leading-relaxed">{description}</p>
            {requireReason && (
              <div>
                <label className="block text-xs font-semibold text-[#0b1c30] mb-1">
                  {reasonLabel} *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setError('');
                  }}
                  rows={3}
                  placeholder={reasonPlaceholder}
                  className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#005dac] focus:ring-1 focus:ring-[#005dac]"
                />
                {error && <p className="mt-1 text-xs text-[#ba1a1a]">{error}</p>}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-[#e2e8f0]">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-[#414752] bg-white border border-[#c1c6d4] rounded hover:bg-slate-100 whitespace-nowrap"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-xs font-semibold text-white rounded whitespace-nowrap ${
                danger ? 'bg-[#ba1a1a] hover:bg-[#93000a]' : 'bg-[#005dac] hover:bg-[#004786]'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
