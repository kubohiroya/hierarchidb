import type { FeatureCollection, MapSourcePort } from './types.js';

export interface SpatialIndexPort extends MapSourcePort {
  build(fc: FeatureCollection): Promise<void> | void;
}
