import type { HeapPressureEvent } from '@hierarchidb/memory';
import type { BuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useEffect, useState } from 'react';

export type UseWorkerHeapPressureOptions = {
  enabled?: boolean;
  workerBridge?: BuildWorkerBridge | null;
};

export const useWorkerHeapPressure = (
  options: UseWorkerHeapPressureOptions = {}
): HeapPressureEvent | null => {
  const { enabled = true, workerBridge } = options;
  const [event, setEvent] = useState<HeapPressureEvent | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const bridge = workerBridge ?? getBuildWorkerBridge();
    let unsubscribe: (() => void) | null = null;
    let isActive = true;

    const connect = async () => {
      try {
        await bridge.initialize();
        const stop = await bridge.subscribeHeapPressure((next) => {
          if (!isActive) return;
          setEvent(next);
        });
        unsubscribe = stop;
      } catch (error) {
        console.warn('[useWorkerHeapPressure] failed to subscribe', error);
      }
    };

    void connect();

    return () => {
      isActive = false;
      try {
        unsubscribe?.();
      } catch (error) {
        console.warn('[useWorkerHeapPressure] unsubscribe failed', error);
      }
    };
  }, [enabled, workerBridge]);

  return event;
};
