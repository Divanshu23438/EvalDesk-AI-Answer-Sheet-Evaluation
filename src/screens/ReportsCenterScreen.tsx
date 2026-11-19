import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { StudentReportView } from '../components/StudentReportView';
import {
  FileSpreadsheet,
  Download,
  Filter,
  ArrowRight,
  ArrowLeft,
  Search,
  Printer,
  X,
  GraduationCap,
  FileCheck2,
  Users,
} from 'lucide-react';

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

export const ReportsCenterScreen: React.FC = () => {
  const [state, store] = useSheetStore();

  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [evaluatedSheets, setEvaluatedSheets] = useState<EvaluatedSheetItem[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Parse explicit query parameter ?sheetId= if present
  const getExplicitSheetId = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    const searchParams = new URLSearchParams(window.location.search);
    const qSheet = searchParams.get('sheetId');
    if (qSheet) return qSheet;

    const hash = window.location.hash || '';
    const hashQueryIdx = hash.indexOf('?');
    if (hashQueryIdx !== -1) {
      const hashParams = new URLSearchParams(hash.slice(hashQueryIdx));
      const hSheet = hashParams.get('sheetId');
      if (hSheet) return hSheet;
    }
    return null;
  }, []);

  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(() => getExplicitSheetId());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Fetch papers and evaluated sheets
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

        // If explicit sheetId requested, confirm it exists
        const explicitId = getExplicitSheetId();
        if (explicitId && allSheets.some((s) => s.id === explicitId)) {
          setSelectedSheetId(explicitId);
        }
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
  }, [getExplicitSheetId]);

  // Sheets filtered by paper and search query
  const filteredSheets = useMemo(() => {
    return evaluatedSheets.filter((s) => {
      const matchesPaper = selectedPaperId === 'all' || s.paper_id === selectedPaperId;
      if (!matchesPaper) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.student_name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        (s.class_name && s.class_name.toLowerCase().includes(q)) ||
        (s.exam_title && s.exam_title.toLowerCase().includes(q)) ||
        (s.subject && s.subject.toLowerCase().includes(q))
      );
    });
  }, [evaluatedSheets, selectedPaperId, searchQuery]);

  // Current selected sheet object
  const currentSheet = useMemo(() => {
    if (!selectedSheetId) return null;
    return evaluatedSheets.find((s) => s.id === selectedSheetId) || null;
  }, [evaluatedSheets, selectedSheetId]);

  // Effective paper ID for class exports
  const effectivePaperIdForClass = useMemo(() => {
    if (selectedPaperId !== 'all') return selectedPaperId;
    if (currentSheet?.paper_id) return currentSheet.paper_id;
    if (papers.length > 0) return papers[0].id;
    return '';
  }, [selectedPaperId, currentSheet, papers]);

  // Download Report Card PDF
  const handleDownloadReportCardPdf = async () => {
    if (!selectedSheetId) return;
    try {
      setIsDownloadingPdf(true);
      const res = await fetch(`/api/sheets/${selectedSheetId}/export/pdf`);
      if (!res.ok) throw new Error('PDF export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const rollClean = (currentSheet?.roll_number || 'Sheet').replace(/[^a-zA-Z0-9_-]/g, '_');
      const subjClean = (currentSheet?.subject || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Report_Card_${rollClean}_${subjClean}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download student report card PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Print Report Card
  const handlePrintReportCard = () => {
    window.print();
  };

  // Export Class Excel (.xlsx)
  const handleExportClassExcel = async () => {
    if (!effectivePaperIdForClass) return;
    try {
      setIsExportingExcel(true);
      const url = `/api/papers/${effectivePaperIdForClass}/export/excel`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Excel export failed');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const paperObj = papers.find((p) => p.id === effectivePaperIdForClass);
      const titleClean = (paperObj?.title || 'Class_Results').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Class_Results_${titleClean}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export class Excel:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col bg-[#F6F7F5] dark:bg-[#111312] overflow-hidden">
      {/* Loading state */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-3">
          <div className="w-8 h-8 border-2 border-[#0F5132] dark:border-[#1F6E4A] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono font-medium text-[#6B7280] dark:text-[#68706C]">Loading report card directory...</span>
        </div>
      ) : evaluatedSheets.length === 0 ? (
        /* Empty state: 0 evaluated sheets */
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-10 max-w-xl w-full text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center mx-auto border border-[#C8E3D5] dark:border-[#294236]">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight">No evaluated student sheets found</h2>
              <p className="text-xs text-[#4B5563] dark:text-[#969E9A] mt-1 max-w-md mx-auto leading-relaxed">
                Upload candidate answer booklets and complete AI evaluation to generate official student report cards, marksheet records, and class gradebooks.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  store.setStep('upload');
                  window.location.hash = '#/upload';
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white text-xs font-bold transition cursor-pointer shadow-none"
              >
                <span>+ Evaluate Answer Sheets</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : selectedSheetId === null ? (
        /* ==================================================================== */
        /* VIEW 1: SEARCH-FIRST DIRECTORY (selectedSheetId === null)           */
        /* ==================================================================== */
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header Title & Description */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight">
                  Find Student Report Card
                </h1>
              </div>
              <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
                Search evaluated candidate records by name, roll number, or filter by assessment to view and download full-width digital report cards.
              </p>
            </div>

            {/* Search and Filter Card */}
            <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-4 md:p-5 shadow-none space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Bar Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#6B7280] dark:text-[#68706C] absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Student Name, Roll Number (e.g. SGSU250489), or Exam..."
                    className="w-full h-10 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl pl-10 pr-9 text-[#111827] dark:text-[#ECEEED] placeholder-[#6B7280] dark:placeholder-[#68706C] focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-3 text-[#6B7280] hover:text-[#111827] dark:text-[#68706C] dark:hover:text-[#ECEEED] transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Exam / Subject Dropdown Filter */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    value={selectedPaperId}
                    onChange={(e) => setSelectedPaperId(e.target.value)}
                    className="h-10 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl px-3 font-semibold text-[#111827] dark:text-[#ECEEED] focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none cursor-pointer max-w-[240px] truncate"
                  >
                    <option value="all">All Exams ({evaluatedSheets.length} Students)</option>
                    {papers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.subject})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status and summary row */}
              <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-[#68706C] pt-1">
                <span>
                  Showing <strong className="text-[#111827] dark:text-[#ECEEED]">{filteredSheets.length}</strong> evaluated student{filteredSheets.length === 1 ? '' : 's'}
                </span>
                {(searchQuery || selectedPaperId !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedPaperId('all');
                    }}
                    className="text-[#0F5132] dark:text-[#7CC9A3] hover:underline font-semibold cursor-pointer"
                  >
                    Show All Evaluated Students
                  </button>
                )}
              </div>
            </div>

            {/* Student Result Cards / Directory List */}
            {filteredSheets.length === 0 ? (
              <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-8 text-center text-[#6B7280] dark:text-[#68706C] text-xs space-y-2">
                <p className="font-semibold text-sm text-[#111827] dark:text-[#ECEEED]">No matching candidate found</p>
                <p>Try searching with another student name, roll number, or selecting "All Exams".</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedPaperId('all');
                  }}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] font-semibold text-xs border border-[#0F5132]/20 dark:border-[#294236] cursor-pointer"
                >
                  Reset Search Criteria
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredSheets.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] hover:border-[#0F5132]/40 dark:hover:border-[#1F6E4A] rounded-2xl p-4 transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-sm text-[#111827] dark:text-[#ECEEED]">
                            {s.student_name}
                          </h3>
                          <span className="font-mono text-xs text-[#6B7280] dark:text-[#68706C]">
                            Roll: {s.roll_number}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            s.grade === 'O' || s.grade.startsWith('A')
                              ? 'bg-emerald-100 dark:bg-[#1A2B23] text-emerald-800 dark:text-[#7CC9A3]'
                              : s.grade.startsWith('B')
                              ? 'bg-teal-100 dark:bg-[#1B2929] text-teal-800 dark:text-[#3A7D8C]'
                              : s.grade === 'F'
                              ? 'bg-rose-100 dark:bg-[#2B191D] text-rose-800 dark:text-[#E57D8A]'
                              : 'bg-amber-100 dark:bg-[#2B2416] text-amber-800 dark:text-[#E5B567]'
                          }`}
                        >
                          Grade {s.grade}
                        </span>
                      </div>

                      <div className="text-xs text-[#4B5563] dark:text-[#969E9A] space-y-0.5 pt-1">
                        <div className="truncate font-medium text-[#111827] dark:text-[#ECEEED]">
                          {s.exam_title || 'Assessment Exam'}
                        </div>
                        {s.subject && (
                          <div className="truncate text-[11px] text-[#6B7280] dark:text-[#68706C]">
                            {s.subject} {s.class_name ? `· ${s.class_name}` : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E2E8E4] dark:border-[#2A2F2C] flex items-center justify-between">
                      <div className="font-mono text-xs">
                        <span className="font-bold text-[#111827] dark:text-[#ECEEED]">
                          {s.score} / {s.max_marks} M
                        </span>
                        <span className="text-[#6B7280] dark:text-[#68706C] ml-1.5">
                          ({s.percentage.toFixed(1)}%)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedSheetId(s.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white text-xs font-semibold transition cursor-pointer shadow-none"
                      >
                        <span>Open Report Card</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================================================================== */
        /* VIEW 2: SELECTED REPORT CARD STATE (selectedSheetId !== null)       */
        /* ==================================================================== */
        <>
          {/* Clean Top Action Bar */}
          <header className="bg-white dark:bg-[#181B19] border-b border-[#E2E8E4] dark:border-[#2A2F2C] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none z-10 print:hidden">
            {/* Left: Search Another Student Back Button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedSheetId(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F1F4F2] dark:bg-[#202422] hover:bg-[#E2E8E4] dark:hover:bg-[#2A2F2C] text-[#111827] dark:text-[#ECEEED] text-xs font-semibold transition cursor-pointer border border-[#E2E8E4] dark:border-[#2F3532]"
                title="Return to student search directory"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Search Another Student</span>
              </button>

              {currentSheet && (
                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <span className="text-[#E2E8E4] dark:text-[#2A2F2C]">|</span>
                  <span className="font-bold text-[#111827] dark:text-[#ECEEED]">
                    {currentSheet.student_name}
                  </span>
                  <span className="font-mono text-[#6B7280] dark:text-[#68706C]">
                    ({currentSheet.roll_number})
                  </span>
                  <span className="text-[#6B7280] dark:text-[#68706C]">·</span>
                  <span className="truncate max-w-[200px] text-[#4B5563] dark:text-[#969E9A]">
                    {currentSheet.exam_title}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Download, Print, and Excel Export */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Primary: Download PDF Report Card */}
              <button
                type="button"
                onClick={handleDownloadReportCardPdf}
                disabled={isDownloadingPdf}
                className="px-3.5 py-1.5 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] disabled:opacity-40 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-none"
                title="Download official PDF report card"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {isDownloadingPdf ? 'Preparing PDF...' : 'Download PDF Report Card'}
                </span>
              </button>

              {/* Print Report Card */}
              <button
                type="button"
                onClick={handlePrintReportCard}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#202422] hover:bg-[#F1F4F2] dark:hover:bg-[#2F3532] text-[#111827] dark:text-[#ECEEED] text-xs font-semibold border border-[#E2E8E4] dark:border-[#2F3532] transition flex items-center gap-1.5 cursor-pointer shadow-none"
                title="Print report card"
              >
                <Printer className="w-3.5 h-3.5 text-[#4B5563] dark:text-[#969E9A]" />
                <span>Print</span>
              </button>

              {/* Optional: Download Excel */}
              <button
                type="button"
                onClick={handleExportClassExcel}
                disabled={!effectivePaperIdForClass || isExportingExcel}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#202422] hover:bg-[#F1F4F2] dark:hover:bg-[#2F3532] disabled:opacity-40 text-[#111827] dark:text-[#ECEEED] text-xs font-semibold border border-[#E2E8E4] dark:border-[#2F3532] transition flex items-center gap-1.5 cursor-pointer shadow-none"
                title="Export class roster and scores to Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3]" />
                <span>{isExportingExcel ? 'Exporting...' : 'Download Excel (.xlsx)'}</span>
              </button>
            </div>
          </header>

          {/* Full-Width Digital Student Report Card Component */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <StudentReportView sheetId={selectedSheetId} />
          </div>
        </>
      )}
    </div>
  );
};
