/**
  * TreeConsoleActions -
  * eria-cartographTreeConsoleActionsUI
 * SpeedDialMenu
  */

import { DialogActions } from '@mui/material';
import {
  Add as AddIcon,
  CreateNewFolder as CreateFolderIcon,
  InsertDriveFile as FileIcon,
  NoteAdd as NoteAddIcon,
} from '@mui/icons-material';
import type { SpeedDialActionType, TreeConsoleActionsProps } from '../types';
import { SpeedDialMenu } from './SpeedDialMenu';

/**
  * SpeedDial
  */
function getDefaultSpeedDialActions(): SpeedDialActionType[] {
  return [
    {
      icon: <CreateFolderIcon />,
      name: 'Create Folder',
      onClick: () => {
        console.log('Create folder-plugin - TODO: Connect to controller');
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
  * TreeConsoleActions
 * TreeConsoleActions
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

  //  SpeedDialprops
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
