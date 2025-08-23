/**
 * TreeConsoleBreadcrumb - 元のデザインの忠実な再現
 *
 * 元のeria-cartographのTreeConsoleBreadcrumbのUIを正確に再現。
 * パンくずナビゲーションの見た目とスタイルを完全に再現。
 */

import { useCallback, useState, type MouseEvent } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Breadcrumbs,
  Link,
  IconButton,
} from '@mui/material';
import styled from '@emotion/styled';
import type { Theme } from '@mui/material/styles';
import { NavigateNext as NavigateNextIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import type { TreeConsoleBreadcrumbProps, BreadcrumbNode } from '../types';
import { NodeContextMenu } from './NodeContextMenu';
import { NodeTypeIcon } from './NodeTypeIcon';


/**
 * BreadcrumbContainer - 元のスタイルを完全に再現
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
 * TreeConsoleBreadcrumb メインコンポーネント
 * 元のTreeConsoleBreadcrumbの構造とスタイルを完全に再現
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
  


  // コンテキストメニューの状態
  const [contextMenuAnchor, setContextMenuAnchor] = useState<HTMLElement | null>(null);
  const [contextMenuNode, setContextMenuNode] = useState<BreadcrumbNode | null>(null);

  // 削除確認ダイアログの状態
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(null);

  // ナビゲーション中のローディング状態
  const [isNavigating, _setIsNavigating] = useState(false);

  // 使用するパスを決定（元のロジックを再現）
  let pathToUse: BreadcrumbNode[] = [];

  if (nodePath && nodePath.length > 0) {
    // プロップスから渡されたパスを使用
    pathToUse = [...nodePath];
  } else {
    // ローディング状態で前のパスもない場合：ルートノードのみ表示
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

  // ノードクリックハンドラー
  const handleNodeClick = useCallback(
    (nodeId: string, node?: BreadcrumbNode) => {
      if (onNodeClick) {
        onNodeClick(nodeId, node);
      } else {
        console.log(`Navigate to node: ${nodeId} - TODO: Connect to controller`);
      }
    },
    [onNodeClick]
  );

  // 削除確認ダイアログの処理
  const handleConfirmDelete = useCallback(async () => {
    if (pendingDeleteNodeId) {
      console.log(`Delete node: ${pendingDeleteNodeId} - TODO: Connect to controller`);
    }
    setConfirmDialogOpen(false);
    setPendingDeleteNodeId(null);
  }, [pendingDeleteNodeId]);

  // コンテキストメニューのハンドラー
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

  // コンテキストメニューのアクションハンドラー
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
                // 最後のアイテムは現在位置（クリック不可）
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
                    }}
                  >
                    <IconComponent
                      nodeType={node.nodeType || node.type || 'folder'}
                      size="small"
                    />
                    {nodeName}
                  </Typography>
                );
              }

              // 通常のパンくずアイテム（クリック可能）
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
                    }}
                  >
                    <IconComponent
                      nodeType={node.nodeType || node.type || 'folder'}
                      size="small"
                    />
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

      {/* ノードコンテキストメニュー */}
      <ContextMenuComponent
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleContextMenuClose}
        nodeId={contextMenuNode?.id || contextMenuNode?.id || ''}
        nodeType={contextMenuNode?.nodeType || contextMenuNode?.type || 'folder'}
        nodeName={contextMenuNode?.name}
        canCreate={true}
        canEdit={true}
        canRemove={true}
        canDuplicate={true}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onRemove={handleRemove}
        onOpen={() => handleNodeClick(contextMenuNode?.id || contextMenuNode?.id || '', contextMenuNode || undefined)}
        onOpenFolder={() => handleNodeClick(contextMenuNode?.id || contextMenuNode?.id || '', contextMenuNode || undefined)}
        onCheckReference={() => console.log('Check reference:', contextMenuNode?.id)}
        onPreview={() => console.log('PreviewStep:', contextMenuNode?.id)}
      />

      {/* 削除確認ダイアログ */}
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
