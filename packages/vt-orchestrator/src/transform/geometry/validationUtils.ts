import type { Feature, Geometry } from 'geojson';
import { geometryCleanCoords, geometryIsValid } from '@hierarchidb/gis-sdk';
import type { GeometryEngine, RingFixConfig } from '@hierarchidb/gis-sdk';
import { applyRingFix } from './ringUtils.js';
import {
  countRingsFromGeometry,
  countVerticesFromGeometry,
  hasNonFiniteCoords,
  hasNonFiniteGeometry,
  type GeometryWithCoords,
} from './metrics.js';

const hasOpenRings = (geometry: Geometry): boolean => {
  if (geometry.type === 'Polygon') {
    const rings = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return rings.some((ring) => ring.length < 4 || ring[0]?.[0] !== ring[ring.length - 1]?.[0] || ring[0]?.[1] !== ring[ring.length - 1]?.[1]);
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
    return polygons.some((rings) => (Array.isArray(rings) ? rings.some((ring) => (
      ring.length < 4 || ring[0]?.[0] !== ring[ring.length - 1]?.[0] || ring[0]?.[1] !== ring[ring.length - 1]?.[1]
    )) : false));
  }
  return false;
};

export const isGeometryValid = (geometry: Geometry, engine: GeometryEngine): boolean => {
  if (geometry.type !== 'GeometryCollection') {
    const coords = (geometry as GeometryWithCoords).coordinates;
    if (hasNonFiniteCoords(coords)) return false;
    if (hasOpenRings(geometry)) return false;
  }
  try {
    return geometryIsValid(geometry, engine);
  } catch {
    return false;
  }
};

export const formatGeometryDiagnostics = (geometry: Geometry, engine: GeometryEngine): string => {
  const vertexCount = countVerticesFromGeometry(geometry);
  const ringCount = countRingsFromGeometry(geometry);
  const nonFinite = hasNonFiniteGeometry(geometry);
  const openRings = hasOpenRings(geometry);
  let booleanValidFlag = false;
  try {
    booleanValidFlag = geometryIsValid(geometry, engine);
  } catch {
    booleanValidFlag = false;
  }
  return `type=${geometry.type} rings=${ringCount} vertices=${vertexCount} nonFinite=${nonFinite ? 1 : 0} openRings=${openRings ? 1 : 0} booleanValid=${booleanValidFlag ? 1 : 0}`;
};

export const cleanGeometry = (geometry: Geometry): Geometry => {
  try {
    const cleaned = geometryCleanCoords({ type: 'Feature', geometry, properties: {} });
    if ((cleaned as Feature).geometry) {
      return (cleaned as Feature).geometry as Geometry;
    }
    if ((cleaned as Geometry).type) {
      return cleaned as Geometry;
    }
    return geometry;
  } catch {
    return geometry;
  }
};

export const validateSimplifiedGeometry = (
  geometry: Geometry,
  ringFix: RingFixConfig,
  minRingArea: number,
  dropInvalidHoles: boolean,
  geometryEngine: GeometryEngine,
): Geometry => {
  const cleaned = cleanGeometry(geometry);
  const ringFixed = applyRingFix(cleaned, ringFix, minRingArea, dropInvalidHoles, geometryEngine);
  if (!ringFixed) {
    throw new Error('simplify produced empty geometry');
  }
  if (!isGeometryValid(ringFixed, geometryEngine)) {
    throw new Error('simplify produced invalid geometry');
  }
  return ringFixed;
};
