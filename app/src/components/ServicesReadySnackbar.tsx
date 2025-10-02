import React from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';

type Detail = { source: 'worker' | 'ui'; at?: number; nodeTypes?: string[] };

export function ServicesReadySnackbar() {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const { t } = useTranslation();

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
    const timeSuffix = detail?.at ? ` (${new Date(detail.at).toLocaleTimeString()})` : '';
    if (!detail) {
      return t('servicesReady.default', { time: timeSuffix });
    }
    if (detail.source === 'worker') {
      return t('servicesReady.worker', { time: timeSuffix });
    }
    const list = (detail.nodeTypes || []).join(', ');
    if (list) {
      return t('servicesReady.prefetchList', { list });
    }
    return t('servicesReady.prefetch', { time: timeSuffix });
  }, [detail, t]);

  return (
    <Snackbar open={open} autoHideDuration={3000} onClose={() => setOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="success" onClose={() => setOpen(false)} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
