import { useCallback, useMemo } from 'react';
import type React from 'react';
import type {
  DataSourceSelectionOption,
  DataSourceSelectionState,
} from './DataSourceSelectionStep.js';

interface UseDataSourceSelectionStepArgs<TAgreedAt> {
  options: DataSourceSelectionOption[];
  state: DataSourceSelectionState<TAgreedAt>;
  onChange: (next: Partial<DataSourceSelectionState<TAgreedAt>>) => void;
  createAgreedAt?: () => TAgreedAt;
  renderDetails?: (
    selected: DataSourceSelectionOption,
    context: {
      agreedAtIso?: string;
      onAgree: () => void;
      state: DataSourceSelectionState<TAgreedAt>;
    },
  ) => React.ReactNode | null | undefined;
}

export const useDataSourceSelectionStep = <TAgreedAt,>({
  options,
  state,
  onChange,
  createAgreedAt,
  renderDetails,
}: UseDataSourceSelectionStepArgs<TAgreedAt>) => {
  const fallbackValue = options[0]?.id ?? '';
  const value = state.dataSourceId ?? fallbackValue;
  const selected = options.find((option) => option.id === value);
  const agreedAtIso = state.licenseAgreedAt
    ? typeof state.licenseAgreedAt === 'number'
      ? new Date(state.licenseAgreedAt).toISOString()
      : String(state.licenseAgreedAt)
    : undefined;

  const handleSelect = useCallback((next: string) => {
    if (next === value) return;
    onChange({
      dataSourceId: next,
      licenseAgreement: false,
      licenseAgreedAt: undefined,
    });
  }, [onChange, value]);

  const handleAgree = useCallback(() => {
    const buildAgreedAt =
      createAgreedAt ??
      (() => new Date().toISOString() as TAgreedAt);
    if (selected?.licenseUrl) {
      window.open(selected.licenseUrl, '_blank', 'noopener,noreferrer');
    }
    onChange({
      licenseAgreement: true,
      licenseAgreedAt: buildAgreedAt(),
    });
  }, [createAgreedAt, onChange, selected?.licenseUrl]);

  const detailsContent = useMemo(() => (
    selected
      ? renderDetails?.(selected, { agreedAtIso, onAgree: handleAgree, state })
      : null
  ), [agreedAtIso, handleAgree, renderDetails, selected, state]);

  return {
    value,
    selected,
    agreedAtIso,
    handleSelect,
    handleAgree,
    detailsContent,
  };
};
