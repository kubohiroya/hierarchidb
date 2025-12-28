export const treeRouteIds = {
  page: '/t/$treeId/$pageNodeId',
  target: '/t/$treeId/$pageNodeId/$targetNodeId',
  dialog: '/t/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action',
} as const;
