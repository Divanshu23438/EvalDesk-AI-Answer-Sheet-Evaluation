import React from 'react';
import { Check, Flag, X, Circle, Dot } from 'lucide-react';

export type StatusType = 'approved' | 'flagged' | 'failed' | 'pending' | 'current';

interface StatusChipProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  size = 'md',
  className = '',
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'approved':
        return {
          bg: 'bg-[var(--status-approved-bg)]',
          border: 'border-[var(--status-approved-border)]',
          text: 'text-[var(--status-approved)]',
          icon: <Check className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />,
          defaultLabel: 'Approved',
        };
      case 'flagged':
        return {
          bg: 'bg-[var(--status-flagged-bg)]',
          border: 'border-[var(--status-flagged-border)]',
          text: 'text-[var(--status-flagged)]',
          icon: <Flag className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />,
          defaultLabel: 'Flagged',
        };
      case 'failed':
        return {
          bg: 'bg-[var(--status-failed-bg)]',
          border: 'border-[var(--status-failed-border)]',
          text: 'text-[var(--status-failed)]',
          icon: <X className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />,
          defaultLabel: 'Failed',
        };
      case 'current':
        return {
          bg: 'bg-[var(--brand-tint)]',
          border: 'border-[var(--surface-card-border)]',
          text: 'text-[var(--brand-primary)]',
          icon: <Dot className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} aria-hidden="true" />,
          defaultLabel: 'Current',
        };
      case 'pending':
      default:
        return {
          bg: 'bg-[var(--status-pending-bg)]',
          border: 'border-[var(--status-pending-border)]',
          text: 'text-[var(--status-pending)]',
          icon: <Circle className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} aria-hidden="true" />,
          defaultLabel: 'Pending',
        };
    }
  };

  const config = getStatusConfig();
  const displayLabel = label || config.defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-medium tabular-nums ${
        size === 'sm' ? 'text-[11px] leading-tight' : 'text-xs leading-normal'
      } ${config.bg} ${config.border} ${config.text} ${className}`}
    >
      {config.icon}
      <span>{displayLabel}</span>
      <span className="sr-only">({config.defaultLabel})</span>
    </span>
  );
};
