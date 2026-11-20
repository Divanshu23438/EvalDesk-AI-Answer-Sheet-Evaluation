import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiClient } from '../api/client';
import { StudentReportCard } from '../components/StudentReportCard';
import {
  FileSpreadsheet,
  Filter,
  ArrowRight,
  ArrowLeft,
  Search,
  X,
  Calendar,
  CheckSquare,
  Square,
  Download,
  Users,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

interface PaperItem {
  id: string;
  title: string;
  subject: string;
  subject_code?: string;
  total_marks?: number;
}

interface EvaluatedSheetItem {
  id: string;
  paper_id: string;
  student_name: string;
  roll_number: string;
  class_name?: string;
  subject?: string;
  exam_title?: string;
  score: number;
  max_marks: number;
  percentage: number;
  grade: string;
  status: string;
  evaluated_at?: string;
  created_at?: string;
}

interface CompareResponse {
  students: Array<{
    sheet_id: string;
    paper_id: string;
    student_name: string;
    roll_number: string;
    class_name: string;
    subject: string;
    paper_title: string;
    total_score: number;
    max_marks: number;
    percentage: number;
    grade: string;
    rank: number;
  }>;
  questions: Array<{
    question_id: string;
    q_no: string | number;
    question_text: string;
    max_marks: number;
    section_name: string;
    order_idx: number;
  }>;
  matrix: Record<string, Record<string, number>>;
}

export const ReportsCenterScreen: React.FC = () => {
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [evaluatedSheets, setEvaluatedSheets] = useState<EvaluatedSheetItem[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string>('all');
  const [selectedClassName, setSelectedClassName] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Multi-select state
  const [selectedSheetIds, setSelectedSheetIds] = useState<Set<string>>(new Set());

  // View mode: 'directory' | 'stepper' | 'compare'
  const [viewMode, setViewMode] = useState<'directory' | 'stepper' | 'compare'>('directory');

  // Stepper state
  const [stepperList, setStepperList] = useState<EvaluatedSheetItem[]>([]);
  const [stepperIndex, setStepperIndex] = useState<number>(0);

  // Compare state
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // Bulk download dropdown open state & loading state
  const [isBulkDropdownOpen, setIsBulkDropdownOpen] = useState<boolean>(false);
  const [isDownloadingBulk, setIsDownloadingBulk] = useState<boolean>(false);
  const [bulkDownloadStatus, setBulkDownloadStatus] = useState<string | null>(null);

  // Parse initial sheetId from URL query param if present
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkUrlSheetId = () => {
      const searchParams = new URLSearchParams(window.location.search);
      let qSheet = searchParams.get('sheetId');
      if (!qSheet && window.location.hash) {
        const hash = window.location.hash;
        const hashQueryIdx = hash.indexOf('?');
        if (hashQueryIdx !== -1) {
          const hashParams = new URLSearchParams(hash.slice(hashQueryIdx));
          qSheet = hashParams.get('sheetId');
        }
      }
      return qSheet;
    };

    const targetId = checkUrlSheetId();
    if (targetId && evaluatedSheets.length > 0) {
      const match = evaluatedSheets.find((s) => s.id === targetId);
      if (match) {
        setStepperList([match]);
        setStepperIndex(0);
        setViewMode('stepper');
      }
    }
  }, [evaluatedSheets]);

  // Load papers and evaluated sheets
  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const [papersRes, historyRes] = await Promise.all([
          apiClient.get<{ papers: PaperItem[] }>('/api/papers').catch(() => ({ papers: [] })),
          apiClient.get<{ sheets: any[] }>('/api/sheets/history').catch(() => ({ sheets: [] })),
        ]);

        if (isCancelled) return;

        const paperList = papersRes.papers || [];
        setPapers(paperList);

        const allSheets: EvaluatedSheetItem[] = (historyRes.sheets || [])
          .filter((s: any) => s.status === 'evaluated')
          .map((s: any) => ({
            id: s.id,
            paper_id: s.paper_id,
            student_name: s.student_name || 'Unnamed Student',
            roll_number: s.roll_number || '—',
            class_name: s.class_name || '',
            subject: s.subject || '',
            exam_title: s.exam_title || '',
            score: typeof s.score === 'number' ? s.score : parseFloat(s.score || '0'),
            max_marks: typeof s.max_marks === 'number' ? s.max_marks : parseFloat(s.max_marks || '100'),
            percentage: typeof s.percentage === 'number' ? s.percentage : parseFloat(s.percentage || '0'),
            grade: s.grade || '—',
            status: s.status,
            evaluated_at: s.evaluated_at,
            created_at: s.created_at,
          }));

        setEvaluatedSheets(allSheets);
      } catch (err) {
        console.error('Failed to load reports center data:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Map of paper ID to PaperItem
  const paperMap = useMemo(() => {
    const map: Record<string, PaperItem> = {};
    papers.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [papers]);

  // Unique Classes dynamically extracted from evaluated sheets
  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    evaluatedSheets.forEach((s) => {
      if (s.class_name && s.class_name.trim()) {
        set.add(s.class_name.trim());
      }
    });
    return Array.from(set).sort();
  }, [evaluatedSheets]);

  // Sheets filtered by paper, class, and multi-search query (comma-separated support)
  const filteredSheets = useMemo(() => {
    const terms = searchQuery
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    return evaluatedSheets.filter((s) => {
      const matchesPaper = selectedPaperId === 'all' || s.paper_id === selectedPaperId;
      if (!matchesPaper) return false;

      const matchesClass =
        selectedClassName === 'all' ||
        (s.class_name || '').toLowerCase() === selectedClassName.toLowerCase();
      if (!matchesClass) return false;

      if (terms.length === 0) return true;

      const studentName = (s.student_name || '').toLowerCase();
      const rollNumber = (s.roll_number || '').toLowerCase();
      const examTitle = (s.exam_title || paperMap[s.paper_id]?.title || '').toLowerCase();
      const subject = (s.subject || paperMap[s.paper_id]?.subject || '').toLowerCase();
      const className = (s.class_name || '').toLowerCase();

      return terms.some(
        (term) =>
          studentName.includes(term) ||
          rollNumber.includes(term) ||
          examTitle.includes(term) ||
          subject.includes(term) ||
          className.includes(term)
      );
    });
  }, [evaluatedSheets, selectedPaperId, selectedClassName, searchQuery, paperMap]);

  // Helper for grade pill styling
  const getGradeBadgeClass = (grade: string) => {
    if (grade === 'O' || grade.startsWith('A')) {
      return 'bg-emerald-100 dark:bg-[#1A2B23] text-emerald-800 dark:text-[#7CC9A3] border border-emerald-200 dark:border-[#294236]';
    }
    if (grade.startsWith('B')) {
      return 'bg-teal-100 dark:bg-[#1B2929] text-teal-800 dark:text-[#3A7D8C] border border-teal-200 dark:border-[#204040]';
    }
    if (grade === 'F' || grade === 'Needs Support') {
      return 'bg-rose-100 dark:bg-[#2B191D] text-rose-800 dark:text-[#E57D8A] border border-rose-200 dark:border-[#45262C]';
    }
    return 'bg-amber-100 dark:bg-[#2B2416] text-amber-800 dark:text-[#E5B567] border border-amber-200 dark:border-[#42361F]';
  };

  // Toggle selection of individual sheet
  const toggleSelectSheet = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedSheetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Master toggle: Select/Deselect All Matching
  const isAllFilteredSelected =
    filteredSheets.length > 0 && filteredSheets.every((s) => selectedSheetIds.has(s.id));

  const toggleSelectAllFiltered = () => {
    setSelectedSheetIds((prev) => {
      const next = new Set(prev);
      if (isAllFilteredSelected) {
        filteredSheets.forEach((s) => next.delete(s.id));
      } else {
        filteredSheets.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedSheetIds(new Set());
  };

  // Action: Open Sequential Stepper for Selected Students
  const handleStartStepper = useCallback((targetList?: EvaluatedSheetItem[]) => {
    const list =
      targetList ||
      evaluatedSheets.filter((s) => selectedSheetIds.has(s.id));
    if (list.length === 0) return;
    setStepperList(list);
    setStepperIndex(0);
    setViewMode('stepper');
  }, [evaluatedSheets, selectedSheetIds]);

  // Action: Open Single Student Report Card
  const handleOpenSingleStudent = (student: EvaluatedSheetItem) => {
    setStepperList([student]);
    setStepperIndex(0);
    setViewMode('stepper');
  };

  // Action: Open Side-by-Side Comparison
  const handleOpenCompare = async () => {
    const targetSheets = evaluatedSheets.filter((s) => selectedSheetIds.has(s.id));
    if (targetSheets.length < 2 || targetSheets.length > 10) return;

    try {
      setIsComparing(true);
      const res = await apiClient.post<CompareResponse>('/api/sheets/compare', {
        sheet_ids: targetSheets.map((s) => s.id),
      });
      setCompareData(res);
      setViewMode('compare');
    } catch (err) {
      console.error('Failed to load comparison data:', err);
    } finally {
      setIsComparing(false);
    }
  };

  // Action: Bulk Export Handler
  const handleBulkExport = async (type: 'zip' | 'merged-pdf' | 'consolidated-xlsx' | 'consolidated-pdf') => {
    const sheetIds = Array.from(selectedSheetIds);
    if (sheetIds.length === 0) return;

    try {
      setIsDownloadingBulk(true);
      setIsBulkDropdownOpen(false);
      setBulkDownloadStatus('Preparing download...');

      let endpoint = '';
      let payload: any = {};
      let defaultFilename = '';

      if (type === 'zip') {
        endpoint = '/api/sheets/export/batch-reports';
        payload = { sheet_ids: sheetIds, format: 'zip' };
        defaultFilename = 'batch_student_reports.zip';
      } else if (type === 'merged-pdf') {
        endpoint = '/api/sheets/export/batch-reports';
        payload = { sheet_ids: sheetIds, format: 'pdf' };
        defaultFilename = 'consolidated_student_reports.pdf';
      } else if (type === 'consolidated-xlsx') {
        endpoint = '/api/sheets/export/consolidated';
        payload = { sheet_ids: sheetIds, format: 'xlsx' };
        defaultFilename = 'consolidated_results.xlsx';
      } else if (type === 'consolidated-pdf') {
        endpoint = '/api/sheets/export/consolidated';
        payload = { sheet_ids: sheetIds, format: 'pdf' };
        defaultFilename = 'consolidated_class_marksheet.pdf';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setBulkDownloadStatus('Download complete!');
      setTimeout(() => setBulkDownloadStatus(null), 2500);
    } catch (err) {
      console.error('Failed to perform bulk export:', err);
      setBulkDownloadStatus('Download failed');
      setTimeout(() => setBulkDownloadStatus(null), 3000);
    } finally {
      setIsDownloadingBulk(false);
    }
  };

  // Compare chart data preparation
  const comparisonChartData = useMemo(() => {
    if (!compareData || !compareData.students) return [];
    return compareData.students.map((st) => ({
      name: st.student_name,
      roll: st.roll_number,
      percentage: Number(st.percentage.toFixed(1)),
      score: st.total_score,
      max: st.max_marks,
    }));
  }, [compareData]);

  // Current active student in Stepper
  const currentStepperStudent = stepperList[stepperIndex] || null;

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col bg-[#F6F7F5] dark:bg-[#111312] overflow-hidden select-text">
      {/* Loading state */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-3">
          <div className="w-8 h-8 border-2 border-[#0F5132] dark:border-[#1F6E4A] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono font-medium text-[#6B7280] dark:text-[#68706C]">
            Loading student report cards...
          </span>
        </div>
      ) : viewMode === 'stepper' && currentStepperStudent ? (
        /* ========================================================================= */
        /* VIEW MODE: STEPPER (One-by-One Report Card Stepper View)                   */
        /* ========================================================================= */
        <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
          {/* Top Sequential Stepper Navigation Bar */}
          <header className="bg-white dark:bg-[#181B19] border-b border-[#E2E8E4] dark:border-[#2A2F2C] px-4 py-2.5 flex flex-col gap-2 shrink-0 select-none z-10 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left: Back to Directory & Step Navigation */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('directory')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#0F5132] dark:text-[#7CC9A3] hover:text-[#0B3D26] dark:hover:text-[#27855A] transition-colors cursor-pointer"
                  title="Back to Student Selection"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Selection</span>
                </button>

                <span className="text-[#E2E8E4] dark:text-[#2F3532]">|</span>

                {/* Previous / Next Stepper Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={stepperIndex === 0}
                    onClick={() => setStepperIndex((i) => Math.max(0, i - 1))}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                      stepperIndex === 0
                        ? 'opacity-40 cursor-not-allowed border-[#E2E8E4] dark:border-[#2A2F2C] text-[#9CA3AF]'
                        : 'border-[#E2E8E4] dark:border-[#2A2F2C] bg-white dark:bg-[#202422] text-[#111827] dark:text-[#ECEEED] hover:bg-[#F1F4F2] dark:hover:bg-[#2A2F2C]'
                    }`}
                    title="Previous Student"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <span className="text-xs font-semibold text-[#111827] dark:text-[#ECEEED] px-2 font-mono">
                    Student {stepperIndex + 1} of {stepperList.length}
                  </span>

                  <button
                    type="button"
                    disabled={stepperIndex === stepperList.length - 1}
                    onClick={() => setStepperIndex((i) => Math.min(stepperList.length - 1, i + 1))}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                      stepperIndex === stepperList.length - 1
                        ? 'opacity-40 cursor-not-allowed border-[#E2E8E4] dark:border-[#2A2F2C] text-[#9CA3AF]'
                        : 'border-[#E2E8E4] dark:border-[#2A2F2C] bg-white dark:bg-[#202422] text-[#111827] dark:text-[#ECEEED] hover:bg-[#F1F4F2] dark:hover:bg-[#2A2F2C]'
                    }`}
                    title="Next Student"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right: Download Actions for Stepper */}
              <div className="flex items-center gap-2">
                <a
                  href={`/api/sheets/${currentStepperStudent.id}/export/report-card-pdf`}
                  download={`report_card_${currentStepperStudent.roll_number || currentStepperStudent.student_name}.pdf`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] hover:bg-[#0F5132] hover:text-white dark:hover:bg-[#1F6E4A] dark:hover:text-white text-xs font-semibold border border-[#0F5132]/20 dark:border-[#294236] transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report Card PDF</span>
                </a>

                {stepperList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleBulkExport('zip')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#202422] hover:bg-[#F1F4F2] dark:hover:bg-[#2A2F2C] text-xs font-semibold text-[#111827] dark:text-[#ECEEED] border border-[#E2E8E4] dark:border-[#2A2F2C] transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download All ({stepperList.length}) Reports</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick-Jump Student Pills (for seamless jumping across selected students) */}
            {stepperList.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin">
                <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#68706C] shrink-0 mr-1">
                  Quick Jump:
                </span>
                {stepperList.map((st, idx) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStepperIndex(idx)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition cursor-pointer shrink-0 border ${
                      idx === stepperIndex
                        ? 'bg-[#0F5132] text-white border-[#0F5132] dark:bg-[#1F6E4A] dark:border-[#1F6E4A] font-bold shadow-none'
                        : 'bg-[#F1F4F2] dark:bg-[#202422] text-[#4B5563] dark:text-[#969E9A] hover:bg-[#E2E8E4] dark:hover:bg-[#2A2F2C] border-[#E2E8E4] dark:border-[#2F3532]'
                    }`}
                  >
                    <span>{st.student_name}</span>
                    <span className="font-mono text-[10px] opacity-75">({st.roll_number})</span>
                  </button>
                ))}
              </div>
            )}
          </header>

          {/* Full-Width Digital 1-Page Bento Report Card */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <StudentReportCard
              sheetId={currentStepperStudent.id}
            />
          </div>
        </div>
      ) : viewMode === 'compare' && compareData ? (
        /* ========================================================================= */
        /* VIEW MODE: COMPARE (Side-by-Side Student Comparison View)                 */
        /* ========================================================================= */
        <div className="flex-1 min-h-0 h-full flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="max-w-6xl mx-auto w-full space-y-6">
            {/* Header Bar */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('directory')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#0F5132] dark:text-[#7CC9A3] hover:text-[#0B3D26] dark:hover:text-[#27855A] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Selection</span>
                </button>
                <span className="text-[#E2E8E4] dark:text-[#2F3532]">|</span>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-[#111827] dark:text-[#ECEEED]">
                    Student Performance Comparison ({compareData.students.length} Candidates)
                  </h1>
                  <p className="text-xs text-[#6B7280] dark:text-[#68706C]">
                    Side-by-side evaluation matrix with question-level breakdown and telemetry.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkExport('consolidated-xlsx')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] hover:bg-[#0F5132] hover:text-white dark:hover:bg-[#1F6E4A] dark:hover:text-white text-xs font-semibold border border-[#0F5132]/20 dark:border-[#294236] transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Comparison (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Visual Score Comparison Bar Chart */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                <h2 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED]">
                  Overall Percentage Comparison
                </h2>
              </div>

              <div className="w-full h-56 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8E4" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      interval={0}
                    />
                    <YAxis
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                    />
                    <Tooltip
                      formatter={(val: any) => [`${val}%`, 'Score Percentage']}
                      labelFormatter={(label) => `Student: ${label}`}
                      contentStyle={{
                        backgroundColor: '#181B19',
                        borderColor: '#2A2F2C',
                        borderRadius: '8px',
                        color: '#ECEEED',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
                      {comparisonChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === 0 ? '#0F5132' : '#1F6E4A'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comparison Matrix Table */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-5 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED]">
                  Question &amp; Section Marks Matrix
                </h2>
                <span className="text-xs text-[#6B7280] dark:text-[#68706C]">
                  Highest scorer per row highlighted in emerald
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2E8E4] dark:border-[#2A2F2C] bg-[#F1F4F2] dark:bg-[#202422]">
                      <th className="py-3 px-3 font-semibold text-[#6B7280] dark:text-[#969E9A] uppercase tracking-wider w-64">
                        Assessment Metric
                      </th>
                      {compareData.students.map((st) => (
                        <th key={st.sheet_id} className="py-3 px-3 text-center min-w-[140px]">
                          <div className="font-bold text-[#111827] dark:text-[#ECEEED] truncate max-w-[130px] mx-auto">
                            {st.student_name}
                          </div>
                          <div className="font-mono text-[11px] text-[#6B7280] dark:text-[#68706C]">
                            {st.roll_number}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8E4] dark:divide-[#2A2F2C]">
                    {/* Total Score Row */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-[#202422]/50">
                      <td className="py-2.5 px-3 font-bold text-[#111827] dark:text-[#ECEEED]">
                        Total Marks Obtained
                      </td>
                      {compareData.students.map((st) => {
                        const maxVal = Math.max(...compareData.students.map((s) => s.total_score));
                        const isHighest = st.total_score === maxVal && maxVal > 0;
                        return (
                          <td
                            key={st.sheet_id}
                            className={`py-2.5 px-3 text-center font-mono font-bold ${
                              isHighest
                                ? 'bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3]'
                                : 'text-[#111827] dark:text-[#ECEEED]'
                            }`}
                          >
                            {st.total_score} <span className="text-[10px] text-[#6B7280] font-normal">/ {st.max_marks}</span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Percentage Row */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-[#202422]/50">
                      <td className="py-2.5 px-3 font-semibold text-[#111827] dark:text-[#ECEEED]">
                        Percentage
                      </td>
                      {compareData.students.map((st) => {
                        const maxPct = Math.max(...compareData.students.map((s) => s.percentage));
                        const isHighest = st.percentage === maxPct && maxPct > 0;
                        return (
                          <td
                            key={st.sheet_id}
                            className={`py-2.5 px-3 text-center font-mono font-bold ${
                              isHighest
                                ? 'bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3]'
                                : 'text-[#4B5563] dark:text-[#969E9A]'
                            }`}
                          >
                            {st.percentage.toFixed(1)}%
                          </td>
                        );
                      })}
                    </tr>

                    {/* Grade Row */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-[#202422]/50">
                      <td className="py-2.5 px-3 font-semibold text-[#111827] dark:text-[#ECEEED]">
                        Awarded Grade
                      </td>
                      {compareData.students.map((st) => (
                        <td key={st.sheet_id} className="py-2.5 px-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getGradeBadgeClass(st.grade)}`}>
                            {st.grade}
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Stream / Class Row */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-[#202422]/50">
                      <td className="py-2.5 px-3 font-semibold text-[#111827] dark:text-[#ECEEED]">
                        Class / Stream
                      </td>
                      {compareData.students.map((st) => (
                        <td key={st.sheet_id} className="py-2.5 px-3 text-center text-[#4B5563] dark:text-[#969E9A]">
                          {st.class_name || '—'}
                        </td>
                      ))}
                    </tr>

                    {/* Rank in Selection Row */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-[#202422]/50 bg-slate-50/30 dark:bg-[#181B19]/30">
                      <td className="py-2.5 px-3 font-bold text-[#111827] dark:text-[#ECEEED]">
                        Rank in Selection
                      </td>
                      {compareData.students.map((st) => (
                        <td key={st.sheet_id} className="py-2.5 px-3 text-center font-bold">
                          <span
                            className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-mono ${
                              st.rank === 1
                                ? 'bg-[#0F5132] text-white dark:bg-[#1F6E4A]'
                                : 'bg-slate-100 dark:bg-[#202422] text-[#4B5563] dark:text-[#969E9A]'
                            }`}
                          >
                            #{st.rank}
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Question-wise Rows */}
                    {compareData.questions.map((q) => {
                      const qScores = compareData.students.map(
                        (st) => compareData.matrix[q.question_id]?.[st.sheet_id] ?? 0
                      );
                      const maxQScore = Math.max(...qScores);

                      return (
                        <tr key={q.question_id} className="hover:bg-slate-50/50 dark:hover:bg-[#202422]/50">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#111827] dark:text-[#ECEEED]">
                              Q{q.q_no} {q.section_name ? `(${q.section_name})` : ''}
                            </div>
                            <div className="text-[11px] text-[#6B7280] dark:text-[#68706C] truncate max-w-xs" title={q.question_text}>
                              {q.question_text || 'Assessment Question'}
                            </div>
                            <div className="text-[10px] font-mono text-[#6B7280] dark:text-[#68706C]">
                              Max: {q.max_marks} marks
                            </div>
                          </td>
                          {compareData.students.map((st) => {
                            const val = compareData.matrix[q.question_id]?.[st.sheet_id] ?? 0;
                            const isHighest = val === maxQScore && maxQScore > 0;
                            return (
                              <td
                                key={st.sheet_id}
                                className={`py-2.5 px-3 text-center font-mono font-bold ${
                                  isHighest
                                    ? 'bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3]'
                                    : 'text-[#4B5563] dark:text-[#969E9A]'
                                }`}
                              >
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW MODE: DIRECTORY (Student Search, Multi-Filter, Directory Table)      */
        /* ========================================================================= */
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Header Box */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-6 shadow-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E2E8E4] dark:border-[#2A2F2C]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center border border-[#0F5132]/20 dark:border-[#294236]">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-base sm:text-lg font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight">
                      Search Student Report Card
                    </h1>
                    <p className="text-xs text-[#4B5563] dark:text-[#969E9A] mt-0.5">
                      Select individual candidates or look up full classes to step through reports one-by-one, compare cohorts, or export in bulk.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#6B7280] dark:text-[#68706C] bg-[#F1F4F2] dark:bg-[#202422] px-3 py-1.5 rounded-lg border border-[#E2E8E4] dark:border-[#2F3532] self-start sm:self-auto">
                  <span>{evaluatedSheets.length} Evaluated Total</span>
                </div>
              </div>

              {/* Search & Filter Controls (Exam/Subject, Class/Stream, Multi-Search) */}
              <div className="pt-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                {/* Multi-Student Search Input */}
                <div className="sm:col-span-6 relative">
                  <Search className="w-4 h-4 text-[#6B7280] dark:text-[#68706C] absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, roll no, or comma-separated candidates..."
                    className="w-full h-10 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl pl-9 pr-8 text-[#111827] dark:text-[#ECEEED] placeholder-[#6B7280] dark:placeholder-[#68706C] focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-[#6B7280] hover:text-[#111827] dark:text-[#68706C] dark:hover:text-[#ECEEED] transition-colors cursor-pointer p-1"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Exam / Subject Dropdown Filter */}
                <div className="sm:col-span-3 relative flex items-center">
                  <Filter className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3] absolute left-3 pointer-events-none" />
                  <select
                    value={selectedPaperId}
                    onChange={(e) => setSelectedPaperId(e.target.value)}
                    className="w-full h-10 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl pl-8 pr-3 font-medium text-[#111827] dark:text-[#ECEEED] focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none cursor-pointer truncate"
                  >
                    <option value="all">All Exams ({papers.length})</option>
                    {papers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} {p.subject ? `(${p.subject})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class / Stream Dropdown Filter */}
                <div className="sm:col-span-3 relative flex items-center">
                  <Users className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3] absolute left-3 pointer-events-none" />
                  <select
                    value={selectedClassName}
                    onChange={(e) => setSelectedClassName(e.target.value)}
                    className="w-full h-10 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl pl-8 pr-3 font-medium text-[#111827] dark:text-[#ECEEED] focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none cursor-pointer truncate"
                  >
                    <option value="all">All Classes / Streams</option>
                    {uniqueClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Multi-Select Action Bar (Shows when 1 or more candidates are selected) */}
            {selectedSheetIds.size > 0 && (
              <div className="bg-[#0F5132] text-white rounded-2xl p-4 shadow-none flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-white/20 text-white font-bold font-mono text-xs flex items-center justify-center">
                    {selectedSheetIds.size}
                  </span>
                  <span className="text-xs font-semibold">
                    {selectedSheetIds.size} {selectedSheetIds.size === 1 ? 'Candidate' : 'Candidates'} Selected
                  </span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-[11px] underline text-emerald-200 hover:text-white ml-2 cursor-pointer"
                  >
                    Clear selection
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Action 1: View Sequential Stepper */}
                  <button
                    type="button"
                    onClick={() => handleStartStepper()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#0F5132] hover:bg-emerald-50 text-xs font-bold transition cursor-pointer"
                  >
                    <span>View Report Cards ({selectedSheetIds.size}) One-by-One</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Action 2: Compare Selected (2 to 10 candidates) */}
                  <button
                    type="button"
                    disabled={selectedSheetIds.size < 2 || selectedSheetIds.size > 10 || isComparing}
                    onClick={handleOpenCompare}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                      selectedSheetIds.size >= 2 && selectedSheetIds.size <= 10
                        ? 'bg-emerald-800 text-white hover:bg-emerald-900 border-white/20 cursor-pointer'
                        : 'bg-emerald-900/40 text-emerald-300/60 border-transparent cursor-not-allowed'
                    }`}
                    title={
                      selectedSheetIds.size < 2
                        ? 'Select at least 2 students to compare'
                        : selectedSheetIds.size > 10
                        ? 'Maximum 10 students can be compared at once'
                        : 'Compare performance side-by-side'
                    }
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Compare Selected ({selectedSheetIds.size})</span>
                  </button>

                  {/* Action 3: Download Bulk Reports Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsBulkDropdownOpen((o) => !o)}
                      disabled={isDownloadingBulk}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold border border-white/20 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{bulkDownloadStatus || 'Download Bulk Reports'}</span>
                    </button>

                    {isBulkDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] shadow-lg py-1.5 z-30 text-[#111827] dark:text-[#ECEEED]">
                        <button
                          type="button"
                          onClick={() => handleBulkExport('zip')}
                          className="w-full text-left px-3.5 py-2 text-xs hover:bg-[#F1F4F2] dark:hover:bg-[#202422] flex items-center justify-between cursor-pointer"
                        >
                          <span>All Selected PDFs (.zip)</span>
                          <span className="text-[10px] text-[#6B7280] font-mono">ZIP</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkExport('merged-pdf')}
                          className="w-full text-left px-3.5 py-2 text-xs hover:bg-[#F1F4F2] dark:hover:bg-[#202422] flex items-center justify-between cursor-pointer"
                        >
                          <span>Merged Multi-Page PDF</span>
                          <span className="text-[10px] text-[#6B7280] font-mono">PDF</span>
                        </button>
                        <div className="my-1 border-t border-[#E2E8E4] dark:border-[#2A2F2C]" />
                        <button
                          type="button"
                          onClick={() => handleBulkExport('consolidated-xlsx')}
                          className="w-full text-left px-3.5 py-2 text-xs hover:bg-[#F1F4F2] dark:hover:bg-[#202422] flex items-center justify-between cursor-pointer"
                        >
                          <span>Consolidated Class Results (.xlsx)</span>
                          <span className="text-[10px] text-[#6B7280] font-mono">EXCEL</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkExport('consolidated-pdf')}
                          className="w-full text-left px-3.5 py-2 text-xs hover:bg-[#F1F4F2] dark:hover:bg-[#202422] flex items-center justify-between cursor-pointer"
                        >
                          <span>Consolidated Class Marksheet (.pdf)</span>
                          <span className="text-[10px] text-[#6B7280] font-mono">PDF</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Results Section */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#68706C]">
                    Evaluated Students ({filteredSheets.length})
                  </span>

                  {/* Select All Matching Toggle */}
                  {filteredSheets.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSelectAllFiltered}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F5132] dark:text-[#7CC9A3] hover:underline cursor-pointer"
                    >
                      {isAllFilteredSelected ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isAllFilteredSelected ? 'Deselect All' : `Select All Matching (${filteredSheets.length})`}
                      </span>
                    </button>
                  )}
                </div>

                {searchQuery && (
                  <span className="text-xs text-[#6B7280] dark:text-[#68706C]">
                    Filtered by: <strong className="text-[#111827] dark:text-[#ECEEED]">"{searchQuery}"</strong>
                  </span>
                )}
              </div>

              {filteredSheets.length === 0 ? (
                /* No Results State */
                <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[#F1F4F2] dark:bg-[#202422] text-[#6B7280] dark:text-[#68706C] flex items-center justify-center mx-auto">
                    <Search className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED]">
                      No matching student report cards
                    </h3>
                    <p className="text-xs text-[#4B5563] dark:text-[#969E9A] mt-1 max-w-sm mx-auto">
                      {searchQuery
                        ? `No evaluated students found matching "${searchQuery}". Try searching by another student name or roll number.`
                        : 'No evaluated sheets found for this assessment filter.'}
                    </p>
                  </div>
                  {(searchQuery || selectedPaperId !== 'all' || selectedClassName !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedPaperId('all');
                        setSelectedClassName('all');
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#F1F4F2] dark:bg-[#202422] hover:bg-[#E2E8E4] dark:hover:bg-[#2F3532] text-xs font-semibold text-[#111827] dark:text-[#ECEEED] transition cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                /* Clickable list/grid of matching evaluated students */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredSheets.map((s) => {
                    const paper = paperMap[s.paper_id];
                    const examName = s.exam_title || paper?.title || 'Examination';
                    const subjectName = s.subject || paper?.subject || '';
                    const isChecked = selectedSheetIds.has(s.id);

                    return (
                      <div
                        key={s.id}
                        onClick={() => handleOpenSingleStudent(s)}
                        className={`bg-white dark:bg-[#181B19] border ${
                          isChecked
                            ? 'border-[#0F5132] ring-1 ring-[#0F5132] dark:border-[#1F6E4A] dark:ring-[#1F6E4A]'
                            : 'border-[#E2E8E4] dark:border-[#2A2F2C] hover:border-[#0F5132]/40 dark:hover:border-[#1F6E4A]'
                        } rounded-2xl p-4 transition-all duration-150 flex flex-col justify-between group cursor-pointer hover:shadow-sm`}
                      >
                        {/* Top: Checkbox, Student & Exam Metadata */}
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              {/* Selection Checkbox */}
                              <button
                                type="button"
                                onClick={(e) => toggleSelectSheet(s.id, e)}
                                className="mt-0.5 text-[#6B7280] hover:text-[#0F5132] dark:text-[#969E9A] dark:hover:text-[#7CC9A3] transition cursor-pointer p-0.5 shrink-0"
                                title={isChecked ? 'Deselect candidate' : 'Select candidate'}
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED] truncate group-hover:text-[#0F5132] dark:group-hover:text-[#7CC9A3] transition-colors">
                                    {s.student_name}
                                  </h3>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getGradeBadgeClass(s.grade)}`}>
                                    {s.grade}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-[#6B7280] dark:text-[#68706C]">
                                  <span className="font-mono font-medium">{s.roll_number}</span>
                                  {s.class_name && (
                                    <>
                                      <span>·</span>
                                      <span>{s.class_name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Score Display */}
                            <div className="text-right shrink-0">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#68706C] block">
                                Total Score
                              </span>
                              <div className="font-mono font-bold text-sm text-[#0F5132] dark:text-[#7CC9A3]">
                                {s.score} <span className="text-xs text-[#6B7280] dark:text-[#68706C] font-normal">/ {s.max_marks}</span>
                              </div>
                              <div className="text-[10px] font-mono text-[#6B7280] dark:text-[#68706C]">
                                {s.percentage.toFixed(1)}%
                              </div>
                            </div>
                          </div>

                          {/* Exam & Subject */}
                          <div className="pt-2 border-t border-[#F1F4F2] dark:border-[#202422] flex items-center justify-between text-xs text-[#4B5563] dark:text-[#969E9A]">
                            <div className="truncate max-w-[280px]" title={`${examName} ${subjectName ? `· ${subjectName}` : ''}`}>
                              <span className="font-medium text-[#111827] dark:text-[#ECEEED]">{examName}</span>
                              {subjectName && (
                                <span className="text-[#6B7280] dark:text-[#68706C]"> · {subjectName}</span>
                              )}
                            </div>
                            {s.evaluated_at && (
                              <div className="flex items-center gap-1 text-[10px] font-mono text-[#6B7280] dark:text-[#68706C] shrink-0">
                                <Calendar className="w-3 h-3" />
                                <span>{s.evaluated_at.split(' ')[0]}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom Action Button */}
                        <div className="pt-3 mt-3 border-t border-[#F1F4F2] dark:border-[#202422] flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(e) => toggleSelectSheet(s.id, e)}
                            className="text-[11px] font-medium text-[#6B7280] dark:text-[#969E9A] hover:text-[#111827] dark:hover:text-[#ECEEED] transition cursor-pointer"
                          >
                            {isChecked ? 'Selected for bulk' : 'Select'}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSingleStudent(s);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] hover:bg-[#0F5132] hover:text-white dark:hover:bg-[#1F6E4A] dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer border border-[#0F5132]/20 dark:border-[#294236]"
                          >
                            <span>View Report Card</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
