/**
  * TreeConsoleBreadcrumb -
  * eria-cartographTreeConsoleBreadcrumbUI
   */

import { type MouseEvent, useCallback, useState } from 'react';
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { MoreVert as MoreVertIcon, NavigateNext as NavigateNextIcon } from '@mui/icons-material';
import type { BreadcrumbNode, TreeConsoleBreadcrumbProps } from '../types';
import { NodeContextMenu } from './NodeContextMenu';
import { NodeTypeIcon } from './NodeTypeIcon';

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

/**
  * TreeConsoleBreadcrumb
 * TreeConsoleBreadcrumb
  */
export function TreeConsoleBreadcrumb(props: TreeConsoleBreadcrumbProps) {
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

  const handleContextMenuOpen = (event: MouseEvent<HTMLElement>, node: BreadcrumbNode) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuAnchor(event.currentTarget);
    setContextMenuNode(node);
  };

  const handleContextMenuClose = () => {
    setContextMenuAnchor(null);
    setContextMenuNode(null);
  };

  const handleCreate = (type: string) => {
    console.log(`Create ${type} under node:`, contextMenuNode?.id);
    // TODO: Connect to controller
  };

  const handleEdit = () => {
    console.log('Edit node:', contextMenuNode?.id);
    // TODO: Connect to controller
  };

  const handleDuplicate = () => {
    console.log('Duplicate node:', contextMenuNode?.id);
    // TODO: Connect to controller
  };

  const handleRemove = () => {
    if (contextMenuNode) {
      setPendingDeleteNodeId(contextMenuNode.id || contextMenuNode.id || '');
      setConfirmDialogOpen(true);
    }
  };

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

              if (isLast) {
                return (
                  <Typography
                    key={nodeId}
                    color="text.primary"
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
                    }}
                    aria-disabled={hoverId === nodeId && hoverBlocked ? true : undefined}
                    title={hoverId === nodeId && hoverBlocked ? '子孫に移動することはできません' : undefined}
                    onDragOver={(e) => {
                      if (e.dataTransfer?.types?.includes('text/hdb-node')) {
                        let blocked = false;
                        try {
                          const raw = e.dataTransfer?.getData('application/hdb-node-descendants');
                          if (raw) {
                            const list = JSON.parse(raw) as string[];
                            blocked = Array.isArray(list) && list.includes(String(nodeId));
                          }
                        } catch {}
                        setHoverId(String(nodeId));
                        setHoverBlocked(blocked);
                        if (!blocked) e.preventDefault();
                      }
                    }}
                    onDrop={(e) => {
                      try {
                        const dragged = e.dataTransfer?.getData('text/hdb-node');
                        let blocked = hoverBlocked;
                        try {
                          const raw = e.dataTransfer?.getData('application/hdb-node-descendants');
                          if (raw) {
                            const list = JSON.parse(raw) as string[];
                            blocked = Array.isArray(list) && list.includes(String(nodeId));
                          }
                        } catch {}
                        if (dragged && nodeId && dragged !== nodeId && !blocked) {
                          props.onDropToNode?.(String(nodeId), dragged);
                        }
                      } catch {}
                      setHoverId(null);
                      setHoverBlocked(false);
                    }}
                    onDragLeave={() => { setHoverId((id) => (id === nodeId ? null : id)); setHoverBlocked(false); }}
                  >
                    <IconComponent nodeType={node.nodeType || node.type || 'folder-plugin'} size="small" />
                    {nodeName}
                  </Typography>
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
                >
                  <Link
                    color="inherit"
                    onClick={() => handleNodeClick(nodeId, node)}
                    sx={{
                      display: 'flex',
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
                    onDragOver={(e) => {
                      if (e.dataTransfer?.types?.includes('text/hdb-node')) {
                        let blocked = false;
                        try {
                          const raw = e.dataTransfer?.getData('application/hdb-node-descendants');
                          if (raw) {
                            const list = JSON.parse(raw) as string[];
                            blocked = Array.isArray(list) && list.includes(String(nodeId));
                          }
                        } catch {}
                        setHoverId(String(nodeId));
                        setHoverBlocked(blocked);
                        if (!blocked) e.preventDefault();
                      }
                    }}
                    onDrop={(e) => {
                      try {
                        const dragged = e.dataTransfer?.getData('text/hdb-node');
                        let blocked = hoverBlocked;
                        try {
                          const raw = e.dataTransfer?.getData('application/hdb-node-descendants');
                          if (raw) {
                            const list = JSON.parse(raw) as string[];
                            blocked = Array.isArray(list) && list.includes(String(nodeId));
                          }
                        } catch {}
                        if (dragged && nodeId && dragged !== nodeId && !blocked) {
                          props.onDropToNode?.(String(nodeId), dragged);
                        }
                      } catch {}
                      setHoverId(null);
                      setHoverBlocked(false);
                    }}
                    onDragLeave={() => { setHoverId((id) => (id === nodeId ? null : id)); setHoverBlocked(false); }}
                  >
                    <IconComponent nodeType={node.nodeType || node.type || 'folder-plugin'} size="small" />
                    {nodeName}
                  </Link>
                  <IconButton
                    size="small"
                    onClick={(e) => handleContextMenuOpen(e, node)}
                    sx={{
                      padding: 0.25,
                      ml: 0.5,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
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
        canCreate={true}
        canEdit={true}
        canRemove={true}
        canDuplicate={true}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onRemove={handleRemove}
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
