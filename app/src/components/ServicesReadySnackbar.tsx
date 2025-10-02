import React from 'react';
import { Snackbar, Alert } from '@mui/material';
import i18n from '@hierarchidb/ui-i18n';

type Detail = { source: 'worker' | 'ui'; at?: number; nodeTypes?: string[] };

export function ServicesReadySnackbar() {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [langVersion, setLangVersion] = React.useState(0);
  React.useEffect(() => {
    const handleLanguageChanged = () => setLangVersion((prev) => prev + 1);
    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
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
    const locale = i18n.language || (Array.isArray(i18n.options?.fallbackLng)
      ? i18n.options?.fallbackLng?.[0]
      : typeof i18n.options?.fallbackLng === 'string'
        ? i18n.options.fallbackLng
        : 'en');
    const timeSuffix = detail?.at
      ? ` (${new Date(detail.at).toLocaleTimeString(locale)})`
      : '';
    if (!detail) {
      return i18n.t('servicesReady.default', { time: timeSuffix });
    }
    if (detail.source === 'worker') {
      return i18n.t('servicesReady.worker', { time: timeSuffix });
    }
    const list = (detail.nodeTypes || []).join(', ');
    if (list) {
      return i18n.t('servicesReady.prefetchList', { list });
    }
    return i18n.t('servicesReady.prefetch', { time: timeSuffix });
  }, [detail, langVersion]);

  return (
    <Snackbar open={open} autoHideDuration={3000} onClose={() => setOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="success" onClose={() => setOpen(false)} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
