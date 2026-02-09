import initGeosJs from 'geos-wasm';
import { geojsonToGeosGeom } from 'geos-wasm/helpers';
import type { Feature, FeatureCollection, GeoJSON, Geometry } from 'geojson';
import { geomToWkb, wkbToGeojson, type GeosEmscriptenModule } from './wkb.js';

export type GeosModule = Awaited<ReturnType<typeof initGeosJs>>;
export type GeosInitConfig = Parameters<typeof initGeosJs>[0];

let geosPromise: Promise<GeosModule> | null = null;
let geosModule: GeosModule | null = null;

const asEmscriptenModule = (geos: GeosModule): GeosEmscriptenModule => {
  const module = (geos as unknown as { Module?: GeosEmscriptenModule }).Module;
  if (!module || typeof module._malloc !== 'function') {
    throw new Error('geos-wasm runtime methods are not available');
  }
  return module;
};

export const initGeos = async (config?: GeosInitConfig): Promise<GeosModule> => {
  if (!geosPromise) {
    geosPromise = initGeosJs(config).then((module) => {
      geosModule = module;
      return module;
    });
  }
  return geosPromise;
};

export const getGeosOrThrow = (): GeosModule => {
  if (!geosModule) {
    throw new Error('geos is not initialized; call initGeos() before use');
  }
  return geosModule;
};

const isFeatureCollection = (value: GeoJSON): value is FeatureCollection => (
  value.type === 'FeatureCollection'
);

const isFeature = (value: GeoJSON): value is Feature => value.type === 'Feature';

const normalizeGeometryInput = (value: GeoJSON): {
  geometry: Geometry | null;
  feature: Feature | null;
} => {
  if (isFeature(value)) {
    return { geometry: value.geometry ?? null, feature: value };
  }
  if (isFeatureCollection(value)) {
    return { geometry: null, feature: null };
  }
  return { geometry: value as Geometry, feature: null };
};

const mapFeatureCollection = (
  collection: FeatureCollection,
  mapper: (feature: Feature) => Feature,
): FeatureCollection => ({
  ...collection,
  features: collection.features.map((feature) => mapper(feature)),
});

const bboxFromCoords = (coords: unknown): [number, number, number, number] | null => {
  if (!Array.isArray(coords)) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      const x = value[0];
      const y = value[1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      return;
    }
    value.forEach((entry) => visit(entry));
  };
  visit(coords);
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return [minX, minY, maxX, maxY];
};

const bboxFromGeometry = (geometry: Geometry): [number, number, number, number] | null => {
  if (geometry.type === 'GeometryCollection') {
    let aggregate: [number, number, number, number] | null = null;
    geometry.geometries.forEach((child) => {
      const next = bboxFromGeometry(child);
      if (!next) return;
      if (!aggregate) {
        aggregate = next;
        return;
      }
      aggregate = [
        Math.min(aggregate[0], next[0]),
        Math.min(aggregate[1], next[1]),
        Math.max(aggregate[2], next[2]),
        Math.max(aggregate[3], next[3]),
      ];
    });
    return aggregate;
  }
  return bboxFromCoords(geometry.coordinates);
};

const bboxFromGeojson = (geojson: GeoJSON): [number, number, number, number] | null => {
  if (isFeatureCollection(geojson)) {
    let aggregate: [number, number, number, number] | null = null;
    geojson.features.forEach((feature) => {
      const next = feature.geometry ? bboxFromGeometry(feature.geometry) : null;
      if (!next) return;
      if (!aggregate) {
        aggregate = next;
        return;
      }
      aggregate = [
        Math.min(aggregate[0], next[0]),
        Math.min(aggregate[1], next[1]),
        Math.max(aggregate[2], next[2]),
        Math.max(aggregate[3], next[3]),
      ];
    });
    return aggregate;
  }
  if (isFeature(geojson)) {
    return geojson.geometry ? bboxFromGeometry(geojson.geometry) : null;
  }
  return bboxFromGeometry(geojson as Geometry);
};

