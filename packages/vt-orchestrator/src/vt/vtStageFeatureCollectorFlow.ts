import type { Feature } from 'geojson';
import type { EphemeralTransformCacheRecord } from '@hierarchidb/gis-sdk';
import type { VTStageContext } from '~/contexts';
import type { InputFeatureStats } from './vtStageGeometryTypes.js';
import { collectFeaturesFromRecord } from './vtStageFeatureCollectorRecordProcessor.js';

type FeatureCollectorFlowInput = {
  context: VTStageContext;
  nodeId: string;
  records: EphemeralTransformCacheRecord[];
  debugCollect: boolean;
  options?: {
    groupByContinent?: boolean;
    continentByCountry?: Map<string, string>;
  };
};

type FeatureCollectorState = {
  allFeatures: Feature[];
  featureStats: InputFeatureStats[];
  bufferSizes: Map<string, number>;
  featuresByContinent?: Map<string, Feature[]>;
};

export const executeFeatureCollectLoop = async (
  input: FeatureCollectorFlowInput,
): Promise<FeatureCollectorState> => {
  const {
    context,
    nodeId,
    records,
    debugCollect,
    options,
  } = input;
  const allFeatures: Feature[] = [];
  const featureStats: InputFeatureStats[] = [];
  const bufferSizes = new Map<string, number>();
  const featuresByContinent = options?.groupByContinent ? new Map<string, Feature[]>() : undefined;

  for (const record of records) {
    await collectFeaturesFromRecord({
      context,
      nodeId,
      allFeatures,
      featureStats,
      bufferSizes,
      featuresByContinent,
      continentByCountry: options?.continentByCountry,
      debugCollect,
    }, record);
    if (debugCollect) {
      console.info('[tileEmit][debug] feature loop done', JSON.stringify({
        nodeId,
        bufferId: record.id,
        featureCount: allFeatures.length,
        featureStatsCount: featureStats.length,
      }));
    }
  }
  return {
    allFeatures,
    featureStats,
    bufferSizes,
    featuresByContinent,
  };
};
