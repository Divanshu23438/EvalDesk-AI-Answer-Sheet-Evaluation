import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../api/client';
import { StudentReportView } from '../components/StudentReportView';
import {
  FileSpreadsheet,
  Filter,
  ArrowRight,
  ArrowLeft,
  Search,
  X,
  Calendar,
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
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [evaluatedSheets, setEvaluatedSheets] = useState<EvaluatedSheetItem[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(() => {
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
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch papers and evaluated sheets from backend
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

  // Sheets filtered by paper and search query
  const filteredSheets = useMemo(() => {
    return evaluatedSheets.filter((s) => {
      const matchesPaper = selectedPaperId === 'all' || s.paper_id === selectedPaperId;
      if (!matchesPaper) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const studentName = (s.student_name || '').toLowerCase();
      const rollNumber = (s.roll_number || '').toLowerCase();
      const examTitle = (s.exam_title || paperMap[s.paper_id]?.title || '').toLowerCase();
      const subject = (s.subject || paperMap[s.paper_id]?.subject || '').toLowerCase();
      const className = (s.class_name || '').toLowerCase();
      return (
        studentName.includes(q) ||
        rollNumber.includes(q) ||
        examTitle.includes(q) ||
        subject.includes(q) ||
        className.includes(q)
      );
    });
  }, [evaluatedSheets, selectedPaperId, searchQuery, paperMap]);

  // Current selected sheet object (when a student is chosen)
  const currentSheet = useMemo(() => {
    if (!selectedSheetId) return null;
    return evaluatedSheets.find((s) => s.id === selectedSheetId) || null;
  }, [evaluatedSheets, selectedSheetId]);

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
      ) : selectedSheetId !== null ? (
        /* ========================================================================= */
        /* STATE 2: Teacher clicked a student — Show Compact Top Bar + Report UI     */
        /* ========================================================================= */
        <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
          {/* Compact Top Bar with Back to Search */}
          <header className="h-11 bg-white dark:bg-[#181B19] border-b border-[#E2E8E4] dark:border-[#2A2F2C] px-4 flex items-center justify-between shrink-0 select-none z-10 print:hidden">
            <div className="flex items-center space-x-3 text-xs">
              <button
                type="button"
                onClick={() => setSelectedSheetId(null)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#0F5132] dark:text-[#7CC9A3] hover:text-[#0B3D26] dark:hover:text-[#27855A] transition-colors cursor-pointer"
                title="Search Another Student"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>← Search Another Student</span>
              </button>
              <span className="text-[#E2E8E4] dark:text-[#2F3532]">|</span>
              <div className="flex items-center space-x-2 text-[#6B7280] dark:text-[#68706C] font-medium">
                <span
                  className="truncate max-w-[220px]"
                  title={currentSheet?.exam_title || paperMap[currentSheet?.paper_id || '']?.title || 'Examination'}
                >
                  {currentSheet?.exam_title || paperMap[currentSheet?.paper_id || '']?.title || 'Examination'}
                </span>
                {currentSheet?.student_name && (
                  <>
                    <span className="text-[#E2E8E4] dark:text-[#2F3532]">/</span>
                    <span
                      className="text-[#111827] dark:text-[#ECEEED] font-semibold truncate max-w-[180px]"
                      title={currentSheet.student_name}
                    >
                      {currentSheet.student_name}
                    </span>
                    <span className="font-mono text-[11px] text-[#6B7280] dark:text-[#68706C]">
                      ({currentSheet.roll_number})
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right Status Label */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-[#6B7280] dark:text-[#68706C]">
                Official Marksheet
              </span>
            </div>
          </header>

          {/* Directly below it: exact restored previous Report component */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <StudentReportView
              sheetId={selectedSheetId}
              onBack={() => setSelectedSheetId(null)}
            />
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* STATE 1: No student selected (selectedSheetId === null) — Search-First    */
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
                      Select an evaluated student to view their comprehensive marksheet, question-by-question telemetry, and performance analytics.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#6B7280] dark:text-[#68706C] bg-[#F1F4F2] dark:bg-[#202422] px-3 py-1.5 rounded-lg border border-[#E2E8E4] dark:border-[#2F3532] self-start sm:self-auto">
                  <span>{evaluatedSheets.length} Evaluated Total</span>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="pt-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                {/* Search Input */}
                <div className="sm:col-span-8 relative">
                  <Search className="w-4 h-4 text-[#6B7280] dark:text-[#68706C] absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by student name, roll number, or exam..."
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
                <div className="sm:col-span-4 relative flex items-center">
                  <Filter className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3] absolute left-3 pointer-events-none" />
                  <select
                    value={selectedPaperId}
                    onChange={(e) => setSelectedPaperId(e.target.value)}
                    className="w-full h-10 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl pl-8 pr-3 font-medium text-[#111827] dark:text-[#ECEEED] focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:outline-none cursor-pointer truncate"
                  >
                    <option value="all">All Exams / Subjects ({evaluatedSheets.length})</option>
                    {papers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} {p.subject ? `(${p.subject})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Results Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#68706C]">
                  Evaluated Students ({filteredSheets.length})
                </span>
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
                  {(searchQuery || selectedPaperId !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedPaperId('all');
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

                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedSheetId(s.id)}
                        className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] hover:border-[#0F5132]/40 dark:hover:border-[#1F6E4A] rounded-2xl p-4 transition-all duration-150 flex flex-col justify-between group cursor-pointer hover:shadow-sm"
                      >
                        {/* Top: Student & Exam Metadata */}
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
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
                        <div className="pt-3 mt-3 border-t border-[#F1F4F2] dark:border-[#202422] flex items-center justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSheetId(s.id);
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
