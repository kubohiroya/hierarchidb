import type { BBox, FeatureCollection, FeatureFilters, MapSourcePort, TileCoord } from './types.js';

export class MapSourceService {
  constructor(private source: MapSourcePort) {}

  async getFeaturesInBBox(
    bbox: BBox,
    zoom?: number,
    filters?: FeatureFilters
  ): Promise<FeatureCollection> {
    return await this.source.queryByBBox(bbox, zoom, filters);
  }

  async getFeaturesInTile(tile: TileCoord, filters?: FeatureFilters): Promise<FeatureCollection> {
    return await this.source.queryByTile(tile, filters);
  }

  async getMetadata(): Promise<Awaited<ReturnType<MapSourcePort['getMetadata']>>> {
    return await this.source.getMetadata();
  }
}
