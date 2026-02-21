import type { Geometry } from 'geojson';
import { geometrySimplify, type GeometryEngine } from '@hierarchidb/gis-sdk';
import { lonLatToMercator, mercatorToLonLat, mapGeometry, metersPerPixel, resolveQuantizeFactor, type LonLat } from './metrics';

export const snapGeometryToGridWithStep = (geometry: Geometry, step: number): Geometry => {
  const snapCoord = (coord: LonLat): LonLat => {
    const [mx, my] = lonLatToMercator(coord);
    const snappedX = Math.round(mx / step) * step;
    const snappedY = Math.round(my / step) * step;
    return mercatorToLonLat([snappedX, snappedY]);
  };
  return mapGeometry(geometry, snapCoord);
};

export const snapGeometryToGrid = (geometry: Geometry, zTarget: number, quantize?: number): Geometry => {
  const factor = resolveQuantizeFactor(quantize);
  return snapGeometryToGridWithStep(geometry, metersPerPixel(zTarget) * factor);
};

export const simplifyGeometryInMercator = (
  geometry: Geometry,
  toleranceMeters: number,
  geometryEngine: GeometryEngine,
): Geometry => {
  const toMercator = (coord: LonLat): LonLat => {
    const [x, y] = lonLatToMercator(coord);
    return [x, y];
  };
  const toLonLat = (coord: LonLat): LonLat => {
    return mercatorToLonLat(coord);
  };
  const mercatorGeometry = mapGeometry(geometry, toMercator);
  const simplified = geometrySimplify(mercatorGeometry, geometryEngine, {
    tolerance: toleranceMeters,
    highQuality: false,
    mutate: false,
    preserveTopology: true,
  }) as Geometry;
  return mapGeometry(simplified, toLonLat);
};
