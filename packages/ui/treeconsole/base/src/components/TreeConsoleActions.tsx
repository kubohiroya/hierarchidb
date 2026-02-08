/**
  * TreeConsoleActions -
  * eria-cartographTreeConsoleActionsUI
 * SpeedDialMenu
  */

import { DialogActions } from '@mui/material';
import type { TreeConsoleActionsProps } from '../types/index.js';
// import { getPageButtonColor } from '@hierarchidb/_obsolate_common-types'; // Function not found
// Deprecated: in-panel SpeedDial has been removed; host should provide its own create affordances.

/**
  * TreeConsoleActions
 * TreeConsoleActions
  */
export function TreeConsoleActions(_props: TreeConsoleActionsProps): React.JSX.Element {

  const backActionButton = null; // TODO: Implement back button logic

  return (
    <DialogActions sx={{ padding: 0, justifyContent: 'flex-end' }}>
      {backActionButton}
    </DialogActions>
  );
}
