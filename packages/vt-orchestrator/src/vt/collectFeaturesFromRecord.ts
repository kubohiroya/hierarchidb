import type { Feature } from 'geojson';
import { geometryArea, type EphemeralGeometryCacheRecord } from '@hierarchidb/gis-sdk';
import type { VTStageContext } from '~/contextTypes';
import type { InputFeatureStats } from './TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY.js';
import type { CollectedFeatureSource } from './vtStageTaskTypes.js';
import {
  featureBBox,
} from './vtStageGeometryFeature.js';
import {
  normalizeGeojsonByteSize,
  resolveFeatureId,
} from './vtStageFeatureMetadataUtils.js';
import {
  countLineStringsFromGeometry,
  countPolygonsFromGeometry,
  countVerticesFromGeometry,
} from './vtStageGeometryCountsUtils.js';
import {
  decodeGeometryStageCache,
  describeBuffer,
} from './vtStageFeatureSourceUtils.js';

type FeatureCollectorRecordContext = {
  context: VTStageContext;
  nodeId: string;
  bufferSizes: Map<string, number>;
  featureStats: InputFeatureStats[];
  allFeatures: Feature[];
  featuresByContinent?: Map<string, Feature[]>;
  featureSources: Map<Feature, CollectedFeatureSource>;
  continentByCountry?: Map<string, string>;
  debugCollect: boolean;
};

export const collectFeaturesFromRecord = async (
  input: FeatureCollectorRecordContext,
  record: EphemeralGeometryCacheRecord,
) => {
  const {
    nodeId,
    context,
    allFeatures,
    featureStats,
    bufferSizes,
    featuresByContinent,
    featureSources,
    continentByCountry,
    debugCollect,
  } = input;
  if (record.timestamp <= 0) {
    throw new Error(`[tileEmit] geometry cache record ${record.id} has an invalid timestamp`);
  }
  bufferSizes.set(record.id, record.data.byteLength);
  if (debugCollect) {
    console.info('[tileEmit][debug] record loop entry', JSON.stringify({
      nodeId,
      bufferId: record.id,
      byteLength: record.data.byteLength,
    }));
  }
  if (debugCollect) {
    console.info('[tileEmit][debug] decode start', JSON.stringify({
      nodeId,
      bufferId: record.id,
      byteLength: record.data.byteLength,
    }));
  }
  const collection = await decodeGeometryStageCache(record.data);
  if (debugCollect) {
    console.info('[tileEmit][debug] decode done', JSON.stringify({
      nodeId,
      bufferId: record.id,
      hasCollection: Boolean(collection),
      featureCount: collection?.features?.length ?? 0,
    }));
  }
  if (!collection) {
    const debug = describeBuffer(record.data);
    console.warn('[shape-tileEmit] failed to decode geometry cache for tileEmit stage', JSON.stringify({
      nodeId,
      bufferId: record.id,
      timestamp: record.timestamp,
      byteLength: debug.byteLength,
      headHex: debug.headHex,
      headAscii: debug.headAscii,
      jsonLike: debug.isJsonLike,
    }));
    throw new Error(`[tileEmit] failed to decode geometry cache record ${record.id}`);
  }
  const continentKey = featuresByContinent
    ? (() => {
      const rawCountry = record.countryCode ?? record.sourceKey?.split(':')[0] ?? '';
      const code = rawCountry.trim().toUpperCase();
      return (code ? continentByCountry?.get(code) : undefined) ?? 'Unknown';
    })()
    : null;

  collection.features.forEach((feature) => {
    allFeatures.push(feature);
    if (featuresByContinent && continentKey) {
      const bucket = featuresByContinent.get(continentKey);
      if (bucket) {
        bucket.push(feature);
      } else {
        featuresByContinent.set(continentKey, [feature]);
      }
    }
    const featureId = resolveFeatureId(feature);
    const geojsonByteSize = featureId
      ? normalizeGeojsonByteSize(context.featureGeojsonByteSizeById?.get(featureId))
      : undefined;
    const normalizedCountryCode = typeof record.countryCode === 'string'
      ? record.countryCode.trim().toUpperCase()
      : '';
    featureSources.set(feature, {
      bufferId: record.id,
      ...(normalizedCountryCode.length > 0 ? { countryCode: normalizedCountryCode } : {}),
      ...(geojsonByteSize !== undefined ? { geojsonByteSize } : {}),
      ...(continentKey ? { continentKey } : {}),
    });
    const bbox = featureBBox(feature);
    if (!bbox) return;
    const featureAreaSqMeters = (() => {
      if (!feature.geometry) return undefined;
      try {
        const area = Math.abs(geometryArea(feature, context.geometryEngine));
        return Number.isFinite(area) ? area : undefined;
      } catch {
        return undefined;
      }
    })();
    featureStats.push({
      bbox,
      vertexCount: countVerticesFromGeometry(feature.geometry),
      polygonCount: countPolygonsFromGeometry(feature.geometry),
      lineStringCount: countLineStringsFromGeometry(feature.geometry),
      bufferId: record.id,
      featureId,
      geojsonByteSize,
      countryCode: normalizedCountryCode.length > 0 ? normalizedCountryCode : undefined,
      featureAreaSqMeters,
    });
  });
};