const bboxToPolygon = (bbox: [number, number, number, number]): Feature<Geometry> => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [bbox[0], bbox[1]],
      [bbox[2], bbox[1]],
      [bbox[2], bbox[3]],
      [bbox[0], bbox[3]],
      [bbox[0], bbox[1]],
    ]],
  },
  properties: {},
});

const withGeosGeometry = <T>(
  geos: GeosModule,
  geojson: GeoJSON,
  fn: (geomPtr: number) => T,
): T => {
  const geomPtr = geojsonToGeosGeom(geojson, geos);
  if (!geomPtr) {
    throw new Error('geojsonToGeosGeom returned null');
  }
  try {
    return fn(geomPtr);
  } finally {
    geos.GEOSGeom_destroy(geomPtr);
  }
};

const withGeosGeometryPair = <T>(
  geos: GeosModule,
  left: GeoJSON,
  right: GeoJSON,
  fn: (leftPtr: number, rightPtr: number) => T,
): T => {
  const leftPtr = geojsonToGeosGeom(left, geos);
  if (!leftPtr) {
    throw new Error('geojsonToGeosGeom returned null for left geometry');
  }
  const rightPtr = geojsonToGeosGeom(right, geos);
  if (!rightPtr) {
    geos.GEOSGeom_destroy(leftPtr);
    throw new Error('geojsonToGeosGeom returned null for right geometry');
  }
  try {
    return fn(leftPtr, rightPtr);
  } finally {
    geos.GEOSGeom_destroy(leftPtr);
    geos.GEOSGeom_destroy(rightPtr);
  }
};

export const geosArea = (geojson: GeoJSON): number => {
  const geos = getGeosOrThrow();
  const module = asEmscriptenModule(geos);
  const { geometry } = normalizeGeometryInput(geojson);
  if (!geometry) return 0;
  return withGeosGeometry(geos, geometry as GeoJSON, (geomPtr) => {
    const areaPtr = module._malloc(8);
    try {
      const ok = geos.GEOSArea(geomPtr, areaPtr);
      if (ok === 0) {
        throw new Error('GEOSArea failed');
      }
      return module.getValue(areaPtr, 'double') as number;
    } finally {
      module._free(areaPtr);
    }
  });
};

export const geosBbox = (geojson: GeoJSON): [number, number, number, number] | null => {
  const geos = getGeosOrThrow();
  const { geometry } = normalizeGeometryInput(geojson);
  if (!geometry) return null;
  return withGeosGeometry(geos, geometry as GeoJSON, (geomPtr) => {
    const envelope = geos.GEOSEnvelope(geomPtr);
    if (!envelope) {
      throw new Error('GEOSEnvelope returned null');
    }
    try {
      const wkb = geomToWkb(geos, envelope);
      const envelopeGeojson = wkbToGeojson(geos, wkb);
      return bboxFromGeojson(envelopeGeojson);
    } finally {
      geos.GEOSGeom_destroy(envelope);
    }
  });
};

export const geosIsValid = (geojson: GeoJSON): boolean => {
  const geos = getGeosOrThrow();
  const { geometry } = normalizeGeometryInput(geojson);
  if (!geometry) return true;
  return withGeosGeometry(geos, geometry as GeoJSON, (geomPtr) => (
    geos.GEOSisValid(geomPtr) === 1
  ));
};

export const geosIsValidDetail = (geojson: GeoJSON): {
  valid: boolean;
  reason?: string;
  location?: [number, number];
} => {
  const geos = asEmscriptenModule(getGeosOrThrow());
  const { geometry } = normalizeGeometryInput(geojson);
  if (!geometry) return { valid: true };
  return withGeosGeometry(geos, geometry as GeoJSON, (geomPtr) => {
    const valid = geos.GEOSisValid(geomPtr) === 1;
    if (valid) return { valid: true };
    const reasonPtr = geos.GEOSisValidReason(geomPtr);
    if (!reasonPtr) return { valid: false };
    const reason = geos.UTF8ToString(reasonPtr);
    geos.GEOSFree(reasonPtr);
    return { valid: false, reason };
  });
};

