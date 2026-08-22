/**
 * DraftCommands Adapter
 * TreeConsoleWorking CopyWorkerAPICommandEnvelope
 * Working Copy
 */

import type { NodeId, PeerEntity, Timestamp } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import type {
  CommitDraftForCreatePayload,
  CommitDraftOptions,
  CommitDraftPayload,
  CommitResult,
  DiscardDraftPayload,
  TreeNode,
} from '@hierarchidb/tree-api';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import { createCommand } from '~/adapters/commandEnvelopeFactories';
import type { CommandAdapterOptions } from '~/types/index';
import { TreeConsoleAdapterError } from '~/types/index';

export interface DraftEditSession {
  draftId: string;
  sourceId?: NodeId;
  parentId?: NodeId;
  isCreate: boolean;
  expectedUpdatedAt?: Timestamp;
}

export class DraftCommandsAdapter<T> {
  constructor(private workerAPI: WorkerAPI<T>) {}

  private resolveCommitOptions(options: CommandAdapterOptions): CommitDraftOptions<T> | undefined {
    const policy = options.context?.onNameConflict as
      | CommitDraftOptions<T>['onNameConflict']
      | undefined;
    return policy ? { onNameConflict: policy } : undefined;
  }

  async startNodeEdit(
    sourceNodeId: NodeId,
    options: CommandAdapterOptions
  ): Promise<DraftEditSession> {
    try {
      const updaterAPI = await this.workerAPI.getTreeNodeUpdaterAPI();
      // Subscription API is expected to keep UI-side node snapshot fresh.
      // If caller provides the latest snapshot, use it; otherwise no extra fetch.
      const currentNodeData = options.context?.nodeSnapshot as TreeNode | undefined;
      const draftId = sourceNodeId;
      if (currentNodeData?.metadata) {
        await updaterAPI.updateTreeNodeDraftMetadata(sourceNodeId, currentNodeData.metadata);
      }
      if (currentNodeData?.data) {
        await updaterAPI.updateTreeNodeDraftData(
          sourceNodeId,
          currentNodeData.data as Partial<PeerEntity<T>>
        );
      }

      return {
        draftId,
        sourceId: sourceNodeId,
        isCreate: false,
        expectedUpdatedAt: currentNodeData?.updatedAt,
      };
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to start editing node ${sourceNodeId}`,
        'START_NODE_EDIT_ERROR',
        error as Error
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
    _options: CommandAdapterOptions
  ): Promise<DraftEditSession> {
    try {
      const updaterAPI = await this.workerAPI.getTreeNodeUpdaterAPI();
      const draft = await updaterAPI.initTreeNode(toNodeType(nodeType), parentId, {
        metadata: { name },
      } as Partial<TreeNode>);

      return {
        draftId: (draft as { id?: string }).id as string,
        parentId: parentId,
        isCreate: true,
      };
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to start creating node in parent ${parentId}`,
        'START_NODE_CREATE_ERROR',
        error as Error
      );
    }
  }

  /**
   * Draft
   * @param editSession
   * @param options
   * @returns Promise<void>
   */
  async commitNodeEdit(
    editSession: DraftEditSession,
    options: CommandAdapterOptions
  ): Promise<void> {
    if (editSession.isCreate) {
      throw new TreeConsoleAdapterError(
        'Use commitNodeCreate for new node creation',
        'INVALID_COMMIT_OPERATION'
      );
    }

    try {
      const command = createCommand(
        'commitDraft',
        {
          draftId: editSession.draftId,
          expectedUpdatedAt: editSession.expectedUpdatedAt!,
          onNameConflict: options.context?.onNameConflict,
        } as CommitDraftPayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        }
      );

      const updaterAPI = await this.workerAPI.getTreeNodeUpdaterAPI();
      const commitOptions = this.resolveCommitOptions(options);
      const result = await updaterAPI.commitDraft(command.payload.draftId as NodeId, commitOptions);

      if (result.status === 'ok') return;

      if (result.status === 'NAME_CONFLICT') {
        throw new TreeConsoleAdapterError(
          `Failed to commit node edit: name conflict (suggested: ${result.suggestedName})`,
          'COMMIT_NODE_EDIT_FAILED',
          {
            status: result.status,
            suggestedName: result.suggestedName,
            onNameConflict: commitOptions?.onNameConflict,
          }
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
          }
        );
      }

      const unexpectedResult = result as CommitResult;
      throw new TreeConsoleAdapterError(
        'Commit edit operation failed: unexpected status',
        'COMMIT_NODE_EDIT_FAILED',
        { status: unexpectedResult.status, onNameConflict: commitOptions?.onNameConflict }
      );
    } catch (error) {
      if (error instanceof TreeConsoleAdapterError) {
        throw error;
      }
      throw new TreeConsoleAdapterError(
        `Commit edit operation failed for draft ${editSession.draftId}`,
        'COMMIT_NODE_EDIT_ADAPTER_ERROR',
        error as Error
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
    editSession: DraftEditSession,
    options: CommandAdapterOptions
  ): Promise<void> {
    if (!editSession.isCreate) {
      throw new TreeConsoleAdapterError(
        'Use commitNodeEdit for existing node editing',
        'INVALID_COMMIT_OPERATION'
      );
    }

    try {
      const command = createCommand(
        'commitDraftForCreate',
        {
          draftId: editSession.draftId,
          onNameConflict: options.context?.onNameConflict,
        } as CommitDraftForCreatePayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        }
      );

      const updaterAPI = await this.workerAPI.getTreeNodeUpdaterAPI();
      const commitOptions = this.resolveCommitOptions(options);
      const result = await updaterAPI.commitDraft(command.payload.draftId as NodeId, commitOptions);

      if (result.status === 'ok') return;

      if (result.status === 'NAME_CONFLICT') {
        throw new TreeConsoleAdapterError(
          `Failed to commit node create: name conflict (suggested: ${result.suggestedName})`,
          'COMMIT_NODE_CREATE_FAILED',
          {
            status: result.status,
            suggestedName: result.suggestedName,
            onNameConflict: commitOptions?.onNameConflict,
          }
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
          }
        );
      }

      const unexpectedResult = result as CommitResult;
      throw new TreeConsoleAdapterError(
        'Commit create operation failed: unexpected status',
        'COMMIT_NODE_CREATE_FAILED',
        { status: unexpectedResult.status, onNameConflict: commitOptions?.onNameConflict }
      );
    } catch (error) {
      if (error instanceof TreeConsoleAdapterError) {
        throw error;
      }
      throw new TreeConsoleAdapterError(
        `Commit create operation failed for draft ${editSession.draftId}`,
        'COMMIT_NODE_CREATE_ADAPTER_ERROR',
        error as Error
      );
    }
  }

  /**
   * Working Copy
   * @param editSession
   * @param options
   * @returns Promise<void>
   */
  async discardDraft(editSession: DraftEditSession, options: CommandAdapterOptions): Promise<void> {
    try {
      const commandKind = editSession.isCreate ? 'discardDraftForCreate' : 'discardDraft';

      const command = createCommand(
        commandKind,
        {
          draftId: editSession.draftId,
        } as DiscardDraftPayload,
        {
          groupId: options.context?.groupId,
          sourceViewId: options.context?.viewId,
        }
      );

      const updaterAPI = await this.workerAPI.getTreeNodeUpdaterAPI();
      await updaterAPI.discardDraft(command.payload.draftId as NodeId);
    } catch (error) {
      throw new TreeConsoleAdapterError(
        `Failed to discard draft ${editSession.draftId}`,
        'DISCARD_WORKING_COPY_ERROR',
        error as Error
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
      return (await this.workerAPI.getQueryAPI()).getNode(nodeId);
    } catch (error) {
      console.error('Failed to get current node data:', error);
      return undefined;
    }
  }
}
