import { ArrowLeft, ArrowRight, FileCheck2 } from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import { computeSheetTotals } from '../../utils/gradingEngine';

export function StudentResults() {
  const { state, currentUser, setSelectedPaperId, setActiveView } = useEval();
  if (!currentUser) return null;

  // Strictly published results only (PRD S2)
  const publishedSheets = state.sheets.filter(
    (s) => s.studentId === currentUser.id && s.status === 'published'
  );

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#0b1c30]">My Published Results</h1>
        <p className="text-xs text-[#64748b] mt-0.5">
          Teacher-confirmed scores for published papers. Pending or unpublished papers remain private until release.
        </p>
      </div>

      {publishedSheets.length === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-8 text-center space-y-2">
          <FileCheck2 className="w-8 h-8 text-[#64748b] mx-auto" />
          <div className="text-sm font-semibold text-[#0b1c30]">No published results available</div>
          <p className="text-xs text-[#64748b]">
            Your results will appear here automatically once the Examination Cell publishes them.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#e2e8f0] text-[#64748b] uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Exam & Paper</th>
                  <th className="py-2.5 px-4 text-right">Score</th>
                  <th className="py-2.5 px-4">Result</th>
                  <th className="py-2.5 px-4">Published On</th>
                  <th className="py-2.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {publishedSheets.map((s) => {
                  const paper = state.papers.find((p) => p.id === s.paperId);
                  const exam = state.exams.find((e) => e.id === paper?.examId);
                  const subj = state.subjects.find((sub) => sub.id === paper?.subjectId);
                  const totals = computeSheetTotals(s);
                  const pass = paper ? totals.finalTotal >= paper.passingMarks : true;

                  return (
                    <tr key={s.id} className="hover:bg-[#f8f9ff]">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#0b1c30]">
                          {subj?.code} — {subj?.name}
                        </div>
                        <div className="text-[11px] text-[#64748b]">{exam?.name}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-[#0b1c30]">
                        {totals.finalTotal} / {paper?.totalMarks}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${
                            pass
                              ? 'bg-[#e8f5e9] text-[#196b22] border-[#88d982]'
                              : 'bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]'
                          }`}
                        >
                          {pass ? 'Pass' : 'Fail'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#64748b] tabular-nums">
                        {s.publishedAt ? new Date(s.publishedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (paper) setSelectedPaperId(paper.id);
                            setActiveView('student_result_detail');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#005dac] text-white font-semibold"
                        >
                          <span>View Breakdown</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function StudentResultDetail() {
  const { state, currentUser, selectedPaperId, setActiveView } = useEval();
  if (!currentUser) return null;

  const sheet =
    state.sheets.find(
      (s) =>
        s.studentId === currentUser.id &&
        s.status === 'published' &&
        (!selectedPaperId || s.paperId === selectedPaperId)
    ) ?? null;

  const paper = sheet ? state.papers.find((p) => p.id === sheet.paperId) : null;
  const subj = paper ? state.subjects.find((s) => s.id === paper.subjectId) : null;

  if (!sheet || !paper) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => setActiveView('student_results')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#005dac] mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Results</span>
        </button>
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-6 text-xs text-[#64748b]">
          Published result not found.
        </div>
      </div>
    );
  }

  const totals = computeSheetTotals(sheet);

  // Optional class average across published sheets (Admin switch)
  const publishedForPaper = state.sheets.filter(
    (s) => s.paperId === paper.id && s.status === 'published'
  );
  const classAvg =
    publishedForPaper.length > 0
      ? (
          publishedForPaper.reduce((sum, s) => sum + computeSheetTotals(s).finalTotal, 0) /
          publishedForPaper.length
        ).toFixed(1)
      : null;

  // Never show AI internals (no confidence %, no AI suggested marks, no NLI checks) — strictly PRD S3!
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setActiveView('student_results')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#005dac] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Results</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('student_requests')}
          className="px-3.5 py-2 rounded border border-[#005dac] text-[#005dac] hover:bg-[#eff4ff] text-xs font-semibold"
        >
          Request Evaluated Answer Sheet
        </button>
      </div>

      <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[#0b1c30]">
            {subj?.code} — {subj?.name}
          </h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Confirmed marks by subject evaluator · Passing threshold: {paper.passingMarks} / {paper.totalMarks}
          </p>
        </div>

        <div className="flex items-center gap-5">
          {state.settings.showClassAverageToStudents && classAvg && (
            <div className="text-right">
              <div className="text-[11px] text-[#64748b]">Class Average</div>
              <div className="text-base font-mono font-semibold text-[#414752] tabular-nums">
                {classAvg} / {paper.totalMarks}
              </div>
            </div>
          )}
          <div className="text-right">
            <div className="text-[11px] text-[#64748b]">Your Total</div>
            <div className="text-2xl font-mono font-semibold text-[#005dac] tabular-nums">
              {totals.finalTotal} / {paper.totalMarks}
            </div>
          </div>
        </div>
      </div>

      {/* Per-question confirmed marks + feedback */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg divide-y divide-[#e2e8f0]">
        {sheet.answers.map((ans) => {
          const q = state.questions.find((x) => x.id === ans.questionId);
          return (
            <div key={ans.questionId} className="p-4 space-y-2 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-[#0b1c30]">
                  {q?.label}. {q?.text}
                </div>
                <span className="font-mono font-semibold text-[#0b1c30] shrink-0 tabular-nums">
                  {ans.finalMarks} / {q?.marks}
                </span>
              </div>
              {state.settings.showQuestionFeedbackToStudents && ans.feedback && (
                <div className="p-2.5 rounded bg-[#f8f9ff] border border-[#e2e8f0] text-[#414752]">
                  <strong>Teacher feedback:</strong> {ans.feedback}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
