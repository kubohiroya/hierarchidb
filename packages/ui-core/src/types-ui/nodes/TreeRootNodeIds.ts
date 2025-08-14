export type TreeRootNodeId = 'Projects' | 'Resources' | 'ProjectsTrash' | 'ResourcesTrash';

export const TreeRootNodeIds = {
  SuperRoot: 'SuperRoot' as TreeRootNodeId,
  Projects: 'Projects' as TreeRootNodeId,
  ProjectsTrash: 'ProjectsTrash' as TreeRootNodeId,
  Resources: 'Resources' as TreeRootNodeId,
  ResourcesTrash: 'ResourcesTrash' as TreeRootNodeId,
} as const;
