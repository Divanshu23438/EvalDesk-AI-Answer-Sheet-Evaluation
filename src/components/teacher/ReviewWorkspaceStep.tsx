import React from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Flag,
  Minus,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  type UISectionRule,
  formatQNo,
} from './types';
import { type EvaluatedReviewItem } from '../../utils/apiOcr';

export interface ReviewWorkspaceStepProps {
  currentSheetId: string;
  studentName: string;
  rollNo: string;
  basis: string;
  paperTitle: string;
  unresolvedFlagsCount: number;
  totalScore: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  sections: UISectionRule[];
  reviewItems: EvaluatedReviewItem[];
  selectedKey: string;
  setSelectedKey: (k: string) => void;
  selectedReviewItem: EvaluatedReviewItem | null;
  flaggedOnlyFilter: boolean;
  setFlaggedOnlyFilter: (f: boolean) => void;
  sheetPages: string[];
  activeSheetPage: number;
  setActiveSheetPage: React.Dispatch<React.SetStateAction<number>>;
  studentZoom: number;
  setStudentZoom: React.Dispatch<React.SetStateAction<number>>;
  studentRotation: number;
  setStudentRotation: React.Dispatch<React.SetStateAction<number>>;
  studentPreview: string;
  editTranscript: string;
  setEditTranscript: (t: string) => void;
  overrideMarks: number;
  setOverrideMarks: React.Dispatch<React.SetStateAction<number>>;
  overrideReason: string;
  setOverrideReason: (r: string) => void;
  isCountedOverride: boolean;
  isFinalizing: boolean;
  handleFinalizeSheet: (sheetId: string) => Promise<void>;
  handleDeleteSheet: (sheetId: string) => Promise<void>;
  handleToggleCounted: (item: EvaluatedReviewItem, checked: boolean) => Promise<void>;
  handleAcceptCurrent: (item: EvaluatedReviewItem) => Promise<void>;
  handleOverrideCurrent: (item: EvaluatedReviewItem) => Promise<void>;
  handleLiveRecheck: (item: EvaluatedReviewItem) => Promise<void>;
  onNavigateToReports: () => void;
}

