export const treeRouteIds = {
  page: '/t/$treeId/$pageNodeId',
  target: '/t/$treeId/$pageNodeId/$targetNodeId',
  dialog: '/t/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action',
  dialogMode: '/t/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action/$mode',
  dialogModeStep: '/t/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action/$mode/$step',
} as const;
