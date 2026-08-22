import { useEffect } from 'react';

/**
 * Basic a11y helpers: focus first focusable element on step change.
 */
export function useMultiStepA11y(rootRef: React.RefObject<HTMLElement>, stepIndex: number) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    try {
      const focusable = root.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus?.();
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.warn('[useMultiStepA11y] focus attempt failed', error);
      }
    }
  }, [rootRef, stepIndex]);
}
