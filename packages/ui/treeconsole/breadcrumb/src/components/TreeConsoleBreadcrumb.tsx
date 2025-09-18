/**
  * TreeConsoleBreadcrumb -
  * eria-cartographTreeConsoleBreadcrumbUI
   */

import { type MouseEvent, useCallback, useState, type ReactElement, type KeyboardEvent } from 'react';
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link as MUILink,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';
import type { BreadcrumbNode, TreeConsoleBreadcrumbProps } from '../types.js';
import { rainbowColors } from '@hierarchidb/ui-core';
import { NodeContextMenu } from './NodeContextMenu.js';
import { NodeTypeIcon } from './NodeTypeIcon.js';

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
  background-color: ${props => (props.theme?.palette?.mode === 'dark' ? '#181818' : 'transparent')};

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

  & .MuiLink-root {
    font-size: 0.975rem;
    font-weight: bold;
    padding: 2px 8px;
    margin: -2px -8px;
    border-radius: 4px;
    transition: background-color 0.2s ease;
    line-height: 1.5;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    text-decoration: none;
    color: inherit;

    &:hover {
      background-color: #f0f0f0;
      text-decoration: none;
    }
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

export function TreeConsoleBreadcrumb(props: TreeConsoleBreadcrumbProps): ReactElement | null {
  const {
    nodePath = [],
    currentNodeId: _currentNodeId,
    onNodeClick,
    variant: _variant = 'default',
    context = {},
    depthOffset: _depthOffset = 0,
    NodeTypeIcon: CustomNodeTypeIcon,
    NodeContextMenu: CustomNodeContextMenu,
  } = props;

  const { isTrashPage: _isTrashPage, isProjectsPage } = context;

  // Use custom containers if provided, otherwise use defaults
  const IconComponent = CustomNodeTypeIcon || NodeTypeIcon;
  const ContextMenuComponent = CustomNodeContextMenu || NodeContextMenu;

  const [contextMenuAnchor, setContextMenuAnchor] = useState<HTMLElement | null>(null);
  const [contextMenuNode, setContextMenuNode] = useState<BreadcrumbNode | null>(null);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(null);

  const [isNavigating, _setIsNavigating] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverBlocked, setHoverBlocked] = useState<boolean>(false);

  let pathToUse: BreadcrumbNode[] = [];

  if (nodePath && nodePath.length > 0) {
    pathToUse = [...nodePath];
  } else {
    const rootNodeName = isProjectsPage ? 'Projects' : 'Resources';
    pathToUse = [
      {
        id: isProjectsPage ? 'projects-root' : 'resources-root',
        nodeType: isProjectsPage ? 'ProjectsRoot' : 'ResourcesRoot',
        name: rootNodeName,
        parentId: null,
      },
    ];
  }

  const handleNodeClick = useCallback(
    (nodeId: string, node?: BreadcrumbNode) => {
      if (onNodeClick) {
        onNodeClick(nodeId, node);
      } else {
        console.log(`Navigate to node: ${nodeId} - TODO: Connect to controller`);
      }
    },
    [onNodeClick],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (pendingDeleteNodeId) {
      console.log(`Delete node: ${pendingDeleteNodeId} - TODO: Connect to controller`);
    }
    setConfirmDialogOpen(false);
    setPendingDeleteNodeId(null);
  }, [pendingDeleteNodeId]);

  const openContextMenu = (node: BreadcrumbNode, anchorEl: HTMLElement | null) => {
    if (!anchorEl) return;
    setContextMenuAnchor(anchorEl);
    setContextMenuNode(node);
  };

  const handleContextMenuOpen = (
    event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
    node: BreadcrumbNode,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const anchorEl = event.currentTarget as unknown as HTMLElement | null;
    openContextMenu(node, anchorEl);
  };

  const handleContextMenuClose = () => {
    setContextMenuAnchor(null);
    setContextMenuNode(null);
  };

  const handleCreate = (type: string) => {
    console.log(`TODO: Create ${type} under node:`, contextMenuNode?.id);
    // TODO: Connect to controller
  };

  const handleEdit = () => {
    console.log('TODO: Edit node:', contextMenuNode?.id);
    // TODO: Connect to controller
  };

  const handleDuplicate = () => {
    console.log('TODO: Duplicate node:', contextMenuNode?.id);
    // TODO: Connect to controller
  };

  const handleRemove = () => {
    if (contextMenuNode) {
      setPendingDeleteNodeId(contextMenuNode.id || contextMenuNode.id || '');
      setConfirmDialogOpen(true);
    }
  };

  const isRootContext = ((): boolean => {
    if (!contextMenuNode) return false;
    const first = pathToUse[0];
    return !!first && (String(first.id) === String(contextMenuNode.id || contextMenuNode.id));
  })();

  return (
    <>
      <BreadcrumbContainer>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            px: 2
          }}
        >
          {isNavigating && <CircularProgress size={20} sx={{ mr: 2 }} />}

          <Breadcrumbs
            separator={<NavigateNextIcon fontSize="small" />}
            aria-label="breadcrumb"
            sx={{ flex: 1 }}
          >
            {pathToUse.map((node, index) => {
              const isLast = index === pathToUse.length - 1;
              const nodeId = node.id || node.id || '';
              const nodeName = node.name || 'Unknown';
              const explicitDepth = typeof (node as any)?.depth === 'number' ? (node as any).depth : undefined;
              const depth = explicitDepth ?? Math.max(0, index + _depthOffset);
              const iconColor = rainbowColors[depth % rainbowColors.length];
              const treeId = (props as any)?.treeId as string | undefined;
              const isRootLike = index === 0 && (!!(node as any)?.parentId === false || (treeId && nodeId === `${treeId}:root`));
              const toHref = treeId ? (isRootLike ? `/t/${treeId}` : `/t/${treeId}/${String(nodeId)}`) : String(nodeId);

              if (isLast) {
                // 現在ページ（単一要素でルートの場合を含む）もリンク化し、右クリック新規タブを可能にする
                return (
                  <MUILink
                    key={nodeId}
                    component={RouterLink as any}
                    to={toHref}
                    color="inherit"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontWeight: 'bold',
                      fontSize: '0.975rem',
                      outline:
                        hoverId === nodeId
                          ? hoverBlocked
                            ? '2px dashed rgba(211,47,47,0.7)'
                            : '2px dashed rgba(25,118,210,0.6)'
                          : 'none',
                      outlineOffset: '-2px',
                      cursor: hoverId === nodeId && hoverBlocked ? 'not-allowed' : 'pointer',
                      textDecoration: 'none',
                    }}
                    aria-disabled={hoverId === nodeId && hoverBlocked ? true : undefined}
                    title={hoverId === nodeId && hoverBlocked ? '子孫に移動することはできません' : undefined}
                    aria-haspopup="menu"
                    onContextMenu={(event: MouseEvent<HTMLElement>) => handleContextMenuOpen(event, node)}
                    onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                      if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
                        handleContextMenuOpen(event, node);
                      }
                    }}
                    onDragOver={(e: any) => {
                      if (e.dataTransfer?.types?.includes('text/hdb-node')) {
                        let blocked = false;
                          const raw = e.dataTransfer?.getData('application/hdb-node-descendants');
                          if (raw) {
                            const list = JSON.parse(raw) as string[];
                            blocked = Array.isArray(list) && list.includes(String(nodeId));
                          }
                        setHoverId(String(nodeId));
                        setHoverBlocked(blocked);
                        if (!blocked) e.preventDefault();
                      }
                    }}
                    onDrop={(e: any) => {
                        const dragged = e.dataTransfer?.getData('text/hdb-node');
                        let blocked = hoverBlocked;
                          const raw = e.dataTransfer?.getData('application/hdb-node-descendants');
                          if (raw) {
                            const list = JSON.parse(raw) as string[];
                            blocked = Array.isArray(list) && list.includes(String(nodeId));
                          }
                        if (dragged && nodeId && dragged !== nodeId && !blocked) {
                          props.onDropToNode?.(String(nodeId), dragged);
                        }
                      setHoverId(null);
                      setHoverBlocked(false);
                    }}
                    onDragLeave={() => { setHoverId((id) => (id === nodeId ? null : id)); setHoverBlocked(false); }}
                  >
                    {/* Node icon for context; use context menu trigger to open actions */}
                    <IconComponent
                      nodeType={node.nodeType || node.type || 'folder-plugin'}
                      size="small"
                      color="inherit"
                      htmlColor={iconColor}
                      clickable
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openContextMenu(node, event.currentTarget as HTMLElement);
                      }}
                    />
                    {nodeName}
                  </MUILink>
                );
              }

              return (
                <Box
                  key={nodeId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                  onContextMenu={(event: MouseEvent<HTMLElement>) => handleContextMenuOpen(event, node)}
                >
                  {/* Node icon for context; right-click/keyboard context menu opens actions. */}
                  <IconComponent
                    nodeType={node.nodeType || node.type || 'folder-plugin'}
                    size="small"
                    color="inherit"
                    htmlColor={iconColor}
                    clickable
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openContextMenu(node, event.currentTarget as HTMLElement);
                    }}
                  />
                  <MUILink
                    color="inherit"
                    component={RouterLink as any}
                    to={toHref}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      outline:
                        hoverId === nodeId
                          ? hoverBlocked
                            ? '2px dashed rgba(211,47,47,0.7)'
                            : '2px dashed rgba(25,118,210,0.6)'
                          : 'none',
                      outlineOffset: '-2px',
                      cursor: hoverId === nodeId && hoverBlocked ? 'not-allowed' : 'pointer',
                    }}
                    aria-disabled={hoverId === nodeId && hoverBlocked ? true : undefined}
                    title={hoverId === nodeId && hoverBlocked ? '子孫に移動することはできません' : undefined}
                    aria-haspopup="menu"
                    onContextMenu={(event: MouseEvent<HTMLElement>) => handleContextMenuOpen(event, node)}
                    onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                      if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
                        handleContextMenuOpen(event, node);
                      }
                    }}
                    onDragOver={(e: any) => {
                      if (e.dataTransfer?.types?.includes('text/hdb-node')) {
                        let blocked = false;
                          const raw = e.dataTransfer?.getData('application/hdb-node-descendants');
                          if (raw) {
                            const list = JSON.parse(raw) as string[];
                            blocked = Array.isArray(list) && list.includes(String(nodeId));
                          }
                        setHoverId(String(nodeId));
                        setHoverBlocked(blocked);
                        if (!blocked) e.preventDefault();
                      }
                    }}
                    onDrop={(e: any) => {
                        const dragged = e.dataTransfer?.getData('text/hdb-node');
                        let blocked = hoverBlocked;
                          const raw = e.dataTransfer?.getData('application/hdb-node-descendants');
                          if (raw) {
                            const list = JSON.parse(raw) as string[];
                            blocked = Array.isArray(list) && list.includes(String(nodeId));
                          }
                        if (dragged && nodeId && dragged !== nodeId && !blocked) {
                          props.onDropToNode?.(String(nodeId), dragged);
                        }
                      setHoverId(null);
                      setHoverBlocked(false);
                    }}
                    onDragLeave={() => { setHoverId((id) => (id === nodeId ? null : id)); setHoverBlocked(false); }}
                  >
                    {nodeName}
                  </MUILink>
                </Box>
              );
            })}
          </Breadcrumbs>
        </Box>
      </BreadcrumbContainer>

      {/*
*/}
      <ContextMenuComponent
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleContextMenuClose}
        nodeId={contextMenuNode?.id || contextMenuNode?.id || ''}
        nodeType={contextMenuNode?.nodeType || contextMenuNode?.type || 'folder-plugin'}
        nodeName={contextMenuNode?.name}
        treeId={(props as any)?.treeId}
        canCreate={true}
        canEdit={!isRootContext}
        canRemove={!isRootContext}
        canDuplicate={!isRootContext}
        onCreate={handleCreate}
        onEdit={() => { if (!isRootContext) handleEdit(); else handleContextMenuClose(); }}
        onDuplicate={() => { if (!isRootContext) handleDuplicate(); else handleContextMenuClose(); }}
        onRemove={() => { if (!isRootContext) handleRemove(); else handleContextMenuClose(); }}
        onOpen={() =>
          handleNodeClick(
            contextMenuNode?.id || contextMenuNode?.id || '',
            contextMenuNode || undefined,
          )
        }
        onOpenFolder={() =>
          handleNodeClick(
            contextMenuNode?.id || contextMenuNode?.id || '',
            contextMenuNode || undefined,
          )
        }
        onCheckReference={() => console.log('Check reference:', contextMenuNode?.id)}
        onPreview={() => console.log('PreviewStep:', contextMenuNode?.id)}
      />

      {/*
*/}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this item and all its children?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
