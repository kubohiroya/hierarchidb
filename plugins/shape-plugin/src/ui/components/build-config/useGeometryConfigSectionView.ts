import { useTranslation } from '@hierarchidb/ui-i18n';
import { type ChangeEvent, useCallback } from 'react';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';

type Args = {
  simplifyAlgorithm: 'geojson' | 'topojson';
  preserveTopology: boolean;
  update: (partial: Partial<ShapeBuildConfig['geometryConfig']>) => void;
};

export const useGeometryConfigSectionView = ({
  simplifyAlgorithm,
  preserveTopology,
  update,
}: Args) => {
  const { t } = useTranslation('shape-plugin');

  const summaryHelp =
    simplifyAlgorithm === 'topojson'
      ? t(
          'processing.geometry.summaryHelpTopojson',
          'Geometry uses topojson simplify first, then runs topology repair checks.'
        )
      : t(
          'processing.geometry.summaryHelpGeojson',
          'Geometry runs turf.simplify with the configured tolerance.'
        );

  const updateGeometryConfig = useCallback(
    (partial: Partial<ShapeBuildConfig['geometryConfig']>) => update(partial),
    [update]
  );

  const handleSimplifyAlgorithmChange = useCallback(
    (_event: unknown, value: string) => {
      if (value !== 'geojson' && value !== 'topojson') return;
      updateGeometryConfig({ simplifyAlgorithm: value });
    },
    [updateGeometryConfig]
  );

  const handlePreserveTopologyChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateGeometryConfig({ preserveTopology: event.target.checked });
    },
    [updateGeometryConfig]
  );

  return {
    preserveTopology,
    simplifyAlgorithm,
    summaryHelp,
    handleSimplifyAlgorithmChange,
    handlePreserveTopologyChange,
    t,
  };
};
