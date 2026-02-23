import { ZoomBandConfigSection as SharedZoomBandConfigSection } from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '~/ui/i18n';
import { useTransformConfigSection } from '~/ui/hooks/useTransformConfigSection';
import type { ShapeBuildConfig } from '~/common/types/index';
import { resampleToleranceByBand } from '~/services/utils/toleranceByBand';

type Props = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
};

export const ZoomBandConfigSection: React.FC<Props> = ({
  config,
  disabled,
  onChange,
}) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, onChange });
  const toleranceFallback = 0.1;

  return (
    <SharedZoomBandConfigSection
      t={t}
      boundaries={baseTransformConfig.zoomBandBoundaries}
      onBoundariesChange={(zoomBandBoundaries: number[]) => {
        const nextToleranceByBand = resampleToleranceByBand(
          baseTransformConfig.toleranceByBand,
          baseTransformConfig.zoomBandBoundaries,
          zoomBandBoundaries,
          toleranceFallback,
        );
        update({
          transformConfig: {
            ...baseTransformConfig,
            toleranceByBand: nextToleranceByBand,
            zoomBandBoundaries,
          },
        });
      }}
      disabled={disabled}
    />
  );
};
