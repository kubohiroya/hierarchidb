import type { Feature, FeatureCollection } from 'geojson';

export const HDB_FEATURE_ID_KEY = '__hdbFeatureId';
export const HDB_ORIGIN_KEY = '__hdbOriginKey';

type FeatureIdContext = {
  countryCode?: string;
  adminLevel?: number;
};

const pickFirstString = (properties: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const pickCountryCode = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, ['ISO_A3', 'ISO3', 'ADM0_A3', 'countryCode', 'COUNTRY_CODE']);

const pickAdminCode = (properties: Record<string, unknown>): string | undefined =>
  pickFirstString(properties, ['GID_0', 'GID_1', 'GID_2', 'GID_3', 'shapeID', 'adminCode', 'code']);

const pickAdminLevel = (properties: Record<string, unknown>): number | undefined => {
  const candidates = [
    properties.adminLevel,
    properties.admin_level,
    properties.ADM_LEVEL,
    properties.level,
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const buildFeatureId = (
  base: string,
  index: number,
  countryCode?: string,
  adminLevel?: number,
  adminCode?: string,
): string => {
  const baseId = base.trim().length > 0 ? base.trim() : (adminCode ?? `feature-${index}`);
  const prefixParts = [
    countryCode,
    adminLevel != null ? `ADM${adminLevel}` : undefined,
    adminCode,
  ].filter(Boolean);
  const prefix = prefixParts.join('-');
  const composed = prefix ? `${prefix}:${baseId}` : baseId;
  return `${composed}:${index}`;
};

export const assignFeatureIds = (
  collection: FeatureCollection,
  context: FeatureIdContext = {},
): FeatureCollection => {
  collection.features.forEach((feature, index) => {
    if (!feature) return;
    const properties = (feature.properties ??= {});
    const existing = pickFirstString(properties, [HDB_FEATURE_ID_KEY, 'hdbFeatureId']);
    const baseId = String(properties.id ?? feature.id ?? `feature-${index}`);
    const countryCode = context.countryCode ?? pickCountryCode(properties);
    const adminLevel = context.adminLevel ?? pickAdminLevel(properties);
    const adminCode = pickAdminCode(properties);
    const featureId = existing ?? buildFeatureId(baseId, index, countryCode, adminLevel, adminCode);
    properties[HDB_FEATURE_ID_KEY] = featureId;
    properties.id = featureId;
    if (typeof feature.id !== 'string' && typeof feature.id !== 'number') {
      (feature as Feature).id = featureId;
    }
  });
  return collection;
};

export const applyOriginKey = (
  collection: FeatureCollection,
  originKey?: string,
): FeatureCollection => {
  if (!originKey) return collection;
  collection.features.forEach((feature) => {
    if (!feature) return;
    const properties = (feature.properties ??= {});
    if (typeof properties[HDB_ORIGIN_KEY] !== 'string' || !properties[HDB_ORIGIN_KEY]) {
      properties[HDB_ORIGIN_KEY] = originKey;
    }
  });
  return collection;
};
