import React, { useEffect, useState } from 'react';
import { useSheetStore, AppStep } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { ErrorBanner } from '../components/ErrorBanner';
import { ActionBar } from '../components/ActionBar';
import { UploadScreen } from '../screens/UploadScreen';
import { EvaluateScreen } from '../screens/EvaluateScreen';
import { ReportScreen } from '../screens/ReportScreen';
import { PaperSetupScreen } from '../screens/PaperSetupScreen';
import {
  FileText,
  FileSpreadsheet,
  Upload,
  CheckCircle,
  BarChart,
  Settings,
  Activity,
  ArrowRight,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
} from 'lucide-react';

export const Shell: React.FC = () => {
  const [state, store] = useSheetStore();
  const [providerStatus, setProviderStatus] = useState<'online' | 'degraded' | 'offline'>('online');
  const [providerLabel, setProviderLabel] = useState<string>('Checking AI...');

  // 1. URL Hash Routing on Mount & HashChange
  useEffect(() => {
    store.syncStateFromHash();

    const handleHashChange = () => {
      store.syncStateFromHash();
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [store]);

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

  // 3. Workflow Stepper: Strictly 3 Steps (Upload > Evaluate > Report)
  const stepperSteps: { id: AppStep; label: string; number: number }[] = [
    { id: 'upload', label: 'Upload', number: 1 },
    { id: 'evaluate', label: 'Evaluate', number: 2 },
    { id: 'report', label: 'Report', number: 3 },
  ];

  const handleStepClick = (step: AppStep) => {
    store.setStep(step);
  };

  return (
    <div className="app">
      {/* 48px Top Bar */}
      <header
        role="banner"
        className="h-[48px] bg-white border-b border-slate-200 px-4 flex items-center justify-between select-none z-30 shrink-0 shadow-2xs"
      >
        {/* Left: Brand Logo & Assessment / Student Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0" data-purpose="app-branding">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
              ED
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900">
              EvalDesk
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300 px-1.5 py-0.2 rounded leading-none">
              PRO
            </span>
          </div>

          <div className="h-4 w-[1px] bg-slate-200 shrink-0" />

          {/* Paper Setup Pill / Student Context Breadcrumb */}
          <div className="min-w-0 flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => store.setStep('setup')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                state.step === 'setup'
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
              title="Open Assessment Paper Setup"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate max-w-[220px]">
                {state.paperTitle || 'Assessment Setup'}
              </span>
              <Settings className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {state.step === 'evaluate' && state.studentName ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-slate-300">/</span>
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  <span>{state.studentName}</span>
                  {state.rollNumber && (
                    <span className="text-[11px] font-normal text-slate-500 font-mono">
                      ({state.rollNumber})
                    </span>
                  )}
                </div>
                {state.reviewMetrics && (
                  <div className="flex items-center gap-1.5 tabular-nums text-[11px]">
                    <span className="text-slate-300">/</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      {state.reviewMetrics.checked}/{state.reviewMetrics.total} marked
                    </span>
                    {state.reviewMetrics.flagged > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold border border-amber-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {state.reviewMetrics.flagged} flagged
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              state.paperTotalMarks > 0 && (
                <span className="text-[11px] text-slate-500 tabular-nums shrink-0 font-medium">
                  ({state.paperTotalMarks} Marks)
                </span>
              )
            )}
          </div>
        </div>

        {/* Center: Streamlined 3-Step Stepper (Upload > Evaluate > Report) */}
        <nav aria-label="Workflow Stepper" className="hidden md:flex items-center gap-1.5">
          {stepperSteps.map((step, idx) => {
            const isActive = state.step === step.id;
            const isPast =
              (step.id === 'upload' && (state.step === 'evaluate' || state.step === 'report')) ||
              (step.id === 'evaluate' && state.step === 'report');

            return (
              <React.Fragment key={step.id}>
                {idx > 0 && (
                  <span className="text-slate-300 text-xs px-0.5">›</span>
                )}
                <button
                  type="button"
                  onClick={() => handleStepClick(step.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-2xs'
                      : isPast
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : isPast
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'border border-slate-300 text-slate-400'
                    }`}
                  >
                    {isPast ? <Check className="w-2.5 h-2.5" /> : step.number}
                  </span>
                  <span>{step.label}</span>
                  {isActive && (
                    <span className="text-[9px] uppercase tracking-wider bg-indigo-600 text-white px-1 rounded font-bold">
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700"
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
            <Activity className="w-3 h-3 text-slate-400" />
            <span>{providerLabel}</span>
          </div>
        </div>
      </header>

      {/* Sliding Error Banner (Overlay) */}
      <ErrorBanner
        error={state.error}
        onDismiss={() => store.clearError()}
      />

      {/* Main 1fr Screen Area (Zero Page Scroll) */}
      <main className="min-h-0 overflow-hidden relative bg-slate-50 flex-1">
        {state.step === 'setup' && <PaperSetupScreen />}
        {state.step === 'upload' && <UploadScreen />}
        {state.step === 'processing' && <UploadScreen />}
        {state.step === 'evaluate' && <EvaluateScreen />}
        {state.step === 'report' && <ReportScreen />}
      </main>

      {/* 56px Bottom Action Bar */}
      <ActionBar
        leftContent={
          state.step === 'evaluate' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:prev'))}
                className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center gap-1 font-medium text-xs transition"
                title="Previous Question (←)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>
              <span className="font-semibold text-xs text-slate-800 tabular-nums">
                Q {state.reviewMetrics?.currentIndex || 1} of {state.reviewMetrics?.total || 1}
              </span>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:next'))}
                className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center gap-1 font-medium text-xs transition"
                title="Next Question (→)"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              {state.reviewMetrics && state.reviewMetrics.total > 0 && (
                <div className="hidden lg:flex w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
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
          ) : state.step === 'report' ? (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:report:back-review'))}
              className="p-1 px-2.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center gap-1 font-medium text-xs transition shadow-2xs"
              title="Return to Evaluation Review"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Review</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2 text-xs">
              <div className="flex items-center space-x-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                {state.paperIsLocked ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-bold text-slate-800">Locked Paper Scheme:</span>
                    <span className="text-slate-600 font-medium">
                      {state.paperTitle || 'Assessment Paper'} · {state.paperQuestionCount} Questions · {state.paperTotalMarks} Max Marks
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-bold text-slate-800">Draft Assessment:</span>
                    <span className="text-slate-600 font-medium">
                      {state.paperTitle || 'Untitled Paper'} · {state.paperQuestionCount} Questions (Unlocked)
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => store.setStep('setup')}
                className="text-xs text-slate-500 hover:text-indigo-600 hover:underline"
              >
                Change Paper
              </button>
            </div>
          )
        }
        centerContent={
          state.step === 'evaluate' ? (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-700 font-semibold tabular-nums">
                ✔ {state.reviewMetrics?.checked || 0} checked
              </span>
              <span>·</span>
              <span
                className={`font-semibold tabular-nums ${
                  (state.reviewMetrics?.flagged || 0) > 0
                    ? 'text-amber-700'
                    : 'text-slate-400'
                }`}
              >
                ⚑ {state.reviewMetrics?.flagged || 0} flagged
              </span>
              {(state.reviewMetrics?.failed || 0) > 0 && (
                <>
                  <span>·</span>
                  <span className="text-rose-600 font-semibold tabular-nums">
                    ✕ {state.reviewMetrics?.failed} failed
                  </span>
                </>
              )}
              <div className="hidden xl:flex items-center gap-1.5 text-[10px] text-slate-500 ml-2">
                <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono">
                  A
                </kbd>{' '}
                Approve
                <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono">
                  F
                </kbd>{' '}
                Flag
                <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono">
                  R
                </kbd>{' '}
                Recheck
              </div>
            </div>
          ) : state.step === 'report' ? (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">
                {state.studentName || 'Student Report'}
              </span>
              {state.rollNumber && (
                <span className="tabular-nums text-slate-500">
                  · Roll {state.rollNumber}
                </span>
              )}
              <span className="text-slate-300">·</span>
              <span>Complete Assessment Report & Class Analytics</span>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-500">
              <span>Shortcuts:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">
                A
              </kbd>{' '}
              Approve
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">
                F
              </kbd>{' '}
              Next Flag
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">
                ← / →
              </kbd>{' '}
              Navigate
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">
                [
              </kbd>{' '}
              Toggle Sidebar
            </div>
          )
        }
        rightContent={
          state.step === 'setup' ? (
            <button
              type="button"
              onClick={() => store.setStep('upload')}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm"
            >
              <span>Proceed to Upload</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : state.step === 'upload' ? (
            <button
              type="button"
              onClick={() => {
                if (state.sheetId) {
                  store.setStep('evaluate', state.sheetId);
                }
              }}
              disabled={!state.sheetId}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 shadow-sm"
            >
              <span>Open Evaluation Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : state.step === 'evaluate' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:approve-all'))}
                disabled={
                  !state.reviewMetrics ||
                  state.reviewMetrics.checked >= state.reviewMetrics.total
                }
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 transition shadow-2xs"
              >
                Approve all unflagged
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:finish'))}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition flex items-center gap-1.5 shadow-sm ${
                  state.reviewMetrics?.allResolved
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {state.reviewMetrics?.allResolved ? (
                  <>
                    <span>Evaluated → Report</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <span>
                    {(state.reviewMetrics?.flagged || 0) + (state.reviewMetrics?.failed || 0)} flagged left (Jump)
                  </span>
                )}
              </button>
            </div>
          ) : state.step === 'report' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:report:download-pdf'))}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition flex items-center gap-1 shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-rose-500" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:report:download-excel'))}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition flex items-center gap-1 shadow-2xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('evaldesk:report:next-sheet'))}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1 shadow-sm"
              >
                <span>Next Sheet</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => store.setStep('upload')}
              className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Next Sheet
            </button>
          )
        }
      />
    </div>
  );
};
