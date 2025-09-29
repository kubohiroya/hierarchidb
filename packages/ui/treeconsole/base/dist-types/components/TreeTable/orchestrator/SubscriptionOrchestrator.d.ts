/**
  * SubscriptionOrchestrator
  * SubTree
 * - Worker
 * -
 * -
  */
import type { WorkerAPI } from '@hierarchidb/common-api';
/**
  * SubTree
  */
export interface SubscriptionOrchestratorResult {
    isSubscribed: boolean;
    subscribedRootNodeId: string | null;
    lastUpdateTimestamp: number;
    pendingUpdatesCount: number;
    subscribe: (rootNodeId: string, depth?: number) => Promise<void>;
    unsubscribe: () => Promise<void>;
    processPendingUpdates: () => void;
}
/**
  * SubTree
  */
export declare function useSubscriptionOrchestrator(workerAPI: WorkerAPI): SubscriptionOrchestratorResult;
//# sourceMappingURL=SubscriptionOrchestrator.d.ts.map