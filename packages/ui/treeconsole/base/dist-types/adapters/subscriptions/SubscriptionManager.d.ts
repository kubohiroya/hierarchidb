/**
  * SubscriptionManager
  * TreeConsole
   */
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNodeEvent } from '@hierarchidb/common-type';
import type { AdapterContext } from '../../types/index.js';
type TreeNodeEventCallback = (event: TreeNodeEvent) => void;
export declare class SubscriptionManager {
    private adapter;
    private subscriptions;
    constructor(workerAPI: WorkerAPI, _viewId: string);
    /**
              * @param nodeId ID
     * @param expandedChangesCallback
     * @param subtreeChangesCallback
     * @param context
     * @returns ID
        */
    subscribeToSubtree(nodeId: NodeId, callback: TreeNodeEventCallback, context: AdapterContext): Promise<string>;
    /**
              * @param nodeId ID
     * @param callback
     * @param context
     * @returns ID
        */
    subscribeToNode(nodeId: NodeId, callback: TreeNodeEventCallback, context: AdapterContext): Promise<string>;
    /**
              * @param parentId ID
     * @param callback
     * @param context
     * @returns ID
        */
    subscribeToChildren(parentId: NodeId, callback: TreeNodeEventCallback, context: AdapterContext): Promise<string>;
    /**
              * @param subscriptionId ID
        */
    unsubscribe(subscriptionId: string): void;
    /**
              * @param nodeId ID
        */
    unsubscribeByNodeId(nodeId: NodeId): void;
    /**
              * @param type
        */
    unsubscribeByType(type: 'subtree' | 'node' | 'children'): void;
    /**
              */
    cleanupAll(): void;
    /**
              * @param maxAgeMs 1
        */
    cleanupOldSubscriptions(maxAgeMs?: number): void;
    /**
              */
    getSubscriptionStats(): {
        total: number;
        byType: Record<string, number>;
        byNodeId: Record<string, number>;
        oldestSubscription?: {
            id: string;
            ageMs: number;
        };
    };
}
export {};
//# sourceMappingURL=SubscriptionManager.d.ts.map