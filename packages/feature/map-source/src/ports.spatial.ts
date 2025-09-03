import type { FeatureCollection, MapSourcePort } from './ports';

export interface SpatialIndexPort extends MapSourcePort {
  build(fc: FeatureCollection): Promise<void> | void;
}
