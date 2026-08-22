import { useCallback, useEffect, useRef, useState } from 'react';
import { isDevEnv } from '~/utils/env';

export interface MemoryUsageChartDataPoint {
  timestamp: number;
  percentage: number;
  used: number;
  total: number;
}

export interface UseMemoryUsageChartDataParams {
  maxMemory: number;
  maxDataPoints: number;
  updateInterval: number;
}

export interface UseMemoryUsageChartDataResult {
  dataPoints: MemoryUsageChartDataPoint[];
  currentMemory: { used: number; total: number; percentage: number };
  isSupported: boolean;
}

export function useMemoryUsageChartData({
  maxMemory,
  maxDataPoints,
  updateInterval,
}: UseMemoryUsageChartDataParams): UseMemoryUsageChartDataResult {
  const [dataPoints, setDataPoints] = useState<MemoryUsageChartDataPoint[]>([]);
  const [currentMemory, setCurrentMemory] = useState({ used: 0, total: maxMemory, percentage: 0 });
  const [isSupported, setIsSupported] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateMemoryInfo = useCallback(async () => {
    try {
      let used = 0;
      let total = maxMemory;

      if ('measureUserAgentSpecificMemory' in performance) {
        const result = await (
          performance as {
            measureUserAgentSpecificMemory: () => Promise<{ breakdown: Array<{ bytes?: number }> }>;
          }
        ).measureUserAgentSpecificMemory();
        used = result.breakdown.reduce((sum, entry) => sum + (entry.bytes || 0), 0);

        if ('memory' in performance) {
          const memory = (performance as { memory: { jsHeapSizeLimit?: number } }).memory;
          if (memory.jsHeapSizeLimit) {
            total = memory.jsHeapSizeLimit;
          }
        }
      } else if ('memory' in performance) {
        const memory = (
          performance as { memory: { jsHeapSizeLimit?: number; usedJSHeapSize?: number } }
        ).memory;
        used = memory.usedJSHeapSize || 0;
        total = memory.jsHeapSizeLimit || maxMemory;
      } else {
        setIsSupported(false);
        return;
      }

      const percentage = total > 0 ? (used / total) * 100 : 0;
      const timestamp = Date.now();
      setCurrentMemory({ used, total, percentage });
      setDataPoints((prev) => {
        const next = [...prev, { timestamp, percentage, used, total }];
        return next.length > maxDataPoints ? next.slice(-maxDataPoints) : next;
      });
    } catch (error) {
      if (isDevEnv()) {
        console.warn('Memory measurement failed:', String(error));
      }
    }
  }, [maxDataPoints, maxMemory]);

  useEffect(() => {
    void updateMemoryInfo();
    const safeInterval = Math.max(updateInterval, 10000);
    intervalRef.current = setInterval(() => {
      void updateMemoryInfo();
    }, safeInterval);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [updateInterval, updateMemoryInfo]);

  return {
    dataPoints,
    currentMemory,
    isSupported,
  };
}
