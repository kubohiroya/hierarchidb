import React from 'react';
import { Snackbar, Alert, AlertTitle } from '@mui/material';
import { CrossViewStyles } from '../sync/CrossViewStyles.js';

const logCrossViewSnackbarWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[CrossViewSnackbar]', message, error);
};

export function CrossViewSnackbar({ datasetId, autoHideDuration = 3000, format }: {
  datasetId: string;
  autoHideDuration?: number;
  format?: (ev: { source: 'row'|'feature'; id: string|number; data?: any }) => { title?: string; message?: string };
}) {
  const [open, setOpen] = React.useState(false);
  const [payload, setPayload] = React.useState<{ source:'row'|'feature'; id:string|number; data?:any }|null>(null);

  React.useEffect(() => {
    const unsub = CrossViewStyles.subscribeFocus(datasetId, (ev) => {
      if (ev) {
        setPayload({ source: ev.source, id: ev.id, data: ev.data });
        setOpen(true);
      } else {
        setOpen(false);
      }
    });
    return () => {
      try {
        unsub();
      } catch (error) {
        logCrossViewSnackbarWarning('Failed to unsubscribe focus listener', error);
      }
    };
  }, [datasetId]);

  const content = React.useMemo(() => {
    if (!payload) return { title: undefined, message: undefined };
    if (format) return format(payload);
    const name = payload.data?.name ?? payload.id;
    const type = payload.data?.type ?? payload.data?.nodeType;
    const desc = payload.data?.description;
    const coords = payload.data?.coordinates || payload.data?.point || payload.data?.center;
    const coordText = Array.isArray(coords) ? `(${coords[0]}, ${coords[1]})` : undefined;
    return {
      title: `[${payload.source}] ${type ?? ''}`.trim(),
      message: [name, desc, coordText].filter(Boolean).join(' / '),
    };
  }, [payload, format]);

  return (
    <Snackbar open={open} autoHideDuration={autoHideDuration} onClose={() => setOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="info" onClose={() => setOpen(false)} sx={{ width: '100%' }}>
        {content.title && <AlertTitle>{content.title}</AlertTitle>}
        {content.message || '選択中のアイテム'}
      </Alert>
    </Snackbar>
  );
}
