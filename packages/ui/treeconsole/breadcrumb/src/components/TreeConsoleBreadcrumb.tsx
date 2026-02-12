/**
 * TreeConsoleBreadcrumb -
 * eria-cartographTreeConsoleBreadcrumbUI
 */

import { rainbowColors } from '@hierarchidb/ui-theme';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { styled } from '@mui/material/styles';
import { Link as RouterLink } from '@tanstack/react-router';
import type { DragEvent, KeyboardEvent, MouseEvent, ReactElement } from 'react';
import type { BreadcrumbNode, TreeConsoleBreadcrumbProps } from '../types.js';
import type { BuildTreeConsoleLinkOptions } from '../utils/linkFactory.js';
import { buildTreeConsoleLinkHref } from '../utils/linkFactory.js';
import { getPluginIconColor, isFolderNodeType } from '../utils/nodeTypeIconColor.js';
import { useTreeConsoleBreadcrumb } from '../hooks/useTreeConsoleBreadcrumb.js';

const DRAGGED_NODE_MIME = 'text/hdb-node';
const DESCENDANT_MIME = 'application/hdb-node-descendants';

const parseDescendantPayload = (event: DragEvent<HTMLElement>): string[] => {
  const raw = event.dataTransfer?.getData(DESCENDANT_MIME);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const readDraggedNodeId = (event: DragEvent<HTMLElement>): string | null => {
  const value = event.dataTransfer?.getData(DRAGGED_NODE_MIME);
  return value ? String(value) : null;
};

/**
 * BreadcrumbContainer -
 */
const BreadcrumbContainer = styled(Box)<{ theme?: Theme }>`
  width: 100%;
  opacity: 1;
  height: 48px;
  min-height: 48px;
  max-height: 48px;
  overflow-y: hidden;
  overflow-x: auto;
  padding: 0;
  flex: 1;
  white-space: nowrap;
  /* Dark theme background */
  background-color: ${(props) => (props.theme?.palette?.mode === 'dark' ? '#181818' : 'transparent')};

  /* Custom scrollbar styling for horizontal scroll */

  &::-webkit-scrollbar {
    width: 0px;
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;

    &:hover {
      background-color: rgba(0, 0, 0, 0.3);
    }
  }

  /* Firefox scrollbar */
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) rgba(0, 0, 0, 0.05);

  & .MuiBreadcrumbs-root {
    font-size: 0.975rem;
    font-weight: bold;
    line-height: 1.5;
    white-space: nowrap;
  }

  & .MuiBreadcrumbs-ol {
    gap: 8px;
    line-height: 1.5;
    align-items: center;
    flex-wrap: nowrap;
    white-space: nowrap;
  }

  & .MuiBreadcrumbs-separator {
    font-size: 1.375rem;
    margin: 0 8px;
    line-height: 1.5;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }
`;

const BreadcrumbLink = styled(RouterLink, {
  shouldForwardProp: (prop) =>
    !['$isLast', '$outlined', '$outlineColor', '$blocked'].includes(prop as string),
})<{
  $isLast: boolean;
  $outlined: boolean;
  $outlineColor: string;
  $blocked: boolean;
}>(({ theme, $isLast, $outlined, $outlineColor, $blocked }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: $isLast ? '2px 8px' : '2px 6px',
  margin: '-2px -4px',
  borderRadius: 4,
  textDecoration: 'none',
  color: 'inherit',
  fontWeight: $isLast ? 700 : 500,
  fontSize: $isLast ? '0.975rem' : '0.9rem',
  lineHeight: 1.5,
  outline: $outlined ? $outlineColor : 'none',
  outlineOffset: '-2px',
  cursor: $blocked ? 'not-allowed' : 'pointer',
  transition: 'background-color 0.2s ease',
  '&:hover': {
    textDecoration: 'none',
    backgroundColor: theme.palette.action.hover,
  },
}));

type TreeConsoleBreadcrumbBaseProps = Omit<TreeConsoleBreadcrumbProps, 'renderer'>;

