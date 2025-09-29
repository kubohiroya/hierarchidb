import type { NodeId } from '@hierarchidb/common-type';
import type { BatchProgressPayload, BatchSessionId } from '@hierarchidb/runtime-shared-batch-processor';
export interface UnifiedProgressInfo {
    stage: string;
    total: number;
    completed: number;
    failed: number;
    percentage: number;
    currentTask: string;
    phase?: string;
    timestamp?: number;
    payload?: BatchProgressPayload;
    message?: string;
    nodeId?: NodeId;
    sessionId?: BatchSessionId;
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