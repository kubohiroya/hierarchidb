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
export declare function useMemoryData({ updateInterval, maxMemory, // 4GB
enabled, }?: UseMemoryDataOptions): UseMemoryDataResult;
//# sourceMappingURL=useMemoryData.d.ts.map