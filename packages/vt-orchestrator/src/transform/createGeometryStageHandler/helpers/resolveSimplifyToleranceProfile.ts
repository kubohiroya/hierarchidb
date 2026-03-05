import type { GeometryConfig, GeometrySimplifyToleranceByAdminLevelConfig } from '@hierarchidb/gis-sdk';

export type SimplifyToleranceProfile = {
  multiplierByBand: number[];
  minRatioByBand: number[];
  maxRatioByBand: number[];
  toleranceSearchMaxIterations: number;
};

type SimplifyAdminLevelKey = 'admin0' | 'admin1' | 'admin2' | 'admin3Plus';

const resolveSimplifyAdminLevelKey = (adminLevel: number | undefined): SimplifyAdminLevelKey => {
  if (!Number.isFinite(adminLevel)) return 'admin0';
  if (adminLevel === 0) return 'admin0';
  if (adminLevel === 1) return 'admin1';
  if (adminLevel === 2) return 'admin2';
  return 'admin3Plus';
};

const resolveProfileByKey = (
  geometryConfig: GeometryConfig,
  config: GeometrySimplifyToleranceByAdminLevelConfig | undefined,
  key: SimplifyAdminLevelKey,
  previous: SimplifyToleranceProfile | null,
): SimplifyToleranceProfile => {
  const fallbackSearchIterations = typeof geometryConfig.toleranceSearchMaxIterations === 'number'
    && Number.isFinite(geometryConfig.toleranceSearchMaxIterations)
    ? Math.max(1, Math.min(64, Math.round(geometryConfig.toleranceSearchMaxIterations)))
    : 24;
  const fallbackMultiplierByBand = Array.isArray(geometryConfig.toleranceMultiplierByBand)
    ? geometryConfig.toleranceMultiplierByBand
    : [];
  const fallbackMinRatioByBand = Array.isArray(geometryConfig.toleranceMinRatioByBand)
    ? geometryConfig.toleranceMinRatioByBand
    : [];
  const fallbackMaxRatioByBand = Array.isArray(geometryConfig.toleranceMaxRatioByBand)
    ? geometryConfig.toleranceMaxRatioByBand
    : [];

  const raw = config?.[key];
  const usePrevious = key !== 'admin0' && raw?.usePrevious === true;
  if (usePrevious && previous) {
    return previous;
  }

  const multiplierByBand = Array.isArray(raw?.multiplierByBand) && raw.multiplierByBand.length > 0
    ? raw.multiplierByBand
    : (fallbackMultiplierByBand.length > 0
      ? fallbackMultiplierByBand
      : []);
  const minRatioByBand = Array.isArray(raw?.minRatioByBand) && raw.minRatioByBand.length > 0
    ? raw.minRatioByBand
    : (fallbackMinRatioByBand.length > 0
      ? fallbackMinRatioByBand
      : []);
  const maxRatioByBand = Array.isArray(raw?.maxRatioByBand) && raw.maxRatioByBand.length > 0
    ? raw.maxRatioByBand
    : (fallbackMaxRatioByBand.length > 0
      ? fallbackMaxRatioByBand
      : []);
  const toleranceSearchMaxIterations = typeof raw?.toleranceSearchMaxIterations === 'number'
    && Number.isFinite(raw.toleranceSearchMaxIterations)
    ? Math.max(1, Math.min(64, Math.round(raw.toleranceSearchMaxIterations)))
    : fallbackSearchIterations;

  return {
    multiplierByBand,
    minRatioByBand,
    maxRatioByBand,
    toleranceSearchMaxIterations,
  };
};

export const resolveSimplifyToleranceProfile = (
  geometryConfig: GeometryConfig,
  adminLevel: number | undefined,
): SimplifyToleranceProfile => {
  const simplifyToleranceByAdminLevel = geometryConfig.simplifyToleranceByAdminLevel;
  const admin0 = resolveProfileByKey(geometryConfig, simplifyToleranceByAdminLevel, 'admin0', null);
  const admin1 = resolveProfileByKey(geometryConfig, simplifyToleranceByAdminLevel, 'admin1', admin0);
  const admin2 = resolveProfileByKey(geometryConfig, simplifyToleranceByAdminLevel, 'admin2', admin1);
  const admin3Plus = resolveProfileByKey(geometryConfig, simplifyToleranceByAdminLevel, 'admin3Plus', admin2);
  const lookup: Record<SimplifyAdminLevelKey, SimplifyToleranceProfile> = {
    admin0,
    admin1,
    admin2,
    admin3Plus,
  };
  return lookup[resolveSimplifyAdminLevelKey(adminLevel)];
};
