import React from 'react';
import { Snackbar, Alert } from '@mui/material';

type Detail = { source: 'worker' | 'ui'; at?: number; nodeTypes?: string[] };

export function ServicesReadySnackbar() {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<Detail | null>(null);

  React.useEffect(() => {
    const handler = (ev: Event) => {
      const d = (ev as CustomEvent<Detail>)?.detail || { source: 'worker' };
      setDetail(d);
      setOpen(true);
    };
    window.addEventListener('hdb-services-ready', handler as EventListener);
    return () => window.removeEventListener('hdb-services-ready', handler as EventListener);
  }, []);

  const message = React.useMemo(() => {
    if (!detail) return 'サービスの準備が完了しました。';
    const when = detail.at ? new Date(detail.at).toLocaleTimeString() : '';
    if (detail.source === 'worker') {
      return `Worker サービスの準備が完了しました。${when ? `(${when})` : ''}`;
    }
    const list = (detail.nodeTypes || []).join(', ');
    return list
      ? `サービスの事前接続が完了: ${list}`
      : `サービスの事前接続が完了しました。${when ? `(${when})` : ''}`;
  }, [detail]);

  return (
    <Snackbar open={open} autoHideDuration={3000} onClose={() => setOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="success" onClose={() => setOpen(false)} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
}

