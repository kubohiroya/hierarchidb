import type { I18nInstance } from '@hierarchidb/ui-i18n';
import { useEffect, useState } from 'react';

export function useI18nReadyVersion(i18n: I18nInstance): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => {
      setVersion((current) => current + 1);
    };

    i18n.on('initialized', bump);
    i18n.on('loaded', bump);

    return () => {
      i18n.off('initialized', bump);
      i18n.off('loaded', bump);
    };
  }, [i18n]);

  return version;
}
