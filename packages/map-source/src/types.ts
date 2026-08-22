export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export interface GeoFeature {
  type: 'Feature';
  geometry: any;
  properties?: Record<string, any>;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

export interface MapSourcePort {
  // Return a features collection intersecting bbox at (optional) zoom LOD
  queryByBBox(bbox: BBox, zoom?: number, filters?: Record<string, any>): Promise<FeatureCollection>;

  // Return features for a WebMercator tile (z/x/y)
  queryByTile(tile: TileCoord, filters?: Record<string, any>): Promise<FeatureCollection>;

  // Layer metadata (e.g., bounds, count)
  getMetadata(): Promise<{ bounds?: BBox; featureCount?: number; updatedAt?: number }>;
}
