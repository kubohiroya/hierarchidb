/**
 * TreeConsoleActions - 元のデザインの忠実な再現
 *
 * 元のeria-cartographのTreeConsoleActionsのUIを正確に再現。
 * SpeedDialMenuを使用した右下のフローティングアクションボタン。
 */

import { DialogActions } from '@mui/material';
import {
  Add as AddIcon,
  CreateNewFolder as CreateFolderIcon,
  NoteAdd as NoteAddIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import type { TreeConsoleActionsProps, SpeedDialActionType } from '../types';
import { SpeedDialMenu } from './SpeedDialMenu';

/**
 * 既定のSpeedDialアクションを生成
 */
function getDefaultSpeedDialActions(): SpeedDialActionType[] {
  return [
    {
      icon: <CreateFolderIcon />,
      name: 'Create Folder',
      onClick: () => {
        console.log('Create folder - TODO: Connect to controller');
      },
    },
    {
      icon: <NoteAddIcon />,
      name: 'Create Note',
      onClick: () => {
        console.log('Create note - TODO: Connect to controller');
      },
    },
    {
      icon: <FileIcon />,
      name: 'Create File',
      onClick: () => {
        console.log('Create file - TODO: Connect to controller');
      },
    },
  ];
}

/**
 * TreeConsoleActions メインコンポーネント
 * 元のTreeConsoleActionsの構造を完全に再現
 */
export function TreeConsoleActions(props: TreeConsoleActionsProps): React.JSX.Element {
  const {
    isProjectsPage = false,
    isResourcesPage = false,
    speedDialActions,
    speedDialIcon,
    color,
    position = { bottom: 10, right: 10 },
    zIndex = 1000,
    direction = 'up',
    hidden = false,
    backActionButton,
  } = props;

  // SpeedDialのアクション定義（propsで渡されない場合はデフォルトを使用）
  const actions = speedDialActions || getDefaultSpeedDialActions();

  return (
    <DialogActions sx={{ padding: 0, justifyContent: 'flex-end' }}>
      {(isProjectsPage || isResourcesPage) && !hidden && (
        <SpeedDialMenu
          actions={actions}
          icon={speedDialIcon || <AddIcon />}
          tooltipTitle="Create new item"
          color={color}
          position={position}
          direction={direction}
          zIndex={zIndex}
          hidden={hidden}
        />
      )}
      {backActionButton}
    </DialogActions>
  );
}
