import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { ReportBookletPreview } from './report/ReportBookletPreview';
import { ReportOverviewTab } from './report/ReportOverviewTab';
import { ReportQuestionTab } from './report/ReportQuestionTab';
import { ReportAnalyticsTab } from './report/ReportAnalyticsTab';
import { ReportBottomBar } from './report/ReportBottomBar';
import {
  NormalizedQuestion,
  StudentReportData,
  PaperReportData,
  SheetListItem,
} from './report/types';

export interface StudentReportViewProps {
  sheetId: number | string;
  onBack?: () => void;
}

export const StudentReportView: React.FC<StudentReportViewProps> = ({
  sheetId,
  onBack,
}) => {
  const [state, store] = useSheetStore();

  const activeSheetId = String(sheetId || state.sheetId || '');

  // Active tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'question' | 'analytics'>('overview');

  // Selected question and section filter
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  // Split ratio persistence
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    const saved = localStorage.getItem('evaldesk_report_split_ratio');
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 25 && parsed <= 75) {
        return parsed;
      }
    }
    return 45;
  });

  // Booklet preview state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);

  // Data fetching states
  const [studentReport, setStudentReport] = useState<StudentReportData | null>(null);
  const [reviewData, setReviewData] = useState<any | null>(null);
  const [paperReport, setPaperReport] = useState<PaperReportData | null>(null);
  const [allSheets, setAllSheets] = useState<SheetListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Download loading states
  const [isDownloadingExcel, setIsDownloadingExcel] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Dragging state for resizable divider
  const isDraggingRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Student Report
  const fetchStudentReport = useCallback(async (sId: string) => {
    if (!sId) return;
    try {
      const data = await apiClient.get<StudentReportData>(`/api/sheets/${sId}/report`);
      setStudentReport(data);
      return data;
    } catch (err: any) {
      console.error('Failed to fetch student report:', err);
      setErrorMessage(err.message || 'Failed to load student evaluation report');
      return null;
    }
  }, []);

  // 2. Fetch Review Data
  const fetchReviewData = useCallback(async (sId: string) => {
    if (!sId) return;
    try {
      const data = await apiClient.get<any>(`/api/sheets/${sId}/review`);
      setReviewData(data);
      return data;
    } catch (err: any) {
      console.warn('Failed to fetch review data:', err);
      return null;
    }
  }, []);

  // 3. Fetch Paper Sheets
  const fetchPaperSheets = useCallback(async (paperId: string) => {
    if (!paperId) return;
    try {
      const data = await apiClient.get<{ sheets: SheetListItem[] }>(`/api/papers/${paperId}/sheets`);
      setAllSheets(data.sheets || []);
      return data.sheets || [];
    } catch (err: any) {
      console.warn('Failed to fetch paper sheets:', err);
      return [];
    }
  }, []);

  // 4. Fetch Paper Reports
  const fetchPaperReports = useCallback(async (paperId: string) => {
    if (!paperId) return;
    try {
      const data = await apiClient.get<PaperReportData>(`/api/papers/${paperId}/reports`);
      setPaperReport(data);
      return data;
    } catch (err: any) {
      console.warn('Paper reports cohort data error:', err);
      return null;
    }
  }, []);

  // Initial and reactive load whenever activeSheetId changes
  useEffect(() => {
    let active = true;

    const loadAll = async () => {
      if (!activeSheetId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const [sRep, rev] = await Promise.all([
        fetchStudentReport(activeSheetId),
        fetchReviewData(activeSheetId),
      ]);

      if (!active) return;

      const pId = sRep?.paper_id || rev?.paper?.id || state.paperId;
      if (pId) {
        await Promise.all([
          fetchPaperSheets(pId),
          fetchPaperReports(pId),
        ]);
      }

      if (active) {
        setIsLoading(false);
      }
    };

    loadAll();

    return () => {
      active = false;
    };
  }, [activeSheetId, state.paperId, fetchStudentReport, fetchReviewData, fetchPaperSheets, fetchPaperReports]);

  // Reset question index and booklet page when sheetId changes
  useEffect(() => {
    setSelectedQuestionIndex(0);
    setCurrentPage(1);
  }, [activeSheetId]);

  // Normalize questions from review and report endpoints
  const normalizedQuestions: NormalizedQuestion[] = useMemo(() => {
    const evals = reviewData?.evaluations || [];
    const repQuestions = studentReport?.questions || [];

    if (evals.length > 0) {
      return evals.map((e: any, idx: number) => {
        const repMatch = repQuestions.find(
          (rq: any) => rq.question_id === e.question_id || rq.eval_id === e.eval_id
        );

        let parsedPages: number[] = [1];
        if (Array.isArray(e.page_numbers) && e.page_numbers.length > 0) {
          parsedPages = e.page_numbers.map((p: any) => {
            const num = parseInt(p, 10);
            return isNaN(num) ? 1 : num === 0 ? 1 : num;
          });
        } else if (repMatch?.page_numbers) {
          try {
            const raw = typeof repMatch.page_numbers === 'string'
              ? JSON.parse(repMatch.page_numbers)
              : repMatch.page_numbers;
            if (Array.isArray(raw) && raw.length > 0) {
              parsedPages = raw.map((p: any) => {
                const num = parseInt(p, 10);
                return isNaN(num) ? 1 : num === 0 ? 1 : num;
              });
            }
          } catch {
            parsedPages = [1];
          }
        }

        const legVal = typeof e.legibility === 'number'
          ? e.legibility
          : typeof e.legibility_score === 'number'
          ? e.legibility_score
          : 0.94;

        return {
          eval_id: e.eval_id || `eval_${idx}`,
          question_id: e.question_id || `q_${idx}`,
          question_key: e.key || e.question_key || `Q${idx + 1}`,
          q_no: e.q_no || idx + 1,
          question_text: e.text || e.question_text || repMatch?.question_text || `Question ${idx + 1}`,
          section_name: e.section_name || repMatch?.section_name || '',
          question_type: e.question_type || repMatch?.question_type || '',
          max_marks: e.max_marks ?? repMatch?.max_marks ?? 1,
          ai_marks: e.ai_marks ?? repMatch?.ai_marks,
          final_marks: e.final_marks ?? repMatch?.final_marks ?? 0,
          reason: e.reason || repMatch?.reason || '',
          evidence_quote: e.evidence_quote || repMatch?.evidence_quote || '',
          is_counted: e.is_counted !== undefined ? Boolean(e.is_counted) : true,
          flags: Array.isArray(e.flags) ? e.flags : [],
          resolved: e.resolved ?? repMatch?.resolved ?? 1,
          strictness_used: e.strictness_used || reviewData?.paper?.strictness_level || studentReport?.paper_strictness || 3,
          page_numbers: parsedPages,
          bbox: e.bbox || e.bbox_json || repMatch?.bbox_json || null,
          ocr_text: e.ocr_text || e.extracted_text || repMatch?.extracted_text || '',
          legibility: legVal,
          reference: e.reference || {
            source: 'Model Key',
            model_answer: e.model_answer || '',
            key_points: e.key_points || [],
          },
          verdicts: Array.isArray(e.verdicts) ? e.verdicts : [],
        };
      });
    }

    if (repQuestions.length > 0) {
      return repQuestions.map((rq: any, idx: number) => {
        let parsedPages: number[] = [1];
        if (rq.page_numbers) {
          try {
            const raw = typeof rq.page_numbers === 'string' ? JSON.parse(rq.page_numbers) : rq.page_numbers;
            if (Array.isArray(raw) && raw.length > 0) {
              parsedPages = raw.map((p: any) => {
                const num = parseInt(p, 10);
                return isNaN(num) ? 1 : num === 0 ? 1 : num;
              });
            }
          } catch {
            parsedPages = [1];
          }
        }

        return {
          eval_id: rq.eval_id || `eval_${idx}`,
          question_id: rq.question_id || `q_${idx}`,
          question_key: rq.question_key || `Q${idx + 1}`,
          q_no: rq.q_no || idx + 1,
          question_text: rq.question_text || `Question ${idx + 1}`,
          section_name: rq.section_name || '',
          question_type: rq.question_type || '',
          max_marks: rq.max_marks || 1,
          ai_marks: rq.ai_marks,
          final_marks: rq.final_marks || 0,
          reason: rq.reason || '',
          evidence_quote: rq.evidence_quote || '',
          is_counted: rq.is_counted !== undefined ? Boolean(rq.is_counted) : true,
          flags: [],
          resolved: rq.resolved ?? 1,
          strictness_used: rq.strictness_used || studentReport?.paper_strictness || 3,
          page_numbers: parsedPages,
          bbox: rq.bbox_json || null,
          ocr_text: rq.extracted_text || '',
          legibility: 0.94,
          reference: {
            source: 'Model Key',
            model_answer: '',
            key_points: [],
          },
          verdicts: [],
        };
      });
    }

    return [];
  }, [reviewData, studentReport]);

  // Filter questions based on section dropdown
  const filteredQuestions = useMemo(() => {
    if (sectionFilter === 'all') return normalizedQuestions;
    return normalizedQuestions.filter(
      (q) => q.section_name?.trim().toLowerCase() === sectionFilter.trim().toLowerCase()
    );
  }, [normalizedQuestions, sectionFilter]);

  // Real paper sections for dropdown
  const distinctSections = useMemo(() => {
    const set = new Set<string>();
    normalizedQuestions.forEach((q) => {
      if (q.section_name?.trim()) {
        set.add(q.section_name.trim());
      }
    });
    return Array.from(set);
  }, [normalizedQuestions]);

  // Current active question
  const activeQuestion = normalizedQuestions[selectedQuestionIndex] || normalizedQuestions[0] || null;
  const targetPage = activeQuestion?.page_numbers?.[0];

  // Jump left preview page when selected question changes
  useEffect(() => {
    if (targetPage && targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }
  }, [targetPage, currentPage]);

  // Sheet counting & navigation
  const totalSheets = allSheets.length || 1;
  const currentSheetIndex = useMemo(() => {
    const idx = allSheets.findIndex((s) => s.id === activeSheetId);
    return idx >= 0 ? idx + 1 : 1;
  }, [allSheets, activeSheetId]);

  const nextSheet = useMemo(() => {
    if (!allSheets.length) return null;
    const currentIdx = allSheets.findIndex((s) => s.id === activeSheetId);
    if (currentIdx >= 0 && currentIdx < allSheets.length - 1) {
      return allSheets[currentIdx + 1];
    }
    return null;
  }, [allSheets, activeSheetId]);

  const isLastSheet = !nextSheet;

  // Total pages count
  const totalPages = useMemo(() => {
    if (reviewData?.pages && Array.isArray(reviewData.pages) && reviewData.pages.length > 0) {
      return reviewData.pages.length;
    }
    let maxP = 1;
    normalizedQuestions.forEach((q) => {
      (q.page_numbers || []).forEach((p) => {
        if (p > maxP) maxP = p;
      });
    });
    return maxP;
  }, [reviewData, normalizedQuestions]);

  // Evaluated sheets count for cohort avg calculation
  const evaluatedSheetsCount = useMemo(() => {
    return allSheets.filter(
      (s) => s.status === 'evaluated' || s.status === 'finalized'
    ).length;
  }, [allSheets]);

  // Draggable divider handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(25, Math.min(75, newRatio));
      setSplitRatio(clamped);
      localStorage.setItem('evaldesk_report_split_ratio', clamped.toFixed(1));
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Back handler
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (activeSheetId) {
      store.setStep('evaluate', activeSheetId);
      window.location.hash = `#/evaluate/${activeSheetId}`;
    } else {
      store.setStep('upload');
      window.location.hash = '#/upload';
    }
  };

  // Next Question / Prev Question switcher
  const handlePrevQuestion = () => {
    if (selectedQuestionIndex > 0) {
      setSelectedQuestionIndex((i) => i - 1);
    }
  };

  const handleNextQuestion = () => {
    if (selectedQuestionIndex < normalizedQuestions.length - 1) {
      setSelectedQuestionIndex((i) => i + 1);
    }
  };

  // File downloads
  const handleDownloadExcel = async () => {
    const pId = state.paperId || studentReport?.paper_id;
    if (!pId) return;

    setIsDownloadingExcel(true);
    try {
      let downloadUrl = paperReport?.excel_report_url;
      if (!downloadUrl) {
        const fresh = await apiClient.get<PaperReportData>(`/api/papers/${pId}/reports`);
        downloadUrl = fresh.excel_report_url;
      }
      if (downloadUrl) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${studentReport?.paper_title || 'paper'}_results.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      console.error('Failed to download Excel report:', err);
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!activeSheetId) return;

    setIsDownloadingPdf(true);
    try {
      let downloadUrl = studentReport?.pdf_url;
      if (!downloadUrl) {
        const fresh = await apiClient.get<StudentReportData>(`/api/sheets/${activeSheetId}/report`);
        downloadUrl = fresh.pdf_url;
      }
      if (downloadUrl) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `report_card_${studentReport?.roll_number || studentReport?.student_name || activeSheetId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      console.error('Failed to download PDF report:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Next Sheet navigation
  const handleNextSheetNav = () => {
    if (!nextSheet) return;
    store.setSheet(nextSheet.id, nextSheet.student_name, nextSheet.roll);
    if (nextSheet.status === 'evaluated' || nextSheet.status === 'finalized') {
      store.setStep('report', nextSheet.id);
      window.location.hash = `#/report/${nextSheet.id}`;
    } else {
      store.setStep('evaluate', nextSheet.id);
      window.location.hash = `#/evaluate/${nextSheet.id}`;
    }
  };

  const dynamicFilename =
    reviewData?.sheet?.filename ||
    allSheets.find((s) => s.id === activeSheetId)?.filename ||
    (studentReport?.roll_number ? `${studentReport.roll_number}_booklet.pdf` : 'answer_sheet.pdf');

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden bg-[#F6F7F5] dark:bg-[#111312]">
      {/* MAIN WORKSPACE (flex-1 h-full min-h-0) */}
      <main
        ref={containerRef}
        className="flex-1 flex min-h-0 overflow-hidden bg-[#F6F7F5] dark:bg-[#111312] relative p-3 gap-2.5"
      >
        {/* ==================== LEFT PANE (Answer Booklet Preview) ==================== */}
        <section
          style={{
            width: `calc(${splitRatio}% - 6px)`,
            height: '100%',
            maxHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ReportBookletPreview
            sheetId={activeSheetId}
            filename={dynamicFilename}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            activeQuestion={activeQuestion}
            zoom={zoom}
            onZoomChange={setZoom}
            onFitZoom={() => setZoom(100)}
          />
        </section>

        {/* Draggable Vertical Divider Handle */}
        <div
          onMouseDown={handleMouseDown}
          className="w-2 hover:w-2.5 -mx-1 flex items-center justify-center cursor-col-resize z-20 group transition-all shrink-0 self-stretch"
          title="Drag to resize panes"
        >
          <div className="w-1 group-hover:w-1.5 h-16 bg-[#E2E8E4] dark:bg-[#2A2F2C] group-hover:bg-[#0F5132] dark:group-hover:bg-[#1F6E4A] rounded-full transition-all" />
        </div>

        {/* ==================== RIGHT PANE (Overview, Questions, Analytics) ==================== */}
        <section
          style={{
            width: `calc(${100 - splitRatio}% - 6px)`,
            height: '100%',
            maxHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          className="bg-white dark:bg-[#181B19] rounded-xl border border-[#E2E8E4] dark:border-[#2A2F2C]"
        >
          {/* Single-row Header Bar (h-12) */}
          <div className="h-12 border-b border-[#E2E8E4] dark:border-[#2A2F2C] px-4 flex items-center justify-between shrink-0 bg-white dark:bg-[#181B19] select-none">
            {/* Segmented Tab Buttons */}
            <div className="flex items-center space-x-1" role="tablist">
              <button
                aria-selected={activeTab === 'overview'}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-[#E8F3EE] text-[#0F5132] dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border dark:border-[#294236]'
                    : 'text-[#4B5563] hover:text-[#111827] dark:text-[#969E9A] dark:hover:text-[#ECEEED]'
                }`}
                onClick={() => setActiveTab('overview')}
                role="tab"
                type="button"
              >
                Overview
              </button>
              <button
                aria-selected={activeTab === 'question'}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'question'
                    ? 'bg-[#E8F3EE] text-[#0F5132] dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border dark:border-[#294236]'
                    : 'text-[#4B5563] hover:text-[#111827] dark:text-[#969E9A] dark:hover:text-[#ECEEED]'
                }`}
                onClick={() => setActiveTab('question')}
                role="tab"
                type="button"
              >
                Question-wise Marks
              </button>
              <button
                aria-selected={activeTab === 'analytics'}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-[#E8F3EE] text-[#0F5132] dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border dark:border-[#294236]'
                    : 'text-[#4B5563] hover:text-[#111827] dark:text-[#969E9A] dark:hover:text-[#ECEEED]'
                }`}
                onClick={() => setActiveTab('analytics')}
                role="tab"
                type="button"
              >
                <svg className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#68706C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                <span>Analytics &amp; Charts</span>
              </button>
            </div>

            {/* Right: Section Filter Dropdown & Quick Switcher */}
            <div className="flex items-center space-x-2">
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="h-8 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg px-2.5 text-[#111827] dark:text-[#ECEEED] font-medium focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none cursor-pointer"
              >
                <option value="all">All Questions ({normalizedQuestions.length})</option>
                {distinctSections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>

              <div className="flex items-center space-x-1 bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg px-2 py-1 text-xs font-mono text-[#4B5563] dark:text-[#969E9A]">
                <button
                  onClick={handlePrevQuestion}
                  disabled={selectedQuestionIndex <= 0}
                  className="hover:text-[#0F5132] dark:hover:text-[#7CC9A3] px-0.5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Previous Question"
                  type="button"
                >
                  ‹
                </button>
                <span className="font-semibold text-[#111827] dark:text-[#ECEEED] tabular-nums">
                  Q{activeQuestion?.q_no || selectedQuestionIndex + 1} / {normalizedQuestions.length || 1}
                </span>
                <button
                  onClick={handleNextQuestion}
                  disabled={selectedQuestionIndex >= normalizedQuestions.length - 1}
                  className="hover:text-[#0F5132] dark:hover:text-[#7CC9A3] px-0.5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Next Question"
                  type="button"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          {/* Tab Content Area */}
          <div
            className="flex-1 overflow-hidden relative"
            style={{ flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}
          >
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center p-8 space-y-3">
                <div className="w-6 h-6 border-2 border-[#0F5132] dark:border-[#1F6E4A] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-[#6B7280] dark:text-[#68706C]">Loading evaluation report...</span>
              </div>
            ) : errorMessage ? (
              <div className="h-full flex flex-col items-center justify-center p-8 space-y-2 text-center">
                <span className="text-rose-600 dark:text-[#E57D8A] font-bold text-xs">{errorMessage}</span>
                <button
                  onClick={() => activeSheetId && fetchStudentReport(activeSheetId)}
                  className="px-3 py-1 rounded bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] text-xs font-semibold border border-[#0F5132]/20 dark:border-[#294236] hover:bg-[#d8eade] cursor-pointer"
                >
                  Retry Loading
                </button>
              </div>
            ) : (
              <>
                {/* Tab 1: Overview */}
                {activeTab === 'overview' && (
                  <ReportOverviewTab
                    studentReport={studentReport}
                    paperReport={paperReport}
                    questions={filteredQuestions}
                    evaluatedSheetsCount={evaluatedSheetsCount}
                    onSelectQuestion={(idx) => {
                      setSelectedQuestionIndex(idx);
                      setActiveTab('question');
                    }}
                  />
                )}

                {/* Tab 2: Question-wise Marks */}
                {activeTab === 'question' && (
                  <ReportQuestionTab question={activeQuestion} />
                )}

                {/* Tab 3: Analytics & Charts */}
                {activeTab === 'analytics' && (
                  <ReportAnalyticsTab
                    studentReport={studentReport}
                    paperReport={paperReport}
                    questions={normalizedQuestions}
                    evaluatedSheetsCount={evaluatedSheetsCount}
                    selectedQuestionIndex={selectedQuestionIndex}
                    onSelectQuestion={(idx) => {
                      setSelectedQuestionIndex(idx);
                      setActiveTab('question');
                    }}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {/* BOTTOM ACTION BAR (56px height, locked) */}
      <ReportBottomBar
        currentSheetIndex={currentSheetIndex}
        totalSheets={totalSheets}
        onBackToEvaluate={handleBack}
        onDownloadExcel={handleDownloadExcel}
        onDownloadPdf={handleDownloadPdf}
        onNextSheet={handleNextSheetNav}
        isDownloadingExcel={isDownloadingExcel}
        isDownloadingPdf={isDownloadingPdf}
        isLastSheet={isLastSheet}
      />
    </div>
  );
};
