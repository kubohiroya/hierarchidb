import type { Feature, FeatureCollection } from 'geojson';
import type { VTStageContext } from '~/contexts';
import type { InputFeatureStats } from './vtStageGeometryTypes.js';
import {
  logCollectBuffersStart,
  logCollectSummary,
  logCollectCountDone,
  logCollectCountStart,
  logCollectRecordSnapshot,
} from './vtStageFeatureCollectorDebug.js';
import { getCollectDebugSettings } from './vtStageFeatureCollectorDebugSettings.js';
import { executeFeatureCollectLoop } from './vtStageFeatureCollectorFlow.js';
import { loadTransformCacheRecordsForCollection } from './vtStageFeatureCollectorLoad.js';

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
    const count = await context.ephemeralDB.transformCache.count();
    logCollectCountDone(nodeId, count, countStartedAt);
  }

  const records = await loadTransformCacheRecordsForCollection({
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
  };
};
