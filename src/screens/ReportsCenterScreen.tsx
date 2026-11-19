import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { BentoMarksheetView } from '../components/BentoMarksheetView';
import {
  FileSpreadsheet,
  Download,
  FileText,
  Search,
  Filter,
  Users,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ChevronRight,
  FileCheck,
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isDownloadingStudentPdf, setIsDownloadingStudentPdf] = useState<boolean>(false);

  // Parse initial sheetId from query or hash
  const getInitialSheetId = useCallback((): string => {
    if (typeof window === 'undefined') return '';
    // Check ?sheetId= in location.search
    const searchParams = new URLSearchParams(window.location.search);
    const qSheet = searchParams.get('sheetId');
    if (qSheet) return qSheet;

    // Check hash query param: #/reports?sheetId=...
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

  // Sheets further filtered by search query
  const displayedSheets = useMemo(() => {
    if (!searchQuery.trim()) return paperFilteredSheets;
    const q = searchQuery.toLowerCase().trim();
    return paperFilteredSheets.filter(
      (s) =>
        s.student_name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        (s.class_name && s.class_name.toLowerCase().includes(q))
    );
  }, [paperFilteredSheets, searchQuery]);

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
      alert('Failed to download student marksheet PDF.');
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
      alert('Failed to export class Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Export Class PDF
  const handleExportClassPdf = async () => {
    if (!effectivePaperIdForClass) return;
    try {
      setIsExportingPdf(true);
      const url = `/api/papers/${effectivePaperIdForClass}/export/pdf`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Class PDF export failed');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const paperObj = papers.find((p) => p.id === effectivePaperIdForClass);
      const titleClean = (paperObj?.title || 'Class_Marksheet').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Class_Marksheet_${titleClean}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err) {
      alert('Failed to export class PDF.');
    } finally {
      setIsExportingPdf(false);
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
    <div className="flex-1 min-h-0 bg-[#F6F7F5] overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Loading state */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <div className="w-8 h-8 border-3 border-[#0F5132] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono font-medium text-slate-500">Loading student reports &amp; marks...</span>
        </div>
      ) : evaluatedSheets.length === 0 ? (
        /* Empty state: 0 evaluated sheets */
        <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-10 max-w-xl mx-auto my-12 text-center shadow-[0_4px_16px_rgba(17,24,39,0.04)] space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#E8F3EE] text-[#0F5132] flex items-center justify-center mx-auto border border-[#C8E3D5]">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">No evaluated student sheets yet</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              Upload candidate answer booklets and complete AI evaluation to generate official Bento Marksheets, institutional grading records, and class gradebooks.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/upload';
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <span>+ Evaluate Answer Sheets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top Student & Class Control Bar */}
          <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-4 md:p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)] space-y-4">
            {/* Top row: Paper Filter, Search, and Action Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
              {/* Left: Filter Controls */}
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                {/* Paper / Exam Filter */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-[#0F5132]" />
                  <span className="text-xs font-bold text-slate-700">Exam:</span>
                  <select
                    value={selectedPaperId}
                    onChange={(e) => handlePaperChange(e.target.value)}
                    className="h-8 text-xs bg-[#F1F4F2] border border-[#E2E8E4] rounded-xl px-2.5 font-semibold text-slate-800 focus:ring-2 focus:ring-[#0F5132] focus:outline-none cursor-pointer max-w-[220px] truncate"
                  >
                    <option value="all">All Exams ({evaluatedSheets.length} Sheets)</option>
                    {papers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.subject})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Student / Roll No */}
                <div className="relative flex-1 min-w-[180px] max-w-[260px]">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search candidate / roll..."
                    className="w-full h-8 text-xs bg-[#F1F4F2] border border-[#E2E8E4] rounded-xl pl-8 pr-3 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#0F5132] focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>

                {/* Specific Student Select Dropdown */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold text-slate-700">Student:</span>
                  <select
                    value={selectedSheetId}
                    onChange={(e) => setSelectedSheetId(e.target.value)}
                    className="h-8 text-xs bg-[#F1F4F2] border border-[#E2E8E4] rounded-xl px-2.5 font-semibold text-slate-800 focus:ring-2 focus:ring-[#0F5132] focus:outline-none cursor-pointer max-w-[240px] truncate"
                  >
                    {displayedSheets.map((s) => (
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
                  className="px-3.5 py-2 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] disabled:opacity-40 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
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
                  className="px-3 py-2 rounded-xl bg-white hover:bg-[#F1F4F2] disabled:opacity-40 text-slate-700 text-xs font-semibold border border-[#E2E8E4] shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Export class roster and itemized scores to Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{isExportingExcel ? 'Exporting...' : 'Export Class Excel (.xlsx)'}</span>
                </button>

                {/* Export Class PDF */}
                <button
                  type="button"
                  onClick={handleExportClassPdf}
                  disabled={!effectivePaperIdForClass || isExportingPdf}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-[#F1F4F2] disabled:opacity-40 text-slate-700 text-xs font-semibold border border-[#E2E8E4] shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Download consolidated class-wide mark roster PDF"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isExportingPdf ? 'Generating...' : 'Export Class PDF (.pdf)'}</span>
                </button>
              </div>
            </div>

            {/* Bottom Row: Quick-Select Student Pills */}
            {displayedSheets.length > 0 && (
              <div className="pt-2 border-t border-[#E2E8E4]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Quick-Select Candidate ({displayedSheets.length} found):
                  </span>
                  {currentSheet && (
                    <span className="text-[11px] font-mono text-[#0F5132] font-semibold">
                      Viewing: {currentSheet.student_name} ({currentSheet.roll_number})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {displayedSheets.map((s) => {
                    const isSelected = s.id === selectedSheetId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSheetId(s.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer shrink-0 ${
                          isSelected
                            ? 'bg-[#E8F3EE] text-[#0F5132] border-[#0F5132] font-semibold shadow-xs'
                            : 'bg-[#F1F4F2] text-slate-700 hover:bg-[#E2E8E4] border-[#E2E8E4]'
                        }`}
                      >
                        <span className="font-semibold">{s.student_name}</span>
                        <span className="text-[11px] font-mono text-slate-400">·</span>
                        <span className="font-mono text-[11px]">{s.roll_number}</span>
                        <span className="text-[11px] font-mono text-slate-400">·</span>
                        <span className="font-mono font-bold text-[#0F5132]">
                          {s.score}/{s.max_marks}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            s.grade === 'O' || s.grade.startsWith('A')
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.grade.startsWith('B')
                              ? 'bg-teal-100 text-teal-800'
                              : s.grade === 'F'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.grade}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Embedded Student Report Card: Front/Back Bento Marksheet */}
          {selectedSheetId ? (
            <div className="space-y-4">
              <BentoMarksheetView sheetId={selectedSheetId} />
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-8 text-center text-slate-500 text-xs">
              Select a student from the list above to preview their Bento Marksheet.
            </div>
          )}
        </>
      )}
    </div>
  );
};
