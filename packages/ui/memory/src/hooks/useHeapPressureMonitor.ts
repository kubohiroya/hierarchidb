import {
  createHeapPressureMonitor,
  type HeapPressureEvent,
  type HeapPressureMonitorOptions,
} from '@hierarchidb/memory';
import { useEffect, useMemo, useState } from 'react';

export type UseHeapPressureMonitorOptions = {
  enabled?: boolean;
} & HeapPressureMonitorOptions;

export type UseHeapPressureMonitorResult = {
  event: HeapPressureEvent | null;
  isSupported: boolean;
};

export const useHeapPressureMonitor = (
  options: UseHeapPressureMonitorOptions = {}
): UseHeapPressureMonitorResult => {
  const { enabled = true, source = 'ui', intervalMs, warningRatio, criticalRatio } = options;
  const monitor = useMemo(
    () => createHeapPressureMonitor({ source, intervalMs, warningRatio, criticalRatio }),
    [criticalRatio, intervalMs, source, warningRatio]
  );
  const [event, setEvent] = useState<HeapPressureEvent | null>(monitor.getSnapshot());
  const [isSupported, setIsSupported] = useState(monitor.isSupported());

  useEffect(() => {
    if (!enabled) {
      return;
    }
    setIsSupported(monitor.isSupported());
    monitor.start();
    const unsubscribe = monitor.subscribe((next) => {
      setEvent(next);
    });
    return () => {
      unsubscribe();
      monitor.stop();
    };
  }, [enabled, monitor]);

  return { event, isSupported };
};
