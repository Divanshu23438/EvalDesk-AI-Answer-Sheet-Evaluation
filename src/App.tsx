import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSheetStore, AppStep } from './state/useSheetStore';
import { apiClient } from './api/client';
import { AppSidebar } from './components/AppSidebar';
import { ErrorBanner } from './components/ErrorBanner';
import { ActionBar } from './components/ActionBar';
import { DashboardScreen } from './screens/DashboardScreen';
import { UploadScreen } from './screens/UploadScreen';
import { EvaluateScreen } from './screens/EvaluateScreen';
import { ReportScreen } from './screens/ReportScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ReportsCenterScreen } from './screens/ReportsCenterScreen';
import { HomeScreen } from './screens/HomeScreen';
import { GuideScreen } from './screens/GuideScreen';
import {
  FileText,
  FileSpreadsheet,
  CheckCircle,
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo?: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('EvalDesk Runtime Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.handleHashChange);
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.handleHashChange);
  }

  handleHashChange = () => {
    if (this.state.hasError) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.hash = '#/upload';
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex-1 min-w-0 h-screen overflow-y-auto bg-[#F6F7F5] dark:bg-[#111312] p-6 flex flex-col items-center justify-center select-text">
          <div className="max-w-lg w-full bg-white dark:bg-[#181B19] border border-rose-200 dark:border-[#45262C] rounded-2xl p-6 shadow-none dark:shadow-none text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-[#2B191D] text-rose-600 dark:text-[#E57D8A] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111827] dark:text-[#ECEEED]">Application Error Encountered</h2>
              <p className="text-xs text-[#4B5563] dark:text-[#969E9A] mt-1.5 leading-relaxed">
                {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
              </p>
            </div>
            {this.state.error?.stack && (
              <pre className="text-[10px] text-left font-mono bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] p-3 rounded-xl max-h-40 overflow-y-auto text-[#4B5563] dark:text-[#969E9A] whitespace-pre-wrap leading-tight">
                {this.state.error.stack}
              </pre>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white text-xs font-semibold shadow-none dark:shadow-none transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload Evaluation Workspace</span>
              </button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [state, store] = useSheetStore();
  const [currentRoute, setCurrentRoute] = useState<AppStep>(() => {
    if (typeof window === 'undefined') return 'home';
    const cleanHash = window.location.hash.replace(/^#\/?/, '');
    const first = cleanHash.split('/').filter(Boolean)[0] || '';
    if (first === 'dashboard' || first === 'login') return 'dashboard';
    if (first === 'history') return 'history';
    if (first === 'reports') return 'reports';
    if (first === 'evaluate') return 'evaluate';
    if (first === 'report') return 'report';
    if (first === 'guide') return 'guide';
    if (first === 'upload' || first === 'setup' || first === 'processing') return 'upload';
    return 'home';
  });
  const [routeSheetId, setRouteSheetId] = useState<string | null>(null);

  const [providerStatus, setProviderStatus] = useState<'online' | 'degraded' | 'offline'>('online');
  const [providerLabel, setProviderLabel] = useState<string>('Checking AI...');

  const mainRef = useRef<HTMLElement | null>(null);

  // 1. URL Hash-based Routing Parser
  const parseHash = useCallback(() => {
    const rawHash = typeof window !== 'undefined' ? window.location.hash : '';
    const cleanHash = rawHash.replace(/^#\/?/, '');
    const parts = cleanHash.split('/').filter(Boolean);
    const stepPart = parts[0] || '';
    const sheetIdPart = parts[1] || null;

    let targetStep: AppStep = 'home';
    if (stepPart === 'dashboard' || stepPart === 'login') {
      targetStep = 'dashboard';
    } else if (stepPart === 'history') {
      targetStep = 'history';
    } else if (stepPart === 'reports') {
      targetStep = 'reports';
    } else if (stepPart === 'evaluate') {
      targetStep = 'evaluate';
    } else if (stepPart === 'report') {
      targetStep = 'report';
    } else if (stepPart === 'guide') {
      targetStep = 'guide';
    } else if (stepPart === 'upload' || stepPart === 'setup' || stepPart === 'processing' || stepPart === 'signup' || stepPart === 'sign-up') {
      targetStep = 'upload';
    } else if (stepPart === 'home' || !stepPart || stepPart === '') {
      targetStep = 'home';
    } else {
      targetStep = 'home';
    }

    setCurrentRoute(targetStep);
    setRouteSheetId(sheetIdPart);

    if (state.step !== targetStep || (sheetIdPart && state.sheetId !== sheetIdPart)) {
      store.syncStateFromHash();
    }
  }, [state.step, state.sheetId, store]);

  // Initial mount & hashchange event listener
  useEffect(() => {
    parseHash();

    const onHashChange = () => {
      parseHash();
    };

    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [parseHash]);

  // Sync state.step when store changes
  useEffect(() => {
    if (state.step && state.step !== currentRoute) {
      setCurrentRoute(state.step);
    }
    if (state.sheetId !== routeSheetId) {
      setRouteSheetId(state.sheetId);
    }
  }, [state.step, state.sheetId, currentRoute, routeSheetId]);

  // 2. Fetch Provider & Quota Health
  useEffect(() => {
    let isCancelled = false;

    const checkHealth = async () => {
      try {
        const data = await apiClient.get<Record<string, any>>('/api/health/providers');
        if (isCancelled) return;

        const geminiText = data.gemini_text?.status === 'online';
        const geminiImg = data.gemini_image?.status === 'online';
        const groqImg = data.groq_image?.status === 'online';

        if (geminiText && (geminiImg || groqImg)) {
          setProviderStatus('online');
          setProviderLabel('AI Online');
        } else if (geminiText || geminiImg || groqImg) {
          setProviderStatus('degraded');
          setProviderLabel('AI Degraded');
        } else {
          setProviderStatus('offline');
          setProviderLabel('AI Offline');
        }

        store.setProviderHealth({
          isHealthy: geminiText,
          providers: data,
        });
      } catch (err) {
        if (isCancelled) return;
        setProviderStatus('offline');
        setProviderLabel('AI Offline');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [store]);

  // Scroll to top on step or sheet switch
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [currentRoute, routeSheetId]);

  // 3. Workflow Stepper: Strictly 3 Steps (1. Upload > 2. Evaluate > 3. Report)
  const stepperSteps: { id: AppStep; label: string; number: number }[] = [
    { id: 'upload', label: 'Upload', number: 1 },
    { id: 'evaluate', label: 'Evaluate', number: 2 },
    { id: 'report', label: 'Report', number: 3 },
  ];

  const handleStepClick = async (step: AppStep) => {
    if ((step === 'evaluate' || step === 'report') && !state.sheetId && state.paperId) {
      try {
        const sheetsData = await apiClient.get<{ sheets: any[] }>(`/api/papers/${state.paperId}/sheets`);
        const sheetsList = Array.isArray(sheetsData?.sheets) ? sheetsData.sheets : [];
        if (sheetsList.length > 0) {
          const target = sheetsList[0];
          store.setSheet(target.id, target.student_name, target.roll);
          store.setStep(step, target.id);
          window.location.hash = `#/${step}/${target.id}`;
          return;
        }
      } catch {}
    }
    store.setStep(step);
    window.location.hash = `#/${step}`;
  };

  if (currentRoute === 'home') {
    return (
      <ErrorBoundary>
        <div className="w-full h-screen overflow-y-auto bg-[#F6F7F5] dark:bg-[#111312]">
          <HomeScreen />
        </div>
      </ErrorBoundary>
    );
  }

  const isEvalWorkflow = currentRoute === 'upload' || currentRoute === 'evaluate' || currentRoute === 'report';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F6F7F5] dark:bg-[#111312] font-sans select-none app-shell">
      {/* 1. Persistent Collapsible Left Navigation Sidebar */}
      <AppSidebar />

      {/* 2. Main Content Area with inline ErrorBoundary */}
      <ErrorBoundary>
        <main
          ref={mainRef}
          className="flex-1 min-w-0 h-screen overflow-y-auto bg-[#F6F7F5] dark:bg-[#111312] flex flex-col app-main"
        >
          {/* Top evaluation workflow stepper header (for upload and evaluate) */}
          {isEvalWorkflow && currentRoute !== 'report' && (
            <header
              role="banner"
              className="h-[48px] bg-white dark:bg-[#181B19] border-b border-[#E2E8E4] dark:border-[#2A2F2C] px-4 flex items-center justify-between select-none z-30 shrink-0 shadow-none dark:shadow-none print:hidden"
            >
              {/* Left: Breadcrumbs or Section Context */}
              <div className="flex items-center gap-3 min-w-0">
                {currentRoute === 'evaluate' && state.studentName ? (
                  <div className="flex items-center gap-1.5 truncate text-xs">
                    <span className="font-semibold text-[#111827] dark:text-[#ECEEED] truncate">{state.paperTitle || 'Assessment Paper'}</span>
                    <span className="text-[#6B7280] dark:text-[#68706C]">/</span>
                    <div className="flex items-center gap-1.5 font-semibold text-[#111827] dark:text-[#ECEEED] bg-[#F1F4F2] dark:bg-[#202422] px-2 py-0.5 rounded border border-[#E2E8E4] dark:border-[#2F3532]">
                      <span>{state.studentName}</span>
                      {state.rollNumber && (
                        <span className="text-[11px] font-normal text-[#6B7280] dark:text-[#68706C] font-mono">
                          ({state.rollNumber})
                        </span>
                      )}
                    </div>
                    {state.reviewMetrics && (
                      <div className="flex items-center gap-1.5 tabular-nums text-[11px]">
                        <span className="text-[#6B7280] dark:text-[#68706C]">/</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] font-bold border border-[#0F5132]/20 dark:border-[#294236]">
                          {state.reviewMetrics.checked}/{state.reviewMetrics.total} marked
                        </span>
                        {state.reviewMetrics.flagged > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-[#2B2416] text-amber-800 dark:text-[#E5B567] font-semibold border border-amber-200 dark:border-[#42361F] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {state.reviewMetrics.flagged} flagged
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-[#E2E8E4] dark:border-[#2F3532] bg-[#F1F4F2] dark:bg-[#202422] text-[#111827] dark:text-[#ECEEED]"
                    title="Target Assessment Paper"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3] shrink-0" />
                    <span className="truncate max-w-[240px] font-semibold text-[#111827] dark:text-[#ECEEED]">
                      {state.paperTitle || 'Assessment Paper'}
                    </span>
                    {state.paperTotalMarks > 0 && (
                      <span className="text-[11px] text-[#6B7280] dark:text-[#68706C] font-mono tabular-nums">
                        ({state.paperTotalMarks}M)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Center: Streamlined 3-Step Stepper */}
              <nav aria-label="Workflow Stepper" className="hidden md:flex items-center gap-1.5">
                {stepperSteps.map((step, idx) => {
                  const stepIndex = stepperSteps.findIndex((s) => s.id === step.id);
                  const currentStepIndex = stepperSteps.findIndex((s) => s.id === currentRoute);
                  const isActive = currentRoute === step.id;
                  const isPast = currentStepIndex > stepIndex;

                  return (
                    <React.Fragment key={step.id}>
                      {idx > 0 && (
                        <span className="text-[#6B7280] dark:text-[#68706C] text-xs px-0.5">›</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStepClick(step.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          isActive
                            ? 'bg-[#E8F3EE] text-[#0F5132] dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border dark:border-[#294236]'
                            : isPast
                            ? 'text-[#4B5563] dark:text-[#969E9A] hover:bg-[#F1F4F2] dark:hover:bg-[#202422]'
                            : 'text-[#6B7280] dark:text-[#68706C] hover:text-[#111827] dark:hover:text-[#ECEEED]'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                            isActive
                              ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white'
                              : isPast
                              ? 'bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3]'
                              : 'border border-[#E2E8E4] dark:border-[#2F3532] text-[#6B7280] dark:text-[#68706C]'
                          }`}
                        >
                          {isPast ? <Check className="w-2.5 h-2.5" /> : step.number}
                        </span>
                        <span>{step.label}</span>
                        {isActive && (
                          <span className="text-[9px] uppercase tracking-wider bg-[#0F5132] dark:bg-[#1F6E4A] text-white px-1 rounded font-bold">
                            Active
                          </span>
                        )}
                      </button>
                    </React.Fragment>
                  );
                })}
              </nav>

              {/* Right: Telemetry & AI Status Indicator */}
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#E2E8E4] dark:border-[#2F3532] bg-[#F1F4F2] dark:bg-[#202422] text-[11px] font-medium text-[#4B5563] dark:text-[#969E9A]"
                  title="Live AI Provider Status"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      providerStatus === 'online'
                        ? 'bg-emerald-500'
                        : providerStatus === 'degraded'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                  />
                  <Activity className="w-3 h-3 text-[#6B7280] dark:text-[#68706C]" />
                  <span>{providerLabel}</span>
                </div>
              </div>
            </header>
          )}

          {/* Sliding Error Banner (Overlay) */}
          <ErrorBanner
            error={state.error}
            onDismiss={() => store.clearError()}
          />

          {/* Screen Route Dispatcher */}
          <div className="flex-1 min-h-0 min-w-0 flex flex-col">
            {currentRoute === 'dashboard' && <DashboardScreen />}
            {currentRoute === 'upload' && <UploadScreen />}
            {currentRoute === 'evaluate' && <EvaluateScreen />}
            {currentRoute === 'report' && <ReportScreen />}
            {currentRoute === 'history' && <HistoryScreen />}
            {currentRoute === 'reports' && <ReportsCenterScreen />}
            {currentRoute === 'guide' && <GuideScreen />}
          </div>

          {/* 56px Bottom Action Bar (only on upload or evaluate) */}
          {(currentRoute === 'upload' || currentRoute === 'evaluate') && (
            <div className="print:hidden">
              <ActionBar
                leftContent={
                currentRoute === 'evaluate' ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:prev'))}
                      className="p-1 rounded border border-[#E2E8E4] dark:border-[#2F3532] hover:bg-[#F1F4F2] dark:hover:bg-[#202422] text-[#4B5563] dark:text-[#ECEEED] flex items-center gap-1 font-medium text-xs transition cursor-pointer"
                      title="Previous Question (←)"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Prev</span>
                    </button>
                    <span className="font-semibold text-xs text-[#111827] dark:text-[#ECEEED] tabular-nums">
                      Q {state.reviewMetrics?.currentIndex || 1} of {state.reviewMetrics?.total || 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:next'))}
                      className="p-1 rounded border border-[#E2E8E4] dark:border-[#2F3532] hover:bg-[#F1F4F2] dark:hover:bg-[#202422] text-[#4B5563] dark:text-[#ECEEED] flex items-center gap-1 font-medium text-xs transition cursor-pointer"
                      title="Next Question (→)"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    {state.reviewMetrics && state.reviewMetrics.total > 0 && (
                      <div className="hidden lg:flex w-24 h-2 rounded-full bg-slate-200 dark:bg-[#202422] overflow-hidden">
                        <div
                          className="bg-[#0F5132] dark:bg-[#1F6E4A] h-full transition-all duration-300"
                          style={{
                            width: `${(state.reviewMetrics.checked / state.reviewMetrics.total) * 100}%`,
                          }}
                        />
                        <div
                          className="bg-amber-500 h-full transition-all duration-300"
                          style={{
                            width: `${(state.reviewMetrics.flagged / state.reviewMetrics.total) * 100}%`,
                          }}
                        />
                        <div
                          className="bg-rose-500 h-full transition-all duration-300"
                          style={{
                            width: `${(state.reviewMetrics.failed / state.reviewMetrics.total) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-xs">
                    <div className="flex items-center space-x-1.5 bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] px-2.5 py-1 rounded">
                      {state.paperIsLocked ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-[#7CC9A3]" />
                          <span className="font-bold text-[#111827] dark:text-[#ECEEED]">Locked Paper Scheme:</span>
                          <span className="text-[#4B5563] dark:text-[#969E9A] font-medium">
                            {state.paperTitle || 'Assessment Paper'} · {state.paperQuestionCount} Questions · {state.paperTotalMarks} Max Marks
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-[#E5B567]" />
                          <span className="font-bold text-[#111827] dark:text-[#ECEEED]">Draft Assessment:</span>
                          <span className="text-[#4B5563] dark:text-[#969E9A] font-medium">
                            {state.paperTitle || 'Untitled Paper'} · {state.paperQuestionCount} Questions (Unlocked)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )
              }
              centerContent={
                currentRoute === 'evaluate' ? (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-[#0F5132] dark:text-[#7CC9A3] font-semibold tabular-nums">
                      ✔ {state.reviewMetrics?.checked || 0} checked
                    </span>
                    <span className="text-[#6B7280] dark:text-[#68706C]">·</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        (state.reviewMetrics?.flagged || 0) > 0
                          ? 'text-amber-700 dark:text-[#E5B567]'
                          : 'text-[#6B7280] dark:text-[#68706C]'
                      }`}
                    >
                      ⚑ {state.reviewMetrics?.flagged || 0} flagged
                    </span>
                    {(state.reviewMetrics?.failed || 0) > 0 && (
                      <>
                        <span className="text-[#6B7280] dark:text-[#68706C]">·</span>
                        <span className="text-rose-600 dark:text-[#E57D8A] font-semibold tabular-nums">
                          ✕ {state.reviewMetrics?.failed} failed
                        </span>
                      </>
                    )}
                    <div className="hidden xl:flex items-center gap-1.5 text-[10px] text-[#6B7280] dark:text-[#68706C] ml-2">
                      <kbd className="px-1 py-0.5 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] font-mono text-[#111827] dark:text-[#ECEEED]">
                        A
                      </kbd>{' '}
                      Approve
                      <kbd className="px-1 py-0.5 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] font-mono text-[#111827] dark:text-[#ECEEED]">
                        F
                      </kbd>{' '}
                      Flag
                      <kbd className="px-1 py-0.5 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] font-mono text-[#111827] dark:text-[#ECEEED]">
                        R
                      </kbd>{' '}
                      Recheck
                    </div>
                  </div>
                ) : (
                  <div className="hidden lg:flex items-center gap-3 text-[11px] text-[#6B7280] dark:text-[#68706C]">
                    <span>Shortcuts:</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] font-mono text-[10px] text-[#111827] dark:text-[#ECEEED]">
                      A
                    </kbd>{' '}
                    Approve
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] font-mono text-[10px] text-[#111827] dark:text-[#ECEEED]">
                      F
                    </kbd>{' '}
                    Next Flag
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] font-mono text-[10px] text-[#111827] dark:text-[#ECEEED]">
                      ← / →
                    </kbd>{' '}
                    Navigate
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] font-mono text-[10px] text-[#111827] dark:text-[#ECEEED]">
                      [
                    </kbd>{' '}
                    Toggle Sidebar
                  </div>
                )
              }
              rightContent={
                currentRoute === 'upload' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (state.sheetId) {
                        store.setStep('evaluate', state.sheetId);
                        window.location.hash = `#/evaluate/${state.sheetId}`;
                      }
                    }}
                    disabled={!state.sheetId}
                    className="px-4 py-1.5 rounded-lg bg-[#0F5132] text-white text-xs font-semibold hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-none dark:shadow-none cursor-pointer"
                  >
                    <span>Open Evaluation Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:help'))}
                      className="p-1.5 rounded border border-[#E2E8E4] dark:border-[#2F3532] hover:bg-[#F1F4F2] dark:hover:bg-[#202422] text-[#4B5563] dark:text-[#ECEEED] transition cursor-pointer"
                      title="Keyboard Shortcuts (?)"
                    >
                      <span className="font-mono text-xs font-bold">?</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:approve-all'))}
                      className="px-3 py-1 rounded bg-[#F1F4F2] dark:bg-[#202422] hover:bg-slate-200 dark:hover:bg-[#2F3532] text-[#111827] dark:text-[#ECEEED] font-semibold text-xs border border-[#E2E8E4] dark:border-[#2F3532] transition cursor-pointer"
                    >
                      Approve All
                    </button>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:finish'))}
                      className={`px-3.5 py-1 rounded font-semibold text-xs transition flex items-center gap-1 shadow-none dark:shadow-none text-white cursor-pointer ${
                        state.reviewMetrics?.allResolved
                          ? 'bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A]'
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      <span>{state.reviewMetrics?.allResolved ? 'Finish & Report' : 'Review Remaining'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )
              }
            />
            </div>
          )}
        </main>
      </ErrorBoundary>
    </div>
  );
}
