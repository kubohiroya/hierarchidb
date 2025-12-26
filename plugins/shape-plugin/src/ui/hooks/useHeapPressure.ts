import { useEffect, useState } from 'react';
import { BUILD_MONITOR_SAMPLE_INTERVAL_MS, getHeapPressureSnapshot, type HeapPressureSnapshot } from '../utils/buildMonitor.js';

export const useHeapPressure = (enabled: boolean = true): HeapPressureSnapshot | null => {
  const [snapshot, setSnapshot] = useState<HeapPressureSnapshot | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null);
      return;
    }
    const readSnapshot = () => {
      setSnapshot(getHeapPressureSnapshot());
    };
    readSnapshot();
    const interval = window.setInterval(readSnapshot, BUILD_MONITOR_SAMPLE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [enabled]);

  return snapshot;
};
