/**
 * TreeConsoleToolbar
 * 
 * ツールバーコンポーネント。検索、フィルタリング、操作モードの切り替えを提供。
 * 
 * 移植戦略：
 * 1. 基本構造とレイアウトから開始
 * 2. 検索機能の基本実装
 * 3. 段階的に高度な機能を追加（TreeConsoleToolbarContent等）
 * 4. TrashManager等の特殊機能
 */

import { Box, TextField, FormControl, InputLabel, Select, MenuItem, Button } from '@mui/material';
// import { useTheme } from '@mui/material/styles'; // Removed - unused
import type { TreeConsoleToolbarProps } from '~/types';

/**
 * TreeConsoleToolbar コンポーネント
 * 
 * 現在は最小限の実装。実際の移植時に既存コードから段階的に機能を追加。
 */
export function TreeConsoleToolbar(props: TreeConsoleToolbarProps): JSX.Element | null {
  const {
    hideConsole,
    showSearchOnly,
    isProjectsPage,
    isResourcesPage,
    treeRootNodeId,
    controller,
    hasTrashItems = false,
    hasChildren = false,
  } = props;

  // const _theme = useTheme(); // Removed - unused

  // コンソールが非表示の場合は何も表示しない
  if (hideConsole) {
    return null;
  }

  // 検索のみモードの場合
  if (showSearchOnly) {
    return (
      <Box
        sx={{
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
        <TextField
          size="small"
          placeholder="検索..."
          value={controller?.searchText || ''}
          onChange={(e) => {
            if (controller?.handleSearchTextChange) {
              try {
                controller.handleSearchTextChange(e.target.value);
              } catch (error) {
                console.warn('Search functionality not implemented:', error);
                // 検索入力は受け付けるが、実際の検索は行わない
              }
            }
          }}
          sx={{ width: '100%' }}
        />
      </Box>
    );
  }

  // メイン・プロジェクト・リソースページの場合
  if (isProjectsPage || isResourcesPage) {
    return (
      <Box
        data-testid="tree-console-toolbar"
        sx={{
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* 検索フィールド */}
        <TextField
          size="small"
          placeholder="検索..."
          value={controller?.searchText || ''}
          onChange={(e) => {
            if (controller?.handleSearchTextChange) {
              try {
                controller.handleSearchTextChange(e.target.value);
              } catch (error) {
                console.warn('Search functionality not implemented:', error);
                // 検索入力は受け付けるが、実際の検索は行わない
              }
            }
          }}
          sx={{ minWidth: 200 }}
        />

        {/* 選択モード（プレースホルダー） */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>選択モード</InputLabel>
          <Select
            value={controller?.selectionMode || 'checkbox'}
            label="選択モード"
            onChange={() => {
              console.log('Selection mode change - TODO: implement');
            }}
          >
            <MenuItem value="checkbox">チェックボックス</MenuItem>
            <MenuItem value="radio">単一選択</MenuItem>
          </Select>
        </FormControl>

        {/* 行クリックアクション（プレースホルダー） */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>クリック操作</InputLabel>
          <Select
            value="Select"
            label="クリック操作"
            onChange={() => {
              console.log('Row click action change - TODO: implement');
            }}
          >
            <MenuItem value="Select">選択</MenuItem>
            <MenuItem value="Edit">編集</MenuItem>
            <MenuItem value="Navigate">ナビゲート</MenuItem>
          </Select>
        </FormControl>

        {/* 操作ボタン群 */}
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              console.log('Add new item - TODO: implement');
            }}
          >
            新規追加
          </Button>

          {hasTrashItems && (
            <>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={() => {
                  console.log('Open trash restore - TODO: implement');
                }}
              >
                復元
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => {
                  console.log('Open trash dispose - TODO: implement');
                }}
              >
                完全削除
              </Button>
            </>
          )}
        </Box>

        {/* デバッグ情報（開発時のみ） */}
        <Box sx={{ width: '100%', mt: 1 }}>
          <Box sx={{ display: 'flex', gap: 2, fontSize: '0.75rem', color: 'text.secondary' }}>
            <span>Tree: {treeRootNodeId || 'None'}</span>
            <span>Page: {isProjectsPage ? 'Projects' : isResourcesPage ? 'Resources' : 'Other'}</span>
            <span>Trash Items: {hasTrashItems ? 'Yes' : 'No'}</span>
            <span>Has Children: {hasChildren ? 'Yes' : 'No'}</span>
            <span>Controller: {controller ? 'Available' : 'None'}</span>
          </Box>
        </Box>
      </Box>
    );
  }

  // その他のケース（デフォルト表示なし）
  return null;
}