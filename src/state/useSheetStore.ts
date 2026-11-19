import { useState, useEffect } from 'react';

export type AppStep = 'home' | 'dashboard' | 'upload' | 'evaluate' | 'report' | 'history' | 'reports' | 'guide';

function getInitialStep(): AppStep {
  if (typeof window === 'undefined') return 'home';
  const rawHash = window.location.hash.replace(/^#\/?/, '');
  const stepPart = rawHash.split('/').filter(Boolean)[0] || '';
  if (stepPart === 'dashboard' || stepPart === 'login') return 'dashboard';
  if (stepPart === 'history') return 'history';
  if (stepPart === 'reports') return 'reports';
  if (stepPart === 'evaluate') return 'evaluate';
  if (stepPart === 'report') return 'report';
  if (stepPart === 'guide') return 'guide';
  if (stepPart === 'upload' || stepPart === 'setup' || stepPart === 'processing') return 'upload';
  return 'home';
}

export interface ProviderHealthState {
  isHealthy: boolean;
  quotaStatus?: string;
  providers: Record<string, { status: string; latency_ms?: number; error?: string | null }>;
}

export interface SheetStoreError {
  code: string;
  message: string;
  retry_at?: string | null;
  onRetry?: () => void;
}

export interface ReviewMetrics {
  total: number;
  checked: number;
  flagged: number;
  failed: number;
  currentIndex: number;
  allResolved: boolean;
}

export interface SheetStoreState {
  step: AppStep;
  paperId: string | null;
  paperTitle: string;
  paperTotalMarks: number;
  paperQuestionCount: number;
  paperIsLocked: boolean;
  sheetId: string | null;
  studentName: string;
  rollNumber: string;
  activeQuestionKey: string | null;
  error: SheetStoreError | null;
  providerHealth: ProviderHealthState | null;
  isSidebarCollapsed: boolean;
  reviewMetrics: ReviewMetrics | null;
}

// Initial state is strictly empty - server is sole source of truth
const initialStoreState: SheetStoreState = {
  step: getInitialStep(),
  paperId: null,
  paperTitle: '',
  paperTotalMarks: 0,
  paperQuestionCount: 0,
  paperIsLocked: false,
  sheetId: null,
  studentName: '',
  rollNumber: '',
  activeQuestionKey: null,
  error: null,
  providerHealth: null,
  isSidebarCollapsed: typeof localStorage !== 'undefined' ? localStorage.getItem('evaldesk_sidebar_collapsed') === 'true' : false,
  reviewMetrics: null,
};

let globalState: SheetStoreState = { ...initialStoreState };
const listeners = new Set<(state: SheetStoreState) => void>();

function emitChange() {
  for (const listener of listeners) {
    listener(globalState);
  }
}

export const sheetStore = {
  getState(): SheetStoreState {
    return globalState;
  },

  setState(partial: Partial<SheetStoreState>) {
    globalState = { ...globalState, ...partial };
    emitChange();
  },

  setStep(step: AppStep, sheetId?: string | null) {
    globalState = {
      ...globalState,
      step,
      ...(sheetId !== undefined ? { sheetId } : {}),
      error: null, // Clear transient error on route navigation
    };
    emitChange();
    this.updateHashFromState();
  },

  setPaper(paper: { id: string; title?: string; totalMarks?: number; questionCount?: number; isLocked?: boolean }) {
    globalState = {
      ...globalState,
      paperId: paper.id,
      paperTitle: paper.title !== undefined ? paper.title : globalState.paperTitle,
      paperTotalMarks: paper.totalMarks !== undefined ? paper.totalMarks : globalState.paperTotalMarks,
      paperQuestionCount: paper.questionCount !== undefined ? paper.questionCount : globalState.paperQuestionCount,
      paperIsLocked: paper.isLocked !== undefined ? !!paper.isLocked : globalState.paperIsLocked,
    };
    emitChange();
  },

  setSheet(sheetId: string | null, studentName = '', rollNumber = '') {
    globalState = {
      ...globalState,
      sheetId,
      studentName,
      rollNumber,
    };
    emitChange();
  },

  setActiveQuestionKey(key: string | null) {
    globalState = {
      ...globalState,
      activeQuestionKey: key,
    };
    emitChange();
  },

  toggleSidebar() {
    const nextVal = !globalState.isSidebarCollapsed;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('evaldesk_sidebar_collapsed', String(nextVal));
      } catch {}
    }
    globalState = {
      ...globalState,
      isSidebarCollapsed: nextVal,
    };
    emitChange();
  },

  setReviewMetrics(metrics: ReviewMetrics | null) {
    globalState = { ...globalState, reviewMetrics: metrics };
    emitChange();
  },

  setError(error: SheetStoreError | null) {
    globalState = { ...globalState, error };
    emitChange();
  },

  clearError() {
    globalState = { ...globalState, error: null };
    emitChange();
  },

  setProviderHealth(health: ProviderHealthState | null) {
    globalState = { ...globalState, providerHealth: health };
    emitChange();
  },

  reset() {
    globalState = { ...initialStoreState };
    emitChange();
    this.updateHashFromState();
  },

  // Synchronize browser URL hash with state
  updateHashFromState() {
    if (typeof window === 'undefined') return;
    const { step, sheetId } = globalState;
    let targetHash = step === 'home' ? '#/' : `#/${step}`;
    if ((step === 'evaluate' || step === 'report') && sheetId) {
      targetHash = `#/${step}/${sheetId}`;
    }
    const currentHash = window.location.hash;
    const isAlreadyHome = step === 'home' && (currentHash === '#/' || currentHash === '#/home' || currentHash === '' || currentHash === '#');
    if (currentHash !== targetHash && !isAlreadyHome) {
      window.location.hash = targetHash;
    }
  },

  // Parse browser URL hash into state
  syncStateFromHash() {
    const rawHash = typeof window !== 'undefined' ? window.location.hash : '';
    const hash = rawHash.replace(/^#\/?/, '');
    const parts = hash.split('/').filter(Boolean);
    const stepPart = parts[0] || '';
    const sheetIdPart = parts[1] || null;

    let resolvedStep: AppStep = 'home';
    if (stepPart === 'dashboard' || stepPart === 'login') {
      resolvedStep = 'dashboard';
    } else if (stepPart === 'history') {
      resolvedStep = 'history';
    } else if (stepPart === 'reports') {
      resolvedStep = 'reports';
    } else if (stepPart === 'evaluate') {
      resolvedStep = 'evaluate';
    } else if (stepPart === 'report') {
      resolvedStep = 'report';
    } else if (stepPart === 'guide') {
      resolvedStep = 'guide';
    } else if (stepPart === 'upload' || stepPart === 'setup' || stepPart === 'processing' || stepPart === 'signup' || stepPart === 'sign-up') {
      resolvedStep = 'upload';
    } else if (stepPart === 'home' || !stepPart || stepPart === '') {
      resolvedStep = 'home';
    } else {
      resolvedStep = 'home';
    }

    globalState = {
      ...globalState,
      step: resolvedStep,
      sheetId: sheetIdPart || globalState.sheetId,
    };
    emitChange();
    this.updateHashFromState();
  },
};

export function useSheetStore(): [SheetStoreState, typeof sheetStore] {
  const [state, setState] = useState<SheetStoreState>(globalState);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return [state, sheetStore];
}
