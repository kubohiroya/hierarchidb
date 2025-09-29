/**
  * TreeMutationCommands Adapter
  * TreeConsoleCRUDWorkerAPICommandEnvelope
   */
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId } from '@hierarchidb/common-type';
import type { CommandAdapterOptions } from '../../types/index.js';
export declare class TreeMutationCommandsAdapter {
    private workerAPI;
    constructor(workerAPI: WorkerAPI);
    /**
        * moveNodes
        * @param nodeIds ID
     * @param targetParentId ID
     * @param options
     * @returns Promise<void>
        */
    moveNodes(nodeIds: NodeId[], targetParentId: NodeId, options: CommandAdapterOptions): Promise<void>;
    /**
              * @param nodeIds ID
     * @param options
     * @returns Promise<void>
        */
    deleteNodes(nodeIds: NodeId[], options: CommandAdapterOptions): Promise<void>;
    /**
              * @param nodeIds ID
     * @param targetParentId ID
     * @param options
     * @returns Promise<void>
        */
    duplicateNodes(nodeIds: NodeId[], targetParentId: NodeId, options: CommandAdapterOptions): Promise<void>;
    /**
              * @param targetParentId ID
     * @param options
     * @returns Promise<void>
        */
    pasteNodes(targetParentId: NodeId, _options: CommandAdapterOptions): Promise<void>;
    /**
              * @param nodeIds ID
     * @param options
     * @returns Promise<void>
        */
    removeNodes(nodeIds: NodeId[], options: CommandAdapterOptions): Promise<void>;
    /**
              * @param nodeIds ID
     * @param targetParentId ID
     * @param options
     * @returns Promise<void>
        */
    restoreFromTrash(nodeIds: NodeId[], targetParentId: NodeId | undefined, options: CommandAdapterOptions): Promise<void>;
}
//# sourceMappingURL=TreeMutationCommands.d.ts.map