function TreeConsoleBreadcrumbBase(props: TreeConsoleBreadcrumbBaseProps): ReactElement | null {
  const {
    depthOffset: _depthOffset = 0,
    pageNodeId,
    onContextAction,
    leftSlot,
    treeId,
  } = props;

  const {
    pathToUse,
    iconInteractive,
    IconComponent,
    ContextMenuComponent,
    blockedDescendantMoveLabel,
    handleNodeClick,
    handleContextMenuOpen,
    handleContextMenuClose,
    openContextMenu,
    contextMenuAnchor,
    contextMenuNode,
    openSteps,
    openStepsLoading,
    confirmDialogOpen,
    setConfirmDialogOpen,
    handleConfirmTrash,
    handleCreate,
    handleEdit,
    handleDuplicate,
    handleCopy,
    handleCut,
    handleBuild,
    handleTrash,
    isRootContext,
    isNavigating,
    hoverId,
    setHoverId,
    hoverBlocked,
    setHoverBlocked,
    useTrashColumnsFlag,
    trashActionValue,
  } = useTreeConsoleBreadcrumb(props);
  const contextMenuNodeId = contextMenuNode?.id ?? contextMenuNode?.treeNodeId;
  const isTrashDisabledForContextNode = Boolean(
    contextMenuNodeId && props.trashDisabledNodeIds?.has(String(contextMenuNodeId))
  );
  const canTrashFromContextMenu = !isRootContext && !isTrashDisabledForContextNode;

  return (
    <>
      <BreadcrumbContainer>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            px: 2,
          }}
        >
          {leftSlot && (
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
              {leftSlot}
            </Box>
          )}
          {isNavigating && <CircularProgress size={20} sx={{ mr: 2 }} />}

          <Breadcrumbs
            separator={<NavigateNextIcon fontSize="small" />}
            aria-label="breadcrumb"
            sx={{ flex: 1 }}
          >
            {pathToUse.map((node, index) => {
              const isLast = index === pathToUse.length - 1;
              const nodeId = node.id ?? node.treeNodeId ?? '';
              const nodeIdString = nodeId != null ? String(nodeId) : '';
              const nodeName = node.name || 'Unknown';
              const isVisible = node.visible !== false;
              const explicitDepth = typeof node.depth === 'number' ? node.depth : undefined;
              const nodeWithAbsolute = node as BreadcrumbNode & { absoluteDepth?: number };
              const absoluteDepth =
                typeof nodeWithAbsolute.absoluteDepth === 'number'
                  ? nodeWithAbsolute.absoluteDepth
                  : explicitDepth;
              const fallbackDepth =
                typeof absoluteDepth === 'number'
                  ? Math.max(0, Math.round(absoluteDepth))
                  : Math.max(0, index + _depthOffset);
              const baseIconColor = rainbowColors[fallbackDepth % rainbowColors.length];
              const nodeType = nodeWithAbsolute.nodeType || nodeWithAbsolute.type || 'folder-plugin';
              const manifestIconColor = getPluginIconColor(nodeType);
              const iconColor = isFolderNodeType(nodeType)
                ? baseIconColor
                : (manifestIconColor ?? baseIconColor);
              const hasTreeId = Boolean(treeId);
              const isRootLike =
                index === 0 && (!node.parentId || (hasTreeId && nodeIdString === `${treeId}:root`));
              const linkOptions: BuildTreeConsoleLinkOptions = {
                treeId,
                nodeId: nodeIdString,
                pageNodeId,
                holderType: node.holderType as 'draft' | 'trash' | undefined,
                useTrashColumns: useTrashColumnsFlag,
                trashAction: trashActionValue,
                isRootLike,
              };

              const toHref = buildTreeConsoleLinkHref(linkOptions);

              const isClickable = node.isClickable !== false;
              const isOutline = hoverId === nodeIdString;
              const outlineColor = isOutline
                ? hoverBlocked
                  ? '2px dashed rgba(211,47,47,0.7)'
                  : '2px dashed rgba(25,118,210,0.6)'
                : 'none';

              const linkContent = (
                <>
                  <IconComponent
                    nodeType={nodeType}
                    size="small"
                    color="inherit"
                    htmlColor={iconColor}
                    clickable={iconInteractive}
                    onClick={
                      iconInteractive
                        ? (event: MouseEvent<HTMLElement>) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openContextMenu(node, event.currentTarget as HTMLElement);
                          }
                        : undefined
                    }
                  />
                  <Typography
                    component="span"
                    sx={{
                      fontWeight: isLast ? 700 : 500,
                      textDecoration: isVisible ? 'none' : 'line-through',
                    }}
                  >
                    {nodeName}
                  </Typography>
                </>
              );

              if (!isClickable) {
                return (
                  <Box key={nodeId} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {linkContent}
                  </Box>
                );
              }

              return (
                <BreadcrumbLink
                  key={nodeIdString}
                  to={toHref}
                  $isLast={isLast}
                  $outlined={isOutline}
                  $outlineColor={outlineColor}
                  $blocked={hoverId === nodeIdString && hoverBlocked}
                  aria-disabled={hoverId === nodeIdString && hoverBlocked ? true : undefined}
                  title={
                    hoverId === nodeIdString && hoverBlocked
                      ? blockedDescendantMoveLabel
                      : undefined
                  }
                  aria-haspopup="menu"
                  onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
                      handleContextMenuOpen(event, node);
                    }
                  }}
                  onDragOver={(event: DragEvent<HTMLElement>) => {
                    const types = event.dataTransfer?.types ?? [];
                    if (!types.includes(DRAGGED_NODE_MIME)) return;
                    const descendants = parseDescendantPayload(event);
                    const blocked = descendants.includes(nodeIdString);
                    setHoverId(nodeIdString);
                    setHoverBlocked(blocked);
                    if (!blocked) event.preventDefault();
                  }}
                  onDrop={(event: DragEvent<HTMLElement>) => {
                    const dragged = readDraggedNodeId(event);
                    const descendants = parseDescendantPayload(event);
                    const blocked = hoverBlocked || descendants.includes(nodeIdString);
                    if (dragged && nodeIdString && dragged !== nodeIdString && !blocked) {
                      props.onDropToNode?.(nodeIdString, dragged);
                    }
                    setHoverId(null);
                    setHoverBlocked(false);
                  }}
                  onDragLeave={() => {
                    setHoverId((id) => (id === nodeIdString ? null : id));
                    setHoverBlocked(false);
                  }}
                >
                  {linkContent}
                </BreadcrumbLink>
              );
            })}
          </Breadcrumbs>
        </Box>
      </BreadcrumbContainer>

      <ContextMenuComponent
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleContextMenuClose}
        nodeId={contextMenuNode?.id || contextMenuNode?.id || ''}
        nodeType={contextMenuNode?.nodeType || contextMenuNode?.type || 'folder-plugin'}
        nodeName={contextMenuNode?.name}
        treeId={props.treeId}
        isVisible={contextMenuNode?.visible !== false}
        canCreate={isFolderNodeType(contextMenuNode?.nodeType ?? contextMenuNode?.type)}
        canEdit={!isRootContext}
        canTrash={canTrashFromContextMenu}
        canRemove={canTrashFromContextMenu}
        canDuplicate={!isRootContext}
        canCopy={!isRootContext}
        canCut={!isRootContext}
        onCreate={handleCreate}
        onCopy={handleCopy}
        onCut={handleCut}
        onEdit={() => {
          if (!isRootContext) handleEdit();
          else handleContextMenuClose();
        }}
        onDuplicate={() => {
          if (!isRootContext) handleDuplicate();
          else handleContextMenuClose();
        }}
        onTrash={() => {
          if (canTrashFromContextMenu) handleTrash();
          else handleContextMenuClose();
        }}
        onRemove={() => {
          if (canTrashFromContextMenu) handleTrash();
          else handleContextMenuClose();
        }}
        onOpen={() =>
          handleNodeClick(contextMenuNode?.id || contextMenuNode?.id || '', contextMenuNode || undefined)
        }
        onOpenFolder={() =>
          handleNodeClick(contextMenuNode?.id || contextMenuNode?.id || '', contextMenuNode || undefined)
        }
        onOpenStep={(step) => {
          if (contextMenuNode && onContextAction) {
            onContextAction(`open-step:${step}`, contextMenuNode, { source: 'breadcrumb' });
          }
        }}
        openSteps={openSteps}
        openStepsLoading={openStepsLoading}
        onToggleVisible={(nextVisible) => {
          if (contextMenuNode && onContextAction) {
            onContextAction('toggle-visibility', contextMenuNode, { source: 'breadcrumb', nextVisible });
          }
        }}
        onPreview={() => {
          if (contextMenuNode && onContextAction) {
            onContextAction('preview', contextMenuNode, { source: 'breadcrumb' });
          }
          handleContextMenuClose();
        }}
        onBuild={() => {
          handleBuild();
          handleContextMenuClose();
        }}
      />

      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Move to Trash</DialogTitle>
        <DialogContent>
          <Typography>Move this item and all its children to trash?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmTrash} color="error" variant="contained">
            Move to Trash
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function TreeConsoleBreadcrumb(props: TreeConsoleBreadcrumbProps): ReactElement | null {
  const { renderer, ...baseProps } = props;

  if (renderer) {
    const defaultRenderer = () => <TreeConsoleBreadcrumbBase {...baseProps} />;
    const items = Array.isArray(baseProps.nodePath) ? baseProps.nodePath : [];
    return renderer({
      items,
      defaultRendererProps: baseProps,
      defaultRenderer,
    });
  }

  return <TreeConsoleBreadcrumbBase {...baseProps} />;
}