export const geosSimplify = (
  geojson: GeoJSON,
  tolerance: number,
  options?: { preserveTopology?: boolean },
): GeoJSON => {
  const geos = getGeosOrThrow();
  const preserveTopology = options?.preserveTopology ?? true;
  if (isFeatureCollection(geojson)) {
    return mapFeatureCollection(geojson, (feature) => (
      geosSimplify(feature as GeoJSON, tolerance, options) as Feature
    ));
  }
  const { geometry, feature } = normalizeGeometryInput(geojson);
  if (!geometry) return geojson;
  const simplifiedGeojson = withGeosGeometry(geos, geometry as GeoJSON, (geomPtr) => {
    const simplified = preserveTopology
      ? geos.GEOSTopologyPreserveSimplify(geomPtr, tolerance)
      : geos.GEOSSimplify(geomPtr, tolerance);
    if (!simplified) {
      throw new Error('GEOSSimplify returned null');
    }
    try {
      const wkb = geomToWkb(geos, simplified);
      return wkbToGeojson(geos, wkb);
    } finally {
      geos.GEOSGeom_destroy(simplified);
    }
  });
  if (feature) {
    return { ...feature, geometry: simplifiedGeojson as Geometry };
  }
  return simplifiedGeojson;
};

export const geosMakeValid = (geojson: GeoJSON): GeoJSON => {
  const geos = getGeosOrThrow();
  const { geometry, feature } = normalizeGeometryInput(geojson);
  if (!geometry) return geojson;
  const validGeojson = withGeosGeometry(geos, geometry as GeoJSON, (geomPtr) => {
    const fixed = geos.GEOSMakeValid(geomPtr);
    if (!fixed) {
      throw new Error('GEOSMakeValid returned null');
    }
    try {
      const wkb = geomToWkb(geos, fixed);
      return wkbToGeojson(geos, wkb);
    } finally {
      geos.GEOSGeom_destroy(fixed);
    }
  });
  if (feature) {
    return { ...feature, geometry: validGeojson as Geometry };
  }
  return validGeojson;
};

export const geosIntersects = (left: GeoJSON, right: GeoJSON): boolean => {
  const geos = getGeosOrThrow();
  return withGeosGeometryPair(geos, left, right, (leftPtr, rightPtr) => (
    geos.GEOSIntersects(leftPtr, rightPtr) === 1
  ));
};

export const geosContains = (left: GeoJSON, right: GeoJSON): boolean => {
  const geos = getGeosOrThrow();
  return withGeosGeometryPair(geos, left, right, (leftPtr, rightPtr) => (
    geos.GEOSContains(leftPtr, rightPtr) === 1
  ));
};

export const geosClip = (feature: Feature, bbox: [number, number, number, number]): Feature | null => {
  const geos = getGeosOrThrow();
  const geometry = feature.geometry;
  if (!geometry) return null;
  const bboxPolygon = bboxToPolygon(bbox);
  const clipped = withGeosGeometryPair(geos, geometry as GeoJSON, bboxPolygon as GeoJSON, (leftPtr, rightPtr) => {
    const result = geos.GEOSIntersection(leftPtr, rightPtr);
    if (!result) {
      return null;
    }
    try {
      if (geos.GEOSisEmpty(result) === 1) {
        return null;
      }
      const wkb = geomToWkb(geos, result);
      return wkbToGeojson(geos, wkb);
    } finally {
      geos.GEOSGeom_destroy(result);
    }
  });
  if (!clipped) return null;
  return { ...feature, geometry: clipped as Geometry };
};
