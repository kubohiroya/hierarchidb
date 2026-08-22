import type { BBox, FeatureCollection, MapSourcePort, TileCoord } from './types.js';

export class MapSourceService {
  constructor(private source: MapSourcePort) {}

  async getFeaturesInBBox(
    bbox: BBox,
    zoom?: number,
    filters?: Record<string, any>
  ): Promise<FeatureCollection> {
    return await this.source.queryByBBox(bbox, zoom, filters);
  }

  async getFeaturesInTile(
    tile: TileCoord,
    filters?: Record<string, any>
  ): Promise<FeatureCollection> {
    return await this.source.queryByTile(tile, filters);
  }

  async getMetadata(): Promise<Awaited<ReturnType<MapSourcePort['getMetadata']>>> {
    return await this.source.getMetadata();
  }
}
