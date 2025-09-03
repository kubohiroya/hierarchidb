import type { BBox, FeatureCollection, MapSourcePort, TileCoord } from './ports';

export interface SpatialIndexPort extends MapSourcePort {
  build(fc: FeatureCollection): Promise<void> | void;
}

