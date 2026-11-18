import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { ReportTopBar } from '../components/report/ReportTopBar';
import { ReportBookletPreview } from '../components/report/ReportBookletPreview';
import { ReportOverviewTab } from '../components/report/ReportOverviewTab';
import { ReportQuestionTab } from '../components/report/ReportQuestionTab';
import { ReportAnalyticsTab } from '../components/report/ReportAnalyticsTab';
import { ReportBottomBar } from '../components/report/ReportBottomBar';
import {
  NormalizedQuestion,
  StudentReportData,
  PaperReportData,
  SheetListItem,
} from '../components/report/types';

export const ReportScreen: React.FC = () => {
  const [state, store] = useSheetStore();

  // Active tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'question' | 'analytics'>('overview');

  // Selected question and section filter
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  // UI scale and layout persistence
  const [uiScale, setUiScale] = useState<'A-' | 'A' | 'A+'>('A');
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
  const fetchStudentReport = useCallback(async (sheetId: string) => {
    if (!sheetId) return;
    try {
      const data = await apiClient.get<StudentReportData>(`/api/sheets/${sheetId}/report`);
      setStudentReport(data);
      return data;
    } catch (err: any) {
      console.error('Failed to fetch student report:', err);
      setErrorMessage(err.message || 'Failed to load student evaluation report');
      return null;
    }
  }, []);

  // 2. Fetch Review Data (contains per-question ocr_text, legibility, bbox, verdicts, flags)
  const fetchReviewData = useCallback(async (sheetId: string) => {
    if (!sheetId) return;
    try {
      const data = await apiClient.get<any>(`/api/sheets/${sheetId}/review`);
      setReviewData(data);
      return data;
    } catch (err: any) {
      console.warn('Failed to fetch review data:', err);
      return null;
    }
  }, []);

  // 3. Fetch Paper Sheets (for Sheet X of Y and Next Sheet navigation)
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

  // 4. Fetch Paper Reports (for real cohort average when evaluated_sheets.length >= 2)
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

  const getSheetIdFromUrl = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/#\/report\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    return null;
  }, []);

  // Initial load
  useEffect(() => {
    let active = true;

    const loadAll = async () => {
      const urlSheetId = getSheetIdFromUrl();
      const sId = state.sheetId || urlSheetId;
      if (!sId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const [sRep, rev] = await Promise.all([
        fetchStudentReport(sId),
        fetchReviewData(sId),
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
  }, [state.sheetId, state.paperId, getSheetIdFromUrl, fetchStudentReport, fetchReviewData, fetchPaperSheets, fetchPaperReports]);

  // Merge and normalize questions from review and report endpoints
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
    const idx = allSheets.findIndex((s) => s.id === state.sheetId);
    return idx >= 0 ? idx + 1 : 1;
  }, [allSheets, state.sheetId]);

  const nextSheet = useMemo(() => {
    if (!allSheets.length) return null;
    const currentIdx = allSheets.findIndex((s) => s.id === state.sheetId);
    if (currentIdx >= 0 && currentIdx < allSheets.length - 1) {
      return allSheets[currentIdx + 1];
    }
    return null;
  }, [allSheets, state.sheetId]);

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

  // Reset layout handler
  const handleResetLayout = () => {
    setSplitRatio(45);
    setZoom(100);
    setUiScale('A');
    localStorage.removeItem('evaldesk_report_split_ratio');
  };

  // Stepper navigation handlers
  const handleStepUpload = () => {
    store.setStep('upload');
    window.location.hash = '#/upload';
  };

  const handleStepEvaluate = () => {
    if (state.sheetId) {
      store.setStep('evaluate', state.sheetId);
      window.location.hash = `#/evaluate/${state.sheetId}`;
    } else {
      handleStepUpload();
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
    const sId = state.sheetId;
    if (!sId) return;

    setIsDownloadingPdf(true);
    try {
      let downloadUrl = studentReport?.pdf_url;
      if (!downloadUrl) {
        const fresh = await apiClient.get<StudentReportData>(`/api/sheets/${sId}/report`);
        downloadUrl = fresh.pdf_url;
      }
      if (downloadUrl) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `report_card_${studentReport?.roll_number || studentReport?.student_name || sId}.pdf`;
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

  // Scale class
  const scaleStyle = uiScale === 'A-' ? { fontSize: '0.92rem' } : uiScale === 'A+' ? { fontSize: '1.08rem' } : {};

  const dynamicFilename =
    reviewData?.sheet?.filename ||
    allSheets.find((s) => s.id === state.sheetId)?.filename ||
    (studentReport?.roll_number ? `${studentReport.roll_number}_booklet.pdf` : 'answer_sheet.pdf');

  return (
    <div
      className="app h-full w-full overflow-hidden bg-[#F8FAFC] font-sans text-[#0F172A] antialiased flex flex-col select-none"
      style={{
        height: '100%',
        maxHeight: '100%',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
        padding: 0,
        ...scaleStyle,
      }}
    >
      {/* 1. TOP BAR (48px height, locked uncluttered) */}
      <ReportTopBar
        paperTitle={studentReport?.paper_title || reviewData?.paper?.title || state.paperTitle || 'Examination'}
        studentName={studentReport?.student_name || reviewData?.sheet?.student_name || state.studentName || 'Student'}
        uiScale={uiScale}
        onSetUiScale={setUiScale}
        onResetLayout={handleResetLayout}
        onStepUpload={handleStepUpload}
        onStepEvaluate={handleStepEvaluate}
      />

      {/* 2. MAIN WORKSPACE (flex-1 h-full min-h-0) */}
      <main
        ref={containerRef}
        className="flex-1 flex min-h-0 overflow-hidden bg-[#F8FAFC] relative"
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          height: 'calc(100vh - 104px)',
          maxHeight: 'calc(100vh - 104px)',
          overflow: 'hidden',
          padding: '12px',
          gap: '10px',
        }}
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
            sheetId={state.sheetId}
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
          <div className="w-1 group-hover:w-1.5 h-16 bg-slate-300 group-hover:bg-indigo-500 rounded-full transition-all" />
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
          className="bg-white rounded-xl border border-slate-200 shadow-xs"
        >
          {/* Single-row Header Bar (h-12) */}
          <div className="h-12 border-b border-slate-200 px-4 flex items-center justify-between shrink-0 bg-white select-none">
            {/* Segmented Tab Buttons */}
            <div className="flex items-center space-x-1" role="tablist">
              <button
                aria-selected={activeTab === 'overview'}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
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
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
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
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setActiveTab('analytics')}
                role="tab"
                type="button"
              >
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="h-8 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All Questions ({normalizedQuestions.length})</option>
                {distinctSections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>

              <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-600">
                <button
                  onClick={handlePrevQuestion}
                  disabled={selectedQuestionIndex <= 0}
                  className="hover:text-indigo-600 px-0.5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Previous Question"
                  type="button"
                >
                  ‹
                </button>
                <span className="font-semibold text-slate-900 tabular-nums">
                  Q{activeQuestion?.q_no || selectedQuestionIndex + 1} / {normalizedQuestions.length || 1}
                </span>
                <button
                  onClick={handleNextQuestion}
                  disabled={selectedQuestionIndex >= normalizedQuestions.length - 1}
                  className="hover:text-indigo-600 px-0.5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-slate-500">Loading evaluation report...</span>
              </div>
            ) : errorMessage ? (
              <div className="h-full flex flex-col items-center justify-center p-8 space-y-2 text-center">
                <span className="text-rose-600 font-bold text-xs">{errorMessage}</span>
                <button
                  onClick={() => state.sheetId && fetchStudentReport(state.sheetId)}
                  className="px-3 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200 hover:bg-indigo-100"
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

      {/* 3. BOTTOM ACTION BAR (56px height, locked) */}
      <ReportBottomBar
        currentSheetIndex={currentSheetIndex}
        totalSheets={totalSheets}
        onBackToEvaluate={handleStepEvaluate}
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
