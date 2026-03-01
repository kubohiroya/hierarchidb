import { ZoomBandConfigSection as SharedZoomBandConfigSection } from '@hierarchidb/ui-accordion-config';
import { useTranslation } from '~/ui/i18n';
import { useGeometryConfigSection } from '~/ui/hooks/useGeometryConfigSection';
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
  const { baseGeometryConfig, update } = useGeometryConfigSection({ config, onChange });
  const toleranceFallback = 0.1;
  const simplifyToleranceByAdminLevel = baseGeometryConfig.simplifyToleranceByAdminLevel;

  return (
    <SharedZoomBandConfigSection
      t={t}
      boundaries={baseGeometryConfig.zoomBandBoundaries}
      onBoundariesChange={(zoomBandBoundaries: number[]) => {
        const nextToleranceByBand = resampleToleranceByBand(
          baseGeometryConfig.toleranceByBand,
          baseGeometryConfig.zoomBandBoundaries,
          zoomBandBoundaries,
          toleranceFallback,
        );
        const nextRetryToleranceByBand = resampleToleranceByBand(
          baseGeometryConfig.retryToleranceByBand,
          baseGeometryConfig.zoomBandBoundaries,
          zoomBandBoundaries,
          toleranceFallback,
        );
        const nextSimplifyToleranceByAdminLevel = simplifyToleranceByAdminLevel
          ? {
            admin0: {
              ...simplifyToleranceByAdminLevel.admin0,
              toleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin0?.toleranceByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
              retryToleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin0?.retryToleranceByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
            },
            admin1: {
              ...simplifyToleranceByAdminLevel.admin1,
              toleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin1?.toleranceByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
              retryToleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin1?.retryToleranceByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
            },
            admin2: {
              ...simplifyToleranceByAdminLevel.admin2,
              toleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin2?.toleranceByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
              retryToleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin2?.retryToleranceByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
            },
            admin3Plus: {
              ...simplifyToleranceByAdminLevel.admin3Plus,
              toleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin3Plus?.toleranceByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
              retryToleranceByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin3Plus?.retryToleranceByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                toleranceFallback,
              ),
            },
          }
          : undefined;
        update({
          geometryConfig: {
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
