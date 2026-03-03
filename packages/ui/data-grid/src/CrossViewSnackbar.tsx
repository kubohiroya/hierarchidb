import { Snackbar, Alert, AlertTitle } from '@mui/material';
import { useCrossViewSnackbarView } from './useCrossViewSnackbarView.js';

export function CrossViewSnackbar({ datasetId, autoHideDuration = 3000, format }: {
  datasetId: string;
  autoHideDuration?: number;
  format?: (ev: { source: 'row'|'features'; id: string|number; data?: any }) => { title?: string; message?: string };
}) {
  const { open, setOpen, content } = useCrossViewSnackbarView({ datasetId, format });

  return (
    <Snackbar open={open} autoHideDuration={autoHideDuration} onClose={() => setOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="info" onClose={() => setOpen(false)} sx={{ width: '100%' }}>
        {content.title && <AlertTitle>{content.title}</AlertTitle>}
        {content.message || '選択中のアイテム'}
      </Alert>
    </Snackbar>
  );
}
