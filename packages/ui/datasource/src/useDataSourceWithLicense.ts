import { useCallback } from 'react';
import type {
  DataSourceWithLicenseOption,
  DataSourceWithLicenseState,
} from './DataSourceWithLicense.js';

interface UseDataSourceWithLicenseArgs<TAgreedAt> {
  options: DataSourceWithLicenseOption[];
  state: DataSourceWithLicenseState<TAgreedAt>;
  onChange: (next: Partial<DataSourceWithLicenseState<TAgreedAt>>) => void;
  createAgreedAt?: () => TAgreedAt;
}

export const useDataSourceWithLicense = <TAgreedAt>({
  options,
  state,
  onChange,
  createAgreedAt,
}: UseDataSourceWithLicenseArgs<TAgreedAt>) => {
  const fallbackValue = options[0]?.id ?? '';
  const value = state.dataSourceId ?? fallbackValue;
  const selected = options.find((option) => option.id === value);

  const agreedAtIso = state.licenseAgreedAt
    ? typeof state.licenseAgreedAt === 'number'
      ? new Date(state.licenseAgreedAt).toISOString()
      : String(state.licenseAgreedAt)
    : undefined;

  const handleSelect = useCallback(
    (next: string) => {
      if (next === value) return;
      onChange({
        dataSourceId: next,
        licenseAgreement: false,
        licenseAgreedAt: undefined,
      });
    },
    [onChange, value]
  );

  const handleAgree = useCallback(() => {
    const buildAgreedAt = createAgreedAt ?? (() => new Date().toISOString() as TAgreedAt);
    if (selected?.licenseUrl) {
      window.open(selected.licenseUrl, '_blank', 'noopener,noreferrer');
    }
    onChange({
      licenseAgreement: true,
      licenseAgreedAt: buildAgreedAt(),
    });
  }, [createAgreedAt, onChange, selected?.licenseUrl]);

  return {
    value,
    selected,
    agreedAtIso,
    handleSelect,
    handleAgree,
  };
};
