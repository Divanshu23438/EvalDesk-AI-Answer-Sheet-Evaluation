import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Filter,
  Flag,
  Layers,
  RefreshCw,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  type SetupStep,
  type UISheetSummary,
  formatBytes,
} from './types';

export interface SheetIntakeStepProps {
  step: SetupStep;
  setStep: (s: SetupStep) => void;
  currentPaperId: string;
  currentSheetId: string;
  setCurrentSheetId: (id: string) => void;
  studentFiles: File[];
  setStudentFiles: (files: File[]) => void;
  activeStudentIdx: number;
  setActiveStudentIdx: (idx: number) => void;
  hasConsent: boolean;
  setHasConsent: (c: boolean) => void;
  readNamesWithAi: boolean;
  setReadNamesWithAi: (r: boolean) => void;
  studentName: string;
  setStudentName: (n: string) => void;
  rollNo: string;
  setRollNo: (r: string) => void;
  isUploadingSheet: boolean;
  setIsUploadingSheet: (u: boolean) => void;
  needsIdentityPrompt: boolean;
  setNeedsIdentityPrompt: (p: boolean) => void;
  headerConfidence: number | null;
  setHeaderConfidence: (c: number | null) => void;
  evalStage: 'idle' | 'reading' | 'matching' | 'marking' | 'checking' | 'done' | 'error';
  setEvalStage: (s: 'idle' | 'reading' | 'matching' | 'marking' | 'checking' | 'done' | 'error') => void;
  stageProgress: number;
  setStageProgress: (p: number) => void;
  liveStageText: string;
  setLiveStageText: (t: string) => void;
  sheetStatus: string;
  setSheetStatus: (s: string) => void;
  errorMessage: string;
  setErrorMessage: (m: string) => void;
  sheetsList: UISheetSummary[];
  setSheetsList: React.Dispatch<React.SetStateAction<UISheetSummary[]>>;
  sheetStatusFilter: string;
  setSheetStatusFilter: (f: string) => void;
  sheetSearchQuery: string;
  setSheetSearchQuery: (q: string) => void;
  isBulkFinalizing: boolean;
  setIsBulkFinalizing: (b: boolean) => void;
  isFinalizing: boolean;
  loadSheetsList: (paperId: string) => Promise<void>;
  loadSheetReview: (sheetId: string) => Promise<void>;
  handleStudentSheetUpload: (files: File[]) => Promise<void>;
  handleSaveIdentityAndStart: () => Promise<void>;
  handleFinalizeSheet: (sheetId: string) => Promise<void>;
  handleDeleteSheet: (sheetId: string) => Promise<void>;
  handleRetryEvaluation: (sheetId: string) => Promise<void>;
  handleBulkFinalize: () => Promise<void>;
}

