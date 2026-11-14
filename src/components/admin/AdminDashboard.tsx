import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  FileCheck2,
  FilePlus2,
  Inbox,
  RefreshCw,
  ScanLine,
  Upload,
} from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import { PaperStatusBadge, RequestStatusBadge } from '../ui/StatusBadge';

export function AdminDashboard() {
  const { state, setActiveView, setSelectedPaperId, retryFailedSheet } = useEval();

  const uploadedCount = state.sheets.filter((s) => s.status === 'uploaded').length;
  const processingCount = state.sheets.filter((s) => s.status === 'processing').length;
  const awaitingReviewCount = state.sheets.filter(
    (s) => s.status === 'ready_for_review' || s.status === 'in_review' || s.status === 'reopened'
  ).length;
  const evaluatedCount = state.sheets.filter((s) => s.status === 'evaluated').length;
  const publishedCount = state.sheets.filter((s) => s.status === 'published').length;

  const failedSheets = state.sheets.filter((s) => s.status === 'failed');
  const openRequests = state.requests.filter(
    (r) => r.status === 'requested' || r.status === 'under_review' || r.status === 'approved'
  );

  const teacherCount = state.users.filter((u) => u.role === 'teacher' && u.status === 'active').length;
  const studentCount = state.users.filter((u) => u.role === 'student' && u.status === 'active').length;
  const hasAcademicStructure = state.subjects.length > 0 && state.classes.length > 0;
  const hasUsersProvisioned = teacherCount > 0 && studentCount > 0;
  const hasPaperAndRubric =
    state.papers.length > 0 && state.questions.some((q) => state.papers.some((p) => p.id === q.paperId));
  const hasSheetsAssigned = state.sheets.some((s) => Boolean(s.assignedTeacherId));
  const hasPublished = state.papers.some((p) => p.status === 'published');

  const checklistSteps = [
    {
      done: hasAcademicStructure,
      label: '1. Subjects & Classes',
      detail: `${state.subjects.length} subject(s), ${state.classes.length} class(es)`,
      view: 'admin_subjects',
      cta: 'Configure',
    },
    {
      done: hasUsersProvisioned,
      label: '2. Teachers & Students',
      detail: `${teacherCount} teacher(s), ${studentCount} student(s)`,
      view: 'admin_users',
      cta: 'Add Users',
    },
    {
      done: hasPaperAndRubric,
      label: '3. Exam, Paper & Answer Key',
      detail: `${state.papers.length} paper(s), ${state.questions.length} question(s)`,
      view: 'admin_exams',
      cta: 'Set Rubric',
    },
    {
      done: hasSheetsAssigned,
      label: '4. Upload & Assign Sheets',
      detail: `${state.sheets.length} sheet(s) uploaded`,
      view: state.sheets.length === 0 ? 'admin_intake' : 'admin_assignments',
      cta: state.sheets.length === 0 ? 'Upload Scans' : 'Assign',
    },
    {
      done: hasPublished,
      label: '5. Evaluate & Publish Results',
      detail: `${evaluatedCount + publishedCount} evaluated`,
      view: 'admin_results',
      cta: 'Publish',
    },
  ];

  const showOnboardingChecklist = state.sheets.length === 0 || state.papers.length === 0 || !hasUsersProvisioned;

  const statCards = [
    { label: 'Uploaded', value: uploadedCount, hint: 'Queued for OCR' },
    { label: 'Processing', value: processingCount, hint: 'Active worker' },
    { label: 'Awaiting Review', value: awaitingReviewCount, hint: 'With teachers', accent: 'text-[#875200]' },
    { label: 'Evaluated', value: evaluatedCount, hint: 'Ready to publish', accent: 'text-[#196b22]' },
    { label: 'Published', value: publishedCount, hint: 'Visible to students', accent: 'text-[#005dac]' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Header + Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0b1c30]">Examination Control Dashboard</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            One-look status across active papers, OCR intake, teacher progress, and student requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('admin_exams')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-[#c1c6d4] bg-white hover:bg-slate-50 text-xs font-semibold text-[#0b1c30] whitespace-nowrap"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Add Paper</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('admin_intake')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Sheets</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('admin_requests')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-[#005dac] text-[#005dac] hover:bg-[#eff4ff] text-xs font-semibold whitespace-nowrap"
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Review Requests ({openRequests.length})</span>
          </button>
        </div>
      </div>

      {/* Institution Onboarding Checklist */}
      {showOnboardingChecklist && (
        <div className="bg-white border border-[#c1c6d4] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#0b1c30]">Institution Workflow Checklist</h2>
              <p className="text-xs text-[#64748b]">
                Complete these steps to run an end-to-end examination cycle for {state.settings.institutionName}.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#005dac] tabular-nums">
              {checklistSteps.filter((s) => s.done).length} / {checklistSteps.length} complete
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {checklistSteps.map((step) => (
              <div
                key={step.label}
                className={`p-3 rounded border flex flex-col justify-between gap-2.5 ${
                  step.done ? 'bg-[#e8f5e9]/60 border-[#88d982]' : 'bg-[#f8f9ff] border-[#e2e8f0]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-start gap-1.5">
                    {step.done ? (
                      <CheckCircle2 className="w-4 h-4 text-[#196b22] shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#64748b] shrink-0 mt-0.5" />
                    )}
                    <span className="text-xs font-semibold text-[#0b1c30]">{step.label}</span>
                  </div>
                  <div className="text-[11px] text-[#64748b] pl-5.5">{step.detail}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView(step.view)}
                  className="self-start text-[11px] font-semibold text-[#005dac] hover:underline pl-5.5"
                >
                  {step.cta} →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5 Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((c) => (
          <div key={c.label} className="bg-white border border-[#e2e8f0] rounded-lg p-4">
            <div className="text-xs font-medium text-[#64748b]">{c.label}</div>
            <div className={`text-2xl font-semibold mt-1 tabular-nums ${c.accent || 'text-[#0b1c30]'}`}>
              {c.value}
            </div>
            <div className="text-[11px] text-[#64748b] mt-1">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Papers with progress per teacher */}
        <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0b1c30]">Papers & Teacher Progress</h2>
            <button
              type="button"
              onClick={() => setActiveView('admin_results')}
              className="text-xs font-medium text-[#005dac] hover:underline inline-flex items-center gap-1"
            >
              <span>Publishing console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-[#e2e8f0]">
            {state.papers.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="text-xs font-semibold text-[#0b1c30]">No examination papers created yet</div>
                <p className="text-xs text-[#64748b]">
                  Start by creating Subjects & Classes, then add your first Paper and Answer Key Rubric.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveView('admin_exams')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#005dac] text-white text-xs font-semibold mt-1"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>Create Paper</span>
                </button>
              </div>
            ) : (
              state.papers.map((paper) => {
                const subject = state.subjects.find((s) => s.id === paper.subjectId);
                const paperSheets = state.sheets.filter((s) => s.paperId === paper.id);
                const done = paperSheets.filter(
                  (s) => s.status === 'evaluated' || s.status === 'published'
                ).length;
                const pct = paperSheets.length > 0 ? Math.round((done / paperSheets.length) * 100) : 0;
                const teacherIds = Array.from(new Set(paperSheets.map((s) => s.assignedTeacherId).filter(Boolean)));
                const teacherNames = teacherIds
                  .map((tid) => state.users.find((u) => u.id === tid)?.name)
                  .filter(Boolean)
                  .join(', ');

                return (
                  <div key={paper.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#0b1c30]">
                          {subject?.code} — {subject?.name}
                        </span>
                        <PaperStatusBadge status={paper.status} />
                      </div>
                      <div className="text-xs text-[#64748b] mt-1">
                        <span>Assigned: {teacherNames || 'Unassigned'}</span>
                        <span aria-hidden="true"> · </span>
                        <span>Due {paper.dueDate}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="w-32">
                        <div className="flex justify-between text-[11px] text-[#414752] tabular-nums mb-1">
                          <span>
                            {done}/{paperSheets.length} done
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                          <div className="h-full bg-[#005dac]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPaperId(paper.id);
                          setActiveView('admin_exams');
                        }}
                        className="px-2.5 py-1.5 rounded border border-[#c1c6d4] text-xs font-medium text-[#0b1c30] hover:bg-slate-50 whitespace-nowrap"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Failed items & Open Student Requests */}
        <div className="lg:col-span-5 space-y-6">
          {/* Failed Items to Retry */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
                <h2 className="text-sm font-semibold text-[#0b1c30]">Failed Items to Retry</h2>
              </div>
              <span className="text-xs font-semibold text-[#ba1a1a] tabular-nums">{failedSheets.length}</span>
            </div>
            {failedSheets.length === 0 ? (
              <div className="p-4 text-xs text-[#64748b] flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[#196b22]" />
                <span>All uploaded sheets processed cleanly.</span>
              </div>
            ) : (
              <div className="divide-y divide-[#e2e8f0]">
                {failedSheets.map((s) => {
                  const student = state.users.find((u) => u.id === s.studentId);
                  return (
                    <div key={s.id} className="p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#0b1c30] truncate">
                          {student?.rollNumber} · {s.paperId}
                        </div>
                        <div className="text-[11px] text-[#ba1a1a] mt-0.5 truncate">
                          {s.processingError || s.quality.notes}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => retryFailedSheet(s.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold shrink-0"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Open Student Requests */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-[#005dac]" />
                <h2 className="text-sm font-semibold text-[#0b1c30]">Open Student Requests</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('admin_requests')}
                className="text-xs font-medium text-[#005dac] hover:underline"
              >
                View all
              </button>
            </div>
            {openRequests.length === 0 ? (
              <div className="p-4 text-xs text-[#64748b]">No open student requests right now.</div>
            ) : (
              <div className="divide-y divide-[#e2e8f0]">
                {openRequests.slice(0, 4).map((req) => {
                  const student = state.users.find((u) => u.id === req.studentId);
                  return (
                    <div key={req.id} className="p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#0b1c30] truncate">
                          {student?.name} ({student?.rollNumber})
                        </div>
                        <div className="text-[11px] text-[#64748b] mt-0.5 truncate">
                          {req.paperId} · {req.reasonCategory}
                        </div>
                      </div>
                      <RequestStatusBadge status={req.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
