import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type {
  IdeGsmProjectRootNodeData,
  IdeGsmProjectSnapshot,
  IdeGsmProjectSnapshotManifest,
} from '@hierarchidb/idegsm-project-api';
import type { TreeNode } from '@hierarchidb/tree-api';

export type IdeGsmProjectSyncJournalState = 'started' | 'validated' | 'committed' | 'reverted';

export interface IdeGsmProjectSyncJournal {
  readonly operationId: string;
  readonly generationId: string;
  readonly projectNodeId: NodeId;
  readonly state: IdeGsmProjectSyncJournalState;
  readonly manifest: IdeGsmProjectSnapshotManifest;
  readonly createdAt: number;
  readonly committedAt: number | null;
  readonly error: string | null;
}

export interface IdeGsmProjectMaterializationInput {
  readonly operationId: string;
  readonly generationId: string;
  readonly projectNodeId: NodeId;
  readonly expectedRootVersion: number;
  readonly snapshot: IdeGsmProjectSnapshot;
  readonly now: number;
}

export interface IdeGsmProjectCoreDbPort {
  readonly runInTx: <T>(
    mode: 'r' | 'rw',
    tables: readonly ['nodes'],
    fn: () => Promise<T>
  ) => Promise<T>;
  readonly getNode: (nodeId: NodeId) => Promise<TreeNode | undefined>;
  readonly putNode: (node: TreeNode) => Promise<void>;
  readonly putNodes: (nodes: readonly TreeNode[]) => Promise<void>;
  readonly putJournal: (journal: IdeGsmProjectSyncJournal) => Promise<void>;
}

export interface IdeGsmProjectMaterializationResult {
  readonly operationId: string;
  readonly generationId: string;
  readonly manifest: IdeGsmProjectSnapshotManifest;
  readonly childNodeIds: readonly NodeId[];
}

export interface IdeGsmProjectMaterializedNode extends TreeNode {
  readonly nodeType: NodeType;
  readonly data: Record<string, unknown> | null;
}

export type IdeGsmProjectCommittedRootNode = TreeNode<IdeGsmProjectRootNodeData>;
