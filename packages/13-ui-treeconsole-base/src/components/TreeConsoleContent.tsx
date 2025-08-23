/**
 * TreeConsoleContent - 元のTreeTableCoreの忠実な再現
 *
 * メインのツリーテーブル表示コンポーネント。
 * TanStack Table + Virtual を使用した高性能リスト表示。
 *
 * 元のeria-cartographのTreeTableCoreを完全に再現。
 */

import React, { memo, useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { TreeConsoleContentProps } from '../types/index';
import { TreeTableCore } from './TreeTable/TreeTableCore';

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
`;

/**
 * TreeConsoleContent
 * 元のTreeTableCoreの構造に従って実装
 */
export const TreeConsoleContent: React.FC<TreeConsoleContentProps> = memo(
  ({
    controller,
    isProjectsPage,
    isResourcesPage,
    viewHeight,
    viewWidth,
    useTrashColumns,
    depthOffset: _depthOffset,
    rootNodeId: _treeRootNodeId,
    currentNodeInfo: _currentNodeInfo,
    onDragStateChange: _onDragStateChange,
    canPreviewNode: _canPreviewNode = false,
    mode: _mode,
  }) => {
    const [isWebKit, setIsWebKit] = useState(false);
    const [webKitInitialized, setWebKitInitialized] = useState(false);

    // WebKit ブラウザ検出（Safari等での描画問題対応）
    useEffect(() => {
      if (typeof window !== 'undefined') {
        const ua = window.navigator.userAgent.toLowerCase();
        const isWebKitBrowser =
          ua.includes('webkit') && !ua.includes('chrome') && !ua.includes('firefox');
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

    // ローディング状態判定
    const isLoading = !controller || controller.isLoading || (isWebKit && !webKitInitialized);

    // データ状態判定
    const hasMinimumData =
      controller && controller.selectedNodes && Array.isArray(controller.selectedNodes);

    // 空状態判定
    const isEmpty = controller && !controller.isLoading && controller.selectedNodes.length === 0;

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
              <Typography sx={{ ml: 2 }}>読み込み中...</Typography>
            </LoadingContainer>
          )}

          {contentState === 'empty' && (
            <EmptyStateContainer>
              <Typography variant="h6" color="text.secondary">
                {getEmptyMessage()}
              </Typography>
            </EmptyStateContainer>
          )}

          {contentState === 'table' && (
            <TableContainer>
              <TreeTableCore
                controller={controller}
                viewHeight={viewHeight || 400}
                viewWidth={viewWidth || 800}
                useTrashColumns={useTrashColumns}
                depthOffset={_depthOffset}
                disableDragAndDrop={false}
                hideDragHandler={false}
                onDragStateChange={_onDragStateChange}
                mode={_mode}
                isProjectsPage={isProjectsPage}
                isResourcesPage={isResourcesPage}
                rootNodeId={_treeRootNodeId}
              />
            </TableContainer>
          )}
        </StableContentContainer>
      </StyledDialogContent>
    );
  }
);

TreeConsoleContent.displayName = 'TreeConsoleContent';
