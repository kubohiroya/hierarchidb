import type {
  MapLibreGeoJSONFeature,
  MapLibreMapInstance,
  MapLibreMapMouseEvent,
  MapLibrePoint,
} from '../types/maplibre-public';
import type {
  MapFeatureIdentifyConfig,
  MapFeatureIdentifier,
} from '../types/unified-map-props';

export const DEFAULT_IDENTIFY_RADIUS = 5;

const FALLBACK_ID_PROPERTY_KEYS = [
  'id',
  'ID',
  'Id',
  'feature_id',
  'featureId',
  'FEATURE_ID',
  'OBJECTID',
  'objectid',
];

export const defaultFeatureIdAccessor = (
  feature: MapLibreGeoJSONFeature | null | undefined,
): MapFeatureIdentifier | undefined => {
  if (!feature) return undefined;

  const { id, properties } = feature;
  if (typeof id === 'string' || typeof id === 'number') {
    return id as MapFeatureIdentifier;
  }

  if (properties) {
    for (const key of FALLBACK_ID_PROPERTY_KEYS) {
      const candidate = (properties as Record<string, unknown>)[key];
      if (typeof candidate === 'string' || typeof candidate === 'number') {
        return candidate as MapFeatureIdentifier;
      }
    }
  }

  return undefined;
};

const toQueryGeometry = (point: MapLibrePoint, radius: number) => {
  if (radius <= 0) {
    return point;
  }

  return [
    [point.x - radius, point.y - radius],
    [point.x + radius, point.y + radius],
  ] as const;
};

const pickQueriedFeatures = (
  map: MapLibreMapInstance | null,
  event: MapLibreMapMouseEvent,
  config: MapFeatureIdentifyConfig,
): MapLibreGeoJSONFeature[] | undefined => {
  if (!map || !event.point) {
    return undefined;
  }

  if (typeof (map as any).queryRenderedFeatures !== 'function') {
    return undefined;
  }

  const radius = typeof config.radius === 'number' && config.radius >= 0 ? config.radius : DEFAULT_IDENTIFY_RADIUS;

  try {
    const geometry = toQueryGeometry(event.point, radius);
    const options = config.layerIds || config.filter ? { layers: config.layerIds, filter: config.filter } : undefined;
    const result = (map as any).queryRenderedFeatures(geometry, options);
    return Array.isArray(result) ? (result as MapLibreGeoJSONFeature[]) : undefined;
  } catch (error) {
    console.warn('Map feature identification failed to query rendered features.', error);
    return undefined;
  }
};

const filterFeaturesByLayer = (
  features: MapLibreGeoJSONFeature[] | undefined,
  layerIds?: string[],
): MapLibreGeoJSONFeature[] => {
  if (!features || features.length === 0) {
    return [];
  }

  if (!layerIds || layerIds.length === 0) {
    return features.filter((feature): feature is MapLibreGeoJSONFeature => Boolean(feature));
  }

  const allowed = new Set(layerIds);
  return features.filter((feature): feature is MapLibreGeoJSONFeature => {
    if (!feature) return false;
    const layerId = feature.layer?.id;
    if (!layerId) return false;
    return allowed.has(layerId);
  });
};

const dedupeFeatures = (
  features: MapLibreGeoJSONFeature[],
  getFeatureId: (feature: MapLibreGeoJSONFeature) => MapFeatureIdentifier | null | undefined,
) => {
  const seenIds = new Set<MapFeatureIdentifier>();
  const dedupedFeatures: MapLibreGeoJSONFeature[] = [];
  const identifiers: MapFeatureIdentifier[] = [];

  for (const feature of features) {
    const identifier = getFeatureId(feature);
    if (identifier === null || identifier === undefined) {
      continue;
    }
    if (seenIds.has(identifier)) {
      continue;
    }

    seenIds.add(identifier);
    identifiers.push(identifier);
    dedupedFeatures.push(feature);
  }

  return { features: dedupedFeatures, featureIds: identifiers };
};

export interface MapFeatureIdentifyCandidates {
  features: MapLibreGeoJSONFeature[];
  featureIds: MapFeatureIdentifier[];
}

/**
 * Queries rendered features around the pointer and returns a deduplicated list of identifiers.
 * Falls back to the features bundled in the MapLibre click event when queries return nothing,
 * allowing the behaviour to work even for vector-tile layers without style references.
 */
export const resolveIdentifyCandidates = (
  map: MapLibreMapInstance | null,
  event: MapLibreMapMouseEvent,
  config: MapFeatureIdentifyConfig,
): MapFeatureIdentifyCandidates => {
  const queriedFeatures = pickQueriedFeatures(map, event, config);

  const includeEventFeatures = config.includeEventFeatures ?? true;
  const combinedFeatures =
    queriedFeatures && queriedFeatures.length > 0
      ? queriedFeatures
      : includeEventFeatures && Array.isArray(event.features)
        ? (event.features as MapLibreGeoJSONFeature[])
        : [];

  const filteredFeatures = filterFeaturesByLayer(combinedFeatures, config.layerIds);
  const getFeatureId = config.getFeatureId ?? defaultFeatureIdAccessor;

  return dedupeFeatures(filteredFeatures, getFeatureId);
};
