import { Button, Divider, Paper, Stack, Tooltip, Typography, Alert, Box, IconButton, Chip } from '@mui/material';
import { Edit as EditIcon, PlayArrow as PlayArrowIcon, Close as CloseIcon } from '@mui/icons-material';
import { NodeContextMenu, NodeTypeIcon } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import type { TreeId, TreeNode } from '@hierarchidb/common-types';
import type { TreeConsolePanelProps } from '@hierarchidb/ui-treeconsole-base';
import { useTreeNodeInfoPanel } from './useTreeNodeInfoPanel.js';

type ContextMenuHandler = NonNullable<TreeConsolePanelProps['onContextMenuAction']>;

export interface TreeNodeInfoPanelProps {
  readonly treeId?: TreeId;
  readonly node?: TreeNode;
  readonly onContextMenuAction: ContextMenuHandler;
}

export function TreeNodeInfoPanel({ treeId, node, onContextMenuAction }: TreeNodeInfoPanelProps) {
  const {
    currentNode,
    menuAnchorEl,
    menuNode,
    handleContextMenuTrigger,
    handleIconClick,
    handleMenuClose,
    labels,
    nodeIconColor,
    canMutate,
    isDraft,
  } = useTreeNodeInfoPanel({ treeId, node, onContextMenuAction });

  if (!currentNode) {
    return (
      <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Alert severity="info">
          {labels.noNode}
        </Alert>
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
          maxWidth: 640,
          p: { xs: 1, md: 1 },
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          position: 'relative',
        }}
      >
        <IconButton
          aria-label={labels.closeAria}
          size="small"
          onClick={() => handleContextMenuTrigger('navigate', { navigateToParent: true })}
          disabled={!canMutate}
          sx={{ position: 'absolute', top: 8, right: 8 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
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
          <Typography variant="h4" component="h2" sx={{ wordBreak: 'break-word' }}>
            {currentNode.metadata?.name || labels.unnamedNodeLabel}
          </Typography>
          {isDraft && (
            <Chip
              label="Draft"
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
            Created: {labels.createdAtLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Updated: {labels.updatedAtLabel}
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
          <Button
            variant="outlined"
            startIcon={<PlayArrowIcon />}
            onClick={() => handleContextMenuTrigger('preview')}
            aria-label={labels.previewAria}
            disabled={menuNode?.visible === false}
          >
            {labels.previewLabel}
          </Button>
        </Stack>
      </Paper>

      <NodeContextMenu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl && menuNode)}
        onClose={handleMenuClose}
        nodeId={menuNode?.id ?? ''}
        nodeType={menuNode?.nodeType ?? 'folder'}
        nodeName={menuNode?.metadata?.name ?? ''}
        treeId={treeId}
        isVisible={menuNode?.visible ?? true}
        canCreate={false}
        canEdit={canMutate}
        canDuplicate={canMutate}
        canCopy={canMutate}
        canCut={canMutate}
        canTrash={canMutate}
        canRemove={canMutate}
        onOpen={() => handleContextMenuTrigger('navigate')}
        onOpenFolder={() => handleContextMenuTrigger('navigate')}
        onPreview={() => handleContextMenuTrigger('preview')}
        onEdit={() => handleContextMenuTrigger('edit')}
        onDuplicate={() => handleContextMenuTrigger('duplicate')}
        onCopy={() => handleContextMenuTrigger('copy')}
        onCut={() => handleContextMenuTrigger('cut')}
        onTrash={() => handleContextMenuTrigger('trash')}
        onRemove={() => handleContextMenuTrigger('trash')}
        onToggleVisible={() => handleContextMenuTrigger('toggle-visibility')}
      />
    </Box>
  );
}
