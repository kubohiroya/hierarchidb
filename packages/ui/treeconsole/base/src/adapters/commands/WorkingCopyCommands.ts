/**
  * WorkingCopyCommands Adapter
  * TreeConsoleWorking CopyWorkerAPICommandEnvelope
 * Working Copy
  */

import type { CommitWorkingCopyOptions, WorkerAPI } from '@hierarchidb/common-api';
import type {
  CommitResult,
  CommitWorkingCopyForCreatePayload,
  CommitWorkingCopyPayload,
  DiscardWorkingCopyPayload,
  NodeId,
  Timestamp,
  TreeNode,
} from '@hierarchidb/common-types';
import { toNodeType } from '@hierarchidb/common-types';
import { createAdapterCommandId, createCommand } from '../utils.js';
import type { CommandAdapterOptions } from '../../types/index.js';
import { TreeConsoleAdapterError } from '../../types/index.js';

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

  private resolveCommitOptions(options: CommandAdapterOptions): CommitWorkingCopyOptions | undefined {
    const policy = options.context?.onNameConflict as CommitWorkingCopyOptions['onNameConflict'] | undefined;
    return policy ? { onNameConflict: policy } : undefined;
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

      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      await workingCopyAPI.createWorkingCopyFromNode(sourceNodeId);

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

      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      const workingCopy = await workingCopyAPI.createDraftWorkingCopy(
        toNodeType(nodeType),
        parentId,
        { name },
      );

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

      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      const commitOptions = this.resolveCommitOptions(options);
      const result = await workingCopyAPI.commitWorkingCopy(
        command.payload.workingCopyId as NodeId,
        commitOptions,
      );

      if (result.status === 'ok') return;

      if (result.status === 'NAME_CONFLICT') {
        throw new TreeConsoleAdapterError(
          `Failed to commit node edit: name conflict (suggested: ${result.suggestedName})`,
          'COMMIT_NODE_EDIT_FAILED',
          {
            status: result.status,
            suggestedName: result.suggestedName,
            onNameConflict: commitOptions?.onNameConflict,
          },
        );
      }

      if (result.status === 'COMMIT_CONFLICT') {
        const original = result.originalVersion ?? 'unknown';
        const wc = result.wcVersion ?? 'unknown';
        throw new TreeConsoleAdapterError(
          `Failed to commit node edit: version conflict (original=${original}, wc=${wc})`,
          'COMMIT_NODE_EDIT_FAILED',
          {
            status: result.status,
            originalVersion: result.originalVersion,
            wcVersion: result.wcVersion,
            onNameConflict: commitOptions?.onNameConflict,
          },
        );
      }

      const unexpectedResult = result as CommitResult;
      throw new TreeConsoleAdapterError(
        'Commit edit operation failed: unexpected status',
        'COMMIT_NODE_EDIT_FAILED',
        { status: unexpectedResult.status, onNameConflict: commitOptions?.onNameConflict },
      );
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

      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      const commitOptions = this.resolveCommitOptions(options);
      const result = await workingCopyAPI.commitWorkingCopy(
        command.payload.workingCopyId as NodeId,
        commitOptions,
      );

      if (result.status === 'ok') return;

      if (result.status === 'NAME_CONFLICT') {
        throw new TreeConsoleAdapterError(
          `Failed to commit node create: name conflict (suggested: ${result.suggestedName})`,
          'COMMIT_NODE_CREATE_FAILED',
          {
            status: result.status,
            suggestedName: result.suggestedName,
            onNameConflict: commitOptions?.onNameConflict,
          },
        );
      }

      if (result.status === 'COMMIT_CONFLICT') {
        throw new TreeConsoleAdapterError(
          'Failed to commit node create: version conflict detected',
          'COMMIT_NODE_CREATE_FAILED',
          {
            status: result.status,
            originalVersion: result.originalVersion,
            wcVersion: result.wcVersion,
            onNameConflict: commitOptions?.onNameConflict,
          },
        );
      }

      const unexpectedResult = result as CommitResult;
      throw new TreeConsoleAdapterError(
        'Commit create operation failed: unexpected status',
        'COMMIT_NODE_CREATE_FAILED',
        { status: unexpectedResult.status, onNameConflict: commitOptions?.onNameConflict },
      );
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

      const workingCopyAPI = await this.workerAPI.getWorkingCopyAPI();
      await workingCopyAPI.discardWorkingCopy(command.payload.workingCopyId as NodeId);
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
