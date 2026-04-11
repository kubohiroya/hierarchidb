import type {
  Feature,
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
} from 'geojson';
import { geometryBboxClip } from '@hierarchidb/gis-sdk';
import type { TileBBox } from './TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY.js';
import type { FeatureWithBBox } from './vtStageGeometryFeature.js';
import {
  isAnyPointInBBox,
  isClipGeometry,
  isEmptyGeometry,
  isPointGeometry,
} from './vtStageGeometryFeature.js';
import { bboxIntersects } from './vtStageGeometryTileUtils.js';

export const clipFeatureForTile = (feature: Feature<Geometry>, tileBBox: TileBBox): Feature<Geometry> | null => {
  const geometry = feature.geometry;
  if (!geometry) return null;
  if (isClipGeometry(geometry)) {
    return geometryBboxClip(
      feature as Feature<LineString | MultiLineString | Polygon | MultiPolygon>,
      [tileBBox.minX, tileBBox.minY, tileBBox.maxX, tileBBox.maxY],
      'turf',
    ) as Feature<Geometry>;
  }
  if (isPointGeometry(geometry) && isAnyPointInBBox(geometry, tileBBox)) {
    return feature;
  }
  return null;
};

export const clipFeaturesForTile = (
  featuresWithBBox: FeatureWithBBox[],
  tileBBox: TileBBox,
): Feature<Geometry>[] => {
  const clippedFeatures: Feature<Geometry>[] = [];
  for (const entry of featuresWithBBox) {
    if (!bboxIntersects(entry.bbox, tileBBox)) continue;
    const clipped = clipFeatureForTile(entry.feature, tileBBox);
    if (!clipped || isEmptyGeometry(clipped.geometry)) continue;
    clippedFeatures.push(clipped);
  }
  return clippedFeatures;
};
