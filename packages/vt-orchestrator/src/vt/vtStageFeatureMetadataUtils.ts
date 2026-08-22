import type { Feature, FeatureCollection, Geometry } from 'geojson';

export const resolveFeatureId = (feature: Feature): string | undefined => {
  const properties = feature.properties as Record<string, unknown> | undefined;
  const metadataFeatureId = properties?.__hdbFeatureId;
  if (typeof metadataFeatureId === 'string' && metadataFeatureId.trim().length > 0) {
    return metadataFeatureId;
  }
  if (typeof feature.id === 'string' && feature.id.trim().length > 0) {
    return feature.id;
  }
  if (typeof feature.id === 'number' && Number.isFinite(feature.id)) {
    return String(feature.id);
  }
  return undefined;
};

export const collectUniqueFeatureIds = (features: Feature<Geometry>[]): string[] => {
  const unique = new Set<string>();
  features.forEach((feature) => {
    const featureId = resolveFeatureId(feature);
    if (!featureId) return;
    unique.add(featureId);
  });
  return Array.from(unique);
};

export const normalizeGeojsonByteSize = (value: number | undefined): number | undefined =>
  typeof value !== 'number' || !Number.isFinite(value) ? undefined : Math.max(0, Math.round(value));

export const buildLayerMap = (collection: FeatureCollection): Map<string, Feature[]> => {
  const map = new Map<string, Feature[]>();
  for (const feature of collection.features) {
    if (!feature) continue;
    const props = feature.properties ?? {};
    const layer = typeof props.layer === 'string' ? props.layer : '0';
    const bucket = map.get(layer);
    if (bucket) {
      bucket.push(feature);
    } else {
      map.set(layer, [feature]);
    }
  }
  return map;
};
