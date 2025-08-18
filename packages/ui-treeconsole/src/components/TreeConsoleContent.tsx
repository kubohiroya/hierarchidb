/**
 * TreeConsoleContent
 * 
 * メインのツリーテーブル表示コンポーネント。
 * TanStack Table + Virtual を使用した高性能リスト表示。
 * 
 * 移植戦略：
 * 1. 基本構造（レイアウト・状態判定）
 * 2. TreeTableCore相当の仮実装
 * 3. 既存ロジックを段階的に移植
 * 4. D&D、仮想化、検索等の高度機能
 */

import React, { memo, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { TreeConsoleContentProps } from '~/types';

const StyledDialogContent = styled(Box)`
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 400px;
  overflow: hidden;
`;

const LoadingContainer = styled(Box)`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
`;

const EmptyStateContainer = styled(Box)`
  text-align: center;
  margin-top: 20px;
`;

const TableContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
`;

const StableContentContainer = styled(Box)`
  height: 100%;
  width: 100%;
  transition: opacity 0.2s ease-in-out;

  /* Prevent content from jumping during transitions */
  & > * {
    opacity: 1;
    transition: opacity 0.15s ease-in-out;
  }

  /* Smooth height transitions */
  min-height: 200px;
  display: flex;
  flex-direction: column;
`;

/**
 * TreeConsoleContentInner - メイン実装
 * 
 * 現在は最小限の実装。実際の移植時に既存コードから段階的に機能を追加。
 */
const TreeConsoleContentInner: React.FC<TreeConsoleContentProps> = ({
  controller,
  isProjectsPage,
  isResourcesPage,
  viewHeight,
  viewWidth,
  useTrashColumns: _useTrashColumns,
  depthOffset: _depthOffset,
  treeRootNodeId: _treeRootNodeId,
  currentNodeInfo: _currentNodeInfo,
  onDragStateChange: _onDragStateChange,
  canPreviewNode: _canPreviewNode = false,
  mode: _mode,
}) => {
  // const theme = useTheme(); // TODO: 実装時に使用
  const [isWebKit, setIsWebKit] = useState(false);
  const [webKitInitialized, setWebKitInitialized] = useState(false);

  // WebKit ブラウザ検出（Safari等での描画問題対応）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      const isWebKitBrowser =
        ua.includes('webkit') &&
        !ua.includes('chrome') &&
        !ua.includes('firefox');
      setIsWebKit(isWebKitBrowser);

      if (isWebKitBrowser) {
        const timer = setTimeout(() => {
          setWebKitInitialized(true);
        }, 500);
        return () => clearTimeout(timer);
      } else {
        setWebKitInitialized(true);
      }
    } else {
      setWebKitInitialized(true);
    }
  }, []);

  // レスポンシブレイアウト判定
  // const isWideScreen = useMediaQuery(theme.breakpoints.up('lg')); // TODO: 実装時に使用
  // const _isHorizontalLayout = isWideScreen && viewWidth > 1200; // TODO: 実装時に使用

  // ローディング状態判定
  const isLoading = !controller ||
    controller.isLoading ||
    (isWebKit && !webKitInitialized);

  // データ状態判定
  const hasMinimumData = controller && 
    controller.selectedNodes && 
    Array.isArray(controller.selectedNodes);

  // 空状態判定
  const isEmpty = controller &&
    !controller.isLoading &&
    controller.selectedNodes.length === 0;

  // 表示状態判定
  const contentState = (() => {
    if (isLoading) return 'loading';
    if (isEmpty) return 'empty';
    if (hasMinimumData) return 'table';
    return 'loading';
  })();

  // 空状態メッセージの生成
  const getEmptyMessage = () => {
    if (_mode === 'restore') {
      return 'ゴミ箱に復元可能なアイテムはありません。';
    }
    if (_mode === 'dispose') {
      return '完全削除可能なアイテムはありません。';
    }
    if (isProjectsPage) {
      return 'プロジェクトがありません。新しいプロジェクトを作成してください。';
    }
    if (isResourcesPage) {
      return 'リソースがありません。新しいリソースを作成してください。';
    }
    return 'データがありません。';
  };

  // TODO: 実装時に以下を段階的に追加
  // - TreeTableCore相当（TanStack Table + Virtual）
  // - NodeInfoDisplay（ノード詳細表示）
  // - DragDropConfigProvider（D&D対応）
  // - TreeTableFlashPrevention（表示フラッシュ防止）
  // - RowContextMenuMUI（コンテキストメニュー）
  // - Trash Bin対応
  // - エラーバウンダリー

  return (
    <StyledDialogContent
      sx={{
        height: viewHeight || '100%',
        width: viewWidth || '100%',
      }}
    >
      <StableContentContainer>
        {contentState === 'loading' && (
          <LoadingContainer>
            <CircularProgress size={40} />
            <Typography sx={{ ml: 2 }}>
              読み込み中...
            </Typography>
          </LoadingContainer>
        )}

        {contentState === 'empty' && (
          <EmptyStateContainer>
            <Typography variant="h6" color="text.secondary">
              {getEmptyMessage()}
            </Typography>
            
            {/* デバッグ情報（開発時のみ） */}
            <Box sx={{ mt: 2, p: 2, backgroundColor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Debug Info:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                <Typography variant="body2">
                  Tree Root: {_treeRootNodeId || 'Not specified'}
                </Typography>
                <Typography variant="body2">
                  Current Node: {_currentNodeInfo?.name || 'None'}
                </Typography>
                <Typography variant="body2">
                  Mode: {_mode || 'Default'}
                </Typography>
                <Typography variant="body2">
                  Controller: {controller ? 'Available' : 'Not available'}
                </Typography>
                <Typography variant="body2">
                  Selected: {controller?.selectedNodes?.length || 0} items
                </Typography>
              </Box>
            </Box>
          </EmptyStateContainer>
        )}

        {contentState === 'table' && (
          <TableContainer>
            {/* TreeTable プレースホルダー */}
            <Box sx={{ 
              flex: 1, 
              border: 1, 
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              backgroundColor: 'background.paper'
            }}>
              <Typography variant="h6" gutterBottom>
                TreeTable (placeholder)
              </Typography>
              
              {/* 基本操作テスト用 */}
              <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <button onClick={() => alert('Edit functionality placeholder')}>
                  Edit Selected
                </button>
                <button onClick={() => alert('Delete functionality placeholder')}>
                  Delete Selected
                </button>
                <button onClick={() => alert('Add New functionality placeholder')}>
                  Add New
                </button>
              </Box>

              {/* 選択状態表示 */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2">
                  選択中: {controller?.selectedNodes?.length || 0} / {controller?.expandedNodes?.length || 0} expanded
                </Typography>
                {(controller?.selectedNodes?.length || 0) > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Selected IDs: {controller?.selectedNodes?.join(', ') || ''}
                  </Typography>
                )}
              </Box>

              {/* プレースホルダーテーブル */}
              <Box sx={{ 
                height: Math.max(200, (viewHeight || 400) - 200),
                overflow: 'auto',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 1
              }}>
                <Typography variant="body2" color="text.secondary">
                  ここにTreeTableCoreが配置されます
                  <br />
                  • TanStack Table + TanStack Virtual
                  <br />
                  • Drag & Drop (@dnd-kit)
                  <br />
                  • 仮想スクロール (100+ items)
                  <br />
                  • コンテキストメニュー
                  <br />
                  • 検索・フィルタリング
                </Typography>
              </Box>
            </Box>
          </TableContainer>
        )}
      </StableContentContainer>
    </StyledDialogContent>
  );
};

TreeConsoleContentInner.displayName = 'TreeConsoleContentInner';

/**
 * TreeConsoleContent - memo化されたエクスポート
 */
export const TreeConsoleContent = memo(TreeConsoleContentInner);

TreeConsoleContent.displayName = 'TreeConsoleContent';