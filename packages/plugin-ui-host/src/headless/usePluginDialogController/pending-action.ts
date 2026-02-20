import { useCallback, useEffect, useRef, useState } from 'react';
import type { DialogActionInFlight } from '~/headless/types';

export function usePendingAction(open: boolean) {
  const [pendingAction, setPendingAction] = useState<DialogActionInFlight | null>(null);
  const pendingActionRef = useRef<DialogActionInFlight | null>(null);

  const updatePendingAction = useCallback((next: DialogActionInFlight | null) => {
    pendingActionRef.current = next;
    setPendingAction(next);
  }, []);

  useEffect(() => {
    if (!open) {
      updatePendingAction(null);
    }
  }, [open, updatePendingAction]);

  const runWithPending = useCallback(
    async (action: DialogActionInFlight, task: () => Promise<void> | void) => {
      if (pendingActionRef.current) return;
      updatePendingAction(action);
      try {
        await Promise.resolve(task());
      } finally {
        updatePendingAction(null);
      }
    },
    [updatePendingAction]
  );

  return {
    pendingAction,
    pendingActionRef,
    updatePendingAction,
    runWithPending,
  };
}
