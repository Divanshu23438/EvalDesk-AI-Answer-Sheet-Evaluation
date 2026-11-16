import React from 'react';
import { Download, Printer } from 'lucide-react';
import { type ReportData, formatQNo } from './types';
import { type EvaluatedReviewItem } from '../../utils/apiOcr';

export interface ReportsStepProps {
  currentPaperId: string;
  reportData: ReportData | null;
  studentName: string;
  rollNo: string;
  totalScore: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  basis: string;
  reviewItems: EvaluatedReviewItem[];
}

export const ReportsStep: React.FC<ReportsStepProps> = ({
  currentPaperId,
  reportData,
  studentName,
  rollNo,
  totalScore,
  maxMarks,
  percentage,
  grade,
  basis,
  reviewItems,
}) => {
  return (
    <section className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
        <div>
          <h1 className="text-lg font-bold text-[#005dac]">Academic Reports & Performance Analysis</h1>
          <p className="text-xs text-[#64748b]">
            Student Report Cards (PDF) and Class Results Matrix (Excel)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-[#c1c6d4] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#f1f5f9] flex items-center gap-1 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
          {reportData?.student_reports?.[0] && (
            <a
              href={reportData.student_reports[0].url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[#005dac] px-3 py-1.5 text-xs font-bold text-[#005dac] hover:bg-[#eff4ff] flex items-center gap-1 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" /> Student PDF Report Card
            </a>
          )}
          {reportData?.paper_summary_pdf_url && (
            <a
              href={reportData.paper_summary_pdf_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[#005dac] px-3 py-1.5 text-xs font-bold text-[#005dac] hover:bg-[#eff4ff] flex items-center gap-1 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" /> Paper Summary PDF
            </a>
          )}
          <a
            href={reportData?.excel_report_url || `/api/papers/${currentPaperId}/reports`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-[#005dac] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#004786] flex items-center gap-1 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" /> Download Excel Matrix
          </a>
        </div>
      </div>

      {/* Student Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
          <span className="text-[#64748b] block">Student</span>
          <strong className="text-sm">{studentName}</strong>
        </div>
        <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
          <span className="text-[#64748b] block">Roll Number</span>
          <strong className="text-sm">{rollNo}</strong>
        </div>
        <div className="p-3 rounded-lg bg-[#eff4ff] border border-[#d4e3ff]">
          <span className="text-[#005dac] block">Total Score</span>
          <strong className="text-base text-[#005dac]">{totalScore} / {maxMarks}</strong>
        </div>
        <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
          <span className="text-[#64748b] block">Percentage</span>
          <strong className="text-sm">{percentage}%</strong>
        </div>
        <div className="p-3 rounded-lg bg-[#e8f5e9] border border-[#c8e6c9]">
          <span className="text-[#196b22] block">Grade</span>
          <strong className="text-sm text-[#196b22]">{grade}</strong>
        </div>
        <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
          <span className="text-[#64748b] block">Evaluation Basis</span>
          <strong className="text-[11px] truncate block">{basis}</strong>
        </div>
      </div>

      {/* Questions Table */}
      <div className="overflow-x-auto rounded-lg border border-[#e2e8f0]">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#f8f9ff] border-b border-[#e2e8f0] font-bold text-[#414752]">
            <tr>
              <th className="p-2.5">Q #</th>
              <th className="p-2.5">Marks Obtained / Max</th>
              <th className="p-2.5">Status</th>
              <th className="p-2.5">Remarks / Quoted Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {reviewItems.map((item) => (
              <tr key={item.q_no} className="hover:bg-[#f8f9ff]">
                <td className="p-2.5 font-bold">{formatQNo(item.q_no)}</td>
                <td className="p-2.5 font-semibold">
                  {item.finalMarks} / {item.max_marks}M
                </td>
                <td className="p-2.5">
                  <span className="rounded bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#196b22]">
                    {item.statusLabel || 'Auto-Verified'}
                  </span>
                </td>
                <td className="p-2.5 text-[#414752]">
                  {item.feedback || item.reason || 'Answers verified against rubric standard.'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Strengths & Improvements */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[#c8e6c9] bg-[#f1f8e9] p-4 text-xs">
          <h3 className="font-bold text-[#2e7d32] mb-1">Key Strengths (Task T7 Rubric Analysis)</h3>
          <ul className="list-disc list-inside space-y-1 text-[#33691e]">
            {reviewItems.filter((r) => r.finalMarks >= r.max_marks * 0.75).map((r, i) => (
              <li key={i}>Demonstrated mastery on {formatQNo(r.q_no)} ({r.finalMarks}/{r.max_marks} marks).</li>
            ))}
            {reviewItems.filter((r) => r.finalMarks >= r.max_marks * 0.75).length === 0 && (
              <li>Consistent effort across attempted questions.</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border border-[#ffe082] bg-[#fffde7] p-4 text-xs">
          <h3 className="font-bold text-[#f57f17] mb-1">Areas for Improvement (Missed Rubric Criteria)</h3>
          <ul className="list-disc list-inside space-y-1 text-[#e65100]">
            {reviewItems.filter((r) => r.finalMarks < r.max_marks * 0.75).map((r, i) => (
              <li key={i}>Review {formatQNo(r.q_no)}: {r.reason || 'Deductions against key points'}</li>
            ))}
            {reviewItems.filter((r) => r.finalMarks < r.max_marks * 0.75).length === 0 && (
              <li>No major rubric deficiencies identified.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
};
