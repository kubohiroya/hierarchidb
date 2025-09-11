import { useCallback, useEffect, useRef, useState } from 'react';

/**
  * :
 * :
 * :
 * : React Hooks
  */

export interface MemoryData {
  used: number;
  total: number;
  percentage: number;
  breakdown?: MemoryBreakdown;
}

export interface MemoryBreakdown {
  JavaScript: number;
  DOM: number;
  Images: number;
  Styles: number;
  Other: number;
}

export interface UseMemoryDataOptions {
  updateInterval?: number;
  maxMemory?: number;
  enabled?: boolean;
}

export interface UseMemoryDataResult {
  memoryData: MemoryData;
  isSupported: boolean;
  isPaused: boolean;
  togglePause: () => void;
  clearData: () => void;
  error: string | null;
}

/**
  * :
 * :
 * :
 * : React Hooks
  */
export function useMemoryData({
                                updateInterval = 5000,
                                maxMemory = 4 * 1024 * 1024 * 1024, // 4GB
                                enabled = true,
                              }: UseMemoryDataOptions = {}): UseMemoryDataResult {
  //  :
  const [memoryData, setMemoryData] = useState<MemoryData>({
    used: 0,
    total: 0,
    percentage: 0,
  });
  const [isSupported, setIsSupported] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
      * :
   * :
   * : TypeScript
   * :
      */
  const categorizeMemory = useCallback(
    (breakdown?: Array<{ bytes?: number; types?: string[]; url?: string }>): MemoryBreakdown => {
      //  :
      const categories: MemoryBreakdown = {
        JavaScript: 0,
        DOM: 0,
        Images: 0,
        Styles: 0,
        Other: 0,
      };

      //  :
      if (!Array.isArray(breakdown)) return categories;

      //  : forEach
      breakdown.forEach((entry) => {
        const bytes = entry.bytes || 0;
        const types = entry.types || [];
        const url = entry.url || '';

        //  :
        if (types.includes('JavaScript')) {
          categories.JavaScript += bytes;
        } else if (types.includes('DOM')) {
          categories.DOM += bytes;
        } else if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
          //  :
          categories.Images += bytes;
        } else if (url.includes('.css') || types.includes('CSS')) {
          categories.Styles += bytes;
        } else {
          categories.Other += bytes;
        }
      });

      return categories;
    },
    [],
  );

  /**
      * :
   * :
   * : API
   * :
      */
  const collectMemoryData = useCallback(async () => {
    //  :
    if (isPaused || !enabled) return;

    try {
      //  :
      setError(null);

      //  API: measureUserAgentSpecificMemory
      if ('measureUserAgentSpecificMemory' in performance) {
        try {
          const result = await (performance as any).measureUserAgentSpecificMemory();
          const totalUsed = result.breakdown.reduce(
            (sum: number, entry: { bytes?: number }) => sum + (entry.bytes || 0),
            0,
          );

          let totalMemory = maxMemory;
          if ('memory' in performance) {
            const memory = (performance as any).memory;
            if (memory?.jsHeapSizeLimit) {
              totalMemory = memory.jsHeapSizeLimit;
            }
          }

          //  :
          const memoryInfo: MemoryData = {
            used: totalUsed,
            total: totalMemory,
            percentage: totalMemory > 0 ? (totalUsed / totalMemory) * 100 : 0,
            breakdown: categorizeMemory(result.breakdown),
          };

          setMemoryData(memoryInfo);
          return;
        } catch (advancedApiError) {
          //  : APIAPI
          console.warn('Advanced memory API failed, falling back to basic API:', advancedApiError);
        }
      }

      //  API: performance.memory API
      if ('memory' in performance && (performance as any).memory) {
        const memory = (performance as any).memory;
        const used = memory?.usedJSHeapSize || 0;
        const total = memory?.jsHeapSizeLimit || maxMemory;

        //  : API
        const memoryInfo: MemoryData = {
          used,
          total,
          percentage: total > 0 ? (used / total) * 100 : 0,
          breakdown: {
            JavaScript: used,
            DOM: 0,
            Images: 0,
            Styles: 0,
            Other: 0,
          },
        };

        setMemoryData(memoryInfo);
      } else {
        //  API:
        setIsSupported(false);
        setError('Memory monitoring APIs are not available in this browser');
      }
    } catch (error) {
      //  :
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Memory data collection failed: ${errorMessage}`);
      console.warn('Memory data collection error:', error);
    }
  }, [isPaused, enabled, maxMemory, categorizeMemory]);

  //  :
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const clearData = useCallback(() => {
    //  :
    setMemoryData({ used: 0, total: 0, percentage: 0 });
    setError(null);
  }, []);

  //  :
  useEffect(() => {
    //  :
    if (!enabled) return;

    //  :
    collectMemoryData();

    //  :
    const safeInterval = Math.max(updateInterval, 1000);
    intervalRef.current = setInterval(collectMemoryData, safeInterval);

    //  :
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [updateInterval, collectMemoryData, enabled]);

  //  :
  return {
    memoryData,
    isSupported,
    isPaused,
    togglePause,
    clearData,
    error,
  };
}
