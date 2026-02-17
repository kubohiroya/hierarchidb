import type { HeapPressureEvent } from '@hierarchidb/memory';
import type { BuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useCallback, useMemo, useState } from 'react';
import { useHeapPressureMonitor } from './useHeapPressureMonitor.js';
import { useWorkerHeapPressure } from './useWorkerHeapPressure.js';

export type UseHeapPressureGuardOptions = {
  enabled?: boolean;
  uiEnabled?: boolean;
  workerEnabled?: boolean;
  workerBridge?: BuildWorkerBridge | null;
};

export type UseHeapPressureGuardResult = {
  event: HeapPressureEvent | null;
  isSupported: boolean;
  dismiss: () => void;
};

const pickLatestEvent = (
  uiEvent: HeapPressureEvent | null,
  workerEvent: HeapPressureEvent | null
): HeapPressureEvent | null => {
  if (uiEvent && workerEvent) {
    return uiEvent.timestamp >= workerEvent.timestamp ? uiEvent : workerEvent;
  }
  return uiEvent ?? workerEvent ?? null;
};

export const useHeapPressureGuard = (
  options: UseHeapPressureGuardOptions = {}
): UseHeapPressureGuardResult => {
  const { enabled = true, uiEnabled = true, workerEnabled = true, workerBridge } = options;
  const { event: uiEvent, isSupported } = useHeapPressureMonitor({
    enabled: enabled && uiEnabled,
    source: 'ui',
  });
  const workerEvent = useWorkerHeapPressure({ enabled: enabled && workerEnabled, workerBridge });
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const latestEvent = useMemo(() => pickLatestEvent(uiEvent, workerEvent), [uiEvent, workerEvent]);

  const event = useMemo(() => {
    if (!latestEvent) return null;
    if (dismissedAt && latestEvent.timestamp <= dismissedAt) return null;
    return latestEvent;
  }, [dismissedAt, latestEvent]);

  const dismiss = useCallback(() => {
    if (latestEvent) {
      setDismissedAt(latestEvent.timestamp);
    }
  }, [latestEvent]);

  return {
    event,
    isSupported,
    dismiss,
  };
};
