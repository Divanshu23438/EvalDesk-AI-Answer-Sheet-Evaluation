import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createInitialState,
  createStarterAcademicCatalog,
  SHEET_IMAGE_ASSETS,
  type EvalStoreState,
} from '../data/seedData';
import type {
  AnswerEvaluation,
  AuditEntry,
  Exam,
  Paper,
  PaperMode,
  ProblemReport,
  Question,
  Sheet,
  SheetStatus,
  StudentRequest,
  Subject,
  SystemSettings,
  TeacherPreferences,
  User,
} from '../types/eval';
import {
  canPublishPaper,
  canSubmitSheet,
  evaluateAnswerAgainstRubric,
  generateTemporaryPassword,
  type CsvImportRowResult,
} from '../utils/gradingEngine';

const STORAGE_KEY = 'evaldesk_workspace_v3';

interface ProcessingQueueItem {
  sheetId: string;
  fileName: string;
  paperId: string;
  progressPct: number;
}

interface EvalContextValue {
  state: EvalStoreState;
  currentUser: User | null;
  activeView: string;
  setActiveView: (view: string) => void;
  selectedPaperId: string | null;
  setSelectedPaperId: (id: string | null) => void;
  selectedSheetId: string | null;
  setSelectedSheetId: (id: string | null) => void;
  workspaceInitialQuestionId: string | null;
  setWorkspaceInitialQuestionId: (id: string | null) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  sessionLockedMsg: string | null;
  processingQueue: ProcessingQueueItem[];
  lastSavedAt: string | null;

  // Auth & Institution Setup
  initializeInstitution: (input: {
    institutionName: string;
    academicYear: string;
    adminName: string;
    adminEmail: string;
    password: string;
    includeStarterCatalog?: boolean;
  }) => void;
  login: (identifier: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  completeForcedPasswordChange: (newPassword: string) => void;
  changeOwnPassword: (currentPwd: string, newPwd: string) => { ok: boolean; error?: string };

  // Admin: Users, Subjects, Classes
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  updateUser: (userId: string, patch: Partial<User>) => void;
  toggleUserStatus: (userId: string) => void;
  resetUserPassword: (userId: string) => string;
  importUsersFromCsv: (rows: CsvImportRowResult[]) => number;
  addSubject: (subj: Omit<Subject, 'id'>) => void;
  addClassSection: (cls: { name: string; sections: string[]; academicYear: string }) => void;

  // Admin: Exams, Papers, Rubric
  addExam: (exam: Omit<Exam, 'id'>) => void;
  addPaper: (paper: Omit<Paper, 'id' | 'rubricVersion' | 'rubricHistory'>) => string;
  updatePaper: (paperId: string, patch: Partial<Paper>, auditNote?: string) => void;
  saveQuestion: (question: Question) => void;
  addQuestion: (question: Omit<Question, 'id'>) => void;
  deleteQuestion: (questionId: string) => void;
  toggleRubricLock: (paperId: string, lock: boolean, reason: string) => void;

  // Admin: Intake & Assignments
  uploadSheetsBatch: (
    paperId: string,
    items: {
      fileName: string;
      studentId: string;
      previewUrl?: string;
      pages?: string[];
      tiltDegrees?: number;
      ocrByQuestion?: Record<string, string>;
    }[]
  ) => void;
  retryFailedSheet: (sheetId: string) => void;
  assignSheets: (paperId: string, teacherId: string, sheetIds: string[], dueDate: string) => void;

  // Admin: Requests & Publishing & Settings
  decideStudentRequest: (
    requestId: string,
    decision: 'approved' | 'rejected' | 'released' | 'under_review',
    options?: {
      rejectionReason?: string;
      viewDurationDays?: number;
      allowDownload?: boolean;
      forwardedToTeacherId?: string;
    }
  ) => void;
  publishPaperResults: (paperId: string, sheetIds?: string[]) => { ok: boolean; reasons?: string[] };
  unpublishPaperResults: (paperId: string, reason: string) => void;
  reopenSheet: (sheetId: string, reason: string) => void;
  updateSettings: (patch: Partial<SystemSettings>) => void;
  resolveProblemReport: (reportId: string) => void;

  // Teacher actions
  markSpotCheckCompleted: (sheetId: string) => void;
  bulkAcceptClearQuestions: (sheetId: string) => { count: number };
  updateAnswerEvaluation: (
    sheetId: string,
    questionId: string,
    updater: (prev: AnswerEvaluation) => AnswerEvaluation,
    auditOverride?: { action: string; oldValue: string; newValue: string }
  ) => void;
  recheckAnswerFromOcr: (
    sheetId: string,
    questionId: string,
    editedOcrText: string
  ) => { oldSuggested: number; newSuggested: number; oldFlags: string[]; newFlags: string[] } | null;
  submitEvaluatedSheet: (sheetId: string) => { ok: boolean; error?: string };
  reportSheetProblem: (
    sheetId: string,
    category: ProblemReport['category'],
    description: string
  ) => void;
  saveOcrLineCorrection: (
    sheetId: string,
    questionId: string,
    lineId: string,
    newText: string,
    addToTraining: boolean
  ) => void;
  submitReevaluationDecision: (
    requestId: string,
    sheetId: string,
    updates: { questionId: string; newMarks: number; reason: string }[]
  ) => void;
  updateTeacherPreferences: (patch: Partial<TeacherPreferences>) => void;

  // Student actions
  submitStudentRequest: (paperId: string, reasonCategory: string, note: string) => { ok: boolean; error?: string };
  cancelStudentRequest: (requestId: string) => void;
  logSheetDownload: (sheetId: string) => void;

  // Shared
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  resetInstitutionWorkspace: () => void;
}

const EvalContext = createContext<EvalContextValue | null>(null);

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function loadStoredState(): EvalStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as EvalStoreState;
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.sheets)) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return createInitialState();
}

