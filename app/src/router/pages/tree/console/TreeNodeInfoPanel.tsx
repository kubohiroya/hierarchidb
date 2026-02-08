import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import { getTreeNodeName, type TreeNode } from '@hierarchidb/tree-api';
import {
  NodeContextMenu,
  NodeTypeIcon,
  isFolderNodeType,
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
  CircularProgress,
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
import { useCallback, useMemo } from 'react';
import { useBuildSessionSnapshots } from '~/hooks/build-session/useBuildSessionSnapshots.ts';
import { useTreeNodeInfoPanel } from './useTreeNodeInfoPanel.js';

type ContextMenuHandler = NonNullable<TreeConsolePanelProps['onContextMenuAction']>;

export interface TreeNodeInfoPanelProps {
  readonly treeId?: TreeId;
  readonly pageNodeId?: NodeId;
  readonly node?: TreeNode;
  readonly onContextMenuAction: ContextMenuHandler;
}

export function TreeNodeInfoPanel({ treeId, pageNodeId, node, onContextMenuAction }: TreeNodeInfoPanelProps) {
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
  const buildSessionNodeType = 'shape' as NodeType;
  const { sessions: buildSessions, isRunnerTab, activeSessionId } = useBuildSessionSnapshots(buildSessionNodeType);
  const runningNodeIds = useMemo(
    () => new Set(buildSessions.map((session) => session.nodeId as NodeId)),
    [buildSessions]
  );
  const isBuildRunning = currentNode?.id
    ? runningNodeIds.has(currentNode.id as NodeId)
    : false;
  const isBuildActive = isBuildRunning
    && isRunnerTab
    && String(activeSessionId ?? '') === String(currentNode?.id ?? '');
  const isVisible = currentNode?.visible !== false;
  const displayName = currentNode ? getTreeNodeName(currentNode).trim() : '';
  const originalName =
    typeof currentNode?.metadata?.name === 'string' && currentNode.metadata.name.trim().length > 0
      ? currentNode.metadata.name
      : labels.unnamedNodeLabel;
  const originalDescription =
    typeof currentNode?.metadata?.description === 'string' && currentNode.metadata.description.trim().length > 0
      ? currentNode.metadata.description
      : labels.emptyDescriptionLabel;
  const resolvedPageNodeId =
    pageNodeId ? String(pageNodeId) : (currentNode?.id ? String(currentNode.id) : null);
  const resolvedTreeId = treeId ? String(treeId) : null;
  const tagNames = useMemo(() => {
    const rawTags = currentNode?.metadata?.tags;
    if (!Array.isArray(rawTags)) return [];
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const entry of rawTags) {
      if (typeof entry !== 'string') continue;
      const trimmed = entry.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      normalized.push(trimmed);
    }
    return normalized;
  }, [currentNode?.metadata?.tags]);
  const handleTagNavigate = useCallback(
    (tagName: string) => {
      if (!resolvedTreeId || !resolvedPageNodeId) return;
      navigate({ to: `/t/${resolvedTreeId}/${resolvedPageNodeId}/tags/${encodeURIComponent(tagName)}` });
    },
    [navigate, resolvedPageNodeId, resolvedTreeId]
  );
  const parentNodeId = currentNode?.parentId;
  const isStylerNode = currentNode?.nodeType === 'styler';
  const isRootNode =
    (treeId && currentNode?.id === `${treeId}:root`) ||
    currentNode?.depth === 0 ||
    (currentNode?.id && parentNodeId === currentNode.id);
  const showCloseButton = Boolean(treeId && parentNodeId && !isRootNode);
  const isStylerMenuNode = menuNode?.nodeType === 'styler';
  const canCreate = isFolderNodeType(menuNode?.nodeType);

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
            {displayName || labels.unnamedNodeLabel}
          </Typography>
          {(isDraft || isBuildRunning || tagNames.length > 0) && (
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              justifyContent="center"
              sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
            >
              {isDraft && (
                <Tooltip
                  arrow
                  placement="top"
                  title={(
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 160 }}>
                      <Box sx={{ fontWeight: 600 }}>{originalName}</Box>
                      <Box>{originalDescription}</Box>
                    </Box>
                  )}
                >
                  <span>
                    <Chip
                      label={labels.draftLabel}
                      size="small"
                      color="error"
                      variant="filled"
                      sx={{ height: 20 }}
                    />
                  </span>
                </Tooltip>
              )}
              {isBuildRunning && (
                <CircularProgress
                  size={16}
                  thickness={5}
                  color={isBuildActive ? 'primary' : 'inherit'}
                />
              )}
              {tagNames.map((tagName) => {
                const isClickable = Boolean(resolvedTreeId && resolvedPageNodeId);
                return (
                  <Chip
                    key={`tag-chip-${tagName}`}
                    label={tagName}
                    size="small"
                    variant="outlined"
                    clickable={isClickable}
                    onClick={
                      isClickable
                        ? () => handleTagNavigate(tagName)
                        : undefined
                    }
                    sx={{ height: 20 }}
                  />
                );
              })}
            </Stack>
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
          {isBuildable && currentNode?.nodeType !== 'location' && !isStylerNode && (
            <Button
              variant="outlined"
              startIcon={<ConstructionIcon />}
              onClick={handleBuild}
              aria-label={labels.buildAria}
              disabled={buildTargetLoading}
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
        canCreate={canCreate}
        canEdit={canMutate}
        canDuplicate={canMutate}
        canCopy={canMutate}
        canCut={canMutate}
        canTrash={canMutate}
        canRemove={canMutate}
        canBuild={isBuildable && !isStylerMenuNode}
        canPreview={canPreview && !previewGuardLoading}
        openSteps={openSteps}
        openStepsLoading={openStepsLoading}
        onOpen={(options) => handleContextMenuTrigger('navigate', options)}
        onOpenFolder={(options) => handleContextMenuTrigger('navigate', options)}
        onOpenStep={(step: number, options) => handleContextMenuTrigger(`open-step:${step}`, options)}
        onPreview={(options) => handleContextMenuTrigger('preview', options)}
        onBuild={(options) => handleContextMenuTrigger('build', options)}
        onEdit={(options) => handleContextMenuTrigger('edit', options)}
        onCreate={(type, options) => handleContextMenuTrigger(`create:${type}`, options)}
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
