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
    <div className="h-full flex flex-col bg-slate-50 overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <span>Evaluation History</span>
            <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
              {data.sheets.length} Records
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Search, filter, and inspect past answer sheets across subjects, exams, and classes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => store.setStep('upload')}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <FileCheck2 className="w-4 h-4" />
          <span>New Evaluation</span>
        </button>
      </div>

      {/* Teacher Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <span>Teacher Filters</span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Subject Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
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
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Exam / Paper
            </label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
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
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Student Name
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search name..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                onBlur={fetchHistory}
                className="w-full h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-7 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentSearch('');
                    setTimeout(fetchHistory, 0);
                  }}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Roll No Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Roll No.
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. 24 or CS-301..."
                value={rollSearch}
                onChange={(e) => setRollSearch(e.target.value)}
                onBlur={fetchHistory}
                className="w-full h-9 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-7 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              {rollSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setRollSearch('');
                    setTimeout(fetchHistory, 0);
                  }}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-semibold text-slate-500">Status:</span>
          {(['all', 'ready', 'needs_review'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                selectedStatus === st
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'all' ? 'All' : st === 'ready' ? 'Ready / Graded' : 'Needs Review'}
            </button>
          ))}
        </div>
      </div>

      {/* Evaluated Sheets Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-500">Loading sheets history...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
            {error}
          </div>
        ) : data.sheets.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No answer sheets match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
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
              <tbody className="divide-y divide-slate-100">
                {data.sheets.map((sh) => (
                  <tr key={sh.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {sh.roll_number || '—'}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {sh.student_name}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {sh.class_name || '—'}
                    </td>
                    <td className="py-3 px-3 truncate max-w-[220px]" title={`${sh.subject} - ${sh.exam_title}`}>
                      <span className="font-semibold text-slate-800 block">{sh.subject}</span>
                      <span className="text-slate-400 text-[11px] truncate block">{sh.exam_title}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-800">
                      {sh.score} / {sh.max_marks}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-indigo-600">
                      {sh.percentage}%
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                      {sh.grade || '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          sh.status === 'needs_review' || sh.flags_open > 0
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
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
                    <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {sh.evaluated_at ? sh.evaluated_at.substring(0, 10) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => store.setStep('evaluate', sh.id)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
                        >
                          Evaluate
                        </button>
                        <button
                          type="button"
                          onClick={() => store.setStep('report', sh.id)}
                          className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                        >
                          <span>Report</span>
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
