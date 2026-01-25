import type { FetchStageStrategy } from './FetchStageStrategy.ts';
import { GadmFetchStageStrategy } from './GadmFetchStageStrategy.ts';
import { GeoBoundariesFetchStageStrategy } from './GeoBoundariesFetchStageStrategy.ts';
import { NaturalEarthDownloadStrategy } from './NaturalEarthDownloadStrategy.js';
import { OsmFetchStageStrategy } from './OsmFetchStageStrategy.ts';

const strategies: Record<string, FetchStageStrategy> = {
  gadm: new GadmFetchStageStrategy(),
  geoboundaries: new GeoBoundariesFetchStageStrategy('geoboundaries'),
  'geoboundaries-topojson': new GeoBoundariesFetchStageStrategy('geoboundaries-topojson'),
  naturalearth: new NaturalEarthDownloadStrategy(),
  openstreetmap: new OsmFetchStageStrategy(),
};

export const resolveFetchStageStrategy = (dataSource?: string): FetchStageStrategy => {
  if (!dataSource) {
    throw new Error('Data source is required to resolve fetch stage strategy');
  }
  const strategy = strategies[dataSource];
  if (!strategy) {
    throw new Error(`Unsupported data source: ${dataSource}`);
  }
  return strategy;
};
