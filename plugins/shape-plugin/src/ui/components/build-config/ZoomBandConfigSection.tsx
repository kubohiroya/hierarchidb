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
  const multiplierFallback = 1;
  const minRatioFallback = 0;
  const maxRatioFallback = 3;
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
        const nextMultiplierByBand = resampleToleranceByBand(
          baseGeometryConfig.toleranceMultiplierByBand,
          baseGeometryConfig.zoomBandBoundaries,
          zoomBandBoundaries,
          multiplierFallback,
        );
        const nextMinRatioByBand = resampleToleranceByBand(
          baseGeometryConfig.toleranceMinRatioByBand,
          baseGeometryConfig.zoomBandBoundaries,
          zoomBandBoundaries,
          minRatioFallback,
        );
        const nextMaxRatioByBand = resampleToleranceByBand(
          baseGeometryConfig.toleranceMaxRatioByBand,
          baseGeometryConfig.zoomBandBoundaries,
          zoomBandBoundaries,
          maxRatioFallback,
        );
        const nextSimplifyToleranceByAdminLevel = simplifyToleranceByAdminLevel
          ? {
            admin0: {
              ...simplifyToleranceByAdminLevel.admin0,
              multiplierByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin0?.multiplierByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                multiplierFallback,
              ),
              minRatioByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin0?.minRatioByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                minRatioFallback,
              ),
              maxRatioByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin0?.maxRatioByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                maxRatioFallback,
              ),
            },
            admin1: {
              ...simplifyToleranceByAdminLevel.admin1,
              multiplierByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin1?.multiplierByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                multiplierFallback,
              ),
              minRatioByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin1?.minRatioByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                minRatioFallback,
              ),
              maxRatioByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin1?.maxRatioByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                maxRatioFallback,
              ),
            },
            admin2: {
              ...simplifyToleranceByAdminLevel.admin2,
              multiplierByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin2?.multiplierByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                multiplierFallback,
              ),
              minRatioByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin2?.minRatioByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                minRatioFallback,
              ),
              maxRatioByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin2?.maxRatioByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                maxRatioFallback,
              ),
            },
            admin3Plus: {
              ...simplifyToleranceByAdminLevel.admin3Plus,
              multiplierByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin3Plus?.multiplierByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                multiplierFallback,
              ),
              minRatioByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin3Plus?.minRatioByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                minRatioFallback,
              ),
              maxRatioByBand: resampleToleranceByBand(
                simplifyToleranceByAdminLevel.admin3Plus?.maxRatioByBand,
                baseGeometryConfig.zoomBandBoundaries,
                zoomBandBoundaries,
                maxRatioFallback,
              ),
            },
          }
          : undefined;
        update({
          geometryConfig: {
            toleranceByBand: nextToleranceByBand,
            toleranceMultiplierByBand: nextMultiplierByBand,
            toleranceMinRatioByBand: nextMinRatioByBand,
            toleranceMaxRatioByBand: nextMaxRatioByBand,
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
