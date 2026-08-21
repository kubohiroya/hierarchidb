import { geometryArea } from '@hierarchidb/gis-sdk';
import type { Feature, Geometry } from 'geojson';
import type { VTStageContext } from '~/contextTypes';
import {
  filterInvalidGeometryForTileEmit,
  type TileEmitInvalidGeometryFilterMetrics,
  type TileEmitInvalidGeometryFilterProgress,
} from './filterInvalidGeometryForTileEmit.js';
import type { InputFeatureStats } from './TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY.js';
import { resolveFeatureId } from './vtStageFeatureMetadataUtils.js';
import {
  countLineStringsFromGeometry,
  countPolygonsFromGeometry,
  countVerticesFromGeometry,
} from './vtStageGeometryCountsUtils.js';
import { featureBBox } from './vtStageGeometryFeature.js';
import type { CollectedFeatureSource, CollectedVtFeatures } from './vtStageTaskTypes.js';

export type FilteredCollectedVtFeatures = {
  collected: CollectedVtFeatures;
  metrics: TileEmitInvalidGeometryFilterMetrics;
};

export const buildTileEmitInvalidGeometryFilterTaskMetadata = (
  parentInputMetadata: Record<string, unknown>,
  metrics: TileEmitInvalidGeometryFilterMetrics
): Record<string, unknown> => ({
  ...parentInputMetadata,
  ...metrics,
  ...(metrics.invalidPolygonFilteredCount > 0 ? { resultSeverity: 'warning' } : {}),
});

const containsPolygon = (geometry: Geometry): boolean => {
  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') return true;
  if (geometry.type === 'GeometryCollection') return geometry.geometries.some(containsPolygon);
  return false;
};

const buildFeatureStats = (
  feature: Feature<Geometry>,
  source: CollectedFeatureSource,
  context: VTStageContext
): InputFeatureStats => {
  const bbox = featureBBox(feature);
  if (!bbox) throw new Error('[tileEmit] filtered feature must have a calculable bounding box');
  const featureAreaSqMeters = containsPolygon(feature.geometry)
    ? Math.abs(geometryArea(feature, context.geometryEngine))
    : undefined;
  if (featureAreaSqMeters !== undefined && !Number.isFinite(featureAreaSqMeters)) {
    throw new Error('[tileEmit] geometry area engine returned a non-finite feature area');
  }
  return {
    bbox,
    vertexCount: countVerticesFromGeometry(feature.geometry),
    polygonCount: countPolygonsFromGeometry(feature.geometry),
    lineStringCount: countLineStringsFromGeometry(feature.geometry),
    bufferId: source.bufferId,
    featureId: resolveFeatureId(feature),
    ...(source.geojsonByteSize !== undefined ? { geojsonByteSize: source.geojsonByteSize } : {}),
    ...(source.countryCode !== undefined ? { countryCode: source.countryCode } : {}),
    ...(featureAreaSqMeters !== undefined ? { featureAreaSqMeters } : {}),
  };
};

export const applyTileEmitInvalidGeometryFilter = async (
  collected: CollectedVtFeatures,
  context: VTStageContext,
  onProgress?: (progress: TileEmitInvalidGeometryFilterProgress) => Promise<void> | void
): Promise<FilteredCollectedVtFeatures> => {
  const result = await filterInvalidGeometryForTileEmit(collected.collection, {
    config: context.tileEmitConfig.invalidGeometryFilter,
    geometryEngine: context.geometryEngine,
    onProgress,
  });
  const featureStats: InputFeatureStats[] = [];
  const featureSources: CollectedVtFeatures['featureSources'] = new Map();
  const featuresByContinent = collected.featuresByContinent
    ? new Map<string, Feature[]>()
    : undefined;

  for (const entry of result.filteredFeatures) {
    const source = collected.featureSources.get(entry.sourceFeature);
    if (!source) throw new Error('[tileEmit] filtered feature source metadata is missing');
    featureSources.set(entry.feature, source);
    featureStats.push(buildFeatureStats(entry.feature, source, context));
    if (featuresByContinent) {
      if (!source.continentKey)
        throw new Error('[tileEmit] filtered feature continent grouping is missing');
      const group = featuresByContinent.get(source.continentKey);
      if (group) group.push(entry.feature);
      else featuresByContinent.set(source.continentKey, [entry.feature]);
    }
  }

  return {
    collected: {
      collection: result.collection,
      featureStats,
      bufferSizes: collected.bufferSizes,
      featureSources,
      ...(featuresByContinent ? { featuresByContinent } : {}),
    },
    metrics: result.metrics,
  };
};
