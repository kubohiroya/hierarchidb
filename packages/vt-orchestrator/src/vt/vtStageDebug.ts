export type VtDebugFocusConfig = {
  enabled: boolean;
  logAll: boolean;
  tileKeys: Set<string>;
  featureIds: Set<string>;
};

export type VtDebugFocusMatch = {
  shouldLog: boolean;
  tileMatched: boolean;
  featureMatched: boolean;
  matchedFeatureIds: string[];
};

export const VT_DEBUG_MATCHED_FEATURE_SAMPLE_LIMIT = 8;
export const GEOJSON_VT_EMPTY_TILE_LOG_SAMPLE_LIMIT = 20;

export const buildTileKey = (z: number, x: number, y: number): string => `${z}/${x}/${y}`;

export const normalizeStringTokens = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const normalized = new Set<string>();
  value.forEach((entry) => {
    if (typeof entry !== 'string') return;
    const token = entry.trim();
    if (token.length === 0) return;
    normalized.add(token);
  });
  return Array.from(normalized);
};

const normalizeTileKey = (value: string): string | null => {
  const match = value.match(/^(\d+)\/(\d+)\/(\d+)$/);
  if (!match) return null;
  const z = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (z < 0 || x < 0 || y < 0) return null;
  return buildTileKey(z, x, y);
};

export const resolveVtDebugFocusConfig = (value: unknown): VtDebugFocusConfig => {
  if (!value || typeof value !== 'object') {
    return {
      enabled: false,
      logAll: false,
      tileKeys: new Set<string>(),
      featureIds: new Set<string>(),
    };
  }
  const record = value as Record<string, unknown>;
  const enabled = record.enabled === true;
  const tileKeys = new Set<string>();
  normalizeStringTokens(record.tiles).forEach((tileKey) => {
    const normalized = normalizeTileKey(tileKey);
    if (normalized) tileKeys.add(normalized);
  });
  const featureIds = new Set<string>(normalizeStringTokens(record.features));
  const logAll = enabled && tileKeys.size === 0 && featureIds.size === 0;
  return { enabled, logAll, tileKeys, featureIds };
};

export const resolveVtDebugFocusMatch = (
  config: VtDebugFocusConfig,
  tileKey: string,
  featureIds: string[]
): VtDebugFocusMatch => {
  if (!config.enabled) {
    return {
      shouldLog: false,
      tileMatched: false,
      featureMatched: false,
      matchedFeatureIds: [],
    };
  }
  const tileMatched = config.tileKeys.size > 0 && config.tileKeys.has(tileKey);
  const matchedFeatureIds =
    config.featureIds.size > 0
      ? featureIds.filter((featureId) => config.featureIds.has(featureId))
      : [];
  const featureMatched = matchedFeatureIds.length > 0;
  const shouldLog = config.logAll || tileMatched || featureMatched;
  return {
    shouldLog,
    tileMatched,
    featureMatched,
    matchedFeatureIds: matchedFeatureIds.slice(0, VT_DEBUG_MATCHED_FEATURE_SAMPLE_LIMIT),
  };
};
