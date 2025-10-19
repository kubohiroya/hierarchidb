import type { Remote } from 'comlink';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { BatchProgressEvent, BatchSessionId, BatchSessionStatus } from '@hierarchidb/batch-types';
export interface WorkerBridge {
    initialize(): Promise<void>;
    startBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
    getBatchSessionStatus(nodeType: NodeType, sessionId: BatchSessionId): Promise<BatchSessionStatus>;
    pauseBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
    resumeBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
    cancelBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
    subscribeBatchProgress(nodeType: NodeType, sessionId: BatchSessionId, cb: (event: BatchProgressEvent) => void): Promise<() => void>;
}
interface WorkerClientRefLike {
    client: Remote<WorkerAPI> | null;
    isInitialized: boolean;
    initialize: () => Promise<void>;
    getAPI: () => Remote<WorkerAPI>;
}
export declare function getWorkerBridge(): WorkerBridge;
export declare function __setWorkerBridgeClientRef(ref: WorkerClientRefLike | null): void;
export {};
//# sourceMappingURL=WorkerBridge.d.ts.map
