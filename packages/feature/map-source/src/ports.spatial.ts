import type { FeatureCollection, MapSourcePort } from './ports.js';

export interface SpatialIndexPort extends MapSourcePort {
  build(fc: FeatureCollection): Promise<void> | void;
}
