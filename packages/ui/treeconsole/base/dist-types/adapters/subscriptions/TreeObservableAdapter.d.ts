/**
  * TreeObservableAdapter
  * ObservableWorkerAPI
 * TreeConsoleAPI
  */
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeNodeEvent } from '@hierarchidb/common-type';
import type { AdapterContext, UnsubscribeFunction } from '../../types/index.js';
type TreeNodeEventCallback = (event: TreeNodeEvent) => void;
export declare class TreeObservableAdapter {
    private workerAPI;
    private subscriptions;
    private proxiedCallbacks;
    constructor(workerAPI: WorkerAPI);
    /**
        * subscribeSubTree
        * @param nodeId ID
     * @param expandedChangesCallback
     * @param subtreeChangesCallback
     * @param context
     * @returns
        */
    subscribeToSubtree(nodeId: NodeId, callback: TreeNodeEventCallback, context: AdapterContext): Promise<UnsubscribeFunction>;
    /**
              * @param nodeId ID
     * @param callback
     * @param context
     * @returns
        */
    subscribeToNode(nodeId: NodeId, callback: TreeNodeEventCallback, context: AdapterContext): Promise<UnsubscribeFunction>;
    /**
              * @param parentId ID
     * @param callback
     * @param context
     * @returns
        */
    subscribeToChildren(parentId: NodeId, callback: TreeNodeEventCallback, context: AdapterContext): Promise<UnsubscribeFunction>;
    /**
              */
    cleanupAllSubscriptions(): void;
    /**
              */
    getActiveSubscriptionCount(): number;
}
export {};
//# sourceMappingURL=TreeObservableAdapter.d.ts.map