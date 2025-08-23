/**
 * TreeConsoleActions - 元のデザインの忠実な再現
 *
 * 元のeria-cartographのTreeConsoleActionsのUIを正確に再現。
 * SpeedDialMenuを使用した右下のフローティングアクションボタン。
 */

import { DialogActions, } from '@mui/material';
import {
  Add as AddIcon,
  CreateNewFolder as CreateFolderIcon,
  NoteAdd as NoteAddIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import type { TreeConsoleActionsProps } from '../types/index';
import { getPageButtonColor } from "@hierarchidb/00-core";
import {SpeedDialMenu} from '@hierarchidb/12-ui-treeconsole-speeddial';
/**
 * TreeConsoleActions メインコンポーネント
 * 元のTreeConsoleActionsの構造を完全に再現
 */
export function TreeConsoleActions(props: TreeConsoleActionsProps): React.JSX.Element {
  const { isProjectsPage, isResourcesPage, controller } = props;

  // ページタイプと色の決定
  const pageType = isProjectsPage ? 'projects' : isResourcesPage ? 'resources' : 'preview';
  const buttonColor = getPageButtonColor(pageType);

  // SpeedDialのアクション定義（ダミー実装）
  const speedDialActions = [
    {
      icon: <CreateFolderIcon />,
      name: 'Create Folder',
      onClick: () => {
        controller?.createNode?.('folder');
      },
    },
    {
      icon: <NoteAddIcon />,
      name: 'Create Note',
      onClick: () => {
        controller?.createNode?.('note');
      },
    },
    {
      icon: <FileIcon />,
      name: 'Create File',
      onClick: () => {
        controller?.createNode?.('file');
      },
    },
  ];

  // 戻るボタン（必要に応じて表示）
  const backActionButton = null; // TODO: Implement back button logic

  return (
    <DialogActions sx={{ padding: 0, justifyContent: 'flex-end' }}>
      {(isProjectsPage || isResourcesPage) && (
        <SpeedDialMenu
          actions={speedDialActions}
          icon={<AddIcon />}
          tooltipTitle="Create new item"
          color={buttonColor}
        />
      )}
      {backActionButton}
    </DialogActions>
  );
}
