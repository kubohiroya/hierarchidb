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

export type FeaturePropertyValue =
  | string
  | number
  | boolean
  | null
  | readonly FeaturePropertyValue[]
  | { readonly [key: string]: FeaturePropertyValue };

export type FeatureProperties = Record<string, FeaturePropertyValue>;
export type FeatureFilters = Record<string, FeaturePropertyValue | readonly FeaturePropertyValue[]>;
export type GeoJsonPosition = readonly [number, number, ...number[]];
export type GeoJsonCoordinates = GeoJsonPosition | readonly GeoJsonCoordinates[];

export interface GeoGeometry {
  type: string;
  coordinates?: GeoJsonCoordinates;
  geometries?: readonly GeoGeometry[];
}

export interface GeoFeature {
  type: 'Feature';
  geometry: GeoGeometry | null;
  properties?: FeatureProperties;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

export interface MapSourcePort {
  // Return a features collection intersecting bbox at (optional) zoom LOD
  queryByBBox(bbox: BBox, zoom?: number, filters?: FeatureFilters): Promise<FeatureCollection>;

  // Return features for a WebMercator tile (z/x/y)
  queryByTile(tile: TileCoord, filters?: FeatureFilters): Promise<FeatureCollection>;

  // Layer metadata (e.g., bounds, count)
  getMetadata(): Promise<{ bounds?: BBox; featureCount?: number; updatedAt?: number }>;
}
