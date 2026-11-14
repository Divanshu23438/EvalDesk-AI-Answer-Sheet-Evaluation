import { useMemo } from 'react';
import { AdminAssignments } from './components/admin/AdminAssignments';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminExamsPapers } from './components/admin/AdminExamsPapers';
import { AdminIntake } from './components/admin/AdminIntake';
import { AdminOcrAuditLog } from './components/admin/AdminOcrAuditLog';
import { AdminRequests } from './components/admin/AdminRequests';
import { AdminResults } from './components/admin/AdminResults';
import { AdminSettingsAudit } from './components/admin/AdminSettingsAudit';
import { AdminSubjectsClasses } from './components/admin/AdminSubjectsClasses';
import { AdminUsers } from './components/admin/AdminUsers';
import { ForcedPasswordModal, LoginScreen } from './components/auth/LoginScreen';
import { StudentHome } from './components/student/StudentHome';
import { StudentNotificationsProfile } from './components/student/StudentNotificationsProfile';
import { StudentRequests } from './components/student/StudentRequests';
import { StudentResultDetail, StudentResults } from './components/student/StudentResults';
import { StudentSheetViewer } from './components/student/StudentSheetViewer';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { TeacherOcrEditor } from './components/teacher/TeacherOcrEditor';
import { TeacherPaperSheets } from './components/teacher/TeacherPaperSheets';
import {
  TeacherPreferencesView,
  TeacherReevalTasks,
  TeacherReports,
} from './components/teacher/TeacherReevalReports';
import { TeacherReviewQueue } from './components/teacher/TeacherReviewQueue';
import { TeacherWorkspace } from './components/teacher/TeacherWorkspace';
import { AppShell } from './components/ui/AppShell';
import { EvalProvider, useEval } from './store/EvalContext';

