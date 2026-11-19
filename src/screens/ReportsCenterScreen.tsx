import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { StudentReportView } from '../components/StudentReportView';
import {
  FileSpreadsheet,
  Download,
  Filter,
  ArrowRight,
  Search,
  Printer,
  X,
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
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Parse initial sheetId from query or hash
  const getInitialSheetId = useCallback((): string => {
    if (typeof window === 'undefined') return '';
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

    if (state.sheetId) return state.sheetId;
    return '';
  }, [state.sheetId]);

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

        // Determine initial selected student sheet
        const requestedId = getInitialSheetId();
        if (requestedId && allSheets.some((s) => s.id === requestedId)) {
          setSelectedSheetId(requestedId);
          const foundSheet = allSheets.find((s) => s.id === requestedId);
          if (foundSheet && foundSheet.paper_id) {
            setSelectedPaperId(foundSheet.paper_id);
          }
        } else if (allSheets.length > 0) {
          // Default to most recently evaluated student
          setSelectedSheetId(allSheets[0].id);
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
  }, [getInitialSheetId]);

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
        (s.class_name && s.class_name.toLowerCase().includes(q))
      );
    });
  }, [evaluatedSheets, selectedPaperId, searchQuery]);

  // Keep selectedSheetId valid when filteredSheets changes
  useEffect(() => {
    if (filteredSheets.length > 0 && !filteredSheets.some((s) => s.id === selectedSheetId)) {
      setSelectedSheetId(filteredSheets[0].id);
    }
  }, [filteredSheets, selectedSheetId]);

  // Current selected sheet object
  const currentSheet = useMemo(() => {
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

  // When paper filter changes
  const handlePaperChange = (newPaperId: string) => {
    setSelectedPaperId(newPaperId);
  };

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col bg-[#F6F7F5] dark:bg-[#111312] overflow-hidden">
      {/* Loading state */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-3">
          <div className="w-8 h-8 border-2 border-[#0F5132] dark:border-[#1F6E4A] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono font-medium text-[#6B7280] dark:text-[#68706C]">Loading report cards &amp; student marks...</span>
        </div>
      ) : evaluatedSheets.length === 0 ? (
        /* Empty state: 0 evaluated sheets */
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-10 max-w-xl w-full text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center mx-auto border border-[#C8E3D5] dark:border-[#294236]">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight">No evaluated report cards yet</h2>
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white text-xs font-bold transition cursor-pointer"
              >
                <span>+ Evaluate Answer Sheets</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Compact Student Search & Filter Bar */}
          <header className="bg-white dark:bg-[#181B19] border-b border-[#E2E8E4] dark:border-[#2A2F2C] px-4 py-2 shrink-0 select-none z-10 print:hidden space-y-2">
            {/* Top row: Search, Exam Filter, Student Selector, and Download CTAs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left Group: Search & Filter Controls */}
              <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
                {/* 1. Live Search Input */}
                <div className="relative min-w-[210px] max-w-xs flex-1">
                  <Search className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#68706C] absolute left-2.5 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search student by name or roll number..."
                    className="w-full h-8 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg pl-8 pr-7 text-[#111827] dark:text-[#ECEEED] placeholder-[#6B7280] dark:placeholder-[#68706C] focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-2 text-[#6B7280] hover:text-[#111827] dark:text-[#68706C] dark:hover:text-[#ECEEED] transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 2. Exam / Subject Filter Dropdown */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3]" />
                  <span className="text-xs font-bold text-[#111827] dark:text-[#ECEEED]">Exam:</span>
                  <select
                    value={selectedPaperId}
                    onChange={(e) => handlePaperChange(e.target.value)}
                    className="h-8 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg px-2.5 font-semibold text-[#111827] dark:text-[#ECEEED] focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none cursor-pointer max-w-[190px] truncate"
                  >
                    <option value="all">All Exams ({evaluatedSheets.length})</option>
                    {papers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.subject})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Student Selector Dropdown */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold text-[#111827] dark:text-[#ECEEED]">Student:</span>
                  <select
                    value={selectedSheetId}
                    onChange={(e) => setSelectedSheetId(e.target.value)}
                    className="h-8 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg px-2.5 font-semibold text-[#111827] dark:text-[#ECEEED] focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none cursor-pointer max-w-[240px] truncate"
                  >
                    {filteredSheets.length === 0 ? (
                      <option value="">No matching candidates</option>
                    ) : (
                      filteredSheets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.student_name} ({s.roll_number}) · {s.score}/{s.max_marks} ({s.grade})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Right Group: Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {/* Download Report Card PDF */}
                <button
                  type="button"
                  onClick={handleDownloadReportCardPdf}
                  disabled={!selectedSheetId || isDownloadingPdf}
                  className="px-3.5 py-1.5 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] disabled:opacity-40 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-none"
                  title="Download selected student's official report card PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isDownloadingPdf ? 'Preparing PDF...' : 'Download Report Card PDF'}
                  </span>
                </button>

                {/* Print Report Card */}
                <button
                  type="button"
                  onClick={handlePrintReportCard}
                  disabled={!selectedSheetId}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#202422] hover:bg-[#F1F4F2] dark:hover:bg-[#2F3532] disabled:opacity-40 text-[#111827] dark:text-[#ECEEED] text-xs font-semibold border border-[#E2E8E4] dark:border-[#2F3532] transition flex items-center gap-1.5 cursor-pointer shadow-none"
                  title="Print official report card (white paper format)"
                >
                  <Printer className="w-3.5 h-3.5 text-[#4B5563] dark:text-[#969E9A]" />
                  <span>Print Report Card</span>
                </button>

                {/* Optional: Export Class Excel (.xlsx) */}
                <button
                  type="button"
                  onClick={handleExportClassExcel}
                  disabled={!effectivePaperIdForClass || isExportingExcel}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#202422] hover:bg-[#F1F4F2] dark:hover:bg-[#2F3532] disabled:opacity-40 text-[#111827] dark:text-[#ECEEED] text-xs font-semibold border border-[#E2E8E4] dark:border-[#2F3532] transition flex items-center gap-1.5 cursor-pointer shadow-none"
                  title="Export class roster and itemized scores to Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3]" />
                  <span>{isExportingExcel ? 'Exporting...' : 'Export Class Excel (.xlsx)'}</span>
                </button>
              </div>
            </div>

            {/* Bottom Row: Quick-Select Student Pills */}
            {filteredSheets.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-thin">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#68706C] shrink-0 mr-1">
                  Students ({filteredSheets.length}):
                </span>
                {filteredSheets.map((s) => {
                  const isSelected = s.id === selectedSheetId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSheetId(s.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border-[#0F5132]/30 dark:border-[#294236] font-semibold'
                          : 'bg-[#F1F4F2] dark:bg-[#202422] text-[#4B5563] dark:text-[#969E9A] hover:bg-[#E2E8E4] dark:hover:bg-[#2A2F2C] border-[#E2E8E4] dark:border-[#2F3532]'
                      }`}
                    >
                      <span className="font-semibold text-[#111827] dark:text-[#ECEEED]">{s.student_name}</span>
                      <span className="text-[10px] font-mono text-[#6B7280] dark:text-[#68706C]">·</span>
                      <span className="font-mono text-[11px]">{s.roll_number}</span>
                      <span className="text-[10px] font-mono text-[#6B7280] dark:text-[#68706C]">·</span>
                      <span className="font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                        {s.score}/{s.max_marks}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                          s.grade === 'O' || s.grade.startsWith('A')
                            ? 'bg-emerald-100 dark:bg-[#1A2B23] text-emerald-800 dark:text-[#7CC9A3]'
                            : s.grade.startsWith('B')
                            ? 'bg-teal-100 dark:bg-[#1B2929] text-teal-800 dark:text-[#3A7D8C]'
                            : s.grade === 'F'
                            ? 'bg-rose-100 dark:bg-[#2B191D] text-rose-800 dark:text-[#E57D8A]'
                            : 'bg-amber-100 dark:bg-[#2B2416] text-amber-800 dark:text-[#E5B567]'
                        }`}
                      >
                        {s.grade}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </header>

          {/* Embedded Student Report Page directly below */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {selectedSheetId ? (
              <StudentReportView sheetId={selectedSheetId} />
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-[#6B7280] dark:text-[#68706C] text-xs">
                No matching student found. Adjust your search criteria above.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
