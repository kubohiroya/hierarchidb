import { DialogActions } from '@mui/material';
import type { TreeConsoleActionsProps } from '~/types/index';

export function TreeConsoleActions(_props: TreeConsoleActionsProps): React.JSX.Element {
  const backActionButton = null; // TODO: Implement back button logic

  return (
    <DialogActions sx={{ padding: 0, justifyContent: 'flex-end' }}>
      {backActionButton}
    </DialogActions>
  );
}
