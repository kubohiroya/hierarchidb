/**
 * console NodeType Route for TanStack Router
 *
 * This route handles the `/t/:treeId/:pageNodeId/:targetNodeId/:nodeType` path
 * and loads the node type data with NotFound handling.
 * Corresponds to React Router routes:
 * - `t.($treeId).($pageNodeId).($targetNodeId).($nodeType).tsx`
 * - `t.($treeId).($pageNodeId).($targetNodeId).($nodeType)._layout.tsx`
 */

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { createRoute, Outlet, useLoaderData, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { loadNodeType } from '~/router/loaders/treeLoaders';
import { treeTargetRoute } from './targetRoute.js';

export const treeNodeTypeRoute = createRoute({
  getParentRoute: () => treeTargetRoute,
  path: '$nodeType',
  loader: async ({ params }) => {
    const { treeId, pageNodeId, targetNodeId, nodeType } = params;
    if (!treeId || !targetNodeId || !nodeType) {
      throw new Error('Missing required parameters');
    }
    const resolvedPageNodeId = pageNodeId ?? `${treeId}:root`;
    return await loadNodeType({
      treeId,
      pageNodeId: resolvedPageNodeId,
      targetNodeId,
      nodeType,
    });
  },
  component: TreeNodeTypeLayout,
});

function TreeNodeTypeLayout() {
  const data = useLoaderData({ from: treeNodeTypeRoute.id });
  const navigate = useNavigate();
  const { tree, pageNodeId, targetNodeId, targetNode } = data;
  const notFound = targetNode === undefined;
  const fallbackTreeId = tree?.id ?? 'r';
  const [open, setOpen] = useState<boolean>(notFound);

  useEffect(() => {
    setOpen(notFound);
  }, [notFound]);

  const goToPageNode = () => {
    navigate({ to: `/t/${fallbackTreeId}/${pageNodeId}` });
  };

  return (
    <>
      {notFound && (
        <Dialog open={open} onClose={goToPageNode}>
          <DialogTitle>Node Not Found</DialogTitle>
          <DialogContent>
            <Typography>Node Not Found: ({targetNodeId ?? 'Unknown'})</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={goToPageNode} variant="contained" autoFocus>
              Go to Page Node
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Outlet />
    </>
  );
}
