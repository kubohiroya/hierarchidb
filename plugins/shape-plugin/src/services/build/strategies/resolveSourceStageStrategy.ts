import type { SourceStageStrategy } from './SourceStageStrategy.ts';
import { GadmSourceStageStrategy } from './GadmSourceStageStrategy.ts';
import { GeoBoundariesSourceStageStrategy } from './GeoBoundariesSourceStageStrategy.ts';
import { NaturalEarthDownloadStrategy } from './NaturalEarthDownloadStrategy.js';

const strategies: Record<string, SourceStageStrategy> = {
  gadm: new GadmSourceStageStrategy(),
  geoboundaries: new GeoBoundariesSourceStageStrategy('geoboundaries'),
  'geoboundaries-topojson': new GeoBoundariesSourceStageStrategy('geoboundaries-topojson'),
  naturalearth: new NaturalEarthDownloadStrategy(),
};

export const resolveSourceStageStrategy = (dataSource?: string): SourceStageStrategy => {
  if (!dataSource) {
    throw new Error('Data source is required to resolve source stage strategy');
  }
  const strategy = strategies[dataSource];
  if (!strategy) {
    throw new Error(`Unsupported data source: ${dataSource}`);
  }
  return strategy;
};
