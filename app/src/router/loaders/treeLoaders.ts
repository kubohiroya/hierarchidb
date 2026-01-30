import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { NodeAction, NodeId, NodeType, Tree, TreeNode } from '@hierarchidb/common-types';
import type { Remote } from 'comlink';

// Re-export types from loader.ts for compatibility
export type {
  LoadNodeActionArgs,
  LoadNodeActionReturn,
  LoadNodeTypeArgs,
  LoadNodeTypeReturn,
  LoadPageNodeArgs,
  LoadPageNodeReturn,
  LoadTargetNodeArgs,
  LoadTargetNodeReturn,
  LoadTreeArgs,
  LoadTreeReturn,
  LoadWorkerAPIClientReturn,
} from '~/loader.js';

// Import the actual loader functions from the existing loader.ts
export {
  loadNodeAction,
  loadNodeType,
  loadPageNode,
  loadTargetNode,
  loadTree,
  loadWorkerAPIClient,
} from '~/loader.js';

/**
 * Context type for TanStack Router console routes
 */
export interface TreeRouteContext {
  client?: Remote<WorkerAPI>;
  tree?: Tree;
  pageNodeId?: NodeId;
  pageNode?: TreeNode;
  targetNodeId?: NodeId;
  targetNode?: TreeNode;
  nodeType?: NodeType;
  action?: NodeAction;
}
