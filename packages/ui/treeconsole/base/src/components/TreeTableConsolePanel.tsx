/**
 * TreeTableConsolePanel
 *
 * コンソール画面の中核コンポーネント。
 * ヘッダー/ツールバー/コンテンツ/フッター/アクションを統合し、
 * useTreeViewControllerでツリー状態とCRUD・D&Dを管理。
 *
 * 移植戦略：
 * 1. 基本構造とprops定義
 * 2. useTreeViewControllerの統合
 * 3. 子コンポーネントを段階的に追加
 * 4. 既存ロジックの移植
 */

// import React from 'react'; // Not needed with new JSX transform
import { Box } from '@mui/material';
import { useTreeViewController } from '../hooks/useTreeViewController';
import type { TreeViewController } from '../types/index';
import { TreeConsoleHeader } from './TreeConsoleHeader';
import { TreeConsoleContent } from './TreeConsoleContent';
import { TreeConsoleToolbar } from './TreeConsoleToolbar';
import { TreeConsoleFooter } from './TreeConsoleFooter';
import { TreeConsoleActions } from './TreeConsoleActions';
import type { TreeTableConsolePanelProps, NodeId } from '../types/index';

/**
 * TreeTableConsolePanel コンポーネント
 *
 * 現在は最小限の実装。実際の移植時に既存コードから段階的にコンポーネントを追加。
 */
export function TreeTableConsolePanel(props: TreeTableConsolePanelProps): React.JSX.Element {
  const {
    rootNodeId,
    nodeId,
    displayExpandedNode: _displayExpandedNode,
    close,
    initialRowSelection: _initialRowSelection,
    onRowSelectionChange: _onRowSelectionChange,
    enableRowSelection: _enableRowSelection,
    hideConsole,
    showSearchOnly,
    useTrashColumns,
    containerWidth,
    containerHeight,
    handleStartTour,
    footerHeight,
    mode,
    workerClient,
  } = props;

  // TreeViewController hook の使用
  const treeController = useTreeViewController({
    treeId: '', // TODO: Add treeId to props
    rootNodeId: rootNodeId,
    initialExpandedNodeIds: [], // TODO: 実装時に適切な初期値を設定
    workerClient, // Pass workerClient if provided
  });

  // TODO: 実装時に以下のコンポーネントを段階的に追加
  // - TreeConsoleHeader
  // - TreeConsoleToolbar
  // - TreeConsoleContent
  // - TreeConsoleFooter
  // - TreeConsoleActions
  // - エラーバウンダリー

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
      }}
    >
      {/* ヘッダーコンポーネント */}
      <Box sx={{ flexShrink: 0 }}>
        <TreeConsoleHeader
          title={`Tree Console - ${mode || 'Default'} Mode`}
          baseTitle="Tree Console"
          baseTitleSingular="Node"
          isShowingBranch={!hideConsole}
          isRootNode={rootNodeId === nodeId}
          currentNodeInfo={null} // TODO: 実装時に現在ノード情報を設定
          controller={treeController as TreeViewController}
          previousNodePath={[]} // TODO: 実装時にパス情報を設定
          isTrashPage={mode === 'restore' || mode === 'dispose'}
          isProjectsPage={false} // TODO: 実装時にページタイプを判定
          isResourcesPage={true} // TODO: 実装時にページタイプを判定
          currentNodeId={nodeId}
          onClose={close || (() => console.log('No close handler'))}
          canPreviewNode={false} // TODO: 実装時にプレビュー可能性を判定
          depthOffset={0} // TODO: 実装時に深度オフセットを設定
        />

        {/* デバッグ情報 */}
        <Box
          sx={{
            p: 1,
            backgroundColor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, fontSize: '0.8rem', color: 'text.secondary' }}>
            <span>Selected: {treeController.selectedNodes.length}</span>
            <span>Expanded: {treeController.expandedNodes.length}</span>
            <span>Loading: {treeController.isLoading ? 'Yes' : 'No'}</span>
          </Box>
        </Box>
      </Box>

      {/* ツールバー */}
      <TreeConsoleToolbar
        hideConsole={hideConsole || false}
        showSearchOnly={showSearchOnly || false}
        isProjectsPage={false} // TODO: 実装時にページタイプを判定
        isResourcesPage={true} // TODO: 実装時にページタイプを判定
        rootNodeId={rootNodeId}
        controller={treeController}
        hasTrashItems={mode === 'restore' || mode === 'dispose'} // TODO: 実装時に実際の判定ロジック
        hasChildren={treeController.expandedNodes.length > 0} // TODO: 実装時により正確な判定
      />

      {/* メインコンテンツ */}
      <TreeConsoleContent
        controller={treeController}
        isProjectsPage={false} // TODO: 実装時にページタイプを判定
        isResourcesPage={true} // TODO: 実装時にページタイプを判定
        viewHeight={containerHeight || 600}
        viewWidth={containerWidth || 800}
        useTrashColumns={useTrashColumns || false}
        depthOffset={0} // TODO: 実装時に深度オフセットを設定
        rootNodeId={rootNodeId}
        currentNodeInfo={null} // TODO: 実装時に現在ノード情報を設定
        onDragStateChange={(
          draggingNodeId: NodeId | undefined,
          descendantIdSet: Set<NodeId> | undefined
        ) => {
          console.log('Drag state change:', { draggingNodeId, descendantIdSet });
          // TODO: 実装時にドラッグ状態変更ハンドラーを追加
        }}
        canPreviewNode={false} // TODO: 実装時にプレビュー可能性を判定
        mode={mode}
      />

      {/* フッター */}
      <TreeConsoleFooter
        controller={treeController}
        onStartTour={handleStartTour}
        height={footerHeight || 32}
      />

      {/* アクションボタン */}
      <TreeConsoleActions
        isProjectsPage={false} // TODO: 実装時にページタイプを判定
        isResourcesPage={true} // TODO: 実装時にページタイプを判定
        isTrashPage={mode === 'restore' || mode === 'dispose'}
        speedDialActions={[
          // TODO: 実装時に実際のアクションを定義
          {
            name: 'フォルダ作成',
            icon: '📁',
            onClick: () => console.log('Create folder'),
          },
          {
            name: 'ファイル作成',
            icon: '📄',
            onClick: () => console.log('Create file'),
          },
        ]}
        onClose={close || (() => console.log('No close handler'))}
        backLink="/" // TODO: 実装時に適切なリンク
        rootNodeId={rootNodeId}
      />
    </Box>
  );
}
