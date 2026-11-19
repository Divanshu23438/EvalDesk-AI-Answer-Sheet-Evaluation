import React, { useEffect, useState, useMemo } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import {
  History,
  Search,
  X,
  Filter,
  FileCheck2,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface HistorySheetItem {
  id: string;
  paper_id: string;
  student_name: string;
  roll_number: string;
  class_name: string;
  subject: string;
  exam_title: string;
  score: number;
  max_marks: number;
  percentage: number;
  grade: string;
  status: string;
  flags_open: number;
  evaluated_at: string;
  created_at: string;
}

interface HistoryResponse {
  sheets: HistorySheetItem[];
  subjects: string[];
  exams: string[];
}

export const HistoryScreen: React.FC = () => {
  const [, store] = useSheetStore();
  const [data, setData] = useState<HistoryResponse>({ sheets: [], subjects: [], exams: [] });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedExam, setSelectedExam] = useState<string>('all');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [rollSearch, setRollSearch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'ready' | 'needs_review'>('all');

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedSubject !== 'all') params.set('subject', selectedSubject);
      if (selectedExam !== 'all') params.set('exam', selectedExam);
      if (studentSearch.trim()) params.set('student_name', studentSearch.trim());
      if (rollSearch.trim()) params.set('roll_no', rollSearch.trim());
      if (selectedStatus !== 'all') params.set('status', selectedStatus);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiClient.get<HistoryResponse>(`/api/sheets/history${qs}`);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load evaluation history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedSubject, selectedExam, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleResetFilters = () => {
    setSelectedSubject('all');
    setSelectedExam('all');
    setStudentSearch('');
    setRollSearch('');
    setSelectedStatus('all');
  };

  const hasActiveFilters =
    selectedSubject !== 'all' ||
    selectedExam !== 'all' ||
    studentSearch.trim() !== '' ||
    rollSearch.trim() !== '' ||
    selectedStatus !== 'all';

  return (
    <div className="h-full flex flex-col bg-[#F6F7F5] dark:bg-[#111312] overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none">
        <div>
          <h1 className="text-xl font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-[#0F5132] dark:text-[#7CC9A3]" />
            <span>Evaluation History</span>
            <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#202422] text-slate-700 dark:text-[#ECEEED] border border-slate-200 dark:border-[#2F3532] font-mono">
              {data.sheets.length} Records
            </span>
          </h1>
          <p className="text-xs text-[#4B5563] dark:text-[#969E9A] mt-1">
            Search, filter, and inspect past answer sheets across subjects, exams, and classes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => store.setStep('upload')}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white text-xs font-semibold shadow-none transition-all cursor-pointer self-start sm:self-auto"
        >
          <FileCheck2 className="w-4 h-4" />
          <span>New Evaluation</span>
        </button>
      </div>

      {/* Teacher Filter Toolbar */}
      <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-4 shadow-none dark:shadow-none space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#111827] dark:text-[#ECEEED]">
            <Filter className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3]" />
            <span>Teacher Filters</span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 dark:text-[#E57D8A] hover:text-rose-800 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Subject Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-[#969E9A] mb-1">
              Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full h-9 text-xs bg-slate-50 dark:bg-[#202422] border border-slate-200 dark:border-[#2F3532] rounded-xl px-2.5 text-slate-800 dark:text-[#ECEEED] font-medium focus:ring-2 focus:ring-[#0F5132] focus:outline-none cursor-pointer"
            >
              <option value="all">All Subjects</option>
              {data.subjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Exam Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-[#969E9A] mb-1">
              Exam / Paper
            </label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full h-9 text-xs bg-slate-50 dark:bg-[#202422] border border-slate-200 dark:border-[#2F3532] rounded-xl px-2.5 text-slate-800 dark:text-[#ECEEED] font-medium focus:ring-2 focus:ring-[#0F5132] focus:outline-none cursor-pointer"
            >
              <option value="all">All Exams</option>
              {data.exams.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
          </div>

          {/* Student Name Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-[#969E9A] mb-1">
              Student Name
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search name..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                onBlur={fetchHistory}
                className="w-full h-9 text-xs bg-slate-50 dark:bg-[#202422] border border-slate-200 dark:border-[#2F3532] rounded-xl pl-8 pr-7 text-slate-800 dark:text-[#ECEEED] focus:ring-2 focus:ring-[#0F5132] focus:outline-none placeholder:text-slate-400 dark:placeholder:text-[#68706C]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#68706C] absolute left-2.5 top-2.5" />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentSearch('');
                    setTimeout(fetchHistory, 0);
                  }}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-[#ECEEED]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Roll No Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-[#969E9A] mb-1">
              Roll No.
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. 24 or CS-301..."
                value={rollSearch}
                onChange={(e) => setRollSearch(e.target.value)}
                onBlur={fetchHistory}
                className="w-full h-9 text-xs font-mono bg-slate-50 dark:bg-[#202422] border border-slate-200 dark:border-[#2F3532] rounded-xl pl-8 pr-7 text-slate-800 dark:text-[#ECEEED] focus:ring-2 focus:ring-[#0F5132] focus:outline-none placeholder:text-slate-400 dark:placeholder:text-[#68706C]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-[#68706C] absolute left-2.5 top-2.5" />
              {rollSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setRollSearch('');
                    setTimeout(fetchHistory, 0);
                  }}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-[#ECEEED]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-[#2A2F2C] text-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-[#969E9A]">Status:</span>
          {(['all', 'ready', 'needs_review'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                selectedStatus === st
                  ? 'bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-[#0F5132]/20 dark:border-[#294236] shadow-none'
                  : 'bg-slate-100 dark:bg-[#202422] text-slate-600 dark:text-[#969E9A] hover:bg-slate-200 dark:hover:bg-[#2F3532]'
              }`}
            >
              {st === 'all' ? 'All' : st === 'ready' ? 'Ready / Graded' : 'Needs Review'}
            </button>
          ))}
        </div>
      </div>

      {/* Evaluated Sheets Table */}
      <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-5 shadow-none dark:shadow-none">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-6 h-6 border-2 border-[#0F5132] dark:border-[#1F6E4A] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-500 dark:text-[#969E9A]">Loading sheets history...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 dark:bg-[#2B191D] border border-rose-200 dark:border-[#45262C] text-rose-700 dark:text-[#E57D8A] rounded-xl text-xs">
            {error}
          </div>
        ) : data.sheets.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <p className="text-slate-400 dark:text-[#68706C] text-xs">No answer sheets match the selected filters.</p>
            <a
              href="#/upload"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white text-xs font-semibold shadow-none transition-all"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>+ Evaluate New Sheets</span>
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E2E8E4] dark:border-[#2F3532] bg-[#F1F4F2] dark:bg-[#202422] text-slate-500 dark:text-[#969E9A] font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Roll No.</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Class</th>
                  <th className="py-2.5 px-3">Subject / Exam</th>
                  <th className="py-2.5 px-3 text-center">Marks</th>
                  <th className="py-2.5 px-3 text-center">Score %</th>
                  <th className="py-2.5 px-3 text-center">Grade</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Evaluated Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2A2F2C]">
                {data.sheets.map((sh) => (
                  <tr key={sh.id} className="hover:bg-slate-50/80 dark:hover:bg-[#202422]/60 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-[#ECEEED]">
                      {sh.roll_number || '—'}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800 dark:text-[#ECEEED]">
                      {sh.student_name}
                    </td>
                    <td className="py-3 px-3 text-slate-500 dark:text-[#969E9A]">
                      {sh.class_name || '—'}
                    </td>
                    <td className="py-3 px-3 truncate max-w-[220px]" title={`${sh.subject} - ${sh.exam_title}`}>
                      <span className="font-semibold text-slate-800 dark:text-[#ECEEED] block">{sh.subject}</span>
                      <span className="text-slate-400 dark:text-[#68706C] text-[11px] truncate block">{sh.exam_title}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-800 dark:text-[#ECEEED]">
                      {sh.score} / {sh.max_marks}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3] tabular-nums">
                      {sh.percentage}%
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-700 dark:text-[#ECEEED]">
                      {sh.grade || '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          sh.status === 'needs_review' || sh.flags_open > 0
                            ? 'bg-amber-50 dark:bg-[#2B2416] text-amber-700 dark:text-[#E5B567] border border-amber-200 dark:border-[#42361F]'
                            : 'bg-emerald-50 dark:bg-[#1A2B23] text-emerald-700 dark:text-[#7CC9A3] border border-emerald-200 dark:border-[#294236]'
                        }`}
                      >
                        {sh.status === 'needs_review' || sh.flags_open > 0 ? (
                          <>
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>{sh.flags_open} flags</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-2.5 h-2.5" />
                            <span>Ready</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-400 dark:text-[#68706C] font-mono text-[11px]">
                      {sh.evaluated_at ? sh.evaluated_at.substring(0, 10) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => store.setStep('evaluate', sh.id)}
                          className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#202422] hover:bg-slate-200 dark:hover:bg-[#2F3532] text-slate-700 dark:text-[#ECEEED] border border-slate-200 dark:border-[#2F3532] text-xs font-medium transition cursor-pointer"
                        >
                          Evaluate
                        </button>
                        <button
                          type="button"
                          onClick={() => store.setStep('report', sh.id)}
                          className="px-2.5 py-1 rounded bg-[#E8F3EE] hover:bg-[#E8F3EE]/80 dark:bg-[#1A2B23] dark:hover:bg-[#233B2F] text-[#0F5132] dark:text-[#7CC9A3] text-xs font-semibold border border-[#0F5132]/20 dark:border-[#294236] transition cursor-pointer flex items-center gap-1"
                          title="View Student Marksheet"
                        >
                          <span>Marksheet</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
