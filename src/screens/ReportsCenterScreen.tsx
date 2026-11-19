import React, { useEffect, useState, useMemo } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import {
  FileSpreadsheet,
  Download,
  FileText,
  Search,
  Filter,
  CheckCircle,
  ExternalLink,
  Award,
  Users,
  Percent,
  TrendingUp,
} from 'lucide-react';

interface PaperOption {
  id: string;
  title: string;
  subject: string;
  total_marks: number;
}

interface SheetRow {
  id: string;
  paper_id: string;
  student_name: string;
  roll_number: string;
  class_name: string;
  total_score: number;
  max_marks: number;
  percentage: number;
  grade: string;
  status: string;
  created_at: string;
}

export const ReportsCenterScreen: React.FC = () => {
  const [state, store] = useSheetStore();

  const [papers, setPapers] = useState<PaperOption[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [sheets, setSheets] = useState<SheetRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [downloadingSheetId, setDownloadingSheetId] = useState<string | null>(null);

  // 1. Fetch available papers
  useEffect(() => {
    let isCancelled = false;
    const fetchPapers = async () => {
      try {
        const res = await apiClient.get<{ sheets: any[]; subjects: string[]; exams: string[] }>('/api/sheets/history');
        if (isCancelled) return;

        // Group sheets by paper_id to form paper list
        const paperMap = new Map<string, PaperOption>();
        for (const sh of res.sheets || []) {
          if (!paperMap.has(sh.paper_id)) {
            paperMap.set(sh.paper_id, {
              id: sh.paper_id,
              title: sh.exam_title || 'Assessment Paper',
              subject: sh.subject || 'General',
              total_marks: sh.max_marks || 100,
            });
          }
        }

        const paperList = Array.from(paperMap.values());
        setPapers(paperList);

        // Auto-select current paper if in store, else first paper
        if (state.paperId && paperMap.has(state.paperId)) {
          setSelectedPaperId(state.paperId);
        } else if (paperList.length > 0) {
          setSelectedPaperId(paperList[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch papers for reports center:', err);
      }
    };

    fetchPapers();
    return () => {
      isCancelled = true;
    };
  }, [state.paperId]);

  // 2. Fetch sheets for selected paper
  useEffect(() => {
    if (!selectedPaperId) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    const fetchPaperSheets = async () => {
      try {
        setIsLoading(true);
        const res = await apiClient.get<{ sheets: any[] }>(`/api/papers/${selectedPaperId}/sheets`);
        if (!isCancelled) {
          setSheets(res.sheets || []);
        }
      } catch (err) {
        console.error('Failed to fetch paper sheets:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchPaperSheets();
    return () => {
      isCancelled = true;
    };
  }, [selectedPaperId]);

  const activePaper = papers.find((p) => p.id === selectedPaperId);

  // Distinct classes for filter dropdown
  const distinctClasses = useMemo(() => {
    const set = new Set<string>();
    for (const s of sheets) {
      if (s.class_name && s.class_name.trim()) {
        set.add(s.class_name.trim());
      }
    }
    return Array.from(set).sort();
  }, [sheets]);

  // Filtered sheets
  const filteredSheets = useMemo(() => {
    return sheets.filter((s) => {
      if (selectedClass !== 'all') {
        const sc = (s.class_name || '').trim().toLowerCase();
        if (sc !== selectedClass.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = (s.student_name || '').toLowerCase().includes(q);
        const rollMatch = (s.roll_number || '').toLowerCase().includes(q);
        if (!nameMatch && !rollMatch) return false;
      }
      return true;
    });
  }, [sheets, selectedClass, searchQuery]);

  // Summary KPIs for current class / paper
  const classStats = useMemo(() => {
    const total = filteredSheets.length;
    if (total === 0) {
      return { total: 0, passPct: 0, avgScore: 0, avgPct: 0, highestScore: 0, maxMarks: activePaper?.total_marks || 100 };
    }
    const maxM = activePaper?.total_marks || filteredSheets[0]?.max_marks || 100;
    const scores = filteredSheets.map((s) => s.total_score || 0);
    const avgScore = roundNum(scores.reduce((a, b) => a + b, 0) / total, 1);
    const avgPct = maxM > 0 ? roundNum((avgScore / maxM) * 100, 1) : 0;
    const highestScore = Math.max(...scores);
    const passCount = scores.filter((sc) => maxM > 0 && sc / maxM >= 0.40).length;
    const passPct = roundNum((passCount / total) * 100, 1);

    return {
      total,
      passPct,
      avgScore,
      avgPct,
      highestScore,
      maxMarks: maxM,
    };
  }, [filteredSheets, activePaper]);

  function roundNum(n: number, d = 1) {
    return Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
  }

  // Whole Class Excel Export
  const handleDownloadClassExcel = async () => {
    if (!selectedPaperId) return;
    try {
      setIsExportingExcel(true);
      const url = `/api/papers/${selectedPaperId}/export/excel${
        selectedClass !== 'all' ? `?class_name=${encodeURIComponent(selectedClass)}` : ''
      }`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `Class_Results_${activePaper?.title || selectedPaperId.slice(0, 8)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to generate Class Excel report.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Whole Class Marksheet PDF Export
  const handleDownloadClassPdf = async () => {
    if (!selectedPaperId) return;
    try {
      setIsExportingPdf(true);
      const url = `/api/papers/${selectedPaperId}/export/class-pdf${
        selectedClass !== 'all' ? `?class_name=${encodeURIComponent(selectedClass)}` : ''
      }`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `Class_Marksheet_${activePaper?.title || selectedPaperId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to generate Class Marksheet PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Individual Student Report Card PDF
  const handleDownloadStudentPdf = async (sheetId: string, studentName: string) => {
    try {
      setDownloadingSheetId(sheetId);
      const url = `/api/sheets/${sheetId}/export/pdf`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `Report_Card_${studentName || sheetId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to generate Student Report Card PDF.');
    } finally {
      setDownloadingSheetId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F6F7F5] overflow-y-auto p-4 md:p-6 space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#0F5132]" />
            <span>Reports &amp; Results Center</span>
            <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Official Records
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Download consolidated class marksheets (.pdf), grade matrices (.xlsx), and individual student report cards.
          </p>
        </div>

        {/* Paper Selector Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
            Assessment:
          </label>
          <select
            value={selectedPaperId}
            onChange={(e) => setSelectedPaperId(e.target.value)}
            className="h-9 text-xs bg-[#F6F7F5] border border-[#E2E8E4] rounded-xl px-3 font-semibold text-slate-800 focus:ring-2 focus:ring-[#0F5132] focus:outline-none cursor-pointer max-w-[260px] truncate"
          >
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.subject})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-4 shadow-[0_4px_16px_rgba(17,24,39,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-[#0F5132]" />
            <span>Class Filter:</span>
          </div>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="h-8 text-xs bg-[#F6F7F5] border border-[#E2E8E4] rounded-lg px-2.5 font-medium text-slate-800 focus:ring-1 focus:ring-[#0F5132] focus:outline-none cursor-pointer"
          >
            <option value="all">All Classes ({sheets.length} students)</option>
            {distinctClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search student or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 text-xs bg-[#F6F7F5] border border-[#E2E8E4] rounded-lg pl-8 pr-3 text-slate-800 focus:ring-2 focus:ring-[#0F5132] focus:outline-none"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* One-Click Whole-Class Result Card */}
      <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E2E8E4]">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F5132]">
              Whole-Class Performance Overview
            </span>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              {activePaper?.title || 'Assessment Paper'} · {activePaper?.subject || 'General'}
            </h2>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleDownloadClassExcel}
              disabled={isExportingExcel || filteredSheets.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExportingExcel ? 'Exporting...' : 'Download Class Result (.xlsx)'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadClassPdf}
              disabled={isExportingPdf || filteredSheets.length === 0}
              className="px-3.5 py-2 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>{isExportingPdf ? 'Generating...' : 'Download Class Marksheet (.pdf)'}</span>
            </button>
          </div>
        </div>

        {/* 4 Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#F1F4F2] border border-[#E2E8E4]">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Users className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold uppercase">Total Students</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {classStats.total}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F1F4F2] border border-[#E2E8E4]">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Percent className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold uppercase">Passing Rate</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 tabular-nums">
              {classStats.passPct}%
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F1F4F2] border border-[#E2E8E4]">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold uppercase">Class Average</span>
            </div>
            <div className="text-xl font-bold font-mono text-[#0F5132] tabular-nums">
              {classStats.avgScore} / {classStats.maxMarks} <span className="text-xs text-slate-500 font-normal">({classStats.avgPct}%)</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F1F4F2] border border-[#E2E8E4]">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Award className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold uppercase">Highest Score</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {classStats.highestScore} / {classStats.maxMarks}
            </div>
          </div>
        </div>
      </div>

      {/* Class Result Ledger Table */}
      <div className="bg-white border border-[#E2E8E4] rounded-[20px] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">
            Class Result Ledger ({filteredSheets.length} Students)
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Official Marks Record
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-6 h-6 border-2 border-[#0F5132] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-slate-500">Loading student marks...</span>
          </div>
        ) : filteredSheets.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            <p className="text-slate-400 text-xs">
              No students found for this assessment or class filter.
            </p>
            <button
              onClick={() => { window.location.hash = '#/upload'; }}
              className="px-4 py-2 bg-[#0F5132] hover:bg-[#0B3D26] text-white text-xs font-semibold rounded-xl transition"
            >
              + Evaluate New Sheets
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F1F4F2]">
                <tr className="border-b border-[#E2E8E4] text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Roll No.</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Class</th>
                  <th className="py-2.5 px-3 text-center">Marks</th>
                  <th className="py-2.5 px-3 text-center">%</th>
                  <th className="py-2.5 px-3 text-center">Grade</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Download &amp; Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8E4]">
                {filteredSheets.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F6F7F5] transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {s.roll_number || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {s.student_name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {s.class_name || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800">
                      {s.total_score || 0} / {s.max_marks || activePaper?.total_marks || 10}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#0F5132] tabular-nums">
                      {s.percentage || 0}%
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                      {s.grade || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownloadStudentPdf(s.id, s.student_name)}
                          disabled={downloadingSheetId === s.id}
                          className="px-2.5 py-1 rounded bg-[#F1F4F2] hover:bg-[#E2E8E4] text-slate-700 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                          title="Download Student Result Card PDF"
                        >
                          <Download className="w-3 h-3 text-slate-500" />
                          <span>{downloadingSheetId === s.id ? 'Saving...' : 'PDF'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => store.setStep('report', s.id)}
                          className="px-2.5 py-1 rounded bg-[#E8F3EE] hover:bg-[#0F5132]/20 text-[#0F5132] text-xs font-semibold border border-[#0F5132]/20 transition flex items-center gap-1 cursor-pointer"
                          title="Preview Full Booklet & Questions"
                        >
                          <span>Preview</span>
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
