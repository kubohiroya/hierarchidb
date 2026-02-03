import type { TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import {
  NodeContextMenu,
  NodeTypeIcon,
} from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { SEARCH_FIELD_MIN_WIDTH_PX, SEARCH_FIELD_WIDTH_PX } from '@hierarchidb/ui-search-field';
import type { TreeConsolePanelProps } from '@hierarchidb/ui-treeconsole-base';
import {
  Close as CloseIcon,
  Construction as ConstructionIcon,
  Edit as EditIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import { useTreeNodeInfoPanel } from './useTreeNodeInfoPanel.js';

type ContextMenuHandler = NonNullable<TreeConsolePanelProps['onContextMenuAction']>;

export interface TreeNodeInfoPanelProps {
  readonly treeId?: TreeId;
  readonly node?: TreeNode;
  readonly onContextMenuAction: ContextMenuHandler;
}

export function TreeNodeInfoPanel({ treeId, node, onContextMenuAction }: TreeNodeInfoPanelProps) {
  const navigate = useNavigate();
  const {
    currentNode,
    menuAnchorEl,
    menuNode,
    handleContextMenuTrigger,
    handleIconClick,
    handleMenuClose,
    handleBuild,
    handleTrashConfirm,
    handleTrashCancel,
    confirmTrashOpen,
    labels,
    nodeIconColor,
    canMutate,
    isDraft,
    isBuildable,
    buildTargetLoading,
    canPreview,
    previewGuardLoading,
    openSteps,
    openStepsLoading,
  } = useTreeNodeInfoPanel({ treeId, node, onContextMenuAction });
  const isVisible = currentNode?.visible !== false;
  const parentNodeId = currentNode?.parentId;
  const isRootNode =
    (treeId && currentNode?.id === `${treeId}:root`) ||
    currentNode?.depth === 0 ||
    (currentNode?.id && parentNodeId === currentNode.id);
  const showCloseButton = Boolean(treeId && parentNodeId && !isRootNode);

  if (!currentNode) {
    return (
      <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Alert severity="info">{labels.noNode}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 1,
      }}
    >
      <Paper
        elevation={2}
        sx={{
          width: '100%',
          maxWidth: `${SEARCH_FIELD_WIDTH_PX}px`,
          minWidth: `${SEARCH_FIELD_MIN_WIDTH_PX}px`,
          p: { xs: 1, md: 1 },
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          position: 'relative',
        }}
      >
        {showCloseButton && (
          <IconButton
            aria-label={labels.closeAria}
            size="small"
            onClick={() => {
              if (!treeId || !parentNodeId) return;
              navigate({ to: `/t/${treeId}/${parentNodeId}` });
            }}
            sx={{ position: 'absolute', top: 8, right: 8 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
        <Tooltip title={labels.iconTooltip}>
          <span style={{ display: 'inline-flex', justifyContent: 'center' }}>
            <NodeTypeIcon
              nodeType={labels.nodeTypeLabel}
              size="large"
              clickable
              onClick={handleIconClick}
              color="inherit"
              htmlColor={nodeIconColor}
            />
          </span>
        </Tooltip>

        <Stack spacing={0.5} alignItems="center">
          <Typography
            variant="h4"
            component="h2"
            sx={{
              wordBreak: 'break-word',
              textDecoration: isVisible ? 'none' : 'line-through',
              textDecorationThickness: isVisible ? 'initial' : '2px',
              textDecorationColor: isVisible ? 'initial' : 'inherit',
            }}
          >
            {currentNode.metadata?.name || labels.unnamedNodeLabel}
          </Typography>
          {isDraft && (
            <Chip
              label={labels.draftLabel}
              size="small"
              color="error"
              variant="filled"
              sx={{ height: 20 }}
            />
          )}
          <Typography variant="body2" color="text.secondary">
            {labels.nodeTypeCaption}
          </Typography>
        </Stack>

        <Divider />

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}
        >
          {labels.description}
        </Typography>

        <Divider />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="center"
          alignItems="center"
        >
          <Typography variant="body2" color="text.secondary">
            {labels.createdLabel}: {labels.createdAtLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {labels.updatedLabel}: {labels.updatedAtLabel}
          </Typography>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => handleContextMenuTrigger('edit')}
            disabled={!canMutate}
            aria-label={labels.editAria}
          >
            {labels.editLabel}
          </Button>
          {isBuildable && (
            <Button
              variant="outlined"
              startIcon={<ConstructionIcon />}
              onClick={handleBuild}
              aria-label={labels.buildAria}
              disabled={buildTargetLoading || currentNode?.nodeType === 'location'}
            >
              {labels.buildLabel}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={() => handleContextMenuTrigger('preview')}
            aria-label={labels.previewAria}
            disabled={!isVisible || !canPreview || previewGuardLoading}
          >
            {labels.previewLabel}
          </Button>
        </Stack>
      </Paper>

      <Dialog open={confirmTrashOpen} onClose={handleTrashCancel}>
        <DialogTitle>{labels.confirmTrashTitle}</DialogTitle>
        <DialogContent>
          <Typography>{labels.confirmTrashDescription}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleTrashCancel}>{labels.confirmTrashCancel}</Button>
          <Button onClick={handleTrashConfirm} color="error" variant="contained">
            {labels.confirmTrashConfirm}
          </Button>
        </DialogActions>
      </Dialog>

      <NodeContextMenu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl && menuNode)}
        onClose={handleMenuClose}
        nodeId={menuNode?.id ?? ''}
        nodeType={menuNode?.nodeType ?? 'folder'}
        nodeName={menuNode?.metadata?.name ?? ''}
        treeId={treeId}
        isVisible={isVisible}
        canCreate={false}
        canEdit={canMutate}
        canDuplicate={canMutate}
        canCopy={canMutate}
        canCut={canMutate}
        canTrash={canMutate}
        canRemove={canMutate}
        canBuild={isBuildable}
        canPreview={canPreview && !previewGuardLoading}
        openSteps={openSteps}
        openStepsLoading={openStepsLoading}
        onOpen={() => handleContextMenuTrigger('navigate')}
        onOpenFolder={() => handleContextMenuTrigger('navigate')}
        onOpenStep={(step: number) => handleContextMenuTrigger(`open-step:${step}`)}
        onPreview={() => handleContextMenuTrigger('preview')}
        onBuild={handleBuild}
        onEdit={() => handleContextMenuTrigger('edit')}
        onDuplicate={() => handleContextMenuTrigger('duplicate')}
        onCopy={() => handleContextMenuTrigger('copy')}
        onCut={() => handleContextMenuTrigger('cut')}
        onTrash={() => handleContextMenuTrigger('trash')}
        onRemove={() => handleContextMenuTrigger('trash')}
        onToggleVisible={(nextVisible) =>
          handleContextMenuTrigger('toggle-visibility', { nextVisible })
        }
      />
    </Box>
  );
}