export const SheetIntakeStep: React.FC<SheetIntakeStepProps> = ({
  step,
  setStep,
  currentPaperId,
  currentSheetId,
  setCurrentSheetId,
  studentFiles,
  setStudentFiles,
  activeStudentIdx,
  setActiveStudentIdx,
  hasConsent,
  setHasConsent,
  readNamesWithAi,
  setReadNamesWithAi,
  studentName,
  setStudentName,
  rollNo,
  setRollNo,
  isUploadingSheet,
  needsIdentityPrompt,
  headerConfidence,
  evalStage,
  stageProgress,
  liveStageText,
  sheetStatus,
  errorMessage,
  sheetsList,
  sheetStatusFilter,
  setSheetStatusFilter,
  sheetSearchQuery,
  setSheetSearchQuery,
  isBulkFinalizing,
  isFinalizing,
  loadSheetsList,
  loadSheetReview,
  handleStudentSheetUpload,
  handleSaveIdentityAndStart,
  handleFinalizeSheet,
  handleDeleteSheet,
  handleRetryEvaluation,
  handleBulkFinalize,
}) => {
  const filteredSheets = useMemo(() => {
    return sheetsList.filter((s) => {
      if (sheetStatusFilter === 'flagged') {
        if (s.unresolved_flags_count === 0 && s.status !== 'needs_review') return false;
      } else if (sheetStatusFilter === 'completed') {
        if (s.status !== 'completed' && s.status !== 'evaluated') return false;
      } else if (sheetStatusFilter === 'queued') {
        if (s.status === 'completed' || s.status === 'evaluated') return false;
      }

      if (sheetSearchQuery.trim()) {
        const q = sheetSearchQuery.toLowerCase();
        const n = (s.student_name || '').toLowerCase();
        const r = (s.roll_number || '').toLowerCase();
        if (!n.includes(q) && !r.includes(q)) return false;
      }
      return true;
    });
  }, [sheetsList, sheetStatusFilter, sheetSearchQuery]);

  return (
    <>
      {/* ----------------- SCREEN 2: UPLOAD ANSWER SHEETS ----------------- */}
      {step === 'upload' && (
        <section className="space-y-4">
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4 mb-4">
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#005dac]" />
                  Upload Student Answer Sheets
                </h1>
                <p className="text-xs text-[#64748b]">
                  Batch-queue answer sheets, verify student name/roll number detection, and ensure consent.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={readNamesWithAi}
                    onChange={(e) => setReadNamesWithAi(e.target.checked)}
                    className="accent-[#005dac] w-3.5 h-3.5"
                  />
                  Read names with AI
                </label>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <label className="block rounded-xl border-2 border-dashed border-[#a5c8ff] bg-[#f8f9ff] p-6 text-center cursor-pointer hover:bg-[#eff4ff] transition-all">
                  <Upload className="w-8 h-8 text-[#005dac] mx-auto mb-2" />
                  <span className="font-bold text-sm text-[#005dac] block">
                    Click to choose student answer sheets (images or PDF)
                  </span>
                  <span className="text-xs text-[#64748b] block mt-1">
                    One upload per student (or select multiple files for batch queueing)
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const fl = Array.from(e.target.files || []);
                      if (fl.length > 0) {
                        setStudentFiles(fl);
                        handleStudentSheetUpload(fl);
                      }
                    }}
                  />
                </label>

                {/* Consent Checkbox */}
                <div className="rounded-lg border border-[#d4e3ff] bg-[#eff4ff] p-3 text-xs flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="consent"
                    checked={hasConsent}
                    onChange={(e) => setHasConsent(e.target.checked)}
                    className="mt-0.5 accent-[#005dac] w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="consent" className="cursor-pointer font-medium text-[#00325b]">
                    I have permission to process these sheets with external AI services. (Required for evaluation and training-data capture export)
                  </label>
                </div>

                {/* Queued Student List */}
                {studentFiles.length > 0 && (
                  <div className="rounded-lg border border-[#e2e8f0] p-3">
                    <div className="text-xs font-bold text-[#414752] mb-2">
                      Uploaded Sheets ({studentFiles.length})
                    </div>
                    <div className="space-y-1.5">
                      {studentFiles.map((file, idx) => (
                        <div
                          key={idx}
                          onClick={() => setActiveStudentIdx(idx)}
                          className={`p-2 rounded text-xs flex items-center justify-between cursor-pointer ${
                            activeStudentIdx === idx ? 'bg-[#d4e3ff] font-bold text-[#005dac]' : 'hover:bg-[#f1f5f9]'
                          }`}
                        >
                          <span>Sheet #{idx + 1} · {file.name}</span>
                          <span className="text-[11px] text-[#64748b]">{formatBytes(file.size)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Student Identity Box & Validation */}
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] p-4 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#005dac]">
                  Student Header Verification
                </h2>
                <p className="text-[11px] text-[#64748b]">
                  Evaluation starts automatically when header confidence is &gt;= 70%.
                </p>

                {isUploadingSheet && (
                  <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-[#eff4ff] border border-[#b9d3ff] text-xs font-bold text-[#005dac]">
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Scanning header with AI (Task T4)...</span>
                  </div>
                )}

                {needsIdentityPrompt && currentSheetId ? (
                  <>
                    <div className="rounded-lg border border-[#f57c00] bg-[#fff3e0] p-2.5 text-xs text-[#b26a00]">
                      <div className="font-bold flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-4 h-4" /> Header Verification Required
                      </div>
                      <p className="text-[11px]">
                        Header confidence was {headerConfidence !== null ? `${Math.round(headerConfidence * 100)}%` : 'unreadable'}. Please verify or enter student name and roll number below to proceed.
                      </p>
                    </div>

                    <div className={`p-3 rounded-lg border ${(!studentName || !rollNo) ? 'border-[#ba1a1a] bg-[#ffdad6]' : 'border-[#c1c6d4] bg-white'}`}>
                      <label className="text-[11px] font-bold block mb-1">Student Name *</label>
                      <input
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Enter student name"
                        className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 text-xs mb-2 font-medium"
                      />
                      <label className="text-[11px] font-bold block mb-1">Roll Number *</label>
                      <input
                        value={rollNo}
                        onChange={(e) => setRollNo(e.target.value)}
                        placeholder="e.g. BCA-2026-01"
                        className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 text-xs font-medium"
                      />
                      {(!studentName || !rollNo) && (
                        <span className="text-[10px] text-[#ba1a1a] font-bold block mt-1">
                          Manual entry required before evaluation can start.
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isUploadingSheet || !studentName.trim() || !rollNo.trim() || !hasConsent}
                      onClick={handleSaveIdentityAndStart}
                      className="w-full rounded-lg bg-[#005dac] px-4 py-3 text-xs font-bold text-white hover:bg-[#004786] disabled:opacity-40 shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Save Identity & Start Evaluation</span>
                    </button>
                  </>
                ) : !isUploadingSheet && (
                  <div className="p-3 rounded-lg border border-[#e2e8f0] bg-white text-xs text-[#64748b]">
                    Upload an answer sheet above. If the header is detected with high confidence (≥70%), evaluation begins automatically. If unreadable, you will be prompted here to enter identity.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Phase D: Batch Sheets Queue & Management Card */}
          {sheetsList.length > 0 && (
            <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#f1f5f9] pb-3">
                <div>
                  <h2 className="text-sm font-bold text-[#004786] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#005dac]" />
                    Class Answer Sheets Queue ({sheetsList.length} Sheets)
                  </h2>
                  <p className="text-xs text-[#526071]">
                    Batch-track student sheet processing status, unresolved flags, and bulk finalize clean sheets.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isBulkFinalizing || sheetsList.filter(s => s.status === 'completed' && s.unresolved_flags_count === 0).length === 0}
                    onClick={handleBulkFinalize}
                    className="rounded-lg bg-[#196b22] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#14531b] disabled:opacity-40 flex items-center gap-1.5 shadow-2xs"
                    title="Bulk finalize all completed sheets with zero unresolved flags"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isBulkFinalizing ? 'Finalizing...' : `Bulk Finalize (${sheetsList.filter(s => s.status === 'completed' && s.unresolved_flags_count === 0).length} Clean Sheets)`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSheetsList(currentPaperId)}
                    className="rounded-lg border border-[#c1c6d4] bg-white p-1.5 text-[#005dac] hover:bg-[#eff4ff]"
                    title="Refresh sheets list"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#64748b]" />
                  <span className="font-semibold text-[#64748b]">Filter:</span>
                  {(['all', 'flagged', 'completed', 'queued'] as const).map((filterKey) => (
                    <button
                      key={filterKey}
                      type="button"
                      onClick={() => setSheetStatusFilter(filterKey)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize transition-all ${
                        sheetStatusFilter === filterKey
                          ? 'bg-[#005dac] text-white shadow-2xs'
                          : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
                      }`}
                    >
                      {filterKey === 'flagged' ? 'Needs Review / Flagged' : filterKey}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-2.5 top-2" />
                  <input
                    value={sheetSearchQuery}
                    onChange={(e) => setSheetSearchQuery(e.target.value)}
                    placeholder="Search student or roll no..."
                    className="rounded-lg border border-[#c1c6d4] pl-8 pr-3 py-1 text-xs w-56"
                  />
                </div>
              </div>

              {/* Sheets Table */}
              <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8f9ff] text-[11px] font-bold text-[#64748b] border-b border-[#e2e8f0]">
                    <tr>
                      <th className="py-2.5 px-3">Roll No</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Flags</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {filteredSheets.map((sh) => (
                      <tr key={sh.id} className="hover:bg-[#f8fbff] transition-all">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#005dac]">{sh.roll_number || '—'}</td>
                        <td className="py-2.5 px-3 font-semibold text-[#1e293b]">{sh.student_name || 'Unnamed'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            sh.status === 'completed'
                              ? 'bg-[#e8f5e9] text-[#1b5e20]'
                              : sh.status === 'failed'
                              ? 'bg-[#ffdad6] text-[#93000a]'
                              : 'bg-[#eff4ff] text-[#005dac]'
                          }`}>
                            {sh.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#1e293b]">
                          {sh.total_score !== undefined ? `${sh.total_score} / ${sh.max_marks} M` : '—'}
                          {sh.grade && <span className="ml-1 text-[11px] font-semibold text-[#64748b]">({sh.grade})</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          {sh.unresolved_flags_count > 0 ? (
                            <span className="rounded bg-[#ffdad6] text-[#93000a] px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 w-fit">
                              <Flag className="w-3 h-3" /> {sh.unresolved_flags_count} Unresolved
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#196b22] font-semibold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> 0 Flags
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentSheetId(sh.id);
                              loadSheetReview(sh.id);
                              setStep('review');
                            }}
                            className="rounded border border-[#005dac] bg-[#eff4ff] px-2.5 py-1 text-[11px] font-bold text-[#005dac] hover:bg-[#dbe6f5]"
                          >
                            Review
                          </button>
                          <button
                            type="button"
                            disabled={sh.unresolved_flags_count > 0 || isFinalizing}
                            onClick={() => handleFinalizeSheet(sh.id)}
                            className="rounded border border-[#196b22] bg-white px-2 py-1 text-[11px] font-bold text-[#196b22] hover:bg-[#e8f5e9] disabled:opacity-40"
                            title={sh.unresolved_flags_count > 0 ? 'Resolve flags before finalizing' : 'Finalize sheet'}
                          >
                            Finalize
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSheet(sh.id)}
                            className="rounded border border-[#ba1a1a] bg-white p-1 text-[#ba1a1a] hover:bg-[#ffdad6]"
                            title="Delete sheet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ----------------- SCREEN 3: EVALUATION STATUS TRACKER ----------------- */}
      {step === 'status' && (
        <section className="max-w-2xl mx-auto rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm text-center space-y-6">
          <h1 className="text-xl font-bold text-[#005dac]">Live Evaluation Progress</h1>
          <p className="text-xs text-[#64748b]">
            Evaluating sheet for <strong>{studentName}</strong> ({rollNo})
          </p>

          {/* Stage Progress Bar */}
          <div className="w-full bg-[#f1f5f9] h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-[#005dac] h-full transition-all duration-300"
              style={{ width: `${stageProgress}%` }}
            />
          </div>

          {/* Stages Grid */}
          <div className="grid grid-cols-5 gap-2 text-[11px]">
            {[
              { key: 'reading', label: '1. Reading Pages' },
              { key: 'matching', label: '2. Matching Answers' },
              { key: 'marking', label: '3. Marking Rubric' },
              { key: 'checking', label: '4. Checking Flags' },
              { key: 'done', label: '5. Done' },
            ].map((st) => (
              <div
                key={st.key}
                className={`p-2.5 rounded-lg border ${
                  evalStage === st.key
                    ? 'border-[#005dac] bg-[#eff4ff] text-[#005dac] font-bold shadow-xs'
                    : stageProgress > 50
                    ? 'border-[#c8e6c9] bg-[#e8f5e9] text-[#196b22]'
                    : 'border-[#e2e8f0] text-[#64748b]'
                }`}
              >
                {st.label}
              </div>
            ))}
          </div>

          {evalStage === 'error' || sheetStatus === 'failed' ? (
            <div
              className={`rounded-lg border p-4 text-xs space-y-3 ${
                errorMessage.toLowerCase().includes('429') ||
                errorMessage.toLowerCase().includes('quota') ||
                errorMessage.toLowerCase().includes('rate limit')
                  ? 'border-[#f59e0b] bg-[#fffbeb] text-[#b45309]'
                  : 'border-[#ba1a1a] bg-[#ffdad6] text-[#93000a]'
              }`}
            >
              <div className="flex items-center justify-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {errorMessage.toLowerCase().includes('429') ||
                  errorMessage.toLowerCase().includes('quota') ||
                  errorMessage.toLowerCase().includes('rate limit')
                    ? 'AI Provider Quota / Rate Limit Reached (HTTP 429)'
                    : 'Evaluation Encountered an Error'}
                </span>
              </div>
              <div className="bg-white/80 p-2.5 rounded border border-current/20 font-mono text-[11px] text-left break-words">
                {errorMessage || 'External provider timed out or rate limit reached.'}
              </div>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => currentSheetId && handleRetryEvaluation(currentSheetId)}
                  className="rounded bg-[#005dac] px-5 py-2 font-bold text-white hover:bg-[#004786] flex items-center gap-2 transition-all cursor-pointer shadow-md text-xs"
                >
                  <RefreshCw className="w-4 h-4" /> Retry Evaluation
                </button>
                <button
                  type="button"
                  onClick={() => currentSheetId && handleDeleteSheet(currentSheetId)}
                  className="rounded border border-[#ba1a1a] bg-white px-3 py-2 font-bold text-[#ba1a1a] hover:bg-[#ffdad6] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Discard Sheet
                </button>
              </div>
            </div>
          ) : evalStage === 'done' ? (
            <div className="text-xs font-bold text-[#196b22] flex items-center justify-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Evaluation complete! Redirecting to review...
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#005dac] animate-pulse flex items-center justify-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{liveStageText || 'Processing in background · Zero frozen screen'}</span>
              </div>
              <div className="text-[11px] text-[#64748b]">
                Continuous live polling active · Evaluates questions in parallel
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
};
