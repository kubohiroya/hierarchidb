import type {
  NodeAction,
  NodeId,
  NodeType,
  Tree,
  TreeNode,
} from '@hierarchidb/feature-core/common-types';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/feature-core/common-api';

// Re-export types from loader.ts for compatibility
export type {
  LoadWorkerAPIClientReturn,
  LoadTreeArgs,
  LoadTreeReturn,
  LoadPageNodeArgs,
  LoadPageNodeReturn,
  LoadTargetNodeArgs,
  LoadTargetNodeReturn,
  LoadNodeTypeArgs,
  LoadNodeTypeReturn,
  LoadNodeActionArgs,
  LoadNodeActionReturn,
} from '~/loader.js';

// Import the actual loader functions from the existing loader.ts
export {
  loadWorkerAPIClient,
  loadTree,
  loadPageNode,
  loadTargetNode,
  loadNodeType,
  loadNodeAction,
} from '~/loader.js';

/**
 * Context type for TanStack Router tree routes
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
