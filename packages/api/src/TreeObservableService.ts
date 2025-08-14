import type { Observable } from 'rxjs';
import type {
  CommandEnvelope,
  TreeChangeEvent,
  TreeNodeId,
  TreeNode,
  ExpandedStateChanges,
  SubTreeChanges,
  ObserveNodePayload,
  ObserveChildrenPayload,
  ObserveSubtreePayload,
  ObserveWorkingCopiesPayload,
} from '@hierarchidb/core';

/**
 * Modern Observable-based Tree service for real-time tree monitoring
 * Provides high-performance reactive tree observation with granular subscriptions
 */
export interface TreeObservableService {
  // Basic node observation
  observeNode(
    cmd: CommandEnvelope<'observeNode', ObserveNodePayload>
  ): Promise<Observable<TreeChangeEvent>>;

  // Children observation
  observeChildren(
    cmd: CommandEnvelope<'observeChildren', ObserveChildrenPayload>
  ): Promise<Observable<TreeChangeEvent>>;

  // Subtree observation
  observeSubtree(
    cmd: CommandEnvelope<'observeSubtree', ObserveSubtreePayload>
  ): Promise<Observable<TreeChangeEvent>>;

  // Working copy observation
  observeWorkingCopies(
    cmd: CommandEnvelope<'observeWorkingCopies', ObserveWorkingCopiesPayload>
  ): Promise<Observable<TreeChangeEvent>>;

  // Resource management
  getActiveSubscriptions(): Promise<number>;

  cleanupOrphanedSubscriptions(): Promise<void>;

  // Legacy V1 compatibility methods (deprecated)
  subscribeSubTree(
    pageTreeNodeId: TreeNodeId,
    notifyExpandedChangesCallback: (changes: ExpandedStateChanges) => void,
    notifySubTreeChangesCallback: (changes: SubTreeChanges) => void
  ): Promise<{
    initialSubTree: Promise<SubTreeChanges>;
    unsubscribeSubTree: () => void;
  }>;

  toggleNodeExpanded(pageTreeNodeId: TreeNodeId): Promise<void>;

  listChildren(parentId: TreeNodeId, doExpandNode?: boolean): Promise<SubTreeChanges>;

  getNodeAncestors(pageNodeId: TreeNodeId): Promise<TreeNode[]>;

  searchByNameWithDepth(
    rootNodeId: TreeNodeId,
    query: string,
    opts: {
      maxDepth: number;
      maxVisited?: number;
    }
  ): Promise<TreeNode[]>;
}