export function EvalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EvalStoreState>(loadStoredState);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`${STORAGE_KEY}_uid`);
    } catch {
      return null;
    }
  });
  const [activeView, setActiveView] = useState<string>('admin_dashboard');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [workspaceInitialQuestionId, setWorkspaceInitialQuestionId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [sessionLockedMsg, setSessionLockedMsg] = useState<string | null>(null);
  const [processingQueue, setProcessingQueue] = useState<ProcessingQueueItem[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === currentUserId) ?? null,
    [state.users, currentUserId]
  );

  // Sync activeView when user changes
  useEffect(() => {
    if (!currentUser) return;
    setActiveView((prev) => {
      if (currentUser.role === 'admin' && !prev.startsWith('admin_')) return 'admin_dashboard';
      if (currentUser.role === 'teacher' && !prev.startsWith('teacher_')) return 'teacher_dashboard';
      if (currentUser.role === 'student' && !prev.startsWith('student_')) return 'student_home';
      return prev;
    });
  }, [currentUser]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch {
      // ignore quota errors
    }
  }, [state]);

  useEffect(() => {
    try {
      if (currentUserId) localStorage.setItem(`${STORAGE_KEY}_uid`, currentUserId);
      else localStorage.removeItem(`${STORAGE_KEY}_uid`);
    } catch {
      // ignore
    }
  }, [currentUserId]);

  // Session inactivity timeout (PRD Section 8)
  useEffect(() => {
    if (!currentUser) return;
    const timeoutMs = Math.max(5, state.settings.sessionTimeoutMinutes) * 60 * 1000;
    let timer = window.setTimeout(() => {
      setCurrentUserId(null);
      setSessionLockedMsg('Session timed out after inactivity. Please sign in again.');
    }, timeoutMs);

    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setCurrentUserId(null);
        setSessionLockedMsg('Session timed out after inactivity. Please sign in again.');
      }, timeoutMs);
    };

    const events = ['mousedown', 'keydown', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [currentUser, state.settings.sessionTimeoutMinutes]);

  // Single-sheet-at-a-time processing queue worker (PRD A6 & 17)
  useEffect(() => {
    if (processingQueue.length === 0) return;
    const currentItem = processingQueue[0];
    const interval = window.setInterval(() => {
      setProcessingQueue((prev) => {
        if (prev.length === 0) return prev;
        const head = prev[0];
        if (head.progressPct < 100) {
          return [{ ...head, progressPct: Math.min(100, head.progressPct + 25) }, ...prev.slice(1)];
        }
        return prev.slice(1);
      });
    }, 550);

    if (currentItem.progressPct >= 100) {
      setState((prev) => {
        const sheet = prev.sheets.find((s) => s.id === currentItem.sheetId);
        if (!sheet) return prev;
        const nextStatus: SheetStatus = sheet.quality.blurOk ? 'ready_for_review' : 'failed';
        const admins = prev.users.filter((u) => u.role === 'admin' && u.status === 'active');
        const adminNotifs = admins.map((adm) => ({
          id: uid('notif'),
          userId: adm.id,
          title: nextStatus === 'failed' ? 'Sheet Processing Failed' : 'Sheet OCR Complete',
          message:
            nextStatus === 'failed'
              ? `${currentItem.fileName} failed quality check (${sheet.quality.notes}).`
              : `${currentItem.fileName} is ready for teacher review.`,
          type: (nextStatus === 'failed' ? 'error' : 'success') as 'error' | 'success',
          createdAt: new Date().toISOString(),
          read: false,
          linkView: 'admin_intake',
        }));
        return {
          ...prev,
          sheets: prev.sheets.map((s) =>
            s.id === currentItem.sheetId
              ? {
                  ...s,
                  status: nextStatus,
                  processingError: nextStatus === 'failed' ? 'Scan tilt/blur exceeded threshold.' : undefined,
                }
              : s
          ),
          notifications: [...adminNotifs, ...prev.notifications],
        };
      });
    }

    return () => window.clearInterval(interval);
  }, [processingQueue]);

  const appendAudit = useCallback(
    (
      prev: EvalStoreState,
      action: string,
      target: string,
      oldValue?: string,
      newValue?: string,
      actorOverride?: User
    ): AuditEntry[] => {
      const actor = actorOverride ?? currentUser;
      if (!actor) return prev.auditLogs;
      const entry: AuditEntry = {
        id: uid('aud'),
        timestamp: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action,
        target,
        oldValue,
        newValue,
      };
      return [entry, ...prev.auditLogs];
    },
    [currentUser]
  );

  const initializeInstitution = useCallback(
    (input: {
      institutionName: string;
      academicYear: string;
      adminName: string;
      adminEmail: string;
      password: string;
      includeStarterCatalog?: boolean;
    }) => {
      const now = new Date().toISOString();
      const adminUser: User = {
        id: uid('u-adm'),
        name: input.adminName.trim(),
        email: input.adminEmail.trim(),
        passwordHash: input.password,
        role: 'admin',
        status: 'active',
        mustChangePassword: false,
        createdAt: now,
      };
      const base = createInitialState();
      const catalog = input.includeStarterCatalog
        ? createStarterAcademicCatalog(adminUser.name, input.academicYear.trim() || '2026–27')
        : null;

      const nextState: EvalStoreState = {
        ...base,
        users: [adminUser],
        subjects: catalog?.subjects || [],
        classes: catalog?.classes || [],
        exams: catalog?.exams || [],
        papers: catalog?.papers || [],
        questions: catalog?.questions || [],
        settings: {
          ...base.settings,
          institutionName: input.institutionName.trim(),
          academicYear: input.academicYear.trim() || '2026–27',
        },
        auditLogs: [
          {
            id: uid('aud'),
            timestamp: now,
            actorId: adminUser.id,
            actorName: adminUser.name,
            actorRole: 'admin',
            action: 'Institution Initialized',
            target: input.institutionName.trim(),
            newValue: catalog ? 'With starter academic catalog' : 'Clean workspace',
          },
        ],
      };

      setState(nextState);
      setSessionLockedMsg(null);
      setCurrentUserId(adminUser.id);
      setActiveView('admin_dashboard');
      setSelectedPaperId(catalog?.papers[0]?.id ?? null);
      setSelectedSheetId(null);
    },
    []
  );

  const login = useCallback(
    (identifier: string, password: string) => {
      const cleanId = identifier.trim().toLowerCase();
      const user = state.users.find(
        (u) =>
          u.email.toLowerCase() === cleanId ||
          (u.rollNumber && u.rollNumber.toLowerCase() === cleanId)
      );
      if (!user) {
        return { ok: false, error: 'Account not found. Check your email or roll number.' };
      }
      if (user.status !== 'active') {
        return { ok: false, error: 'This account has been deactivated by Admin.' };
      }
      if (user.passwordHash !== password) {
        return { ok: false, error: 'Incorrect password.' };
      }
      setSessionLockedMsg(null);
      setCurrentUserId(user.id);
      if (user.role === 'admin') setActiveView('admin_dashboard');
      else if (user.role === 'teacher') setActiveView('teacher_dashboard');
      else setActiveView('student_home');

      setState((prev) => ({
        ...prev,
        auditLogs: appendAudit(prev, 'Login', `${user.name} (${user.role})`, undefined, 'Signed in', user),
      }));
      return { ok: true };
    },
    [state.users, appendAudit]
  );

  const logout = useCallback(() => {
    setCurrentUserId(null);
  }, []);

  const completeForcedPasswordChange = useCallback(
    (newPassword: string) => {
      if (!currentUser) return;
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === currentUser.id ? { ...u, passwordHash: newPassword, mustChangePassword: false } : u
        ),
        auditLogs: appendAudit(prev, 'First-Login Password Changed', currentUser.email, 'Temporary', 'Updated'),
      }));
    },
    [currentUser, appendAudit]
  );

  const changeOwnPassword = useCallback(
    (currentPwd: string, newPwd: string) => {
      if (!currentUser) return { ok: false, error: 'Not signed in.' };
      if (currentUser.passwordHash !== currentPwd) {
        return { ok: false, error: 'Current password does not match.' };
      }
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === currentUser.id ? { ...u, passwordHash: newPwd } : u)),
        auditLogs: appendAudit(prev, 'Password Updated', currentUser.email),
      }));
      return { ok: true };
    },
    [currentUser, appendAudit]
  );

  const addUser = useCallback(
    (userInput: Omit<User, 'id' | 'createdAt'>) => {
      const newUser: User = {
        ...userInput,
        id: uid('u'),
        rollCode:
          userInput.role === 'student' && !userInput.rollCode
            ? `RC-${Math.floor(4100 + Math.random() * 800)}`
            : userInput.rollCode,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        users: [newUser, ...prev.users],
        auditLogs: appendAudit(prev, 'Create User', `${newUser.name} (${newUser.role})`, undefined, newUser.email),
      }));
    },
    [appendAudit]
  );

  const updateUser = useCallback(
    (userId: string, patch: Partial<User>) => {
      setState((prev) => {
        const existing = prev.users.find((u) => u.id === userId);
        return {
          ...prev,
          users: prev.users.map((u) => (u.id === userId ? { ...u, ...patch } : u)),
          auditLogs: appendAudit(prev, 'Update User', existing?.name || userId, existing?.email, patch.email || 'Updated'),
        };
      });
    },
    [appendAudit]
  );

  const toggleUserStatus = useCallback(
    (userId: string) => {
      setState((prev) => {
        const target = prev.users.find((u) => u.id === userId);
        if (!target) return prev;
        const nextStatus = target.status === 'active' ? 'inactive' : 'active';
        return {
          ...prev,
          users: prev.users.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u)),
          auditLogs: appendAudit(prev, 'Toggle User Status', target.name, target.status, nextStatus),
        };
      });
    },
    [appendAudit]
  );

  const resetUserPassword = useCallback(
    (userId: string) => {
      const tempPwd = generateTemporaryPassword();
      setState((prev) => {
        const target = prev.users.find((u) => u.id === userId);
        if (!target) return prev;
        return {
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId ? { ...u, passwordHash: tempPwd, mustChangePassword: true } : u
          ),
          auditLogs: appendAudit(prev, 'Reset Password', target.name, 'Active password', 'Temporary (must change)'),
        };
      });
      return tempPwd;
    },
    [appendAudit]
  );

  const importUsersFromCsv = useCallback(
    (rows: CsvImportRowResult[]) => {
      const valid = rows.filter((r) => r.valid && r.user).map((r) => r.user!);
      if (valid.length === 0) return 0;
      const created: User[] = valid.map((u) => ({
        ...u,
        id: uid('u'),
        createdAt: new Date().toISOString(),
      }));
      setState((prev) => ({
        ...prev,
        users: [...created, ...prev.users],
        auditLogs: appendAudit(prev, 'CSV Bulk User Import', `${created.length} users`, undefined, created.map((c) => c.email).join(', ')),
      }));
      return created.length;
    },
    [appendAudit]
  );

  const addSubject = useCallback(
    (subj: Omit<Subject, 'id'>) => {
      const created: Subject = { ...subj, id: uid('subj') };
      setState((prev) => ({
        ...prev,
        subjects: [...prev.subjects, created],
        auditLogs: appendAudit(prev, 'Add Subject', `${created.code} — ${created.name}`),
      }));
    },
    [appendAudit]
  );

  const addClassSection = useCallback(
    (cls: { name: string; sections: string[]; academicYear: string }) => {
      const created = { ...cls, id: uid('cls') };
      setState((prev) => ({
        ...prev,
        classes: [...prev.classes, created],
        auditLogs: appendAudit(prev, 'Add Class', `${created.name} (${created.academicYear})`),
      }));
    },
    [appendAudit]
  );

  const addExam = useCallback(
    (exam: Omit<Exam, 'id'>) => {
      const created: Exam = { ...exam, id: uid('exam') };
      setState((prev) => ({
        ...prev,
        exams: [...prev.exams, created],
        auditLogs: appendAudit(prev, 'Create Exam', created.name),
      }));
    },
    [appendAudit]
  );

  const addPaper = useCallback(
    (paperInput: Omit<Paper, 'id' | 'rubricVersion' | 'rubricHistory'>) => {
      const id = uid('paper');
      const created: Paper = {
        ...paperInput,
        id,
        rubricVersion: 1,
        rubricHistory: [
          {
            version: 1,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.name || 'Admin',
            reason: 'Initial paper created',
          },
        ],
      };
      setState((prev) => ({
        ...prev,
        papers: [...prev.papers, created],
        auditLogs: appendAudit(prev, 'Create Paper', id, undefined, `Mode: ${created.mode}`),
      }));
      return id;
    },
    [currentUser, appendAudit]
  );

  const updatePaper = useCallback(
    (paperId: string, patch: Partial<Paper>, auditNote?: string) => {
      setState((prev) => {
        const existing = prev.papers.find((p) => p.id === paperId);
        return {
          ...prev,
          papers: prev.papers.map((p) => (p.id === paperId ? { ...p, ...patch } : p)),
          auditLogs: appendAudit(
            prev,
            'Update Paper Settings',
            paperId,
            existing ? `Mode: ${existing.mode}, Status: ${existing.status}` : undefined,
            auditNote || JSON.stringify(patch)
          ),
        };
      });
    },
    [appendAudit]
  );

  const saveQuestion = useCallback(
    (question: Question) => {
      setState((prev) => {
        const paper = prev.papers.find((p) => p.id === question.paperId);
        const nextVersion = (paper?.rubricVersion ?? 1) + 1;
        return {
          ...prev,
          questions: prev.questions.map((q) => (q.id === question.id ? question : q)),
          papers: prev.papers.map((p) =>
            p.id === question.paperId
              ? {
                  ...p,
                  rubricVersion: nextVersion,
                  rubricHistory: [
                    {
                      version: nextVersion,
                      updatedAt: new Date().toISOString(),
                      updatedBy: currentUser?.name || 'Admin',
                      reason: `Updated rubric for ${question.label}`,
                    },
                    ...p.rubricHistory,
                  ],
                }
              : p
          ),
          auditLogs: appendAudit(prev, 'Edit Rubric Question', `${question.paperId} · ${question.label}`),
        };
      });
    },
    [currentUser, appendAudit]
  );

  const addQuestion = useCallback(
    (questionInput: Omit<Question, 'id'>) => {
      const created: Question = { ...questionInput, id: uid('q') };
      setState((prev) => ({
        ...prev,
        questions: [...prev.questions, created],
        auditLogs: appendAudit(prev, 'Add Rubric Question', `${created.paperId} · ${created.label}`),
      }));
    },
    [appendAudit]
  );

  const deleteQuestion = useCallback(
    (questionId: string) => {
      setState((prev) => ({
        ...prev,
        questions: prev.questions.filter((q) => q.id !== questionId),
        auditLogs: appendAudit(prev, 'Delete Rubric Question', questionId),
      }));
    },
    [appendAudit]
  );

  const toggleRubricLock = useCallback(
    (paperId: string, lock: boolean, reason: string) => {
      setState((prev) => {
        const paper = prev.papers.find((p) => p.id === paperId);
        if (!paper) return prev;
        const nextVersion = paper.rubricVersion + 1;
        return {
          ...prev,
          papers: prev.papers.map((p) =>
            p.id === paperId
              ? {
                  ...p,
                  rubricLocked: lock,
                  rubricVersion: nextVersion,
                  status: lock && p.status === 'draft' ? 'ready' : p.status,
                  rubricHistory: [
                    {
                      version: nextVersion,
                      updatedAt: new Date().toISOString(),
                      updatedBy: currentUser?.name || 'Admin',
                      reason: `${lock ? 'Locked' : 'Unlocked'}: ${reason}`,
                    },
                    ...p.rubricHistory,
                  ],
                }
              : p
          ),
          auditLogs: appendAudit(prev, lock ? 'Lock Rubric' : 'Unlock Rubric', paperId, String(paper.rubricLocked), reason),
        };
      });
    },
    [currentUser, appendAudit]
  );

  const uploadSheetsBatch = useCallback(
    (
      paperId: string,
      items: {
        fileName: string;
        studentId: string;
        previewUrl?: string;
        pages?: string[];
        tiltDegrees?: number;
        ocrByQuestion?: Record<string, string>;
      }[]
    ) => {
      const paper = state.papers.find((p) => p.id === paperId);
      const paperQuestions = state.questions
        .filter((q) => q.paperId === paperId)
        .sort((a, b) => a.number - b.number);
      const fallbackImg =
        paper?.mode === 'maths'
          ? SHEET_IMAGE_ASSETS.maths
          : paper?.mode === 'strict'
          ? SHEET_IMAGE_ASSETS.english
          : SHEET_IMAGE_ASSETS.science;

      const createdSheets: Sheet[] = [];
      const queueAdditions: ProcessingQueueItem[] = [];

      for (const item of items) {
        const sheetId = uid('sheet');
        const tilt = item.tiltDegrees ?? 0.4;
        const blurOk = Math.abs(tilt) <= 3.5;

        const answers: AnswerEvaluation[] = paperQuestions.map((q, idx) => {
          const ocrText = (item.ocrByQuestion?.[q.id] ?? '').trim();
          const lowWords = ocrText.length === 0 ? ['untranscribed'] : [];
          const res = evaluateAnswerAgainstRubric({
            ocrText,
            question: q,
            paperMode: paper?.mode ?? 'lenient',
            lowConfidenceWords: lowWords,
            settings: state.settings,
          });
          const topPct = Math.min(74, 14 + idx * 26);
          const lines = ocrText ? ocrText.split(/\n+/).filter(Boolean) : [''];
          return {
            questionId: q.id,
            ocrText,
            originalOcrText: ocrText,
            lowConfidenceWords: lowWords,
            boundingBox: { pageIndex: 0, topPct, leftPct: 6, widthPct: 88, heightPct: 23 },
            lineCrops: lines.map((lineText, lineIdx) => ({
              id: uid('lc'),
              pageIndex: 0,
              topPct: Math.min(92, topPct + lineIdx * 6),
              heightPct: 5,
              ocrGuess: lineText,
              editedText: lineText,
              lowConfidenceWords: lowWords,
              lineConfidence: ocrText.length === 0 ? 45 : 92,
            })),
            confidence: res.confidence,
            confidenceScore: res.confidenceScore,
            reviewReasons: res.reviewReasons,
            flagResolved: res.reviewReasons.length === 0,
            keyPointResults: res.keyPointResults,
            checks: res.checks,
            suggestedMarks: res.suggestedMarks,
            finalMarks: res.suggestedMarks,
            source: 'ai',
            teacherOverride: false,
            feedback: res.aiDraftFeedback,
            aiDraftFeedback: res.aiDraftFeedback,
            strictBreakdown: res.strictBreakdown,
            acceptedByTeacher: false,
            history: [],
          };
        });

        const pages =
          item.pages && item.pages.length > 0
            ? item.pages
            : [item.previewUrl || fallbackImg];

        createdSheets.push({
          id: sheetId,
          paperId,
          studentId: item.studentId,
          pages,
          status: 'processing',
          quality: {
            blurOk,
            tiltDegrees: tilt,
            missingPages: false,
            notes: blurOk ? 'Clean scan quality verified' : `Tilt ${tilt}° exceeds 3.5° limit`,
          },
          spotCheckCompleted: false,
          timeSpentSeconds: 0,
          lastQuestionIndex: 0,
          answers,
        });

        queueAdditions.push({
          sheetId,
          fileName: item.fileName,
          paperId,
          progressPct: 25,
        });
      }

      setState((prev) => ({
        ...prev,
        sheets: [...createdSheets, ...prev.sheets],
        auditLogs: appendAudit(prev, 'Upload Answer Sheets', `${items.length} sheet(s) -> ${paperId}`),
      }));
      setProcessingQueue((prev) => [...prev, ...queueAdditions]);
    },
    [state.papers, state.questions, state.settings, appendAudit]
  );

  const retryFailedSheet = useCallback(
    (sheetId: string) => {
      setState((prev) => {
        const sheet = prev.sheets.find((s) => s.id === sheetId);
        if (!sheet) return prev;
        return {
          ...prev,
          sheets: prev.sheets.map((s) =>
            s.id === sheetId
              ? {
                  ...s,
                  status: 'processing',
                  processingError: undefined,
                  quality: { ...s.quality, blurOk: true, tiltDegrees: 0.3, notes: 'Re-deskewed & enhanced on retry' },
                }
              : s
          ),
          auditLogs: appendAudit(prev, 'Retry Failed Sheet', sheetId, 'failed', 'processing'),
        };
      });
      setProcessingQueue((prev) => [
        ...prev,
        { sheetId, fileName: `Retry-${sheetId}`, paperId: '', progressPct: 25 },
      ]);
    },
    [appendAudit]
  );

  const assignSheets = useCallback(
    (paperId: string, teacherId: string, sheetIds: string[], dueDate: string) => {
      setState((prev) => {
        const teacher = prev.users.find((u) => u.id === teacherId);
        return {
          ...prev,
          papers: prev.papers.map((p) =>
            p.id === paperId
              ? { ...p, dueDate, status: p.status === 'ready' ? 'open_for_evaluation' : p.status }
              : p
          ),
          sheets: prev.sheets.map((s) =>
            sheetIds.includes(s.id) ? { ...s, assignedTeacherId: teacherId } : s
          ),
          notifications: [
            {
              id: uid('notif'),
              userId: teacherId,
              title: 'Sheets Assigned',
              message: `${sheetIds.length} sheet(s) assigned for ${paperId} (due ${dueDate}).`,
              type: 'info',
              createdAt: new Date().toISOString(),
              read: false,
              linkView: 'teacher_papers',
            },
            ...prev.notifications,
          ],
          auditLogs: appendAudit(
            prev,
            'Assign Sheets',
            `${sheetIds.length} sheet(s) in ${paperId}`,
            undefined,
            `${teacher?.name || teacherId} (Due ${dueDate})`
          ),
        };
      });
    },
    [appendAudit]
  );

  const decideStudentRequest = useCallback(
    (
      requestId: string,
      decision: 'approved' | 'rejected' | 'released' | 'under_review',
      options?: {
        rejectionReason?: string;
        viewDurationDays?: number;
        allowDownload?: boolean;
        forwardedToTeacherId?: string;
      }
    ) => {
      setState((prev) => {
        const req = prev.requests.find((r) => r.id === requestId);
        if (!req) return prev;
        const duration = options?.viewDurationDays ?? req.viewDurationDays;
        const expiry = new Date(Date.now() + duration * 86400000).toISOString().slice(0, 10);

        const nextNotifs = [...prev.notifications];
        nextNotifs.unshift({
          id: uid('notif'),
          userId: req.studentId,
          title: `Sheet Request ${decision.replace('_', ' ')}`,
          message:
            decision === 'rejected'
              ? `Your request was rejected: ${options?.rejectionReason || 'See request details'}`
              : decision === 'released'
              ? `Your evaluated sheet is now released until ${expiry}.`
              : `Your request status changed to ${decision.replace('_', ' ')}.`,
          type: decision === 'rejected' ? 'error' : decision === 'released' ? 'success' : 'info',
          createdAt: new Date().toISOString(),
          read: false,
          linkView: 'student_requests',
        });

        if (decision === 'under_review' && options?.forwardedToTeacherId) {
          nextNotifs.unshift({
            id: uid('notif'),
            userId: options.forwardedToTeacherId,
            title: 'Re-evaluation Task Assigned',
            message: `Admin forwarded a student request for sheet ${req.sheetId}.`,
            type: 'warning',
            createdAt: new Date().toISOString(),
            read: false,
            linkView: 'teacher_reeval',
          });
        }

        return {
          ...prev,
          requests: prev.requests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: decision,
                  updatedAt: new Date().toISOString(),
                  decisionBy: currentUser?.name || 'Admin',
                  decisionAt: new Date().toISOString(),
                  rejectionReason: options?.rejectionReason ?? r.rejectionReason,
                  viewDurationDays: duration,
                  allowDownload: options?.allowDownload ?? r.allowDownload,
                  expiryDate: decision === 'released' ? expiry : r.expiryDate,
                  forwardedToTeacherId: options?.forwardedToTeacherId ?? r.forwardedToTeacherId,
                }
              : r
          ),
          notifications: nextNotifs,
          auditLogs: appendAudit(prev, 'Student Request Decision', requestId, req.status, decision),
        };
      });
    },
    [currentUser, appendAudit]
  );

  const publishPaperResults = useCallback(
    (paperId: string, sheetIds?: string[]) => {
      const targetSheets = state.sheets.filter(
        (s) => s.paperId === paperId && (!sheetIds || sheetIds.includes(s.id))
      );
      const check = canPublishPaper(targetSheets);
      if (!check.allowed) {
        return { ok: false, reasons: check.reasons };
      }
      const now = new Date().toISOString();
      setState((prev) => {
        const studentIds = new Set(targetSheets.map((s) => s.studentId));
        const studentNotifs = Array.from(studentIds).map((sid) => ({
          id: uid('notif'),
          userId: sid,
          title: 'Exam Result Published',
          message: `Results for ${paperId} are now published under My Results.`,
          type: 'success' as const,
          createdAt: now,
          read: false,
          linkView: 'student_results',
        }));

        return {
          ...prev,
          papers: prev.papers.map((p) => (p.id === paperId ? { ...p, status: 'published' } : p)),
          sheets: prev.sheets.map((s) =>
            s.paperId === paperId && (!sheetIds || sheetIds.includes(s.id))
              ? { ...s, status: 'published', publishedAt: now }
              : s
          ),
          notifications: [...studentNotifs, ...prev.notifications],
          auditLogs: appendAudit(
            prev,
            'Publish Results',
            paperId,
            'Evaluated',
            `Published ${targetSheets.length} sheet(s)`
          ),
        };
      });
      return { ok: true };
    },
    [state.sheets, appendAudit]
  );

  const unpublishPaperResults = useCallback(
    (paperId: string, reason: string) => {
      setState((prev) => ({
        ...prev,
        papers: prev.papers.map((p) => (p.id === paperId ? { ...p, status: 'closed' } : p)),
        sheets: prev.sheets.map((s) =>
          s.paperId === paperId && s.status === 'published' ? { ...s, status: 'evaluated' } : s
        ),
        auditLogs: appendAudit(prev, 'Unpublish Results', paperId, 'Published', reason),
      }));
    },
    [appendAudit]
  );

  const reopenSheet = useCallback(
    (sheetId: string, reason: string) => {
      setState((prev) => {
        const sheet = prev.sheets.find((s) => s.id === sheetId);
        if (!sheet) return prev;
        const notifs = sheet.assignedTeacherId
          ? [
              {
                id: uid('notif'),
                userId: sheet.assignedTeacherId,
                title: 'Sheet Re-opened by Admin',
                message: `Sheet ${sheetId} was re-opened: ${reason}`,
                type: 'warning' as const,
                createdAt: new Date().toISOString(),
                read: false,
                linkView: 'teacher_papers',
              },
              ...prev.notifications,
            ]
          : prev.notifications;
        return {
          ...prev,
          sheets: prev.sheets.map((s) =>
            s.id === sheetId ? { ...s, status: 'reopened', reopenReason: reason } : s
          ),
          notifications: notifs,
          auditLogs: appendAudit(prev, 'Re-open Sheet', sheetId, sheet.status, reason),
        };
      });
    },
    [appendAudit]
  );

  const updateSettings = useCallback(
    (patch: Partial<SystemSettings>) => {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
        auditLogs: appendAudit(prev, 'Update System Settings', 'Global Settings', undefined, Object.keys(patch).join(', ')),
      }));
    },
    [appendAudit]
  );

  const resolveProblemReport = useCallback(
    (reportId: string) => {
      setState((prev) => ({
        ...prev,
        problemReports: prev.problemReports.map((r) => (r.id === reportId ? { ...r, resolved: true } : r)),
        auditLogs: appendAudit(prev, 'Resolve Problem Report', reportId),
      }));
    },
    [appendAudit]
  );

  const markSpotCheckCompleted = useCallback((sheetId: string) => {
    setState((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) => (s.id === sheetId ? { ...s, spotCheckCompleted: true } : s)),
    }));
  }, []);

  const bulkAcceptClearQuestions = useCallback(
    (sheetId: string) => {
      let acceptedCount = 0;
      setState((prev) => ({
        ...prev,
        sheets: prev.sheets.map((s) => {
          if (s.id !== sheetId) return s;
          const nextAnswers = s.answers.map((a) => {
            if (a.reviewReasons.length === 0 && !a.acceptedByTeacher) {
              acceptedCount += 1;
              return {
                ...a,
                acceptedByTeacher: true,
                flagResolved: true,
                changedBy: currentUser?.name || 'Teacher',
                changedAt: new Date().toISOString(),
              };
            }
            return a;
          });
          return {
            ...s,
            status: s.status === 'ready_for_review' ? 'in_review' : s.status,
            answers: nextAnswers,
          };
        }),
        auditLogs: appendAudit(prev, 'Bulk Accept Clear Questions', sheetId),
      }));
      return { count: acceptedCount };
    },
    [currentUser, appendAudit]
  );

  const updateAnswerEvaluation = useCallback(
    (
      sheetId: string,
      questionId: string,
      updater: (prev: AnswerEvaluation) => AnswerEvaluation,
      auditOverride?: { action: string; oldValue: string; newValue: string }
    ) => {
      setState((prev) => {
        const nextSheets = prev.sheets.map((s) => {
          if (s.id !== sheetId) return s;
          const nextStatus: SheetStatus =
            s.status === 'ready_for_review' ? 'in_review' : s.status;
          return {
            ...s,
            status: nextStatus,
            answers: s.answers.map((a) => (a.questionId === questionId ? updater(a) : a)),
          };
        });
        return {
          ...prev,
          sheets: nextSheets,
          auditLogs: auditOverride
            ? appendAudit(prev, auditOverride.action, `${sheetId} · ${questionId}`, auditOverride.oldValue, auditOverride.newValue)
            : prev.auditLogs,
        };
      });
    },
    [appendAudit]
  );

  const recheckAnswerFromOcr = useCallback(
    (sheetId: string, questionId: string, editedOcrText: string) => {
      const sheet = state.sheets.find((s) => s.id === sheetId);
      const paper = state.papers.find((p) => p.id === sheet?.paperId);
      const question = state.questions.find((q) => q.id === questionId);
      const answer = sheet?.answers.find((a) => a.questionId === questionId);
      if (!sheet || !paper || !question || !answer) return null;

      const oldSuggested = answer.suggestedMarks;
      const oldFlags = [...answer.reviewReasons];

      const regraded = evaluateAnswerAgainstRubric({
        ocrText: editedOcrText,
        question,
        paperMode: paper.mode as PaperMode,
        lowConfidenceWords: [], // teacher verified OCR text
        doubtfulCrop: false,
        settings: state.settings,
      });

      setState((prev) => ({
        ...prev,
        sheets: prev.sheets.map((s) =>
          s.id !== sheetId
            ? s
            : {
                ...s,
                status: s.status === 'ready_for_review' ? 'in_review' : s.status,
                answers: s.answers.map((a) =>
                  a.questionId !== questionId
                    ? a
                    : {
                        ...a,
                        ocrText: editedOcrText,
                        lowConfidenceWords: [],
                        keyPointResults: regraded.keyPointResults,
                        suggestedMarks: regraded.suggestedMarks,
                        finalMarks: a.teacherOverride ? a.finalMarks : regraded.suggestedMarks,
                        confidence: regraded.confidence,
                        confidenceScore: regraded.confidenceScore,
                        reviewReasons: regraded.reviewReasons,
                        flagResolved: regraded.reviewReasons.length === 0,
                        checks: regraded.checks,
                        aiDraftFeedback: regraded.aiDraftFeedback,
                        feedback: a.teacherOverride ? a.feedback : regraded.aiDraftFeedback,
                        strictBreakdown: regraded.strictBreakdown,
                        changedBy: currentUser?.name || 'Teacher',
                        changedAt: new Date().toISOString(),
                        history: [
                          {
                            id: uid('hist'),
                            timestamp: new Date().toISOString(),
                            actorName: currentUser?.name || 'Teacher',
                            actorRole: currentUser?.role || 'teacher',
                            previousMarks: a.finalMarks,
                            newMarks: a.teacherOverride ? a.finalMarks : regraded.suggestedMarks,
                            note: 'Re-checked after OCR edit',
                          },
                          ...a.history,
                        ],
                      }
                ),
              }
        ),
        auditLogs: appendAudit(
          prev,
          'OCR Edit & Re-check',
          `${sheetId} · ${question.label}`,
          `${oldSuggested} marks`,
          `${regraded.suggestedMarks} marks`
        ),
      }));

      return {
        oldSuggested,
        newSuggested: regraded.suggestedMarks,
        oldFlags,
        newFlags: regraded.reviewReasons,
      };
    },
    [state.sheets, state.papers, state.questions, state.settings, currentUser, appendAudit]
  );

  const submitEvaluatedSheet = useCallback(
    (sheetId: string) => {
      const sheet = state.sheets.find((s) => s.id === sheetId);
      if (!sheet) return { ok: false, error: 'Sheet not found.' };
      const check = canSubmitSheet(sheet.answers);
      if (!check.allowed) {
        return {
          ok: false,
          error: `Cannot submit: ${check.unresolvedCount} flagged question(s) still require resolution.`,
        };
      }
      const now = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        sheets: prev.sheets.map((s) =>
          s.id === sheetId
            ? {
                ...s,
                status: 'evaluated',
                submittedAt: now,
                answers: s.answers.map((a) => ({ ...a, acceptedByTeacher: true })),
              }
            : s
        ),
        auditLogs: appendAudit(prev, 'Submit Evaluated Sheet', sheetId, sheet.status, 'evaluated'),
      }));
      return { ok: true };
    },
    [state.sheets, appendAudit]
  );

  const reportSheetProblem = useCallback(
    (sheetId: string, category: ProblemReport['category'], description: string) => {
      const sheet = state.sheets.find((s) => s.id === sheetId);
      if (!sheet || !currentUser) return;
      const report: ProblemReport = {
        id: uid('rep'),
        sheetId,
        paperId: sheet.paperId,
        teacherId: currentUser.id,
        category,
        description,
        createdAt: new Date().toISOString(),
        resolved: false,
      };
      setState((prev) => {
        const admins = prev.users.filter((u) => u.role === 'admin' && u.status === 'active');
        const adminNotifs = admins.map((adm) => ({
          id: uid('notif'),
          userId: adm.id,
          title: 'Teacher Reported Sheet Problem',
          message: `${currentUser.name} flagged ${sheetId} (${category.replace('_', ' ')}): ${description}`,
          type: 'warning' as const,
          createdAt: new Date().toISOString(),
          read: false,
          linkView: 'admin_intake',
        }));
        return {
          ...prev,
          problemReports: [report, ...prev.problemReports],
          notifications: [...adminNotifs, ...prev.notifications],
          auditLogs: appendAudit(prev, 'Report Sheet Problem', sheetId, undefined, category),
        };
      });
    },
    [state.sheets, currentUser, appendAudit]
  );

  const saveOcrLineCorrection = useCallback(
    (sheetId: string, questionId: string, lineId: string, newText: string, addToTraining: boolean) => {
      setState((prev) => ({
        ...prev,
        sheets: prev.sheets.map((s) => {
          if (s.id !== sheetId) return s;
          return {
            ...s,
            answers: s.answers.map((a) => {
              if (a.questionId !== questionId) return a;
              const updatedCrops = a.lineCrops.map((lc) =>
                lc.id === lineId
                  ? {
                      ...lc,
                      editedText: newText,
                      lowConfidenceWords: [],
                      lineConfidence: 99,
                      addedToTrainingSet: addToTraining,
                    }
                  : lc
              );
              const joined = updatedCrops.map((lc) => lc.editedText).join('\n');
              return {
                ...a,
                lineCrops: updatedCrops,
                ocrText: joined,
                lowConfidenceWords: updatedCrops.flatMap((lc) => lc.lowConfidenceWords),
              };
            }),
          };
        }),
        auditLogs: appendAudit(prev, 'OCR Line Correction', `${sheetId} · ${lineId}`, undefined, newText),
      }));
    },
    [appendAudit]
  );

  const submitReevaluationDecision = useCallback(
    (requestId: string, sheetId: string, updates: { questionId: string; newMarks: number; reason: string }[]) => {
      setState((prev) => {
        const nextSheets = prev.sheets.map((s) => {
          if (s.id !== sheetId) return s;
          return {
            ...s,
            answers: s.answers.map((a) => {
              const upd = updates.find((u) => u.questionId === a.questionId);
              if (!upd) return a;
              return {
                ...a,
                finalMarks: upd.newMarks,
                source: 'teacher' as const,
                teacherOverride: true,
                overrideReason: `Re-evaluation: ${upd.reason}`,
                changedBy: currentUser?.name || 'Teacher',
                changedAt: new Date().toISOString(),
                history: [
                  {
                    id: uid('hist'),
                    timestamp: new Date().toISOString(),
                    actorName: currentUser?.name || 'Teacher',
                    actorRole: 'teacher' as const,
                    previousMarks: a.finalMarks,
                    newMarks: upd.newMarks,
                    reason: upd.reason,
                    note: 'Phase 2 Re-evaluation',
                  },
                  ...a.history,
                ],
              };
            }),
          };
        });
        const admins = prev.users.filter((u) => u.role === 'admin' && u.status === 'active');
        const adminNotifs = admins.map((adm) => ({
          id: uid('notif'),
          userId: adm.id,
          title: 'Re-evaluation Completed',
          message: `${currentUser?.name || 'Teacher'} completed re-evaluation for request ${requestId}.`,
          type: 'success' as const,
          createdAt: new Date().toISOString(),
          read: false,
          linkView: 'admin_requests',
        }));
        return {
          ...prev,
          sheets: nextSheets,
          requests: prev.requests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  reevalCompleted: true,
                  reevalSummary: updates.map((u) => `${u.questionId}: ${u.newMarks} (${u.reason})`).join('; '),
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
          notifications: [...adminNotifs, ...prev.notifications],
          auditLogs: appendAudit(
            prev,
            'Re-evaluation Submitted',
            requestId,
            undefined,
            `${updates.length} question(s) updated`
          ),
        };
      });
    },
    [currentUser, appendAudit]
  );

  const updateTeacherPreferences = useCallback(
    (patch: Partial<TeacherPreferences>) => {
      if (!currentUser) return;
      setState((prev) => {
        const existing = prev.teacherPreferences[currentUser.id] ?? {
          defaultZoomPct: 100,
          enableKeyboardShortcuts: true,
          notifyOnAssignment: true,
          notifyOnReopen: true,
          notifyOnReeval: true,
        };
        return {
          ...prev,
          teacherPreferences: {
            ...prev.teacherPreferences,
            [currentUser.id]: { ...existing, ...patch },
          },
        };
      });
    },
    [currentUser]
  );

  const submitStudentRequest = useCallback(
    (paperId: string, reasonCategory: string, note: string) => {
      if (!currentUser) return { ok: false, error: 'Not signed in.' };
      const paper = state.papers.find((p) => p.id === paperId);
      if (!paper || paper.status !== 'published') {
        return { ok: false, error: 'Requests are allowed only for published papers.' };
      }
      const existingOpen = state.requests.find(
        (r) =>
          r.studentId === currentUser.id &&
          r.paperId === paperId &&
          (r.status === 'requested' || r.status === 'under_review' || r.status === 'approved')
      );
      if (existingOpen) {
        return { ok: false, error: 'You already have an open request for this paper.' };
      }
      const sheet = state.sheets.find((s) => s.paperId === paperId && s.studentId === currentUser.id);
      if (!sheet) {
        return { ok: false, error: 'No evaluated sheet found for this paper.' };
      }

      const newReq: StudentRequest = {
        id: uid('req'),
        studentId: currentUser.id,
        paperId,
        sheetId: sheet.id,
        reasonCategory,
        note,
        status: 'requested',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewDurationDays: state.settings.defaultRequestViewDays,
        allowDownload: false,
      };

      setState((prev) => {
        const admins = prev.users.filter((u) => u.role === 'admin' && u.status === 'active');
        const adminNotifs = admins.map((adm) => ({
          id: uid('notif'),
          userId: adm.id,
          title: 'New Evaluated Sheet Request',
          message: `${currentUser.name} (${currentUser.rollNumber}) requested their ${paperId} sheet.`,
          type: 'info' as const,
          createdAt: new Date().toISOString(),
          read: false,
          linkView: 'admin_requests',
        }));
        return {
          ...prev,
          requests: [newReq, ...prev.requests],
          notifications: [...adminNotifs, ...prev.notifications],
          auditLogs: appendAudit(prev, 'Student Sheet Request Created', `${paperId} · ${currentUser.rollNumber}`),
        };
      });
      return { ok: true };
    },
    [currentUser, state.papers, state.requests, state.sheets, state.settings.defaultRequestViewDays, appendAudit]
  );

  const cancelStudentRequest = useCallback(
    (requestId: string) => {
      setState((prev) => ({
        ...prev,
        requests: prev.requests.filter((r) => !(r.id === requestId && r.status === 'requested')),
        auditLogs: appendAudit(prev, 'Cancel Student Request', requestId),
      }));
    },
    [appendAudit]
  );

  const logSheetDownload = useCallback(
    (sheetId: string) => {
      setState((prev) => ({
        ...prev,
        auditLogs: appendAudit(prev, 'Download Evaluated Sheet', sheetId),
      }));
    },
    [appendAudit]
  );

  const markNotificationRead = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    if (!currentUser) return;
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.userId === currentUser.id ? { ...n, read: true } : n)),
    }));
  }, [currentUser]);

  const resetInstitutionWorkspace = useCallback(() => {
    const fresh = createInitialState();
    setState(fresh);
    setCurrentUserId(null);
    setSelectedPaperId(null);
    setSelectedSheetId(null);
    setProcessingQueue([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(`${STORAGE_KEY}_uid`);
    } catch {
      // ignore
    }
  }, []);

  const value: EvalContextValue = {
    state,
    currentUser,
    activeView,
    setActiveView,
    selectedPaperId,
    setSelectedPaperId,
    selectedSheetId,
    setSelectedSheetId,
    workspaceInitialQuestionId,
    setWorkspaceInitialQuestionId,
    globalSearch,
    setGlobalSearch,
    sessionLockedMsg,
    processingQueue,
    lastSavedAt,
    initializeInstitution,
    login,
    logout,
    completeForcedPasswordChange,
    changeOwnPassword,
    addUser,
    updateUser,
    toggleUserStatus,
    resetUserPassword,
    importUsersFromCsv,
    addSubject,
    addClassSection,
    addExam,
    addPaper,
    updatePaper,
    saveQuestion,
    addQuestion,
    deleteQuestion,
    toggleRubricLock,
    uploadSheetsBatch,
    retryFailedSheet,
    assignSheets,
    decideStudentRequest,
    publishPaperResults,
    unpublishPaperResults,
    reopenSheet,
    updateSettings,
    resolveProblemReport,
    markSpotCheckCompleted,
    bulkAcceptClearQuestions,
    updateAnswerEvaluation,
    recheckAnswerFromOcr,
    submitEvaluatedSheet,
    reportSheetProblem,
    saveOcrLineCorrection,
    submitReevaluationDecision,
    updateTeacherPreferences,
    submitStudentRequest,
    cancelStudentRequest,
    logSheetDownload,
    markNotificationRead,
    markAllNotificationsRead,
    resetInstitutionWorkspace,
  };

  return <EvalContext.Provider value={value}>{children}</EvalContext.Provider>;
}

export function useEval() {
  const ctx = useContext(EvalContext);
  if (!ctx) throw new Error('useEval must be used within EvalProvider');
  return ctx;
}
