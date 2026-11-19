import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { StudentReportView } from '../components/StudentReportView';
import {
  FileSpreadsheet,
  Download,
  Filter,
  ArrowRight,
  FileText,
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
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isDownloadingStudentPdf, setIsDownloadingStudentPdf] = useState<boolean>(false);

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

  // Sheets filtered by paper
  const paperFilteredSheets = useMemo(() => {
    if (selectedPaperId === 'all') return evaluatedSheets;
    return evaluatedSheets.filter((s) => s.paper_id === selectedPaperId);
  }, [evaluatedSheets, selectedPaperId]);

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

  // Download Student Marksheet PDF
  const handleDownloadStudentPdf = async () => {
    if (!selectedSheetId) return;
    try {
      setIsDownloadingStudentPdf(true);
      const res = await fetch(`/api/sheets/${selectedSheetId}/export/pdf`);
      if (!res.ok) throw new Error('PDF export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const rollClean = (currentSheet?.roll_number || 'Sheet').replace(/[^a-zA-Z0-9_-]/g, '_');
      const subjClean = (currentSheet?.subject || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Marksheet_${rollClean}_${subjClean}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download student marksheet PDF:', err);
    } finally {
      setIsDownloadingStudentPdf(false);
    }
  };

  // Export Class Excel
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

  // When paper filter changes, keep student if it belongs to paper, else select first from paper
  const handlePaperChange = (newPaperId: string) => {
    setSelectedPaperId(newPaperId);
    if (newPaperId === 'all') {
      if (!selectedSheetId && evaluatedSheets.length > 0) {
        setSelectedSheetId(evaluatedSheets[0].id);
      }
    } else {
      const sheetsForPaper = evaluatedSheets.filter((s) => s.paper_id === newPaperId);
      if (sheetsForPaper.length > 0 && !sheetsForPaper.some((s) => s.id === selectedSheetId)) {
        setSelectedSheetId(sheetsForPaper[0].id);
      }
    }
  };

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col bg-[#F6F7F5] dark:bg-[#111312] overflow-hidden">
      {/* Loading state */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-3">
          <div className="w-8 h-8 border-2 border-[#0F5132] dark:border-[#1F6E4A] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono font-medium text-[#6B7280] dark:text-[#68706C]">Loading student reports &amp; marks...</span>
        </div>
      ) : evaluatedSheets.length === 0 ? (
        /* Empty state: 0 evaluated sheets */
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-2xl p-10 max-w-xl w-full text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center mx-auto border border-[#C8E3D5] dark:border-[#294236]">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight">No evaluated student sheets yet</h2>
              <p className="text-xs text-[#4B5563] dark:text-[#969E9A] mt-1 max-w-md mx-auto leading-relaxed">
                Upload candidate answer booklets and complete AI evaluation to generate official student reports, marksheet records, and class gradebooks.
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
          {/* Top Filter and Actions Bar */}
          <header className="bg-white dark:bg-[#181B19] border-b border-[#E2E8E4] dark:border-[#2A2F2C] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none z-10">
            {/* Left: Filters */}
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              {/* Paper / Exam Filter */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3]" />
                <span className="text-xs font-bold text-[#111827] dark:text-[#ECEEED]">Exam:</span>
                <select
                  value={selectedPaperId}
                  onChange={(e) => handlePaperChange(e.target.value)}
                  className="h-8 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg px-2.5 font-semibold text-[#111827] dark:text-[#ECEEED] focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none cursor-pointer max-w-[200px] truncate"
                >
                  <option value="all">All Exams ({evaluatedSheets.length} Sheets)</option>
                  {papers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.subject})
                    </option>
                  ))}
                </select>
              </div>

              {/* Specific Student Select Dropdown */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-bold text-[#111827] dark:text-[#ECEEED]">Student:</span>
                <select
                  value={selectedSheetId}
                  onChange={(e) => setSelectedSheetId(e.target.value)}
                  className="h-8 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-lg px-2.5 font-semibold text-[#111827] dark:text-[#ECEEED] focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none cursor-pointer max-w-[240px] truncate"
                >
                  {paperFilteredSheets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.student_name} ({s.roll_number}) · {s.score}/{s.max_marks} ({s.grade})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right: Action & Download Buttons */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Download Student Marksheet PDF */}
              <button
                type="button"
                onClick={handleDownloadStudentPdf}
                disabled={!selectedSheetId || isDownloadingStudentPdf}
                className="px-3 py-1.5 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] disabled:opacity-40 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                title="Download selected student's official PDF marksheet"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {isDownloadingStudentPdf ? 'Preparing PDF...' : 'Download Student Marksheet PDF'}
                </span>
              </button>

              {/* Export Class Excel */}
              <button
                type="button"
                onClick={handleExportClassExcel}
                disabled={!effectivePaperIdForClass || isExportingExcel}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#202422] hover:bg-[#F1F4F2] dark:hover:bg-[#2F3532] disabled:opacity-40 text-[#111827] dark:text-[#ECEEED] text-xs font-semibold border border-[#E2E8E4] dark:border-[#2F3532] transition flex items-center gap-1.5 cursor-pointer"
                title="Export class roster and itemized scores to Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3]" />
                <span>{isExportingExcel ? 'Exporting...' : 'Export Class Excel (.xlsx)'}</span>
              </button>
            </div>
          </header>

          {/* Embedded Student Report Page directly below */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {selectedSheetId ? (
              <StudentReportView sheetId={selectedSheetId} />
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-[#6B7280] dark:text-[#68706C] text-xs">
                Select a student from the dropdown above to view their evaluation report.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
