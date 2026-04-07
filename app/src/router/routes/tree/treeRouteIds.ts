export const treeRouteIds = {
  page: '/d/$treeId/$pageNodeId',
  tags: '/d/$treeId/$pageNodeId/tags',
  tagName: '/d/$treeId/$pageNodeId/tags/$tag',
  target: '/d/$treeId/$pageNodeId/$targetNodeId',
  dialog: '/d/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action',
  dialogMode: '/d/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action/$mode',
  dialogModeStep: '/d/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action/$mode/$step',
} as const;

/** Folder view route IDs */
export const folderRouteIds = {
  view: '/f/$treeId/$pageNodeId/$targetNodeId/folder/$viewMode',
  viewSort: '/f/$treeId/$pageNodeId/$targetNodeId/folder/$viewMode/$sortMode',
} as const;
