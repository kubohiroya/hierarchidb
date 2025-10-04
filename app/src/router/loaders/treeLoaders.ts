/**
 * Tree Loaders for TanStack Router
 * 
 * This module provides loader functions for tree-related routes in TanStack Router.
 * These functions are adapted from the existing loader.ts but organized for TanStack Router's context system.
 */

import type {
  NodeAction,
  NodeId,
  NodeType,
  Tree,
  TreeId,
  TreeNode,
} from '@hierarchidb/common-type';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { normalizeNodeType } from '~/utils/nodeTypeNormalize.js';

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
