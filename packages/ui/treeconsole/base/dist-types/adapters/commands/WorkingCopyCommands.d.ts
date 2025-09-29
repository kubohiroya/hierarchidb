/**
  * WorkingCopyCommands Adapter
  * TreeConsoleWorking CopyWorkerAPICommandEnvelope
 * Working Copy
  */
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, Timestamp, TreeNode } from '@hierarchidb/common-type';
import type { CommandAdapterOptions } from '../../types/index.js';
export interface WorkingCopyEditSession {
    workingCopyId: string;
    sourceId?: NodeId;
    parentId?: NodeId;
    isCreate: boolean;
    expectedUpdatedAt?: Timestamp;
}
export declare class WorkingCopyCommandsAdapter {
    private workerAPI;
    constructor(workerAPI: WorkerAPI);
    /**
        * Working Copy
        * @param sourceNodeId ID
     * @param options
     * @returns
        */
    startNodeEdit(sourceNodeId: NodeId, _options: CommandAdapterOptions): Promise<WorkingCopyEditSession>;
    /**
        * Working Copy
        * @param parentId ID
     * @param name
     * @param description
     * @param options
     * @returns
        */
    startNodeCreate(parentId: NodeId, name: string, _description: string | undefined, nodeType: string, _options: CommandAdapterOptions): Promise<WorkingCopyEditSession>;
    /**
        * Working Copy
        * @param editSession
     * @param options
     * @returns Promise<void>
        */
    commitNodeEdit(editSession: WorkingCopyEditSession, options: CommandAdapterOptions): Promise<void>;
    /**
        * Working Copy
        * @param editSession
     * @param options
     * @returns Promise<void>
        */
    commitNodeCreate(editSession: WorkingCopyEditSession, options: CommandAdapterOptions): Promise<void>;
    /**
        * Working Copy
        * @param editSession
     * @param options
     * @returns Promise<void>
        */
    discardWorkingCopy(editSession: WorkingCopyEditSession, options: CommandAdapterOptions): Promise<void>;
    /**
        * Working CopyexpectedUpdatedAt
        * TODO: API
     * TreeQueryService
        */
    getCurrentNodeData(nodeId: NodeId): Promise<TreeNode | undefined>;
}
//# sourceMappingURL=WorkingCopyCommands.d.ts.map