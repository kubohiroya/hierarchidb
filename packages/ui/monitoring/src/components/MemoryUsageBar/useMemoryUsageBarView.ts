import { useCallback, useEffect, useRef, useState } from 'react';
import { isDevEnv } from '~/utils/env';

interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
  breakdown?: Array<{
    url?: string;
    bytes?: number;
    types?: string[];
  }>;
}

type MemorySeverity = 'normal' | 'warning' | 'critical';

export interface UseMemoryUsageBarViewParams {
  maxMemory: number;
  updateInterval: number;
  warningThreshold: number;
  criticalThreshold: number;
}

export interface UseMemoryUsageBarViewResult {
  memoryInfo: MemoryInfo;
  isSupported: boolean;
  severity: MemorySeverity;
  valueColor: 'error.main' | 'warning.main' | 'text.secondary';
  percentageTextColorCompact: 'white' | 'text.primary';
  percentageTextColorInline: 'white' | 'text.primary';
}

export function useMemoryUsageBarView({
  maxMemory,
  updateInterval,
  warningThreshold,
  criticalThreshold,
}: UseMemoryUsageBarViewParams): UseMemoryUsageBarViewResult {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo>({
    used: 0,
    total: maxMemory,
    percentage: 0,
  });
  const [isSupported, setIsSupported] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateMemoryInfo = useCallback(async () => {
    try {
      if ('measureUserAgentSpecificMemory' in performance) {
        const result = await (
          performance as {
            measureUserAgentSpecificMemory: () => Promise<{ breakdown: Array<{ bytes?: number }> }>;
          }
        ).measureUserAgentSpecificMemory();

        const totalUsed = result.breakdown.reduce(
          (sum: number, entry: { bytes?: number }) => sum + (entry.bytes || 0),
          0
        );

        let totalMemory = maxMemory;
        if ('memory' in performance) {
          const memory = (performance as { memory: { jsHeapSizeLimit?: number } }).memory;
          if (memory.jsHeapSizeLimit) {
            totalMemory = memory.jsHeapSizeLimit;
          }
        }

        const percentage = totalMemory > 0 ? (totalUsed / totalMemory) * 100 : 0;
        setMemoryInfo({
          used: totalUsed,
          total: totalMemory,
          percentage: Math.min(percentage, 100),
          breakdown: result.breakdown,
        });
        return;
      }

      if ('memory' in performance) {
        const memory = (performance as { memory: { usedJSHeapSize: number; jsHeapSizeLimit?: number } }).memory;
        const used = memory.usedJSHeapSize;
        const total = memory.jsHeapSizeLimit || maxMemory;
        const percentage = total > 0 ? (used / total) * 100 : 0;
        setMemoryInfo({
          used,
          total,
          percentage: Math.min(percentage, 100),
        });
        return;
      }

      setIsSupported(false);
    } catch (error) {
      if (isDevEnv()) {
        console.warn('Memory measurement failed:', String(error));
      }
      if ('memory' in performance) {
        const memory = (performance as { memory: { usedJSHeapSize: number; jsHeapSizeLimit?: number } }).memory;
        const used = memory.usedJSHeapSize;
        const total = memory.jsHeapSizeLimit || maxMemory;
        const percentage = total > 0 ? (used / total) * 100 : 0;
        setMemoryInfo({
          used,
          total,
          percentage: Math.min(percentage, 100),
        });
      }
    }
  }, [maxMemory]);

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

  const ratio = memoryInfo.percentage / 100;
  const severity: MemorySeverity =
    ratio >= criticalThreshold ? 'critical' : ratio >= warningThreshold ? 'warning' : 'normal';

  return {
    memoryInfo,
    isSupported,
    severity,
    valueColor: severity === 'critical' ? 'error.main' : severity === 'warning' ? 'warning.main' : 'text.secondary',
    percentageTextColorCompact: memoryInfo.percentage > 50 ? 'white' : 'text.primary',
    percentageTextColorInline: memoryInfo.percentage > 70 ? 'white' : 'text.primary',
  };
}
