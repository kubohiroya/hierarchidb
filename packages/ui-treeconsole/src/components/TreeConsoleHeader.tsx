/**
 * TreeConsoleHeader
 * 
 * コンソールのヘッダーコンポーネント。
 * タイトル、パンくずリスト、アクションボタンを表示。
 * 
 * 移植戦略：
 * 1. 基本レイアウトとプロパティ受け渡し
 * 2. 既存スタイリングの再現
 * 3. 段階的に高度機能を追加
 */

// import React from 'react'; // Not needed with new JSX transform
import { Box, Typography } from '@mui/material';
import { TreeConsoleBreadcrumb } from './TreeConsoleBreadcrumb';
import type { TreeConsoleHeaderProps } from '~/types';

/**
 * TreeConsoleHeader コンポーネント
 * 
 * 現在は最小限の実装。実際の移植時に既存コードから段階的に機能を追加。
 */
export function TreeConsoleHeader(props: TreeConsoleHeaderProps): JSX.Element {
  const { 
    title, 
    baseTitle: _baseTitle,
    baseTitleSingular: _baseTitleSingular,
    isShowingBranch: _isShowingBranch,
    isRootNode: _isRootNode, 
    currentNodeInfo, 
    controller: _controller, 
    previousNodePath,
    isTrashPage, 
    isProjectsPage, 
    isResourcesPage,
    currentNodeId,
    onClose,
    canPreviewNode = false,
    depthOffset = 0
  } = props;

  // ページタイプ判定
  const pageType = isTrashPage ? 'trash' : 
                   isProjectsPage ? 'projects' : 
                   isResourcesPage ? 'resources' : 'default';
  
  // ページカラー
  const pageColor = isTrashPage ? '#d32f2f' :
                    isProjectsPage ? '#1976d2' :
                    isResourcesPage ? '#388e3c' : '#666';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      {/* 左側：タイトル・パンくずリスト */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {/* メインタイトル */}
        <Typography variant="h6" component="h1" noWrap>
          {title}
        </Typography>

        {/* パンくずリスト */}
        {previousNodePath.length > 0 && (
          <TreeConsoleBreadcrumb
            nodePath={previousNodePath}
            currentNodeId={currentNodeId}
            depthOffset={depthOffset}
            context={{
              isTrashPage,
              isProjectsPage,
              isResourcesPage,
            }}
            onNodeClick={(nodeId, node) => {
              console.log('Navigate to node:', nodeId, node);
              // TODO: 実装時にナビゲーション処理を追加
            }}
            variant="compact"
            showIcons={true}
            maxWidth={600}
          />
        )}

        {/* 現在のノード情報 */}
        {currentNodeInfo && (
          <Box sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Current: {currentNodeInfo.name} ({currentNodeInfo.type})
              {currentNodeInfo.hasChildren && ' - Has Children'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* 右側：アクションボタン群 */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {/* ページタイプ表示 */}
        <Typography variant="caption" sx={{ 
          px: 1, 
          py: 0.5, 
          backgroundColor: pageColor, 
          color: 'white',
          borderRadius: 1,
          textTransform: 'uppercase',
          fontSize: '0.7rem'
        }}>
          {pageType}
        </Typography>

        {/* トラッシュページ表示 */}
        {isTrashPage && (
          <Typography variant="caption" sx={{ 
            px: 1, 
            py: 0.5, 
            backgroundColor: '#d32f2f', 
            color: 'white',
            borderRadius: 1,
            fontSize: '0.7rem'
          }}>
            TRASH
          </Typography>
        )}

        {/* プレビューボタン（プレースホルダー） */}
        {canPreviewNode && currentNodeId && (
          <button
            onClick={() => console.log('Preview:', currentNodeId)}
            style={{
              padding: '4px 8px',
              backgroundColor: pageColor,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Preview
          </button>
        )}

        {/* 閉じるボタン */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: '4px 8px',
              backgroundColor: '#666',
              color: 'white',  
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        )}
      </Box>
    </Box>
  );
}