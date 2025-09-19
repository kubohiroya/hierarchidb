/**
  * TreeConsoleActions -
  * eria-cartographTreeConsoleActionsUI
 * SpeedDialMenu
  */

import { DialogActions } from '@mui/material';
import type { TreeConsoleActionsProps } from '../types/index.js';
// import { getPageButtonColor } from '@hierarchidb/common-type'; // Function not found
// Deprecated: in-panel SpeedDial has been removed; host should provide its own create affordances.

/**
  * TreeConsoleActions
 * TreeConsoleActions
  */
export function TreeConsoleActions(_props: TreeConsoleActionsProps): React.JSX.Element {
  const {  } = _props; // all controls removed

  // const pageType = isProjectsPage ? 'projects' : isResourcesPage ? 'resources' : 'preview';
  // const buttonColor = getPageButtonColor(pageType); // Function not found
  // no-op

  // No local actions; SpeedDial removed.

  const backActionButton = null; // TODO: Implement back button logic

  return (
    <DialogActions sx={{ padding: 0, justifyContent: 'flex-end' }}>
      {backActionButton}
    </DialogActions>
  );
}
