import React from 'react';
import { Snackbar, Alert } from '@mui/material';
import { i18n } from '@hierarchidb/ui-i18n';

type Detail = { source: 'worker' | 'ui'; at?: number; nodeTypes?: string[] };

const FALLBACK_MESSAGES = {
  default: 'Services are ready.',
  worker: 'Worker service is ready.',
  prefetch: 'Service preconnection is complete.',
  prefetchList: (list: string) => `Service preconnection complete: ${list}`,
};

export function ServicesReadySnackbar() {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [, forceUpdate] = React.useReducer((c) => c + 1, 0);

  React.useEffect(() => {
    if (!i18n || typeof i18n.on !== 'function') return;
    const handler = () => forceUpdate();
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, []);

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
    const locale = i18n?.language || 'en';
    const timeSuffix = detail?.at
      ? ` (${new Date(detail.at).toLocaleTimeString(locale)})`
      : '';

    const translate = (key: string, params?: Record<string, unknown>) => {
      if (i18n?.t) {
        return i18n.t(key, params);
      }
      switch (key) {
        case 'servicesReady.worker':
          return `${FALLBACK_MESSAGES.worker}${params?.time ?? ''}`;
        case 'servicesReady.prefetchList':
          return FALLBACK_MESSAGES.prefetchList(String(params?.list ?? ''));
        case 'servicesReady.prefetch':
          return `${FALLBACK_MESSAGES.prefetch}${params?.time ?? ''}`;
        default:
          return `${FALLBACK_MESSAGES.default}${params?.time ?? ''}`;
      }
    };

    if (!detail) {
      return translate('servicesReady.default', { time: timeSuffix });
    }
    if (detail.source === 'worker') {
      return translate('servicesReady.worker', { time: timeSuffix });
    }
    const list = (detail.nodeTypes || []).join(', ');
    if (list) {
      return translate('servicesReady.prefetchList', { list });
    }
    return translate('servicesReady.prefetch', { time: timeSuffix });
  }, [detail]);

  return (
    <Snackbar open={open} autoHideDuration={3000} onClose={() => setOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="success" onClose={() => setOpen(false)} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
