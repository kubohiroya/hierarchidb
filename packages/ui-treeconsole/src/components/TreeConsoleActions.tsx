/**
 * TreeConsoleActions
 * 
 * フローティングアクションボタン（FAB）を提供。
 * SpeedDial形式で新規作成やその他の操作を提供する。
 * 
 * 移植戦略：
 * 1. 基本的なFABとして実装
 * 2. SpeedDial風の展開メニュー（簡易版）
 * 3. 段階的に高度なSpeedDialコンポーネントに置き換え
 */

import { Fab, Box, Button, Tooltip } from '@mui/material';
import { Add, ArrowBack } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import type { TreeConsoleActionsProps } from '~/types';

const ActionsContainer = styled(Box)({
  position: 'fixed',
  bottom: 16,
  right: 16,
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  alignItems: 'flex-end',
});

/**
 * TreeConsoleActions コンポーネント
 */
export function TreeConsoleActions(props: TreeConsoleActionsProps): JSX.Element {
  const {
    isProjectsPage,
    isResourcesPage,
    isTrashPage,
    speedDialActions = [],
    speedDialIcon,
    onClose,
    closeLink: _closeLink,
    backLink,
    treeRootNodeId,
    backActionButton,
  } = props;

  // ページタイプによる色分け
  const getPageColor = () => {
    if (isTrashPage) return '#d32f2f'; // red
    if (isProjectsPage) return '#1976d2'; // blue
    if (isResourcesPage) return '#388e3c'; // green
    return '#666'; // default gray
  };

  const pageColor = getPageColor();

  // メインページでのみSpeedDialを表示
  if (isProjectsPage || isResourcesPage) {
    return (
      <ActionsContainer>
        {/* SpeedDial風の操作ボタン群（基本実装） */}
        {speedDialActions.length > 0 && (
          <>
            {/* TODO: 実装時に実際のSpeedDialアクションを展開 */}
            {speedDialActions.slice(0, 3).map((action, index) => (
              <Tooltip key={index} title={action.name} placement="left">
                <Fab
                  size="small"
                  onClick={action.onClick}
                  sx={{
                    backgroundColor: action.color || pageColor,
                    color: 'white',
                    '&:hover': {
                      backgroundColor: action.color || pageColor,
                      opacity: 0.8,
                    },
                  }}
                >
                  {action.icon}
                </Fab>
              </Tooltip>
            ))}
          </>
        )}

        {/* メインFABボタン */}
        <Tooltip title="新規作成" placement="left">
          <Fab
            color="primary"
            sx={{
              backgroundColor: pageColor,
              '&:hover': {
                backgroundColor: pageColor,
                opacity: 0.8,
              },
            }}
            onClick={() => {
              console.log('Main FAB clicked - TODO: implement SpeedDial');
              // TODO: 実装時にSpeedDial展開ロジック
            }}
          >
            {speedDialIcon || <Add />}
          </Fab>
        </Tooltip>

        {/* バックボタン（カスタムボタンがある場合） */}
        {backActionButton && (
          <Box sx={{ mt: 1 }}>
            {backActionButton}
          </Box>
        )}

        {/* デフォルトバックボタン */}
        {!backActionButton && (backLink || (onClose && typeof onClose === 'function')) && (
          <Tooltip title="戻る" placement="left">
            <Fab
              size="small"
              onClick={() => {
                if (typeof onClose === 'function') {
                  onClose();
                } else {
                  console.log('Navigate to:', backLink);
                  // TODO: 実装時にナビゲーション
                }
              }}
              sx={{
                backgroundColor: '#666',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#666',
                  opacity: 0.8,
                },
              }}
            >
              <ArrowBack />
            </Fab>
          </Tooltip>
        )}

        {/* デバッグ情報（開発時のみ） */}
        <Box
          sx={{
            position: 'absolute',
            bottom: -40,
            right: 0,
            fontSize: '0.7rem',
            color: 'text.secondary',
            backgroundColor: 'background.paper',
            p: 0.5,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <div>Actions: {speedDialActions.length}</div>
          <div>Tree: {treeRootNodeId?.slice(0, 8)}...</div>
          <div>Page: {isProjectsPage ? 'Projects' : isResourcesPage ? 'Resources' : 'Other'}</div>
        </Box>
      </ActionsContainer>
    );
  }

  // その他のページ（Trashページ等）では基本的なボタンのみ
  return (
    <ActionsContainer>
      {/* バックボタンのみ */}
      {backActionButton && (
        <Box>
          {backActionButton}
        </Box>
      )}

      {!backActionButton && (backLink || (onClose && typeof onClose === 'function')) && (
        <Button
          variant="contained"
          startIcon={<ArrowBack />}
          onClick={() => {
            if (typeof onClose === 'function') {
              onClose();
            } else {
              console.log('Navigate to:', backLink);
              // TODO: 実装時にナビゲーション
            }
          }}
          sx={{
            backgroundColor: pageColor,
            '&:hover': {
              backgroundColor: pageColor,
              opacity: 0.8,
            },
          }}
        >
          戻る
        </Button>
      )}
    </ActionsContainer>
  );
}