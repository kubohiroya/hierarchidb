import { ZoomBandConfigSection as SharedZoomBandConfigSection } from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '~/ui/i18n';
import { useTransformConfigSection } from '~/ui/hooks/useTransformConfigSection';
import type { ShapeBuildConfig } from '~/common/types/index';
import { resampleToleranceByBand } from '~/services/utils/toleranceByBand';

type Props = {
  config: ShapeBuildConfig;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig | ((prev: ShapeBuildConfig) => ShapeBuildConfig)) => void;
  disableHoverLift?: boolean;
};

export const ZoomBandConfigSection: React.FC<Props> = ({
  config,
  disabled,
  onChange,
  disableHoverLift = false,
}) => {
  const { t } = useTranslation();
  const { baseTransformConfig, update } = useTransformConfigSection({ config, onChange });
  const toleranceFallback = 0.1;
  const simplifyToleranceByAdminLevel = baseTransformConfig.simplifyToleranceByAdminLevel;

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
        const nextRetryToleranceByBand = resampleToleranceByBand(
          baseTransformConfig.retryToleranceByBand,
          baseTransformConfig.zoomBandBoundaries,
          zoomBandBoundaries,
          toleranceFallback,
        );
        const nextSimplifyToleranceByAdminLevel = simplifyToleranceByAdminLevel
          ? {
            admin0: {
              ...simplifyToleranceByAdminLevel.admin0,
              toleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin0?.toleranceByBand,
                baseTransformConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
              retryToleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin0?.retryToleranceByBand,
                baseTransformConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
            },
            admin1: {
              ...simplifyToleranceByAdminLevel.admin1,
              toleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin1?.toleranceByBand,
                baseTransformConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
              retryToleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin1?.retryToleranceByBand,
                baseTransformConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
            },
            admin2: {
              ...simplifyToleranceByAdminLevel.admin2,
              toleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin2?.toleranceByBand,
                baseTransformConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
              retryToleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin2?.retryToleranceByBand,
                baseTransformConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
            },
            admin3Plus: {
              ...simplifyToleranceByAdminLevel.admin3Plus,
              toleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin3Plus?.toleranceByBand,
                baseTransformConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
              retryToleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin3Plus?.retryToleranceByBand,
                baseTransformConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
            },
          }
          : undefined;
        update({
          transformConfig: {
            toleranceByBand: nextToleranceByBand,
            retryToleranceByBand: nextRetryToleranceByBand,
            simplifyToleranceByAdminLevel: nextSimplifyToleranceByAdminLevel,
            zoomBandBoundaries,
          },
        });
      }}
      disabled={disabled}
      disableHoverLift={disableHoverLift}
    />
  );
};