function GlobalSearchPanel() {
  const {
    state,
    currentUser,
    globalSearch,
    setGlobalSearch,
    setSelectedPaperId,
    setSelectedSheetId,
    setActiveView,
  } = useEval();

  const matches = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q || !currentUser) return [];

    const results: { id: string; title: string; subtitle: string; onSelect: () => void }[] = [];

    for (const p of state.papers) {
      const subj = state.subjects.find((s) => s.id === p.subjectId);
      const label = `${subj?.code || ''} ${subj?.name || ''}`;
      if (label.toLowerCase().includes(q)) {
        if (currentUser.role === 'admin') {
          results.push({
            id: `p-${p.id}`,
            title: label,
            subtitle: `Paper · ${p.mode} mode`,
            onSelect: () => {
              setSelectedPaperId(p.id);
              setActiveView('admin_exams');
              setGlobalSearch('');
            },
          });
        } else if (
          currentUser.role === 'teacher' &&
          state.sheets.some((s) => s.paperId === p.id && s.assignedTeacherId === currentUser.id)
        ) {
          results.push({
            id: `p-${p.id}`,
            title: label,
            subtitle: 'Assigned Paper',
            onSelect: () => {
              setSelectedPaperId(p.id);
              setActiveView('teacher_paper_sheets');
              setGlobalSearch('');
            },
          });
        } else if (currentUser.role === 'student' && p.status === 'published') {
          results.push({
            id: `p-${p.id}`,
            title: label,
            subtitle: 'Published Result',
            onSelect: () => {
              setSelectedPaperId(p.id);
              setActiveView('student_result_detail');
              setGlobalSearch('');
            },
          });
        }
      }
    }

    if (currentUser.role !== 'student') {
      for (const s of state.sheets) {
        if (currentUser.role === 'teacher' && s.assignedTeacherId !== currentUser.id) continue;
        const paper = state.papers.find((p) => p.id === s.paperId);
        const st = state.users.find((u) => u.id === s.studentId);
        const hay = `${st?.rollNumber || ''} ${st?.rollCode || ''} ${
          paper?.anonymousEvaluation && currentUser.role === 'teacher' ? '' : st?.name || ''
        }`.toLowerCase();
        if (hay.includes(q)) {
          results.push({
            id: `s-${s.id}`,
            title:
              paper?.anonymousEvaluation && currentUser.role === 'teacher'
                ? `${st?.rollCode || s.id}`
                : `${st?.name} (${st?.rollNumber})`,
            subtitle: `Answer Sheet · ${s.paperId}`,
            onSelect: () => {
              setSelectedPaperId(s.paperId);
              setSelectedSheetId(s.id);
              setActiveView(currentUser.role === 'teacher' ? 'teacher_workspace' : 'admin_results');
              setGlobalSearch('');
            },
          });
        }
      }
    }

    return results.slice(0, 6);
  }, [globalSearch, currentUser, state, setSelectedPaperId, setSelectedSheetId, setActiveView, setGlobalSearch]);

  if (!globalSearch.trim()) return null;

  return (
    <div className="bg-white border-b border-[#e2e8f0] px-4 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#0b1c30]">
            Search results for "{globalSearch}" ({matches.length})
          </span>
          <button
            type="button"
            onClick={() => setGlobalSearch('')}
            className="text-[#005dac] font-medium hover:underline"
          >
            Clear search
          </button>
        </div>
        {matches.length === 0 ? (
          <div className="text-xs text-[#64748b]">No matching papers or sheets in your permitted scope.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={m.onSelect}
                className="text-left px-3 py-1.5 rounded border border-[#c1c6d4] bg-[#f8f9ff] hover:bg-[#eff4ff] text-xs"
              >
                <div className="font-semibold text-[#0b1c30]">{m.title}</div>
                <div className="text-[11px] text-[#64748b]">{m.subtitle}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveRoleRouter() {
  const { currentUser, activeView } = useEval();

  if (!currentUser) {
    return <LoginScreen />;
  }

  const renderView = () => {
    if (currentUser.role === 'admin') {
      switch (activeView) {
        case 'admin_users':
          return <AdminUsers />;
        case 'admin_subjects':
          return <AdminSubjectsClasses />;
        case 'admin_exams':
          return <AdminExamsPapers />;
        case 'admin_intake':
          return <AdminIntake />;
        case 'admin_assignments':
          return <AdminAssignments />;
        case 'admin_requests':
          return <AdminRequests />;
        case 'admin_results':
          return <AdminResults />;
        case 'admin_audit':
          return <AdminOcrAuditLog />;
        case 'admin_settings':
          return <AdminSettingsAudit />;
        case 'admin_dashboard':
        default:
          return <AdminDashboard />;
      }
    }

    if (currentUser.role === 'teacher') {
      switch (activeView) {
        case 'teacher_papers':
        case 'teacher_paper_sheets':
          return <TeacherPaperSheets />;
        case 'teacher_workspace':
          return <TeacherWorkspace />;
        case 'teacher_queue':
          return <TeacherReviewQueue />;
        case 'teacher_ocr':
          return <TeacherOcrEditor />;
        case 'teacher_reeval':
          return <TeacherReevalTasks />;
        case 'teacher_reports':
          return <TeacherReports />;
        case 'teacher_profile':
          return <TeacherPreferencesView />;
        case 'teacher_dashboard':
        default:
          return <TeacherDashboard />;
      }
    }

    // Student role
    switch (activeView) {
      case 'student_results':
        return <StudentResults />;
      case 'student_result_detail':
        return <StudentResultDetail />;
      case 'student_requests':
        return <StudentRequests />;
      case 'student_sheet_viewer':
        return <StudentSheetViewer />;
      case 'student_notifications':
        return <StudentNotificationsProfile />;
      case 'student_home':
      default:
        return <StudentHome />;
    }
  };

  return (
    <>
      <ForcedPasswordModal />
      <AppShell>
        <GlobalSearchPanel />
        {renderView()}
      </AppShell>
    </>
  );
}

export default function App() {
  return (
    <EvalProvider>
      <ActiveRoleRouter />
    </EvalProvider>
  );
}
