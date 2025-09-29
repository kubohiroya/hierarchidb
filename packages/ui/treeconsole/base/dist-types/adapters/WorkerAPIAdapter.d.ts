/**
  * WorkerAPIAdapter
  * TreeConsole
 * WorkerAPITreeConsole
   */
import type { NodeId, TreeNodeEvent } from '@hierarchidb/common-type';
import { type WorkingCopyEditSession } from './commands/WorkingCopyCommands.js';
import { SubscriptionManager } from './subscriptions/SubscriptionManager.js';
import type { AdapterContext, UnsubscribeFunction, WorkerAPIAdapterConfig } from './types.js';
type TreeNodeEventCallback = (event: TreeNodeEvent) => void;
export declare class WorkerAPIAdapter {
    private workerAPI;
    private viewId;
    private defaultOnNameConflict;
    private mutationAdapter;
    private workingCopyAdapter;
    private subscriptionManager;
    constructor(config: WorkerAPIAdapterConfig);
    /**
              * @param overrides
     * @returns AdapterContext
        */
    private createDefaultContext;
    /**
              * @param contextOverrides
     * @returns CommandAdapterOptions
        */
    private createDefaultOptions;
    /**
        * subscribeSubTree
        */
    subscribeToSubtree(nodeId: NodeId, callback: TreeNodeEventCallback, contextOverrides?: Partial<AdapterContext>): Promise<UnsubscribeFunction>;
    /**
              */
    subscribeToNode(nodeId: NodeId, callback: TreeNodeEventCallback, contextOverrides?: Partial<AdapterContext>): Promise<UnsubscribeFunction>;
    /**
              */
    subscribeToChildren(parentId: NodeId, callback: TreeNodeEventCallback, contextOverrides?: Partial<AdapterContext>): Promise<UnsubscribeFunction>;
    /**
        * moveNodes
        */
    moveNodes(nodeIds: NodeId[], targetParentId: NodeId, contextOverrides?: Partial<AdapterContext>): Promise<void>;
    /**
              */
    deleteNodes(nodeIds: NodeId[], contextOverrides?: Partial<AdapterContext>): Promise<void>;
    /**
              */
    duplicateNodes(nodeIds: NodeId[], targetParentId: NodeId, contextOverrides?: Partial<AdapterContext>): Promise<void>;
    /**
              */
    pasteNodes(targetParentId: NodeId, contextOverrides?: Partial<AdapterContext>): Promise<void>;
    /**
              */
    removeNodes(nodeIds: NodeId[], contextOverrides?: Partial<AdapterContext>): Promise<void>;
    /**
              */
    restoreFromTrash(nodeIds: NodeId[], targetParentId?: NodeId, contextOverrides?: Partial<AdapterContext>): Promise<void>;
    /**
              */
    startNodeEdit(sourceNodeId: NodeId, contextOverrides?: Partial<AdapterContext>): Promise<WorkingCopyEditSession>;
    /**
              */
    startNodeCreate(parentId: NodeId, name: string, description?: string, nodeType?: string, contextOverrides?: Partial<AdapterContext>): Promise<WorkingCopyEditSession>;
    /**
        * Working Copy
        */
    commitNodeEdit(editSession: WorkingCopyEditSession, contextOverrides?: Partial<AdapterContext>): Promise<void>;
    /**
        * Working Copy
        */
    commitNodeCreate(editSession: WorkingCopyEditSession, contextOverrides?: Partial<AdapterContext>): Promise<void>;
    /**
        * Working Copy
        */
    discardWorkingCopy(editSession: WorkingCopyEditSession, contextOverrides?: Partial<AdapterContext>): Promise<void>;
    /**
           * unmount
        */
    cleanup(): void;
    /**
              */
    cleanupNodeSubscriptions(nodeId: NodeId): void;
    /**
              */
    getAdapterInfo(): {
        viewId: string;
        defaultOnNameConflict: (name: string) => string;
        subscriptionStats: ReturnType<SubscriptionManager['getSubscriptionStats']>;
    };
    /**
        * viewId
        */
    updateViewId(newViewId: string): void;
}
export {};
//# sourceMappingURL=WorkerAPIAdapter.d.ts.map