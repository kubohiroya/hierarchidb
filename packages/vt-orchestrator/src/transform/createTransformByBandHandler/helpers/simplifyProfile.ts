import type { GeometryConfig, GeometrySimplifyToleranceByAdminLevelConfig } from '@hierarchidb/gis-sdk';

export type SimplifyToleranceProfile = {
  toleranceByBand: number[];
  retryToleranceByBand: number[];
  retryCount: number;
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
  const fallbackRetryCount = typeof geometryConfig.retryCount === 'number' && Number.isFinite(geometryConfig.retryCount)
    ? Math.max(0, Math.min(10, Math.round(geometryConfig.retryCount)))
    : 4;
  const fallbackToleranceByBand = Array.isArray(geometryConfig.toleranceByBand)
    ? geometryConfig.toleranceByBand
    : [];
  const fallbackRetryToleranceByBand = Array.isArray(geometryConfig.retryToleranceByBand)
    ? geometryConfig.retryToleranceByBand
    : [];

  const raw = config?.[key];
  const usePrevious = key !== 'admin0' && raw?.usePrevious === true;
  if (usePrevious && previous) {
    return previous;
  }

  const toleranceByBand = Array.isArray(raw?.toleranceByBand) && raw.toleranceByBand.length > 0
    ? raw.toleranceByBand
    : fallbackToleranceByBand;
  const retryToleranceByBand = Array.isArray(raw?.retryToleranceByBand) && raw.retryToleranceByBand.length > 0
    ? raw.retryToleranceByBand
    : fallbackRetryToleranceByBand;
  const retryCount = typeof raw?.retryCount === 'number' && Number.isFinite(raw.retryCount)
    ? Math.max(0, Math.min(10, Math.round(raw.retryCount)))
    : fallbackRetryCount;

  return {
    toleranceByBand,
    retryToleranceByBand,
    retryCount,
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
