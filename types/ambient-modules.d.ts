/// <reference types="vite/client" />

// This file centralizes non-TS module shims and asset module declarations.
// Policy: do not keep hand-maintained .d.ts files under src/ because they drift.

declare module 'geojson' {
  export type Position = [number, number] | [number, number, number];
  export type BBox = [number, number, number, number];
  export type GeoJsonObject = { type: string; bbox?: BBox };
  export type GeoJsonProperties = { [key: string]: unknown } | null;
  export type Geometry = {
    type: string;
    coordinates?: unknown;
    geometries?: Geometry[];
  };
  export type Point = { type: 'Point'; coordinates: Position };
  export type MultiPoint = { type: 'MultiPoint'; coordinates: Position[] };
  export type LineString = { type: 'LineString'; coordinates: Position[] };
  export type MultiLineString = { type: 'MultiLineString'; coordinates: Position[][] };
  export type Polygon = { type: 'Polygon'; coordinates: Position[][] };
  export type MultiPolygon = { type: 'MultiPolygon'; coordinates: Position[][][] };
  export type GeometryCollection = { type: 'GeometryCollection'; geometries: Geometry[] };
  export type Feature<G = Geometry, P = GeoJsonProperties> = {
    type: 'Feature';
    geometry: G | null;
    properties?: P;
    id?: string | number;
  };
  export type FeatureCollection<G = Geometry, P = GeoJsonProperties> = {
    type: 'FeatureCollection';
    features: Array<Feature<G, P>>;
  };
}

declare module '@turf/turf' {
  export function simplify(
    geometry: unknown,
    options?: { tolerance?: number; highQuality?: boolean; mutate?: boolean }
  ): unknown;
  export function bbox(geometry: unknown): [number, number, number, number];
  export function bboxClip(geometry: unknown, bbox: [number, number, number, number]): unknown;
  export function bboxPolygon(bbox: [number, number, number, number]): unknown;
  export function booleanIntersects(a: unknown, b: unknown): boolean;
}

declare module 'flatgeobuf' {
  export const geojson: {
    deserialize(input: Uint8Array): unknown;
    serialize(input: unknown): Uint8Array;
  };
}

declare module '@maplibre/vt-pbf' {
  export function fromGeojsonVt(layers: unknown, options?: { version?: number }): Uint8Array;
  const _default: { fromGeojsonVt: typeof fromGeojsonVt };
  export default _default;
}
