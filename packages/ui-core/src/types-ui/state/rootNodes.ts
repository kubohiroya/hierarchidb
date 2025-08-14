/**
 * @file rootNodes.tsx
 * @description Root node definitions for initializing the tree structure
 *
 * @module types
 */

import type { TreeNodeEntity } from '../nodes/TreeNodeEntity';
import { TreeRootNodeIds } from '../nodes/TreeRootNodeIds';
import { TreeNodeNames } from '../nodes/TreeNodeNames';

import { TreeNodeTypes } from '../nodes/TreeNodeTypes';

/**
 * Root nodes that form the foundation of the tree structure.
 * These nodes are created during database initialization.
 */
const now = Date.now();
const createdAt = now;
const updatedAt = now;
const parentId = TreeRootNodeIds.SuperRoot;
export const rootNodes: TreeNodeEntity[] = [
  {
    id: TreeRootNodeIds.Projects,
    name: TreeNodeNames.Projects,
    type: TreeNodeTypes.ProjectsRoot as any,
    isDraft: false,
    parentId,
    createdAt,
    updatedAt,
    hasChildren: false, // Will be updated when projects are added
  },
  {
    id: TreeRootNodeIds.ProjectsTrash,
    name: TreeNodeNames.ProjectsTrash,
    type: TreeNodeTypes.ProjectsTrashRoot as any,
    isDraft: false,
    parentId,
    createdAt,
    updatedAt,
    hasChildren: false, // Will be updated when items are moved to trash
  },
  {
    id: TreeRootNodeIds.Resources,
    name: TreeNodeNames.Resources,
    type: TreeNodeTypes.ResourcesRoot as any,
    isDraft: false,
    parentId,
    createdAt,
    updatedAt,
    hasChildren: false, // Will be updated when resources are added
  },
  {
    id: TreeRootNodeIds.ResourcesTrash,
    name: TreeNodeNames.ResourcesTrash,
    type: TreeNodeTypes.ResourcesTrashRoot as any,
    isDraft: false,
    parentId,
    createdAt,
    updatedAt,
    hasChildren: false, // Will be updated when items are moved to trash
  },
];
