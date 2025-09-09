/**
  * WorkingCopyCommands Adapter
  * TreeConsoleWorking CopyWorkerAPICommandEnvelope
 * Working Copy
  */

import type { WorkerAPI } from '@hierarchidb/common-api';
import type {
  CommitWorkingCopyForCreatePayload,
  CommitWorkingCopyPayload,
  DiscardWorkingCopyPayload,
  NodeId,
  Timestamp,
  TreeNode,
} from '@hierarchidb/common-type';
import { toNodeType } from '@hierarchidb/common-type';
import { createAdapterCommandId, createCommand } from '../utils';
import type { CommandAdapterOptions } from '../../types/index';
import { TreeConsoleAdapterError } from '../../types/index';

export interface WorkingCopyEditSession {
  workingCopyId: string;
  sourceId?: NodeId;
  parentId?: NodeId;
  isCreate: boolean;
  expectedUpdatedAt?: Timestamp;
}

export class WorkingCopyCommandsAdapter {
  constructor(private workerAPI: WorkerAPI) {
  }

  /**
      * Working Copy
      * @param sourceNodeId ID
   * @param options
   * @returns
      */
  async startNodeEdit(
    sourceNodeId: NodeId,
    _options: CommandAdapterOptions,
  ): Promise<WorkingCopyEditSession> {
    try {
      // Command creation is no longer needed with the new API
      const workingCopyId = createAdapterCommandId();

      const workingCopyAPI = (this.workerAPI as any).getWorkingCopyAPI
        ? await (this.workerAPI as any).getWorkingCopyAPI()
        : (this.workerAPI as any);
      const createFromNode = (workingCopyAPI as any).createWorkingCopyFromNode?.bind(workingCopyAPI)
        || (workingCopyAPI as any).createWorkingCopy?.bind(workingCopyAPI);
      if (typeof createFromNode !== 'function') {
        throw new Error('createWorkingCopy not available on WorkerAPI');
      }
      await createFromNode(sourceNodeId);

      //  expectedUpdatedAt
      const currentNodeData = await this.getCurrentNodeData(sourceNodeId);

      return {
        workingCopyId,
        sourceId: sourceNodeId,
        isCreate: false,
        expectedUpdatedAt: currentNodeData?.updatedAt,
      };
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to start editing node ${sourceNodeId}`,
        'START_NODE_EDIT_ERROR',
        error as Error,
      );
    }
  }

  /**
      * Working Copy
      * @param parentId ID
   * @param name
   * @param description
   * @param options
   * @returns
      */
  async startNodeCreate(
    parentId: NodeId,
    name: string,
    _description: string | undefined,
    nodeType: string,
    _options: CommandAdapterOptions,
  ): Promise<WorkingCopyEditSession> {
    try {
      // Command creation is no longer needed with the new API

      const workingCopyAPI = (this.workerAPI as any).getWorkingCopyAPI
        ? await (this.workerAPI as any).getWorkingCopyAPI()
        : (this.workerAPI as any);
      const createDraft = (workingCopyAPI as any).createDraftWorkingCopy?.bind(workingCopyAPI)
        || (workingCopyAPI as any).createWorkingCopyForCreate?.bind(workingCopyAPI);
      if (typeof createDraft !== 'function') {
        throw new Error('createWorkingCopyForCreate not available on WorkerAPI');
      }
      const workingCopy = await createDraft(toNodeType(nodeType), parentId, {
        name,
      });

      return {
        workingCopyId: workingCopy.id,
        parentId: parentId,
        isCreate: true,
      };
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to start creating node in parent ${parentId}`,
        'START_NODE_CREATE_ERROR',
        error as Error,
      );
    }
  }

  /**
      * Working Copy
      * @param editSession
   * @param options
   * @returns Promise<void>
      */
  async commitNodeEdit(
    editSession: WorkingCopyEditSession,
    options: CommandAdapterOptions,
  ): Promise<void> {
    if (editSession.isCreate) {
      throw new TreeConsoleAdapterError(
        'Use commitNodeCreate for new node creation',
        'INVALID_COMMIT_OPERATION',
      );
    }

    try {
      const command = createCommand(
        'commitWorkingCopy',
        {
          workingCopyId: editSession.workingCopyId,
          expectedUpdatedAt: editSession.expectedUpdatedAt!,
          onNameConflict: options.context?.onNameConflict,
        } as CommitWorkingCopyPayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        },
      );

      const workingCopyAPI = (this.workerAPI as any).getWorkingCopyAPI
        ? await (this.workerAPI as any).getWorkingCopyAPI()
        : (this.workerAPI as any);
      const commit = (workingCopyAPI as any).commitWorkingCopy?.bind(workingCopyAPI)
        || (workingCopyAPI as any).commitWorkingCopyForCreate?.bind(workingCopyAPI);
      const result = await commit(
        command.payload.workingCopyId as NodeId,
      );

      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to commit node edit: ${result.error || 'Unknown error'}`,
          'COMMIT_NODE_EDIT_FAILED',
        );
      }
    } catch (error) {
      if (error instanceof TreeConsoleAdapterError) {
        throw error;
      }
      throw new TreeConsoleAdapterError(
        `Commit edit operation failed for working copy ${editSession.workingCopyId}`,
        'COMMIT_NODE_EDIT_ADAPTER_ERROR',
        error as Error,
      );
    }
  }

  /**
      * Working Copy
      * @param editSession
   * @param options
   * @returns Promise<void>
      */
  async commitNodeCreate(
    editSession: WorkingCopyEditSession,
    options: CommandAdapterOptions,
  ): Promise<void> {
    if (!editSession.isCreate) {
      throw new TreeConsoleAdapterError(
        'Use commitNodeEdit for existing node editing',
        'INVALID_COMMIT_OPERATION',
      );
    }

    try {
      const command = createCommand(
        'commitWorkingCopyForCreate',
        {
          workingCopyId: editSession.workingCopyId,
          onNameConflict: options.context?.onNameConflict,
        } as CommitWorkingCopyForCreatePayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        },
      );

      const workingCopyAPI = (this.workerAPI as any).getWorkingCopyAPI
        ? await (this.workerAPI as any).getWorkingCopyAPI()
        : (this.workerAPI as any);
      const commit = (workingCopyAPI as any).commitWorkingCopy?.bind(workingCopyAPI)
        || (workingCopyAPI as any).commitWorkingCopyForCreate?.bind(workingCopyAPI);
      const result = await commit(
        command.payload.workingCopyId as NodeId,
      );

      if (!result.success) {
        throw new TreeConsoleAdapterError(
          `Failed to commit node create: ${result.error || 'Unknown error'}`,
          'COMMIT_NODE_CREATE_FAILED',
        );
      }
    } catch (error) {
      if (error instanceof TreeConsoleAdapterError) {
        throw error;
      }
      throw new TreeConsoleAdapterError(
        `Commit create operation failed for working copy ${editSession.workingCopyId}`,
        'COMMIT_NODE_CREATE_ADAPTER_ERROR',
        error as Error,
      );
    }
  }

  /**
      * Working Copy
      * @param editSession
   * @param options
   * @returns Promise<void>
      */
  async discardWorkingCopy(
    editSession: WorkingCopyEditSession,
    options: CommandAdapterOptions,
  ): Promise<void> {
    try {
      const commandKind = editSession.isCreate
        ? 'discardWorkingCopyForCreate'
        : 'discardWorkingCopy';

      const command = createCommand(
        commandKind,
        {
          workingCopyId: editSession.workingCopyId,
        } as DiscardWorkingCopyPayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        },
      );

      const workingCopyAPI = (this.workerAPI as any).getWorkingCopyAPI
        ? await (this.workerAPI as any).getWorkingCopyAPI()
        : (this.workerAPI as any);
      const discard = (workingCopyAPI as any).discardWorkingCopy?.bind(workingCopyAPI)
        || (workingCopyAPI as any).discardWorkingCopyForCreate?.bind(workingCopyAPI);
      await discard(command.payload.workingCopyId as NodeId);
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to discard working copy ${editSession.workingCopyId}`,
        'DISCARD_WORKING_COPY_ERROR',
        error as Error,
      );
    }
  }

  /**
      * Working CopyexpectedUpdatedAt
      * TODO: API
   * TreeQueryService
      */
  async getCurrentNodeData(nodeId: NodeId): Promise<TreeNode | undefined> {
    try {
      return await this.workerAPI.getQueryAPI().getNode(nodeId);
    } catch (error) {
      console.error('Failed to get current node data:', error);
      return undefined;
    }
  }
}
