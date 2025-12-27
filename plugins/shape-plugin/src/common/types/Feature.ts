import type { BBox, Geometry } from 'geojson';

export interface Feature {
  type: 'Feature';
  id: number;
  originalId?: string | number;
  properties: Record<string, unknown>;
  geometry: Geometry;
  bbox?: BBox;
  mortonCode?: bigint;
  adminLevel?: number;
  countryCode?: string;
  name?: string;
  nameEn?: string;
  population?: number;
  area?: number;
}