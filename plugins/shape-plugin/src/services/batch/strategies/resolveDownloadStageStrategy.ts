import type { DownloadStageStrategy } from './DownloadStageStrategy.js';
import { GadmDownloadStrategy } from './GadmDownloadStrategy.js';
import { GeoBoundariesDownloadStrategy } from './GeoBoundariesDownloadStrategy.js';
import { NaturalEarthDownloadStrategy } from './NaturalEarthDownloadStrategy.js';
import { OsmDownloadStrategy } from './OsmDownloadStrategy.js';

const strategies: Record<string, DownloadStageStrategy> = {
  gadm: new GadmDownloadStrategy(),
  geoboundaries: new GeoBoundariesDownloadStrategy(),
  naturalearth: new NaturalEarthDownloadStrategy(),
  openstreetmap: new OsmDownloadStrategy(),
};

export const resolveDownloadStageStrategy = (dataSource?: string): DownloadStageStrategy => {
  if (!dataSource) {
    throw new Error('Data source is required to resolve download strategy');
  }
  const strategy = strategies[dataSource];
  if (!strategy) {
    throw new Error(`Unsupported data source: ${dataSource}`);
  }
  return strategy;
};
