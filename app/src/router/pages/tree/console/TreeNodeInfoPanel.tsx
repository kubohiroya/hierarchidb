import {
  NodeTypeIcon,
  SEARCH_FIELD_MIN_WIDTH_PX,
  SEARCH_FIELD_WIDTH_PX,
} from '@hierarchidb/components';
import type { NodeId, TreeId } from '@hierarchidb/core-types';
import { getTreeNodeName, type TreeNode } from '@hierarchidb/tree-api';
import { useOptionalBuildSessionRuntimeContext } from '@hierarchidb/ui-build-sessions';
import type { TreeConsolePanelProps } from '@hierarchidb/ui-treeconsole-base';
import { isFolderNodeType, NodeContextMenu } from '@hierarchidb/ui-treeconsole-breadcrumb';
import {
  ArrowBack as ArrowBackIcon,
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
import { type MouseEvent, useCallback, useMemo } from 'react';
import { BuildSessionSpinnerButton } from '~/components/BuildSessionSpinnerButton';
import { useTreeNodeInfoPanel } from './hooks/useTreeNodeInfoPanel.js';

type ContextMenuHandler = NonNullable<TreeConsolePanelProps['onContextMenuAction']>;

export interface TreeNodeInfoPanelProps {
  readonly treeId?: TreeId;
  readonly pageNodeId?: NodeId;
  readonly node?: TreeNode;
  readonly onContextMenuAction: ContextMenuHandler;
  /** Vertical alignment: 'center' (default) or 'top'. */
  readonly verticalAlign?: 'center' | 'top';
  /** Hide the back arrow button (e.g. when shown inside column view). */
  readonly hideBackButton?: boolean;
  /** Current view mode to preserve in navigation. */
  readonly viewMode?: string;
  /** Current sort mode to preserve in navigation. */
  readonly sortMode?: string;
}

export function TreeNodeInfoPanel({
  treeId,
  pageNodeId,
  node,
  onContextMenuAction,
  verticalAlign = 'center',
  hideBackButton = false,
  viewMode,
  sortMode,
}: TreeNodeInfoPanelProps) {
  const navigate = useNavigate();
  const {
    currentNode,
    menuAnchorEl,
    menuNode,
    handleContextMenuTrigger,
    handleIconClick,
    handleMenuClose,
    handleBuild,
    handleArchiveConfirm,
    handleArchiveCancel,
    confirmArchiveOpen,
    labels,
    nodeIconColor,
    canMutate,
    isDraft,
    isBuildable,
    isBuildRequired,
    folderBuildReady,
    buildTargetLoading,
    canPreview,
    previewGuardLoading,
    openSteps,
    openStepsLoading,
  } = useTreeNodeInfoPanel({ treeId, node, onContextMenuAction });
  const runtimeContext = useOptionalBuildSessionRuntimeContext();
  const isBuildRunning = currentNode?.id
    ? Boolean(runtimeContext?.runningNodeIds.has(currentNode.id as NodeId))
    : false;
  const isVisible = currentNode?.visible !== false;
  const displayName = currentNode ? getTreeNodeName(currentNode).trim() : '';
  const originalName =
    typeof currentNode?.metadata?.name === 'string' && currentNode.metadata.name.trim().length > 0
      ? currentNode.metadata.name
      : labels.unnamedNodeLabel;
  const originalDescription =
    typeof currentNode?.metadata?.description === 'string' &&
    currentNode.metadata.description.trim().length > 0
      ? currentNode.metadata.description
      : labels.emptyDescriptionLabel;
  const resolvedPageNodeId = pageNodeId
    ? String(pageNodeId)
    : currentNode?.id
      ? String(currentNode.id)
      : null;
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
      navigate({
        to: `/d/${resolvedTreeId}/${resolvedPageNodeId}/tags/${encodeURIComponent(tagName)}`,
      });
    },
    [navigate, resolvedPageNodeId, resolvedTreeId]
  );
  const parentNodeId = currentNode?.parentId;
  const isRootNode =
    (treeId && currentNode?.id === `${treeId}:root`) ||
    currentNode?.depth === 0 ||
    (currentNode?.id && parentNodeId === currentNode.id);
  const showCloseButton = !hideBackButton && Boolean(treeId && parentNodeId && !isRootNode);
  const isFolderNode = isFolderNodeType(menuNode?.nodeType);
  const handleNavigateToParent = useCallback(() => {
    if (!treeId || !parentNodeId || isRootNode) return;
    const vm = viewMode || 'list';
    const sm = sortMode || 'name';
    const viewSuffix = sm !== 'name' ? `${vm}/${sm}` : vm;
    navigate({ to: `/f/${treeId}/${parentNodeId}/-/folder/${viewSuffix}` });
  }, [isRootNode, navigate, parentNodeId, treeId, viewMode, sortMode]);
  const handleBackdropClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.currentTarget !== event.target) return;
      handleNavigateToParent();
    },
    [handleNavigateToParent]
  );
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
      onClick={showCloseButton ? handleBackdropClick : undefined}
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: verticalAlign === 'top' ? 'flex-start' : 'center',
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
            size="large"
            onClick={handleNavigateToParent}
            sx={{ position: 'absolute', top: 8, left: 8 }}
          >
            <ArrowBackIcon />
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
              isDraft={isDraft}
              buildRequired={isBuildRequired}
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
          {(isDraft || isBuildRequired || isBuildRunning || tagNames.length > 0) && (
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              justifyContent="center"
              sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
            >
              {isBuildRequired && (
                <Tooltip arrow placement="top" title={labels.buildRequiredLabel}>
                  <span>
                    <Chip
                      label={labels.buildRequiredLabel}
                      size="small"
                      color="warning"
                      variant="filled"
                      sx={{ height: 20 }}
                    />
                  </span>
                </Tooltip>
              )}
              {isDraft && (
                <Tooltip
                  arrow
                  placement="top"
                  title={
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 160 }}>
                      <Box sx={{ fontWeight: 600 }}>{originalName}</Box>
                      <Box>{originalDescription}</Box>
                    </Box>
                  }
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
              {isBuildRunning && <BuildSessionSpinnerButton nodeId={currentNode.id as NodeId} />}
              {tagNames.map((tagName) => {
                const isClickable = Boolean(resolvedTreeId && resolvedPageNodeId);
                return (
                  <Chip
                    key={`tag-chip-${tagName}`}
                    label={tagName}
                    size="small"
                    variant="outlined"
                    clickable={isClickable}
                    onClick={isClickable ? () => handleTagNavigate(tagName) : undefined}
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
            id="tree-node-edit-button"
            role="button"
          >
            {labels.editLabel}
          </Button>
          {isBuildable && currentNode?.nodeType !== 'location' && (
            <Button
              variant="outlined"
              startIcon={<ConstructionIcon />}
              onClick={handleBuild}
              aria-label={labels.buildAria}
              disabled={buildTargetLoading || isBuildRequired === false}
              id="tree-node-build-button"
              role="button"
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
            id="tree-node-preview-button"
            role="button"
          >
            {labels.previewLabel}
          </Button>
        </Stack>
      </Paper>

      <Dialog open={confirmArchiveOpen} onClose={handleArchiveCancel}>
        <DialogTitle>{labels.confirmArchiveTitle}</DialogTitle>
        <DialogContent>
          <Typography>{labels.confirmArchiveDescription}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleArchiveCancel}>{labels.confirmArchiveCancel}</Button>
          <Button onClick={handleArchiveConfirm} color="error" variant="contained">
            {labels.confirmArchiveConfirm}
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
        canImport={canCreate}
        canExport={canCreate}
        folderBuildReady={isFolderNode ? folderBuildReady : undefined}
        buildRequired={isBuildRequired && !isFolderNode}
        canArchive={canMutate && !isBuildRunning}
        canRemove={canMutate && !isBuildRunning}
        canBuild={isBuildable}
        canPreview={canPreview && !previewGuardLoading}
        openSteps={openSteps}
        openStepsLoading={openStepsLoading}
        onOpen={(options) => handleContextMenuTrigger('navigate', options)}
        onOpenFolder={(options) => handleContextMenuTrigger('navigate', options)}
        onOpenStep={(step: number, options) =>
          handleContextMenuTrigger(`open-step:${step}`, options)
        }
        onPreview={(options) => handleContextMenuTrigger('preview', options)}
        onBuild={(options) => handleContextMenuTrigger('build', options)}
        onEdit={(options) => handleContextMenuTrigger('edit', options)}
        onCreate={(type, options) => handleContextMenuTrigger(`create:${type}`, options)}
        onDuplicate={() => handleContextMenuTrigger('duplicate')}
        onCopy={() => handleContextMenuTrigger('copy')}
        onCut={() => handleContextMenuTrigger('cut')}
        onImport={() => handleContextMenuTrigger('import')}
        onExport={() => handleContextMenuTrigger('export')}
        onArchive={() => handleContextMenuTrigger('archive')}
        onRemove={() => handleContextMenuTrigger('archive')}
        onToggleVisible={(nextVisible) =>
          handleContextMenuTrigger('toggle-visibility', { nextVisible })
        }
      />
    </Box>
  );
}
