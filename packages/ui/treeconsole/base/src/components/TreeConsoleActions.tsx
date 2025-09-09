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
import type { TreeConsoleActionsProps } from '../types/index';
// import { getPageButtonColor } from '@hierarchidb/common-type'; // Function not found
import { SpeedDialMenu } from '@hierarchidb/ui-treeconsole-speeddial';

/**
  * TreeConsoleActions
 * TreeConsoleActions
  */
export function TreeConsoleActions(props: TreeConsoleActionsProps): React.JSX.Element {
  const { isProjectsPage, isResourcesPage, controller } = props;

  // const pageType = isProjectsPage ? 'projects' : isResourcesPage ? 'resources' : 'preview';
  // const buttonColor = getPageButtonColor(pageType); // Function not found
  const buttonColor = 'primary'; // fallback

  //  SpeedDial
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
