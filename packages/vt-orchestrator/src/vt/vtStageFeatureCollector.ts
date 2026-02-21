import type { Feature, FeatureCollection } from 'geojson';
import type { VTStageContext } from '~/contexts';
import type { InputFeatureStats } from './vtStageGeometryTypes.js';
import { runFeatureCollectionCoordinator } from './vtStageFeatureCollectorCoordinator.js';

export const collectFeatures = async (
  context: VTStageContext,
  bufferIds: string[],
  nodeId: string,
  options?: { groupByContinent?: boolean; continentByCountry?: Map<string, string> },
): Promise<{
  collection: FeatureCollection;
  featureStats: InputFeatureStats[];
  bufferSizes: Map<string, number>;
  featuresByContinent?: Map<string, Feature[]>;
} | null> => {
  return runFeatureCollectionCoordinator({
    context,
    bufferIds,
    nodeId,
    options,
  });
};
