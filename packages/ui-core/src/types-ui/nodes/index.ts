/**
 * @file Tree node types
 * @module features/tree-data/types/nodes
 */

export type { TreeNodeEntity } from './TreeNodeEntity';
export type {
  TreeNodeDatabaseEntity,
  TreeNodeExtendedProperties,
  TreeNodeFullDatabaseEntity,
} from './TreeNodeDatabaseEntity';
export type { TreeNodeEntityWithChildren } from './TreeNodeWithChildren';
export type { TreeNodeId } from './TreeNodeId';
export { TreeRootNodeIds } from './TreeRootNodeIds';
export { isTreeNodeId, createTreeNodeId, getTreeNodeIdValue } from './TreeNodeId';
export type { TreeNodeName } from './TreeNodeName';
export { TreeNodeNames } from './TreeNodeNames';
export type { TreeNodeType } from './TreeNodeType';
export {
  isProjectNode,
  isResourceNode,
  isDataNode,
  isBranchNode,
  isRootNode,
  isTrashNode,
} from './TreeNodeType';
export type { UpdateNodeFormData } from './UpdateNodeFormData';
export { TreeNodeTypes, isNodeType } from './TreeNodeTypes';

// Import DescendantsState from state
export type { DescendantsState } from '../state/DescendantsState';
