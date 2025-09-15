import { useEffect } from 'react';

export interface UseMultiStepPersistenceOptions {
  key?: string;
  enabled?: boolean;
  step: number;
  setStep: (next: number) => void;
}

/**
 * Persist and restore the active step for multi-step dialogs.
 * Minimal implementation using localStorage; guarded for SSR/unsupported envs.
 */
export function useMultiStepPersistence({ key, enabled = true, step, setStep }: UseMultiStepPersistenceOptions) {
  const storageKey = key || 'MultiStepDialog:activeStep';

  // Restore once on mount (uncontrolled only) — caller passes setStep for internal state
  useEffect(() => {
    if (!enabled) return;
    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
      const n = v != null ? Number(v) : NaN;
      if (!Number.isNaN(n) && n >= 0) setStep(n);
    } catch (err) {
      console.debug('[useMultiStepPersistence] restore failed', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change
  useEffect(() => {
    if (!enabled) return;
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, String(step));
    } catch (err) {
      console.debug('[useMultiStepPersistence] persist failed', err);
    }
  }, [enabled, step, storageKey]);
}
