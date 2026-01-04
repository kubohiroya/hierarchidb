import { bboxClip, bboxPolygon, booleanIntersects } from '@turf/turf';
import type { Feature, FeatureCollection, GeoJsonObject } from 'geojson';
import { tileBBox } from '../../../utils/tiles-util.js';
import { HDB_FEATURE_ID_KEY } from '../../utils/featureIds.js';

export function assembleTileGeoJSON(params: {
  z: number;
  x: number;
  y: number;
  collections: FeatureCollection[];
}): FeatureCollection {
  const { z, x, y, collections } = params;
  const bbox = tileBBox(z, x, y);
  const tilePoly = bboxPolygon(bbox);
  const features: Feature[] = [];
  const seen = new Set<string>();

  for (const collection of collections) {
    for (const feature of collection.features ?? []) {
      if (!feature) continue;
      const properties = feature.properties ?? {};
      const featureId = String(
        properties[HDB_FEATURE_ID_KEY]
        ?? feature.id
        ?? properties.id
        ?? '',
      );
      if (featureId) {
        if (seen.has(featureId)) continue;
        seen.add(featureId);
      }
      const candidate = feature as GeoJsonObject;
      if (!booleanIntersects(tilePoly, candidate)) continue;
      const clipped = bboxClip(candidate, bbox);
      if (clipped) {
        features.push(clipped as Feature);
      }
    }
  }

  return { type: 'FeatureCollection', features };
}
