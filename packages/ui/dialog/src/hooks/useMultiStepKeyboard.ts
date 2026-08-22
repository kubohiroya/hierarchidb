import { useCallback, useEffect } from 'react';

export interface UseMultiStepKeyboardOptions {
  enabled?: boolean;
  onNext?: () => void | Promise<void>;
  onBack?: () => void | Promise<void>;
  onSubmit?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}

/**
 * Keyboard shortcuts for multi-step console.
 * Enter: next/submit, Esc: cancel, ArrowLeft/Right: back/next.
 */
export function useMultiStepKeyboard({
  enabled = true,
  onNext,
  onBack,
  onSubmit,
  onCancel,
}: UseMultiStepKeyboardOptions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.defaultPrevented) return;
      // Ignore when inside input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      switch (e.key) {
        case 'Escape':
          onCancel?.();
          break;
        case 'Enter':
          onSubmit?.() ?? onNext?.();
          break;
        case 'ArrowRight':
          onNext?.();
          break;
        case 'ArrowLeft':
          onBack?.();
          break;
        default:
          return;
      }
      e.preventDefault();
    },
    [enabled, onNext, onBack, onSubmit, onCancel]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, handler]);
}
