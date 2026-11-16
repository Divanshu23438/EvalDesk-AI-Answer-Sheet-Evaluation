import { useEffect } from 'react';

export interface HotkeyHandlers {
  onNext?: () => void;
  onPrev?: () => void;
  onApprove?: () => void;
  onNextFlag?: () => void;
  onMarksStep?: (delta: number) => void;
  onRecheck?: () => void;
  onEditOcr?: () => void;
  onToggleSidebar?: () => void;
  onHelp?: () => void;
}

export function useHotkeys(handlers: HotkeyHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut keys if user is typing in any form input or editable field
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Check key combinations
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handlers.onNext?.();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlers.onPrev?.();
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handlers.onApprove?.();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handlers.onNextFlag?.();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handlers.onMarksStep?.(0.5);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handlers.onMarksStep?.(-0.5);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handlers.onRecheck?.();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        handlers.onEditOcr?.();
      } else if (e.key === '[') {
        e.preventDefault();
        handlers.onToggleSidebar?.();
      } else if (e.key === '?') {
        e.preventDefault();
        handlers.onHelp?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlers, enabled]);
}
