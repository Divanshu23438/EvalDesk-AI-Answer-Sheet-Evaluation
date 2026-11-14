import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, SkipForward } from 'lucide-react';
import { useEval } from '../../store/EvalContext';

interface LineItem {
  sheetId: string;
  questionId: string;
  lineId: string;
  pageImg: string;
  topPct: number;
  heightPct: number;
  ocrGuess: string;
  editedText: string;
  lineConfidence: number;
}

export function TeacherOcrEditor() {
  const { state, currentUser, saveOcrLineCorrection } = useEval();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [addToTraining, setAddToTraining] = useState(state.settings.allowTrainingDataConsent);
  const [identicalWarning, setIdenticalWarning] = useState(false);
  const [savedToast, setSavedToast] = useState('');

  const lineItems: LineItem[] = useMemo(() => {
    if (!currentUser) return [];
    const items: LineItem[] = [];
    for (const s of state.sheets) {
      if (s.assignedTeacherId !== currentUser.id) continue;
      for (const a of s.answers) {
        for (const lc of a.lineCrops) {
          items.push({
            sheetId: s.id,
            questionId: a.questionId,
            lineId: lc.id,
            pageImg: s.pages[lc.pageIndex] || s.pages[0],
            topPct: lc.topPct,
            heightPct: lc.heightPct,
            ocrGuess: lc.ocrGuess,
            editedText: lc.editedText,
            lineConfidence: lc.lineConfidence,
          });
        }
      }
    }
    // Sort low-confidence lines first
    return items.sort((a, b) => a.lineConfidence - b.lineConfidence);
  }, [state.sheets, currentUser]);

  const current = lineItems[index] ?? null;
  const activeText = draft !== null ? draft : current?.editedText || '';

  const handleSaveNext = (force = false) => {
    if (!current) return;
    if (!force && activeText.trim() === current.ocrGuess.trim()) {
      setIdenticalWarning(true);
      return;
    }
    saveOcrLineCorrection(current.sheetId, current.questionId, current.lineId, activeText, addToTraining);
    setIdenticalWarning(false);
    setSavedToast('Line saved.');
    window.setTimeout(() => setSavedToast(''), 1800);
    setDraft(null);
    setIndex((i) => (i + 1 < lineItems.length ? i + 1 : 0));
  };

  const handleSkip = () => {
    setIdenticalWarning(false);
    setDraft(null);
    setIndex((i) => (i + 1 < lineItems.length ? i + 1 : 0));
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0b1c30]">OCR Line Editor</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Fast handwriting line-by-line verification ordered by lowest OCR confidence first.
          </p>
        </div>
        <span className="text-xs font-mono text-[#414752] tabular-nums">
          Line {lineItems.length > 0 ? index + 1 : 0} of {lineItems.length}
        </span>
      </div>

      {!current ? (
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-8 text-center text-xs text-[#64748b]">
          No handwriting line crops found in your assigned sheets.
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[#64748b]">
              {current.sheetId} · {current.lineId}
            </span>
            <span
              className={`font-semibold tabular-nums ${
                current.lineConfidence < 75 ? 'text-[#ba1a1a]' : 'text-[#196b22]'
              }`}
            >
              Line Confidence: {current.lineConfidence}%
            </span>
          </div>

          {/* Cropped handwriting line viewport */}
          <div className="border border-[#c1c6d4] rounded overflow-hidden bg-slate-100">
            <div className="px-3 py-1 bg-slate-50 border-b border-[#e2e8f0] text-[11px] font-medium text-[#64748b]">
              Handwriting Line Image Crop
            </div>
            <div className="relative h-28 overflow-hidden bg-white">
              <img
                src={current.pageImg}
                alt="Handwritten line crop for OCR verification"
                className="w-full absolute left-0 object-cover"
                style={{
                  top: `-${Math.max(0, current.topPct - 2) * 3.8}px`,
                }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="ocr-line-input" className="block text-xs font-semibold text-[#0b1c30] mb-1">
              Recognized Text (Editable)
            </label>
            <input
              id="ocr-line-input"
              type="text"
              value={activeText}
              onChange={(e) => {
                setDraft(e.target.value);
                setIdenticalWarning(false);
              }}
              className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-sm font-mono text-[#0b1c30] focus:outline-none focus:border-[#005dac]"
            />
          </div>

          {identicalWarning && (
            <div className="p-3 rounded border border-[#ffb865] bg-[#fff8e1] text-xs text-[#875200] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Text is identical to the original OCR guess. Confirm if OCR guess is already accurate.</span>
              </div>
              <button
                type="button"
                onClick={() => handleSaveNext(true)}
                className="px-2.5 py-1 rounded bg-[#875200] text-white font-semibold shrink-0"
              >
                Confirm & Next
              </button>
            </div>
          )}

          {savedToast && (
            <div className="text-xs text-[#196b22] font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{savedToast}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#e2e8f0]">
            {state.settings.allowTrainingDataConsent ? (
              <label className="inline-flex items-center gap-2 text-xs text-[#414752]">
                <input
                  type="checkbox"
                  checked={addToTraining}
                  onChange={(e) => setAddToTraining(e.target.checked)}
                />
                <span>Include verified line in local OCR training set</span>
              </label>
            ) : (
              <span className="text-xs text-[#64748b]">Training-set collection disabled by Admin</span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkip}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-[#c1c6d4] text-xs font-semibold text-[#414752] hover:bg-slate-50"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Skip</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveNext(false)}
                className="px-4 py-2 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold"
              >
                Save & Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
