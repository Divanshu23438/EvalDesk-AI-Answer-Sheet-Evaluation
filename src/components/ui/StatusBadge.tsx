import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  Loader2,
  Lock,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { STRINGS } from '../../i18n/strings';
import type {
  ConfidenceLevel,
  KeyPointVerdict,
  PaperMode,
  PaperStatus,
  RequestStatus,
  ReviewFlagReason,
  SheetStatus,
} from '../../types/eval';

const SHEET_STYLES: Record<SheetStatus, { bg: string; text: string; border: string; Icon: typeof Clock }> = {
  uploaded: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', Icon: Clock },
  processing: { bg: 'bg-[#e5eeff]', text: 'text-[#004786]', border: 'border-[#a5c8ff]', Icon: Loader2 },
  ready_for_review: { bg: 'bg-[#fff8e1]', text: 'text-[#875200]', border: 'border-[#ffb865]', Icon: Eye },
  in_review: { bg: 'bg-[#d4e3ff]', text: 'text-[#004786]', border: 'border-[#a5c8ff]', Icon: Clock },
  evaluated: { bg: 'bg-[#e8f5e9]', text: 'text-[#196b22]', border: 'border-[#88d982]', Icon: FileCheck2 },
  published: { bg: 'bg-[#e8f5e9]', text: 'text-[#005312]', border: 'border-[#368539]', Icon: CheckCircle2 },
  reopened: { bg: 'bg-[#ffddba]', text: 'text-[#623a00]', border: 'border-[#f89c00]', Icon: RotateCcw },
  failed: { bg: 'bg-[#ffdad6]', text: 'text-[#93000a]', border: 'border-[#ba1a1a]', Icon: XCircle },
};

export function SheetStatusBadge({ status }: { status: SheetStatus }) {
  const cfg = SHEET_STYLES[status];
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <Icon className={`w-3 h-3 shrink-0 ${status === 'processing' ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span>{STRINGS.statuses.sheet[status]}</span>
    </span>
  );
}

const REQUEST_STYLES: Record<RequestStatus, { bg: string; text: string; border: string; Icon: typeof Clock }> = {
  requested: { bg: 'bg-[#fff8e1]', text: 'text-[#875200]', border: 'border-[#ffb865]', Icon: Clock },
  under_review: { bg: 'bg-[#d4e3ff]', text: 'text-[#004786]', border: 'border-[#a5c8ff]', Icon: Eye },
  approved: { bg: 'bg-[#e8f5e9]', text: 'text-[#196b22]', border: 'border-[#88d982]', Icon: CheckCircle2 },
  rejected: { bg: 'bg-[#ffdad6]', text: 'text-[#93000a]', border: 'border-[#ba1a1a]', Icon: XCircle },
  released: { bg: 'bg-[#e8f5e9]', text: 'text-[#005312]', border: 'border-[#368539]', Icon: FileCheck2 },
  expired: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', Icon: Lock },
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const cfg = REQUEST_STYLES[status];
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{STRINGS.statuses.request[status]}</span>
    </span>
  );
}

const PAPER_STYLES: Record<PaperStatus, { bg: string; text: string; border: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  ready: { bg: 'bg-[#fff8e1]', text: 'text-[#875200]', border: 'border-[#ffb865]' },
  open_for_evaluation: { bg: 'bg-[#d4e3ff]', text: 'text-[#004786]', border: 'border-[#a5c8ff]' },
  closed: { bg: 'bg-slate-200', text: 'text-slate-800', border: 'border-slate-400' },
  published: { bg: 'bg-[#e8f5e9]', text: 'text-[#196b22]', border: 'border-[#88d982]' },
};

export function PaperStatusBadge({ status }: { status: PaperStatus }) {
  const cfg = PAPER_STYLES[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {STRINGS.statuses.paper[status]}
    </span>
  );
}

export function ConfidenceBadge({
  level,
  score,
}: {
  level: ConfidenceLevel;
  score?: number;
}) {
  const styles: Record<ConfidenceLevel, { bg: string; text: string; border: string; Icon: typeof CheckCircle2 }> = {
    high: { bg: 'bg-[#e8f5e9]', text: 'text-[#196b22]', border: 'border-[#88d982]', Icon: CheckCircle2 },
    medium: { bg: 'bg-[#fff8e1]', text: 'text-[#875200]', border: 'border-[#ffb865]', Icon: AlertTriangle },
    low: { bg: 'bg-[#ffdad6]', text: 'text-[#93000a]', border: 'border-[#ba1a1a]', Icon: ShieldAlert },
  };
  const cfg = styles[level];
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap tabular-nums ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>
        {STRINGS.statuses.confidence[level]}
        {typeof score === 'number' ? ` (${score}%)` : ''}
      </span>
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: KeyPointVerdict }) {
  const map: Record<KeyPointVerdict, { cls: string; Icon: typeof CheckCircle2 }> = {
    found: { cls: 'bg-[#e8f5e9] text-[#196b22] border-[#88d982]', Icon: CheckCircle2 },
    partly: { cls: 'bg-[#fff8e1] text-[#875200] border-[#ffb865]', Icon: AlertTriangle },
    not_found: { cls: 'bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]', Icon: XCircle },
  };
  const cfg = map[verdict];
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap ${cfg.cls}`}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{STRINGS.statuses.verdict[verdict]}</span>
    </span>
  );
}

export function FlagReasonTag({ reason }: { reason: ReviewFlagReason }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#ffb865] bg-[#fff8e1] text-[#875200] text-[11px] font-medium whitespace-nowrap">
      <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{STRINGS.statuses.flagReason[reason]}</span>
    </span>
  );
}

export function ModeTag({ mode }: { mode: PaperMode }) {
  const label = mode === 'strict' ? 'Strict' : mode === 'lenient' ? 'Lenient' : 'Maths';
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded border border-[#c1c6d4] bg-[#eff4ff] text-[#004786] text-[11px] font-medium whitespace-nowrap">
      {label}
    </span>
  );
}
