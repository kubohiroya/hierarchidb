import type { Feature, FeatureCollection } from 'geojson';
import type { VTStageContext } from '~/contextTypes';
import type { InputFeatureStats } from './TILE_EMIT_PARENT_INPUT_SUMMARY_METADATA_KEY.js';
import type { CollectedFeatureSource } from './vtStageTaskTypes.js';
import {
  logCollectBuffersStart,
  logCollectSummary,
  logCollectCountDone,
  logCollectCountStart,
  logCollectRecordSnapshot,
} from './vtStageFeatureCollectorDebugUtils.js';
import { getCollectDebugSettings } from './vtStageFeatureCollectorDebugSettings.js';
import { executeFeatureCollectLoop } from './executeFeatureCollectLoop.js';
import { loadGeometryCacheRecordsForCollection } from './loadGeometryCacheRecordsForCollection.js';

type VtFeatureCollectorCoordinationInput = {
  context: VTStageContext;
  bufferIds: string[];
  nodeId: string;
  options?: {
    groupByContinent?: boolean;
    continentByCountry?: Map<string, string>;
  };
};

type VtFeatureCollectorCoordinationResult = {
  collection: FeatureCollection;
  featureStats: InputFeatureStats[];
  bufferSizes: Map<string, number>;
  featuresByContinent?: Map<string, Feature[]>;
  featureSources: Map<Feature, CollectedFeatureSource>;
};

export const runFeatureCollectionCoordinator = async (
  input: VtFeatureCollectorCoordinationInput,
): Promise<VtFeatureCollectorCoordinationResult | null> => {
  const {
    context,
    bufferIds,
    nodeId,
    options,
  } = input;

  const {
    debugCollect,
    testTimeoutMs,
    useBulkGet,
    useGetEach,
  } = getCollectDebugSettings();

  if (debugCollect) {
    const countStartedAt = logCollectCountStart(nodeId);
    logCollectBuffersStart({ nodeId, bufferCount: bufferIds.length, testTimeoutMs, useBulkGet });
    const count = await context.ephemeralDB.geometryCache.count();
    logCollectCountDone(nodeId, count, countStartedAt);
  }

  const records = await loadGeometryCacheRecordsForCollection({
    context,
    nodeId,
    bufferIds,
    useBulkGet,
    useGetEach,
    debugCollect,
    testTimeoutMs,
  });

  if (debugCollect) {
    logCollectRecordSnapshot(nodeId, records);
  }

  const {
    allFeatures: resolvedAllFeatures,
    featureStats: resolvedFeatureStats,
    bufferSizes: resolvedBufferSizes,
    featuresByContinent: resolvedFeaturesByContinent,
    featureSources: resolvedFeatureSources,
  } = await executeFeatureCollectLoop({
    context,
    nodeId,
    records,
    debugCollect,
    options,
  });

  if (debugCollect) {
    logCollectSummary(
      nodeId,
      resolvedAllFeatures.length,
      resolvedFeatureStats.length,
      resolvedBufferSizes.size,
    );
  }

  if (resolvedAllFeatures.length === 0) {
    return null;
  }

  return {
    collection: { type: 'FeatureCollection', features: resolvedAllFeatures },
    featureStats: resolvedFeatureStats,
    bufferSizes: resolvedBufferSizes,
    ...(resolvedFeaturesByContinent ? { featuresByContinent: resolvedFeaturesByContinent } : {}),
    featureSources: resolvedFeatureSources,
  };
};
