/**
 * console Tags Route for TanStack Router
 *
 * This route handles the `/t/:treeId/:pageNodeId/tags` path
 * and reuses the global tags list/detail components.
 */

import { Dialog, DialogContent } from '@mui/material';
import { createRoute, useNavigate } from '@tanstack/react-router';
import TagDetailRoute from '../tags.($tagName).js';
import TagsRoute from '../tags.js';
import { treePageRoute } from './pageRoute.js';

function TreeTagsDialog() {
  const navigate = useNavigate();
  const { treeId, pageNodeId } = treeTagsRoute.useParams();
  if (!treeId) return null;
  const resolvedPageNodeId = pageNodeId ?? `${treeId}:root`;
  const basePath = `/t/${treeId}/${resolvedPageNodeId}/tags`;

  const handleClose = () => {
    navigate({ to: `/t/${treeId}/${resolvedPageNodeId}` });
  };

  return (
    <Dialog
      open
      onClose={handleClose}
      fullWidth
      maxWidth="lg"
      scroll="paper"
      PaperProps={{ sx: { maxHeight: '90vh' } }}
    >
      <DialogContent sx={{ p: 0 }}>
        <TagsRoute basePath={basePath} embedded onBack={handleClose} />
      </DialogContent>
    </Dialog>
  );
}

export const treeTagsRoute = createRoute({
  getParentRoute: () => treePageRoute,
  path: 'tags',
  component: TreeTagsDialog,
});

export const treeTagDetailRoute = createRoute({
  getParentRoute: () => treeTagsRoute,
  path: '$tag',
  component: () => {
    const { tag } = treeTagDetailRoute.useParams();
    return <TagDetailRoute tagName={tag} />;
  },
});
