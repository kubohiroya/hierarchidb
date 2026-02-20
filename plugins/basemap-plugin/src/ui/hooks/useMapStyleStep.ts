import { useTranslation } from '@hierarchidb/ui-i18n';
import { useCallback, useMemo } from 'react';
import { BUILT_IN_STYLES } from '~/common/constants/builtInStyles';
import type { MapStyle } from '~/common/types/BaseMapEntity';

interface UseMapStyleStepArgs {
  value: MapStyle | undefined;
  onChange: (next: MapStyle) => void;
}

export const useMapStyleStep = ({ value, onChange }: UseMapStyleStepArgs) => {
  const { t } = useTranslation('basemap-plugin');
  const style = value?.style || '';
  const url = value?.customStyleUrl || '';

  const presets = useMemo(
    () =>
      (['streets', 'satellite', 'terrain', 'dark', 'light'] as const).map((key) => ({
        key,
        label: BUILT_IN_STYLES[key].name,
        description: BUILT_IN_STYLES[key].description,
      })),
    []
  );

  const selectPreset = useCallback(
    (_e: unknown, next: string | null) => {
      if (!next) return;
      onChange({
        ...(value || { style: next as MapStyle['style'] }),
        style: next as MapStyle['style'],
        customStyleUrl: undefined,
        customStyleConfig: undefined,
      });
    },
    [onChange, value]
  );

  const activateCustom = useCallback(() => {
    onChange({
      ...(value || { style: 'custom' }),
      style: 'custom',
    });
  }, [onChange, value]);

  const updateCustomUrl = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange({
        ...(value || { style: 'custom' }),
        style: 'custom',
        customStyleUrl: e.target.value,
      });
    },
    [onChange, value]
  );

  return {
    t,
    presets,
    style,
    url,
    selectPreset,
    activateCustom,
    updateCustomUrl,
  };
};
