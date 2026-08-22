import { useTranslation } from '@hierarchidb/ui-i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BFF_WARNING_EVENT, type BffWarning, isBffWarning } from '~/services/BffWarning';

const buildDetailKey = (operation: BffWarning['operation']): string =>
  `auth.kvFallback.detail.${operation}`;

interface UseBffKvWarningDialogView {
  warning: BffWarning | null;
  detailText: string;
  handleClose: () => void;
}

export const useBffKvWarningDialogView = (): UseBffKvWarningDialogView => {
  const { t } = useTranslation('common');
  const [warning, setWarning] = useState<BffWarning | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!isBffWarning(detail)) return;
      setWarning(detail);
    };

    window.addEventListener(BFF_WARNING_EVENT, handler);
    return () => window.removeEventListener(BFF_WARNING_EVENT, handler);
  }, []);

  const detailText = useMemo(() => {
    if (!warning) return '';
    return t(buildDetailKey(warning.operation), '');
  }, [t, warning]);

  const handleClose = useCallback(() => {
    setWarning(null);
  }, []);

  return {
    warning,
    detailText,
    handleClose,
  };
};