export const ReviewWorkspaceStep: React.FC<ReviewWorkspaceStepProps> = ({
  currentSheetId,
  studentName,
  rollNo,
  basis,
  paperTitle,
  unresolvedFlagsCount,
  totalScore,
  maxMarks,
  percentage,
  grade,
  sections,
  reviewItems,
  selectedReviewItem,
  setSelectedKey,
  flaggedOnlyFilter,
  setFlaggedOnlyFilter,
  sheetPages,
  activeSheetPage,
  setActiveSheetPage,
  studentZoom,
  setStudentZoom,
  studentRotation,
  setStudentRotation,
  studentPreview,
  editTranscript,
  setEditTranscript,
  overrideMarks,
  setOverrideMarks,
  overrideReason,
  setOverrideReason,
  isCountedOverride,
  isFinalizing,
  handleFinalizeSheet,
  handleDeleteSheet,
  handleToggleCounted,
  handleAcceptCurrent,
  handleOverrideCurrent,
  handleLiveRecheck,
  onNavigateToReports,
}) => {
  return (
    <section className="space-y-4">
      {/* Top Bar: Student Identity, Live Total Score, KPI & Finalize Action */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[#f1f5f9] pb-3 mb-3">
          <div>
            <h1 className="text-base font-bold flex items-center gap-2 text-[#005dac]">
              Teacher Review Workspace · {studentName} ({rollNo})
            </h1>
            <p className="text-xs text-[#64748b]">
              Evaluation Basis: <strong className="text-[#005dac]">{basis}</strong> · Paper: <strong>{paperTitle || 'Exam Paper'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Keyboard Shortcuts Pill */}
            <span className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-[#f1f5f9] px-2.5 py-1 text-[11px] font-mono text-[#526071] border border-[#e2e8f0]">
              <span className="font-bold text-[#005dac]">J/K:</span> Nav &nbsp;|&nbsp;
              <span className="font-bold text-[#005dac]">A:</span> Accept &nbsp;|&nbsp;
              <span className="font-bold text-[#005dac]">F:</span> Flagged
            </span>

            {/* Finalize Sheet Button */}
            <button
              type="button"
              disabled={unresolvedFlagsCount > 0 || isFinalizing}
              onClick={() => currentSheetId && handleFinalizeSheet(currentSheetId)}
              className={`rounded-lg px-4 py-2 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all ${
                unresolvedFlagsCount > 0
                  ? 'bg-[#e2e8f0] text-[#94a3b8] cursor-not-allowed border border-[#cbd5e1]'
                  : 'bg-[#196b22] text-white hover:bg-[#14531b] cursor-pointer'
              }`}
              title={unresolvedFlagsCount > 0 ? `Cannot finalize: ${unresolvedFlagsCount} unresolved flag(s) remain` : 'Finalize sheet and generate report card'}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isFinalizing ? 'Finalizing...' : 'Finalize Sheet'}</span>
              {unresolvedFlagsCount > 0 && (
                <span className="rounded bg-[#ffdad6] px-1.5 py-0.2 text-[10px] text-[#93000a] font-bold">
                  {unresolvedFlagsCount} flag{unresolvedFlagsCount > 1 ? 's' : ''} left
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onNavigateToReports}
              className="rounded-lg border border-[#c1c6d4] bg-white px-3 py-2 text-xs font-bold text-[#414752] hover:bg-[#f1f5f9]"
            >
              Reports
            </button>

            <button
              type="button"
              onClick={() => currentSheetId && handleDeleteSheet(currentSheetId)}
              className="rounded-lg border border-[#ba1a1a] bg-white p-2 text-[#ba1a1a] hover:bg-[#ffdad6]"
              title="Delete sheet"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* KPI Score Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-2.5 rounded-xl bg-[#eff4ff] border border-[#d4e3ff]">
            <span className="text-[11px] font-semibold text-[#005dac] block">Total Counted Score</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold text-[#005dac]">{totalScore}</span>
              <span className="text-xs text-[#005dac]/70 font-semibold">/ {maxMarks} M</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0]">
            <span className="text-[11px] font-semibold text-[#64748b] block">Percentage</span>
            <div className="text-xl font-bold text-[#1e293b] mt-0.5">{percentage}%</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#e8f5e9] border border-[#c8e6c9]">
            <span className="text-[11px] font-semibold text-[#196b22] block">Grade</span>
            <div className="text-xl font-bold text-[#196b22] mt-0.5">{grade}</div>
          </div>
          <div className={`p-2.5 rounded-xl border ${unresolvedFlagsCount > 0 ? 'bg-[#ffdad6] border-[#ba1a1a]' : 'bg-[#f8f9ff] border-[#e2e8f0]'}`}>
            <span className={`text-[11px] font-semibold block ${unresolvedFlagsCount > 0 ? 'text-[#93000a]' : 'text-[#64748b]'}`}>
              Unresolved Flags
            </span>
            <div className={`text-xl font-bold mt-0.5 ${unresolvedFlagsCount > 0 ? 'text-[#93000a]' : 'text-[#196b22]'}`}>
              {unresolvedFlagsCount} {unresolvedFlagsCount === 0 ? '✓ All Clear' : 'Action Required'}
            </div>
          </div>
        </div>
      </div>

      {/* 3-Pane Layout Grid */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr_420px] items-start">
        {/* PANE 1 (LEFT): Question List grouped by Section with Status Chips & Section Choice Rules */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-xs space-y-3">
          {/* Section Choice Rules Summary */}
          {sections && sections.length > 0 && (
            <div className="space-y-1.5 border-b border-[#f1f5f9] pb-3">
              <span className="text-[11px] font-bold text-[#64748b] block uppercase tracking-wider">
                Section Choice Rules
              </span>
              {sections.map((sec) => {
                const secQuestions = reviewItems.filter((q) => q.section_name === sec.name);
                const countedQuestions = secQuestions.filter((q) => q.isCounted);
                const secScore = countedQuestions.reduce((s, q) => s + (Number(q.finalMarks) || 0), 0);
                const isChoice = sec.attempt_n && sec.total_questions && sec.attempt_n < sec.total_questions;
                return (
                  <div key={sec.name} className="rounded-lg border border-[#c1c6d4]/50 bg-[#f8fbff] p-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-[#004786]">
                      <span>{sec.name}</span>
                      <span className="text-[11px] font-semibold text-[#005dac]">
                        {secScore} / {sec.section_marks || (sec.attempt_n * sec.marks_each)} M
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[#526071] leading-tight">
                      {isChoice
                        ? `Attempt ${sec.attempt_n} of ${sec.total_questions} (${sec.policy === 'best_n' ? 'Best N' : 'First N'}): counting ${countedQuestions.map(q => formatQNo(q.q_no)).join(', ') || 'none'}`
                        : `Compulsory: all ${sec.total_questions || secQuestions.length} Qs counted`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Filter Bar: All vs Flagged Only */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1e293b]">Questions</span>
            <button
              type="button"
              onClick={() => setFlaggedOnlyFilter(!flaggedOnlyFilter)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all flex items-center gap-1 ${
                flaggedOnlyFilter
                  ? 'bg-[#ba1a1a] text-white shadow-2xs'
                  : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
              }`}
            >
              <Flag className="w-3 h-3" />
              <span>Flagged Only ({unresolvedFlagsCount})</span>
            </button>
          </div>

          {/* Grouped Questions List */}
          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {(() => {
              const sectionsList = Array.from(new Set(reviewItems.map((it) => it.section_name || 'General')));
              return sectionsList.map((secName) => {
                const secItems = reviewItems.filter((it) => (it.section_name || 'General') === secName);
                const displayItems = flaggedOnlyFilter ? secItems.filter((it) => !it.resolved) : secItems;
                if (displayItems.length === 0) return null;

                return (
                  <div key={secName} className="space-y-1">
                    <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block px-1">
                      {secName}
                    </span>
                    {displayItems.map((item) => {
                      const isSelected = (selectedReviewItem?.q_no === item.q_no) || (selectedReviewItem?.question_key === item.question_key);
                      return (
                        <button
                          key={item.q_no}
                          type="button"
                          onClick={() => setSelectedKey(item.question_key || item.q_no || item.eval_id || '')}
                          className={`w-full text-left rounded-lg p-2.5 text-xs transition-all flex items-center justify-between border ${
                            isSelected
                              ? 'border-[#005dac] bg-[#eff4ff] ring-2 ring-[#005dac]/30 shadow-xs'
                              : !item.resolved
                              ? 'border-[#ba1a1a]/60 bg-[#fff5f5] hover:bg-[#ffebee]'
                              : 'border-[#e2e8f0] bg-white hover:bg-[#f8f9ff]'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold flex items-center gap-1.5">
                              <span className={isSelected ? 'text-[#005dac]' : 'text-[#1e293b]'}>
                                {formatQNo(item.q_no)}
                              </span>
                              {!item.isCounted && (
                                <span className="ml-1 rounded bg-[#fff3e0] border border-[#ffe0b2] px-1 py-0.2 text-[9px] font-bold text-[#b26a00]">
                                  Not Counted
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] truncate max-w-[170px] text-[#64748b]">
                              {!item.resolved ? (
                                <span className="text-[#ba1a1a] font-medium flex items-center gap-1">
                                  <Flag className="w-2.5 h-2.5 shrink-0" /> {item.reason || 'Flagged for review'}
                                </span>
                              ) : (
                                <span className="text-[#196b22] font-medium flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5 shrink-0" /> Verified
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`font-bold block ${!item.resolved ? 'text-[#ba1a1a]' : 'text-[#196b22]'}`}>
                              {item.finalMarks} / {item.max_marks} M
                            </span>
                            <span className="text-[9px] text-[#64748b]">
                              {item.resolved ? 'Checked' : 'Flagged'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* PANE 2 (CENTER): Interactive Sheet Viewer with Auto-Page Jump & Bounding-Box Overlay */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-xs space-y-2">
          {/* Center Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#f1f5f9]">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#005dac]">Answer Sheet Viewer</span>
              {sheetPages.length > 1 && (
                <span className="text-[11px] text-[#64748b] font-medium">
                  (Page {activeSheetPage + 1} of {sheetPages.length})
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {sheetPages.length > 1 && (
                <div className="flex items-center gap-1 mr-1">
                  <button
                    type="button"
                    disabled={activeSheetPage <= 0}
                    onClick={() => setActiveSheetPage((p) => Math.max(0, p - 1))}
                    className="px-2 py-0.5 rounded border border-[#c1c6d4] bg-white text-xs disabled:opacity-40 hover:bg-[#f1f5f9]"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={activeSheetPage >= sheetPages.length - 1}
                    onClick={() => setActiveSheetPage((p) => Math.min(sheetPages.length - 1, p + 1))}
                    className="px-2 py-0.5 rounded border border-[#c1c6d4] bg-white text-xs disabled:opacity-40 hover:bg-[#f1f5f9]"
                  >
                    Next
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setStudentZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                className="rounded border border-[#c1c6d4] bg-white p-1 hover:bg-[#f1f5f9]"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5 text-[#005dac]" />
              </button>
              <span className="text-[10px] font-bold text-[#64748b] w-8 text-center">
                {Math.round(studentZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setStudentZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                className="rounded border border-[#c1c6d4] bg-white p-1 hover:bg-[#f1f5f9]"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5 text-[#005dac]" />
              </button>
              <button
                type="button"
                onClick={() => setStudentRotation((r) => (r + 90) % 360)}
                className="rounded border border-[#c1c6d4] bg-white px-2 py-1 text-xs font-semibold hover:bg-[#f1f5f9] flex items-center gap-1"
                title="Rotate Sheet 90°"
              >
                <RotateCw className="w-3 h-3 text-[#005dac]" /> {studentRotation}°
              </button>
            </div>
          </div>

          {/* Clickable Page Thumbnail Strip (if multiple pages) */}
          {sheetPages.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 border-b border-[#f1f5f9]">
              {sheetPages.map((pageUrl, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => setActiveSheetPage(pIdx)}
                  className={`shrink-0 rounded border p-0.5 transition-all ${
                    activeSheetPage === pIdx
                      ? 'border-[#005dac] ring-2 ring-[#005dac]/40 bg-[#eff4ff]'
                      : 'border-[#e2e8f0] opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={pageUrl}
                    alt={`Thumbnail ${pIdx + 1}`}
                    className="w-10 h-14 object-cover rounded-xs"
                  />
                  <span className="text-[9px] font-bold block text-center mt-0.5 text-[#64748b]">
                    P.{pIdx + 1}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Sheet Page Canvas Container with Bounding Box Overlay */}
          <div className="relative min-h-[560px] max-h-[720px] overflow-auto rounded-lg bg-[#f8f9ff] p-3 border border-[#e2e8f0] flex items-center justify-center">
            <div
              className="relative inline-block transition-transform duration-150"
              style={{
                transform: `rotate(${studentRotation}deg) scale(${studentZoom})`,
                transformOrigin: 'center center',
              }}
            >
              {sheetPages.length > 0 ? (
                <img
                  src={sheetPages[activeSheetPage]}
                  alt={`Student sheet page ${activeSheetPage + 1}`}
                  className="max-h-[660px] max-w-full object-contain rounded shadow-xs"
                />
              ) : studentPreview ? (
                <img
                  src={studentPreview}
                  alt="Student sheet preview"
                  className="max-h-[660px] max-w-full object-contain rounded shadow-xs"
                />
              ) : (
                <div className="text-xs text-[#64748b] p-8 text-center">Answer sheet image preview unavailable</div>
              )}

              {/* Bounding Box Highlight Overlay */}
              {selectedReviewItem?.bbox_json && Array.isArray(selectedReviewItem.bbox_json) && selectedReviewItem.bbox_json.length > 0 && (
                (() => {
                  const box = selectedReviewItem.bbox_json[0];
                  let top = 0, left = 0, width = 100, height = 25;
                  if (box && typeof box === 'object' && 'x' in box && 'y' in box && 'w' in box && 'h' in box) {
                    left = box.x <= 1.0 ? box.x * 100 : (box.x / 800) * 100;
                    top = box.y <= 1.0 ? box.y * 100 : (box.y / 1100) * 100;
                    width = box.w <= 1.0 ? box.w * 100 : (box.w / 800) * 100;
                    height = box.h <= 1.0 ? box.h * 100 : (box.h / 1100) * 100;
                  } else if (Array.isArray(box) && box.length === 4) {
                    const [b0, b1, b2, b3] = box;
                    if (Math.max(b0, b1, b2, b3) <= 1.0) {
                      top = b0 * 100;
                      left = b1 * 100;
                      height = (b2 - b0) * 100;
                      width = (b3 - b1) * 100;
                    }
                  }
                  return (
                    <div
                      className="pointer-events-none absolute rounded border-2 border-[#005dac] bg-[#005dac]/15 shadow-sm transition-all"
                      style={{
                        top: `${Math.max(0, top)}%`,
                        left: `${Math.max(0, left)}%`,
                        width: `${Math.min(100, width)}%`,
                        height: `${Math.min(100, height)}%`,
                      }}
                    >
                      <span className="absolute -top-4 left-0 rounded bg-[#005dac] px-1 py-0.2 text-[8px] font-bold text-white shadow-2xs">
                        {formatQNo(selectedReviewItem.q_no)}
                      </span>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>

        {/* PANE 3 (RIGHT): Selected Question Evaluation Card */}
        {selectedReviewItem ? (
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 shadow-xs space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2.5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#005dac] px-2 py-0.5 text-xs font-bold text-white">
                  {formatQNo(selectedReviewItem.q_no)}
                </span>
                <span className="text-xs font-bold text-[#1e293b]">
                  {selectedReviewItem.section_name || 'General'}
                </span>
                <span className="rounded bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">
                  {selectedReviewItem.max_marks} Marks
                </span>
              </div>

              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                selectedReviewItem.resolved
                  ? 'bg-[#e8f5e9] text-[#1b5e20]'
                  : 'bg-[#ffdad6] text-[#93000a]'
              }`}>
                {selectedReviewItem.resolved ? 'Checked' : 'Flagged'}
              </span>
            </div>

            {/* Flag Reason Alert */}
            {!selectedReviewItem.resolved && selectedReviewItem.reason && (
              <div className="rounded-lg border border-[#ba1a1a] bg-[#ffdad6] p-2.5 text-xs text-[#93000a] space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Flag Reason:</span>
                </div>
                <p className="text-[11px] leading-snug">{selectedReviewItem.reason}</p>
              </div>
            )}

            {/* Cropped Handwriting Image */}
            <div className="rounded-lg border border-[#c1c6d4]/70 bg-[#f8fafc] p-2 space-y-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#526071]">
                Handwriting Snippet (Page {(selectedReviewItem.page_numbers?.[0] ?? 0) + 1})
              </span>
              <div className="max-h-36 overflow-auto rounded bg-white border border-[#e2e8f0] p-1 flex items-center justify-center">
                <img
                  src={`/api/sheets/${currentSheetId}/crop/${selectedReviewItem.eval_id}`}
                  alt="Handwriting crop"
                  className="max-h-32 max-w-full object-contain mx-auto"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* Verbatim Transcript (Editable) */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#1e293b] flex items-center justify-between">
                <span>Raw Character-by-Character Transcript (Editable)</span>
                <span className="text-[10px] text-[#64748b] font-normal">Edit typos below</span>
              </label>
              <textarea
                value={editTranscript}
                onChange={(e) => setEditTranscript(e.target.value)}
                rows={3}
                className="w-full rounded border border-[#c1c6d4] p-2 text-xs font-mono bg-white focus:ring-1 focus:ring-[#005dac]"
              />
            </div>

            {/* Verified Evidence Quote */}
            {selectedReviewItem.evidence_quote && (
              <div className="rounded-lg border border-[#c8e6c9] bg-[#e8f5e9] p-2 text-xs text-[#196b22] space-y-0.5">
                <div className="font-bold flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Verified Evidence Quote:
                </div>
                <blockquote className="italic text-[11px] font-serif bg-white/70 p-1.5 rounded border border-[#c8e6c9]/50">
                  "{selectedReviewItem.evidence_quote}"
                </blockquote>
              </div>
            )}

            {/* Rubric Key-Point Breakdown */}
            {selectedReviewItem.key_points && selectedReviewItem.key_points.length > 0 && (
              <div className="rounded-lg border border-[#e2e8f0] bg-[#fafcff] p-2.5 space-y-1.5">
                <span className="text-[11px] font-bold text-[#005dac] block">
                  Rubric Breakdown ({selectedReviewItem.max_marks} M)
                </span>
                <div className="space-y-1">
                  {selectedReviewItem.key_points.map((kp, kpIdx) => (
                    <div key={kpIdx} className="rounded border border-[#e2e8f0] bg-white p-1.5 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-[#1e293b] flex-1 leading-snug">{kp.text}</span>
                        <span className="rounded bg-[#eff4ff] px-1.5 py-0.2 text-[10px] font-bold text-[#005dac] shrink-0">
                          {kp.marks} M
                        </span>
                      </div>
                      {kp.accept_if && (
                        <div className="text-[10px] text-[#196b22]"><strong className="text-[#2e7d32]">Accept:</strong> {kp.accept_if}</div>
                      )}
                      {kp.reject_if && (
                        <div className="text-[10px] text-[#ba1a1a]"><strong className="text-[#c62828]">Reject:</strong> {kp.reject_if}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Teacher Override Controls */}
            <div className="rounded-lg border border-[#c1c6d4] bg-[#f8fbff] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#1e293b]">Final Marks (0.5 steps)</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOverrideMarks((m) => Math.max(0, Number((m - 0.5).toFixed(1))))}
                    className="rounded border border-[#c1c6d4] bg-white p-1 hover:bg-[#e2e8f0]"
                    title="Decrease 0.5M"
                  >
                    <Minus className="w-3 h-3 text-[#005dac]" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={selectedReviewItem.max_marks}
                    step={0.5}
                    value={overrideMarks}
                    onChange={(e) => setOverrideMarks(Number(e.target.value) || 0)}
                    className="w-14 text-center font-bold text-[#005dac] text-sm border border-[#005dac] rounded py-0.5 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setOverrideMarks((m) => Math.min(selectedReviewItem.max_marks, Number((m + 0.5).toFixed(1))))}
                    className="rounded border border-[#c1c6d4] bg-white p-1 hover:bg-[#e2e8f0]"
                    title="Increase 0.5M"
                  >
                    <Plus className="w-3 h-3 text-[#005dac]" />
                  </button>
                  <span className="text-xs font-semibold text-[#64748b]">/ {selectedReviewItem.max_marks}</span>
                </div>
              </div>

              {/* Required reason when marks differ from AI suggested marks */}
              {overrideMarks !== (selectedReviewItem.suggested_marks ?? selectedReviewItem.finalMarks) && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#ba1a1a] block">
                    Teacher Override Reason (Required):
                  </label>
                  <input
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Accurate system call explanation provided"
                    className="w-full rounded border border-[#ba1a1a] px-2 py-1 text-xs bg-white"
                  />
                </div>
              )}

              {/* Count in Total Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-[#d4e3ff]">
                <div>
                  <span className="text-xs font-semibold text-[#004786] block">Count in Final Total</span>
                  <span className="text-[10px] text-[#64748b]">
                    {isCountedOverride ? 'Included in student score' : 'Optional / Extra answer excluded'}
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-[#005dac]">
                  <input
                    type="checkbox"
                    checked={isCountedOverride}
                    onChange={(e) => handleToggleCounted(selectedReviewItem, e.target.checked)}
                    className="w-4 h-4 rounded text-[#005dac]"
                  />
                  <span>{isCountedOverride ? 'Counted' : 'Not Counted'}</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleAcceptCurrent(selectedReviewItem)}
                className="flex-1 rounded-lg border border-[#196b22] bg-[#e8f5e9] py-2 text-xs font-bold text-[#196b22] hover:bg-[#c8e6c9] flex items-center justify-center gap-1 shadow-2xs"
                title="Accept AI suggested marks and move to next question [A]"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Accept AI ({selectedReviewItem.suggested_marks ?? selectedReviewItem.finalMarks}M) [A]</span>
              </button>
              <button
                type="button"
                onClick={() => handleOverrideCurrent(selectedReviewItem)}
                className="flex-1 rounded-lg bg-[#005dac] py-2 text-xs font-bold text-white hover:bg-[#004786] flex items-center justify-center gap-1 shadow-2xs"
                title="Save teacher overridden marks with required reason"
              >
                <span>Save Override</span>
              </button>
              <button
                type="button"
                onClick={() => handleLiveRecheck(selectedReviewItem)}
                className="rounded-lg border border-[#c1c6d4] bg-white p-2 text-[#005dac] hover:bg-[#eff4ff]"
                title="Live AI Recheck with edited transcript"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 text-center text-xs text-[#64748b]">
            Select a question from the left pane to review evaluation details.
          </div>
        )}
      </div>
    </section>
  );
};
