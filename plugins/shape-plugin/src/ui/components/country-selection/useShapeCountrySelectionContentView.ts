import { useMemo } from 'react';

type Args = {
  fetchedAt: string | number | undefined;
  t: (key: string, fallback: string) => string;
};

export const useShapeCountrySelectionContentView = ({ fetchedAt, t }: Args) => {
  const metadataReloadTooltip = useMemo(() => {
    if (!fetchedAt) {
      return t('countrySelection.reload', 'Reload');
    }
    try {
      const ts = new Date(fetchedAt);
      const iso = ts.toISOString().replace('T', ' ').slice(0, 16);
      return `Reload Metadata (Current: downloaded at ${iso})`;
    } catch {
      return t('countrySelection.reload', 'Reload');
    }
  }, [fetchedAt, t]);

  return {
    metadataReloadTooltip,
  };
};
