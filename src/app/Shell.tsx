import React, { useEffect, useState } from 'react';
import { useSheetStore, AppStep } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import { ErrorBanner } from '../components/ErrorBanner';
import { ActionBar } from '../components/ActionBar';
import { UploadScreen } from '../screens/UploadScreen';
import { ProcessingScreen } from '../screens/ProcessingScreen';
import { EvaluateScreen } from '../screens/EvaluateScreen';
import { ReportScreen } from '../screens/ReportScreen';
import {
  FileText,
  Upload,
  Cpu,
  CheckCircle,
  BarChart,
  Settings,
  Activity,
  ArrowRight,
  RotateCcw,
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

  // 3. Stepper Items definition
  const stepperSteps: { id: AppStep; label: string; icon: React.ReactNode }[] = [
    { id: 'upload', label: 'Upload', icon: <Upload className="w-3.5 h-3.5" /> },
    { id: 'processing', label: 'Processing', icon: <Cpu className="w-3.5 h-3.5" /> },
    { id: 'evaluate', label: 'Evaluate', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { id: 'report', label: 'Report', icon: <BarChart className="w-3.5 h-3.5" /> },
  ];

  const handleStepClick = (step: AppStep) => {
    store.setStep(step);
  };

  return (
    <div className="app">
      {/* 48px Top Bar */}
      <header
        role="banner"
        className="h-[48px] bg-[var(--surface-card)] border-b border-[var(--surface-border)] px-4 flex items-center justify-between select-none z-30 shrink-0"
      >
        {/* Brand & Paper Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-7 h-7 rounded-md bg-[var(--accent-indigo)] text-white font-bold flex items-center justify-center text-xs shadow-sm">
              ED
            </span>
            <span className="font-semibold text-sm tracking-tight text-[var(--ink-primary)]">
              EvalDesk
            </span>
          </div>

          <div className="h-4 w-[1px] bg-[var(--surface-border)] shrink-0" />

          <div className="min-w-0 flex items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
            <FileText className="w-3.5 h-3.5 text-[var(--ink-muted)] shrink-0" />
            <span className="truncate font-medium">
              {state.paperTitle || 'Untitled Assessment'}
            </span>
            {state.paperTotalMarks > 0 && (
              <span className="text-[11px] text-[var(--ink-muted)] tabular-nums shrink-0">
                ({state.paperTotalMarks} Marks)
              </span>
            )}
          </div>
        </div>

        {/* Stepper Navigation */}
        <nav aria-label="Workflow Stepper" className="hidden md:flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleStepClick('setup')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
              state.step === 'setup'
                ? 'bg-[var(--accent-indigo-subtle)] text-[var(--accent-indigo)] font-semibold'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Settings className="w-3 h-3" />
            Setup
          </button>

          <span className="text-[var(--ink-faint)] text-xs font-light">·</span>

          {stepperSteps.map((step, idx) => {
            const isActive = state.step === step.id;
            return (
              <React.Fragment key={step.id}>
                {idx > 0 && (
                  <span className="text-[var(--ink-faint)] text-xs font-light px-0.5">›</span>
                )}
                <button
                  type="button"
                  onClick={() => handleStepClick(step.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[var(--accent-indigo)] text-white font-semibold shadow-xs'
                      : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {step.icon}
                  {step.label}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* AI Provider & Quota Chip */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[var(--surface-border)] bg-[var(--surface-subtle)] text-[11px] font-medium text-[var(--ink-secondary)]"
            title="Live AI Provider & Quota Status"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                providerStatus === 'online'
                  ? 'bg-[var(--status-approved)]'
                  : providerStatus === 'degraded'
                  ? 'bg-[var(--status-flagged)]'
                  : 'bg-[var(--status-failed)]'
              }`}
            />
            <Activity className="w-3 h-3 text-[var(--ink-muted)]" />
            <span>{providerLabel}</span>
          </div>
        </div>
      </header>

      {/* Sliding Error Banner (Overlay) */}
      <ErrorBanner
        error={state.error}
        onDismiss={() => store.clearError()}
      />

      {/* Main 1fr Screen Area */}
      <main className="min-h-0 overflow-hidden relative bg-[var(--surface-bg)]">
        {state.step === 'upload' && <UploadScreen />}
        {state.step === 'processing' && <ProcessingScreen />}
        {state.step === 'evaluate' && <EvaluateScreen />}
        {state.step === 'report' && <ReportScreen />}
        {state.step === 'setup' && (
          <div className="panel h-full p-4">
            <div className="max-w-4xl mx-auto bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--surface-border)] mb-4">
                <div>
                  <h2 className="text-base font-semibold text-[var(--ink-primary)]">
                    Assessment Setup
                  </h2>
                  <p className="text-xs text-[var(--ink-muted)]">
                    Configure question papers, section attempt limits, and rubric references.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => store.setStep('upload')}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent-indigo)] text-white hover:bg-[var(--accent-indigo-hover)] transition flex items-center gap-1.5"
                >
                  Proceed to Upload <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                Paper configuration loaded from server. When ready, proceed to Upload to drop student sheets.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* 56px Bottom Action Bar */}
      <ActionBar
        leftContent={
          <div className="flex items-center gap-2 text-xs text-[var(--ink-secondary)]">
            <span className="font-semibold text-[var(--ink-primary)]">Paper:</span>
            {state.paperIsLocked ? (
              <span className="text-[var(--status-approved)] font-medium inline-flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Locked ✓
              </span>
            ) : (
              <span className="text-[var(--status-flagged)] font-medium inline-flex items-center gap-1">
                Unlocked (Ready)
              </span>
            )}
            <span className="text-[var(--ink-muted)]">·</span>
            <span className="tabular-nums">
              {state.paperQuestionCount > 0 ? `${state.paperQuestionCount} questions` : 'No questions'}
            </span>
          </div>
        }
        centerContent={
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-[var(--ink-muted)]">
            <span>Shortcuts:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] border border-[var(--surface-border)] font-mono text-[10px]">
              A
            </kbd>{' '}
            Approve
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] border border-[var(--surface-border)] font-mono text-[10px]">
              F
            </kbd>{' '}
            Next Flag
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] border border-[var(--surface-border)] font-mono text-[10px]">
              ← / →
            </kbd>{' '}
            Navigate
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] border border-[var(--surface-border)] font-mono text-[10px]">
              [
            </kbd>{' '}
            Toggle Sidebar
          </div>
        }
        rightContent={
          state.step === 'upload' ? (
            <button
              type="button"
              onClick={() => store.setStep('processing')}
              className="px-4 py-1.5 rounded-md bg-[var(--accent-indigo)] text-white text-xs font-semibold hover:bg-[var(--accent-indigo-hover)] transition flex items-center gap-1.5 shadow-sm"
            >
              Start Evaluation <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : state.step === 'processing' ? (
            <button
              type="button"
              onClick={() => store.setStep('evaluate')}
              className="px-4 py-1.5 rounded-md bg-[var(--accent-indigo)] text-white text-xs font-semibold hover:bg-[var(--accent-indigo-hover)] transition flex items-center gap-1.5 shadow-sm"
            >
              Open Evaluation Workspace <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : state.step === 'evaluate' ? (
            <button
              type="button"
              onClick={() => store.setStep('report')}
              className="px-4 py-1.5 rounded-md bg-[var(--status-approved)] text-white text-xs font-semibold hover:opacity-90 transition flex items-center gap-1.5 shadow-sm"
            >
              Evaluated → Report <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => store.setStep('upload')}
              className="px-4 py-1.5 rounded-md bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] text-[var(--ink-primary)] text-xs font-semibold transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Next Sheet
            </button>
          )
        }
      />
    </div>
  );
};
