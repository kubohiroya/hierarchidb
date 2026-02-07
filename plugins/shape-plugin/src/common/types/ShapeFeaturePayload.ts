import type { Geometry } from 'geojson';

export interface ShapeFeaturePayload {
  geometry?: Geometry;
  properties?: Record<string, unknown>;
}
