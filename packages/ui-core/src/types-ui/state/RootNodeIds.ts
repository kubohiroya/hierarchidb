import { TreeRootNodeIds } from '../nodes/TreeRootNodeIds';

// Export the root node IDs directly to avoid circular dependency
export const RootNodeIds = [
  TreeRootNodeIds.Projects,
  TreeRootNodeIds.ProjectsTrash,
  TreeRootNodeIds.Resources,
  TreeRootNodeIds.ResourcesTrash,
];
