import React from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';

type Detail = { source: 'worker' | 'ui'; at?: number; nodeTypes?: string[] };

const FALLBACK_MESSAGES = {
  default: 'Services are ready.',
  worker: 'Worker service is ready.',
  prefetch: 'Service preconnection is complete.',
  prefetchList: (list: string) => `Service preconnection complete: ${list}`,
};

export function ServicesReadySnackbar() {
  const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined' && !!document.body;

  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [, forceUpdate] = React.useReducer((c) => c + 1, 0);

  const { i18n } = useTranslation();

  React.useEffect(() => {
    const handler = () => forceUpdate();
    if (!i18n?.on) return;
    i18n.on('languageChanged', handler);
    return () => {
      i18n?.off?.('languageChanged', handler);
    };
  }, [i18n]);

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
    const locale = i18n?.language ?? 'en';
    const timeSuffix = detail?.at
      ? ` (${new Date(detail.at).toLocaleTimeString(locale)})`
      : '';

    const tr = (
      key: 'servicesReady.default' | 'servicesReady.worker' | 'servicesReady.prefetch' | 'servicesReady.prefetchList',
      fallback: string,
      params?: Record<string, unknown>,
    ): string => i18n?.t?.(key, { defaultValue: fallback, ...(params ?? {}) }) ?? fallback;

    if (!detail) {
      return tr('servicesReady.default', `${FALLBACK_MESSAGES.default}${timeSuffix}`, {
        time: timeSuffix,
      });
    }
    if (detail.source === 'worker') {
      return tr('servicesReady.worker', `${FALLBACK_MESSAGES.worker}${timeSuffix}`, {
        time: timeSuffix,
      });
    }
    const list = (detail.nodeTypes || []).join(', ');
    if (list) {
      return tr('servicesReady.prefetchList', FALLBACK_MESSAGES.prefetchList(list), {
        list,
      });
    }
    return tr('servicesReady.prefetch', `${FALLBACK_MESSAGES.prefetch}${timeSuffix}`, {
      time: timeSuffix,
    });
  }, [detail, i18n]);

  if (!hasDom) {
    return null;
  }

  return (
    <Snackbar open={open} autoHideDuration={3000} onClose={() => setOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="success" onClose={() => setOpen(false)} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
