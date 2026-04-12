import type { Feature, FeatureCollection, Geometry } from 'geojson';

export type Bbox = [number, number, number, number];

export type GeoJSON = Geometry | Feature | FeatureCollection;

export type GeosSimplifyOptions = {
  preserveTopology?: boolean;
};

export type GeosWorkerApi = {
  init: () => Promise<void>;
  area: (geojson: GeoJSON) => Promise<number>;
  bbox: (geojson: GeoJSON) => Promise<Bbox | null>;
  clip: (feature: Feature, bbox: Bbox) => Promise<Feature | null>;
  simplify: (geojson: GeoJSON, tolerance: number, options?: GeosSimplifyOptions) => Promise<GeoJSON>;
  simplifyRepeated: (
    geojson: GeoJSON,
    tolerance: number,
    repeats: number,
    options?: GeosSimplifyOptions,
  ) => Promise<GeoJSON>;
  isValid: (geojson: GeoJSON) => Promise<boolean>;
  makeValid: (geojson: GeoJSON) => Promise<GeoJSON>;
  contains: (left: GeoJSON, right: GeoJSON) => Promise<boolean>;
};
