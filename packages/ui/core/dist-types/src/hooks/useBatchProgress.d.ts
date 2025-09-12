export interface UnifiedProgressInfo {
    stage: string;
    total: number;
    completed: number;
    failed: number;
    percentage: number;
    currentTask: string;
}
export interface UseBatchProgressOptions {
    autoSubscribe?: boolean;
    poll?: () => Promise<UnifiedProgressInfo | null>;
}
export interface BatchProgressAdapter {
    subscribe: (cb: (p: UnifiedProgressInfo) => void) => (() => void) | Promise<() => void>;
}
export declare function useBatchProgress(adapter: BatchProgressAdapter | null, { autoSubscribe, poll }?: UseBatchProgressOptions): {
    readonly progress: UnifiedProgressInfo | null;
    readonly subscribed: boolean;
    readonly subscribe: () => void;
    readonly unsubscribe: () => void;
};
//# sourceMappingURL=useBatchProgress.d.ts.map