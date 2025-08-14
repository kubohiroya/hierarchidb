import { TreeNodeTypes } from '../nodes/TreeNodeTypes';

export type TreeNodeType = (typeof TreeNodeTypes)[keyof typeof TreeNodeTypes];

/**
 * Helper functions for node type categorization
 */
export const isRootNode = (type: TreeNodeType): boolean => {
  return (
    type === TreeNodeTypes.ProjectsRoot ||
    type === TreeNodeTypes.ResourcesRoot ||
    type === TreeNodeTypes.ProjectsTrashRoot ||
    type === TreeNodeTypes.ResourcesTrashRoot
  );
};

export const isProjectNode = (type: TreeNodeType): boolean => {
  return (
    type === TreeNodeTypes.Project ||
    type === TreeNodeTypes.ProjectsRoot ||
    type === TreeNodeTypes.ProjectFolder
  );
};

export const isResourceNode = (type: TreeNodeType): boolean => {
  return (
    type >= 1000 || type === TreeNodeTypes.ResourcesRoot || type === TreeNodeTypes.ResourceFolder
  );
};

export const isDataNode = (type: TreeNodeType): boolean => {
  return (
    type >= 1000 || // Legacy resource types
    type === TreeNodeTypes.Shapes ||
    type === TreeNodeTypes.Locations ||
    type === TreeNodeTypes.Routes ||
    type === TreeNodeTypes.StyleMap ||
    type === TreeNodeTypes.BaseMap ||
    type === TreeNodeTypes.PropertyResolver
  );
};

export const isBranchNode = (type: TreeNodeType): boolean => {
  return (
    type === TreeNodeTypes.ResourceFolder ||
    type === TreeNodeTypes.ProjectFolder ||
    type === TreeNodeTypes.ProjectsRoot ||
    type === TreeNodeTypes.ResourcesRoot ||
    type === TreeNodeTypes.ProjectsTrashRoot ||
    type === TreeNodeTypes.ResourcesTrashRoot
  );
};

export const isTrashNode = (type: TreeNodeType): boolean => {
  return type === TreeNodeTypes.ProjectsTrashRoot || type === TreeNodeTypes.ResourcesTrashRoot;
};
