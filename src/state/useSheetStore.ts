import { useState, useEffect } from 'react';

export type AppStep = 'setup' | 'upload' | 'processing' | 'evaluate' | 'report';

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
}

// Initial state is strictly empty - server is sole source of truth
const initialStoreState: SheetStoreState = {
  step: 'upload',
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
  isSidebarCollapsed: false,
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

  setPaper(paper: { id: string; title: string; totalMarks?: number; questionCount?: number; isLocked?: boolean }) {
    globalState = {
      ...globalState,
      paperId: paper.id,
      paperTitle: paper.title || '',
      paperTotalMarks: paper.totalMarks || 0,
      paperQuestionCount: paper.questionCount || 0,
      paperIsLocked: !!paper.isLocked,
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
    globalState = {
      ...globalState,
      isSidebarCollapsed: !globalState.isSidebarCollapsed,
    };
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
    const { step, sheetId } = globalState;
    let targetHash = `#/${step}`;
    if ((step === 'processing' || step === 'evaluate' || step === 'report') && sheetId) {
      targetHash = `#/${step}/${sheetId}`;
    }
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash);
    }
  },

  // Parse browser URL hash into state
  syncStateFromHash() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const parts = hash.split('/').filter(Boolean);
    const stepPart = (parts[0] || 'upload') as AppStep;
    const sheetIdPart = parts[1] || null;

    const validSteps: AppStep[] = ['setup', 'upload', 'processing', 'evaluate', 'report'];
    const resolvedStep: AppStep = validSteps.includes(stepPart) ? stepPart : 'upload';

    globalState = {
      ...globalState,
      step: resolvedStep,
      sheetId: sheetIdPart || globalState.sheetId,
    };
    emitChange();
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
