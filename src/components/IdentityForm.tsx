import React, { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/client';

interface IdentityFormProps {
  sheetId: string;
  initialName?: string;
  initialRoll?: string;
  initialClass?: string;
  /** Called after the server accepted the identity (evaluation is auto-queued server-side). */
  onSaved: () => void;
  /** Optional cancel callback to close form when opened via manual edit button */
  onCancel?: () => void;
}

export const IdentityForm: React.FC<IdentityFormProps> = ({
  sheetId,
  initialName = '',
  initialRoll = '',
  initialClass = '',
  onSaved,
  onCancel,
}) => {
  const [name, setName] = useState(initialName);
  const [roll, setRoll] = useState(initialRoll);
  const [className, setClassName] = useState(initialClass);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const student_name = name.trim();
    if (!student_name || !roll.trim()) {
      setError('Both student name and roll number are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/api/sheets/${sheetId}/identity`, {
        student_name,
        roll_number: roll.trim(),
        class_name: className.trim(),
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Could not save student details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>Name not detected. Enter the student details and evaluation will start automatically.</span>
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Student name"
          aria-label="Student name"
          className="col-span-3 text-xs px-2 py-1 rounded-md border border-amber-300 bg-white focus:outline-none focus:border-[#0F5132]"
        />
        <input
          type="text"
          value={roll}
          onChange={(e) => setRoll(e.target.value)}
          placeholder="Roll no."
          aria-label="Roll number"
          className="col-span-2 text-xs px-2 py-1 rounded-md border border-amber-300 bg-white focus:outline-none focus:border-[#0F5132] font-mono"
        />
        <input
          type="text"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          placeholder="Class"
          aria-label="Class"
          className="col-span-1 text-xs px-2 py-1 rounded-md border border-amber-300 bg-white focus:outline-none focus:border-[#0F5132]"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-rose-700 min-h-[1rem]">{error}</span>
        <div className="flex items-center gap-1.5">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-md border border-slate-300 bg-white hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving || !name.trim() || !roll.trim()}
            className="px-3 py-1 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#0B3D26] disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition flex items-center gap-1.5 shrink-0"
          >
            {saving && <RefreshCw className="w-3 h-3 animate-spin" />}
            <span>Save and evaluate</span>
          </button>
        </div>
      </div>
    </form>
  );
};
