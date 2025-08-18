/**
 * TreeConsoleBreadcrumb
 * 
 * 軽量なパンくずリストコンポーネント
 * - MUI Breadcrumbsをベースとした標準的な実装
 * - 外部のビジネスロジック依存を排除
 * - プレゼンテーション専用、シンプルな設計
 */

import { Breadcrumbs, Link, Typography, Box, IconButton, Tooltip } from '@mui/material';
import { Home, Folder, Description, MoreVert } from '@mui/icons-material';
import { MouseEvent, useCallback } from 'react';
import type { TreeConsoleBreadcrumbProps, TreeNodeWithChildren } from '~/types';
import type { TreeNodeId } from '@hierarchidb/core';

/**
 * ノードタイプに応じたアイコンを取得
 */
function getNodeIcon(node: TreeNodeWithChildren, showIcons?: boolean) {
  if (!showIcons) return null;
  
  // 簡素化されたアイコンマッピング
  const iconName = node.treeNodeType.toLowerCase();
  if (iconName.includes('root')) return <Home fontSize="small" />;
  if (iconName.includes('folder')) return <Folder fontSize="small" />;
  return <Description fontSize="small" />;
}

/**
 * ノード名の表示用テキストを取得
 */
function getNodeDisplayName(node: TreeNodeWithChildren): string {
  return node.name || `Node ${node.treeNodeId}`;
}

/**
 * TreeConsoleBreadcrumb コンポーネント
 */
export function TreeConsoleBreadcrumb(props: TreeConsoleBreadcrumbProps) {
  const {
    nodePath = [],
    currentNodeId,
    depthOffset = 0,
    context,
    onNodeClick,
    onNodeAction,
    variant = 'default',
    maxWidth = 800,
    showIcons = true,
  } = props;

  // ノードクリック処理
  const handleNodeClick = useCallback((event: MouseEvent, node: TreeNodeWithChildren) => {
    event.preventDefault();
    onNodeClick?.(node.treeNodeId, node);
  }, [onNodeClick]);

  // ノードアクション処理
  const handleNodeAction = useCallback((event: MouseEvent, nodeId: TreeNodeId) => {
    event.stopPropagation();
    // TODO: メニュー表示など、実装時に拡張
    console.log('Node action:', nodeId, onNodeAction);
  }, [onNodeAction]);

  // 表示用ノードパスを生成（深度オフセット適用）
  const displayPath = nodePath.slice(depthOffset);
  
  if (displayPath.length === 0) {
    return null;
  }

  // バリアント別のスタイル設定
  const getVariantStyles = () => {
    switch (variant) {
      case 'compact':
        return {
          fontSize: '0.8rem',
          '& .MuiBreadcrumbs-separator': { mx: 0.5 },
          '& .MuiBreadcrumbs-li': { minHeight: '24px' }
        };
      case 'minimal':
        return {
          fontSize: '0.75rem',
          '& .MuiBreadcrumbs-separator': { mx: 0.3 },
          '& .MuiBreadcrumbs-li': { minHeight: '20px' }
        };
      default:
        return {
          fontSize: '0.875rem',
          '& .MuiBreadcrumbs-separator': { mx: 1 },
          '& .MuiBreadcrumbs-li': { minHeight: '32px' }
        };
    }
  };

  return (
    <Box 
      sx={{
        width: '100%',
        maxWidth,
        overflowX: 'auto',
        overflowY: 'hidden',
        '&::-webkit-scrollbar': { height: 4 },
        '&::-webkit-scrollbar-thumb': { 
          backgroundColor: 'rgba(0,0,0,0.2)',
          borderRadius: 2,
        },
      }}
    >
      <Breadcrumbs
        separator="›"
        maxItems={variant === 'minimal' ? 3 : 5}
        sx={{
          ...getVariantStyles(),
          whiteSpace: 'nowrap',
          '& .MuiBreadcrumbs-ol': {
            flexWrap: 'nowrap',
          }
        }}
      >
        {displayPath.map((node, index) => {
          const isLast = index === displayPath.length - 1;
          const isCurrent = currentNodeId === node.treeNodeId;
          const icon = getNodeIcon(node, showIcons);
          const displayName = getNodeDisplayName(node);

          if (isLast || isCurrent) {
            // 最後のノード（現在のノード）は非クリッカブル
            return (
              <Typography
                key={node.treeNodeId}
                color="textPrimary"
                sx={{
                  fontWeight: isCurrent ? 'bold' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: context?.isTrashPage ? 'warning.main' : 'textPrimary'
                }}
              >
                {icon}
                {displayName}
                {onNodeAction && !isLast && (
                  <Tooltip title="ノードアクション">
                    <IconButton
                      size="small"
                      onClick={(e) => handleNodeAction(e, node.treeNodeId)}
                      sx={{ ml: 0.5, p: 0.25 }}
                    >
                      <MoreVert fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                )}
              </Typography>
            );
          }

          // クリッカブルなリンク
          return (
            <Link
              key={node.treeNodeId}
              component="button"
              color="inherit"
              onClick={(e) => handleNodeClick(e, node)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                  backgroundColor: 'action.hover',
                },
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                p: 0.25,
                borderRadius: 0.5,
              }}
            >
              {icon}
              {displayName}
              {onNodeAction && (
                <Tooltip title="ノードアクション">
                  <IconButton
                    size="small"
                    onClick={(e) => handleNodeAction(e, node.treeNodeId)}
                    sx={{ ml: 0.5, p: 0.25 }}
                  >
                    <MoreVert fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              )}
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
}