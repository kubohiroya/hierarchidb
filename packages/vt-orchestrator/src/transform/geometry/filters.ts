import type { Feature, Geometry, MultiPolygon, Polygon } from 'geojson';
import {
  geometryArea,
  geometryUnkinkPolygons,
  type GeometryEngine,
  type OmitDetailsConfig,
  type RingFixConfig,
  type SelfIntersectionConfig,
  type SelfIntersectionTuningConfig,
} from '@hierarchidb/gis-sdk';
import {
  computeOuterRingArea,
  computeOuterRingBounds,
  computePolygonArea,
  computePolygonOutlineLength,
  metersPerPixel,
  resolveQuantizeFactor,
} from './metrics.js';
import { cleanGeometry, isGeometryValid } from './validation.js';
import { applyRingFix } from './ring.js';
import { snapGeometryToGridWithStep } from './snap.js';

type OmitDetailsLevel = OmitDetailsConfig['level'];

type OmitDetailsThreshold = {
  maxZoom: number;
  minBBoxPx: number;
  minAreaPx2: number;
};

const OMIT_DETAILS_PRESETS: Record<OmitDetailsLevel, OmitDetailsThreshold[]> = {
  weak: [
    { maxZoom: 3, minBBoxPx: 1, minAreaPx2: 2 },
    { maxZoom: 6, minBBoxPx: 0.5, minAreaPx2: 0.5 },
    { maxZoom: Number.POSITIVE_INFINITY, minBBoxPx: 0.25, minAreaPx2: 0.1 },
  ],
  medium: [
    { maxZoom: 3, minBBoxPx: 1.5, minAreaPx2: 3 },
    { maxZoom: 6, minBBoxPx: 0.75, minAreaPx2: 0.75 },
    { maxZoom: Number.POSITIVE_INFINITY, minBBoxPx: 0.4, minAreaPx2: 0.2 },
  ],
  strong: [
    { maxZoom: 3, minBBoxPx: 2, minAreaPx2: 4 },
    { maxZoom: 6, minBBoxPx: 1, minAreaPx2: 1 },
    { maxZoom: Number.POSITIVE_INFINITY, minBBoxPx: 0.5, minAreaPx2: 0.25 },
  ],
};

const resolveOmitDetailsThreshold = (config: OmitDetailsConfig, zTarget: number): OmitDetailsThreshold => {
  const presets = OMIT_DETAILS_PRESETS[config.level];
  if (!presets) {
    throw new Error(`unknown omit-details level: ${config.level}`);
  }
  for (const threshold of presets) {
    if (zTarget <= threshold.maxZoom) return threshold;
  }
  const fallback = presets[presets.length - 1];
  if (!fallback) {
    throw new Error(`omit-details thresholds missing for level: ${config.level}`);
  }
  return fallback;
};

export const applyOmitDetailsFilter = (
  geometry: Geometry,
  config: OmitDetailsConfig,
  zTarget: number,
  geometryEngine: GeometryEngine,
): Geometry | null => {
  const threshold = resolveOmitDetailsThreshold(config, zTarget);
  const metersPerPixelValue = metersPerPixel(zTarget);
  const shouldOmit = (coords: number[][][]): boolean => {
    const { widthMeters, heightMeters } = computeOuterRingBounds(coords);
    const areaMeters = computeOuterRingArea(coords, geometryEngine);
    const widthPx = metersPerPixelValue > 0 ? widthMeters / metersPerPixelValue : 0;
    const heightPx = metersPerPixelValue > 0 ? heightMeters / metersPerPixelValue : 0;
    const areaPx2 = metersPerPixelValue > 0 ? areaMeters / (metersPerPixelValue * metersPerPixelValue) : 0;
    const bboxTooSmall = widthPx < threshold.minBBoxPx && heightPx < threshold.minBBoxPx;
    const areaTooSmall = areaPx2 < threshold.minAreaPx2;
    return bboxTooSmall || areaTooSmall;
  };
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][];
    return shouldOmit(coords) ? null : geometry;
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates as number[][][][];
    const filtered = polygons.filter((coords) => !shouldOmit(coords));
    if (filtered.length > 0) {
      return { ...geometry, coordinates: filtered };
    }
    return null;
  }
  return geometry;
};

export const applyPolygonAreaExclusion = (
  geometry: Geometry,
  coefficient: number,
  zTarget: number,
  quantize: number | undefined,
  geometryEngine: GeometryEngine,
): Geometry | null => {
  if (!Number.isFinite(coefficient)) {
    throw new Error('excludePolygonAreaCoefficient must be a finite number');
  }
  if (coefficient <= 0) return geometry;
  const gridSizeMeters = metersPerPixel(zTarget) * resolveQuantizeFactor(quantize);
  const shouldExclude = (coords: number[][][]): boolean => {
    const outlineLength = computePolygonOutlineLength(coords);
    if (outlineLength <= 0) return false;
    const area = computePolygonArea(coords, geometryEngine);
    const threshold = (coefficient * gridSizeMeters * outlineLength) / 2;
    return area < threshold;
  };
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][];
    return shouldExclude(coords) ? null : geometry;
  }
  if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates as number[][][][];
    const filtered = polygons.filter((coords) => !shouldExclude(coords));
    if (filtered.length > 0) {
      return { ...geometry, coordinates: filtered };
    }
    if (polygons.length === 0) return null;
    const largest = polygons.reduce((best, current) => (
      computePolygonArea(current, geometryEngine) > computePolygonArea(best, geometryEngine) ? current : best
    ));
    return { ...geometry, coordinates: [largest] };
  }
  return geometry;
};

const countPolygonVertices = (coords: number[][][]): number => coords.reduce(
  (sum, ring) => sum + (Array.isArray(ring) ? ring.length : 0),
  0,
);

export const applySelfIntersectionFix = (
  geometry: Geometry,
  config: SelfIntersectionConfig,
  tuning: SelfIntersectionTuningConfig,
  minPolygonArea: number,
  zTarget: number,
  quantize: number | undefined,
  geometryEngine: GeometryEngine,
  options: { splitSelfIntersections: boolean; dropSmallPolygons: boolean; minRingVertices: number },
): Geometry | null => {
  const sanitizePolygon = (coords: number[][][]): number[][][] => (
    config.retainHoles ? coords : [coords[0] ?? []]
  );
  const splitPolygon = (coords: number[][][]): number[][][][] => {
    const polygon = { type: 'Feature', geometry: { type: 'Polygon', coordinates: coords }, properties: {} } as const;
    const pieces = geometryUnkinkPolygons(polygon, geometryEngine)
      .map((feature) => (feature as unknown as { coordinates: number[][][] }).coordinates);
    if (pieces.length <= 1) return [coords];
    return pieces;
  };

  const baseSnapTolerance = (metersPerPixel(zTarget) * resolveQuantizeFactor(quantize)) / 2;
  const snapStep = baseSnapTolerance * config.snapToleranceMultiplier;
  const geometryForFix = snapStep > 0
    ? snapGeometryToGridWithStep(geometry, snapStep)
    : geometry;

  const polygons = geometryForFix.type === 'Polygon'
    ? [geometryForFix.coordinates as number[][][]]
    : geometryForFix.type === 'MultiPolygon'
      ? geometryForFix.coordinates as number[][][][]
      : [];
  if (polygons.length === 0) return geometryForFix;

  const maxVertexCount = polygons.reduce((max, coords) => (
    Math.max(max, countPolygonVertices(coords))
  ), 0);
  if (zTarget <= tuning.disableAtZoomOrBelow) {
    return geometryForFix;
  }
  if (tuning.maxVerticesForFix > 0 && maxVertexCount > tuning.maxVerticesForFix) {
    return geometryForFix;
  }

  const shouldSplit = options.splitSelfIntersections && !config.retainHoles;
  const candidates = polygons.flatMap((coords) => {
    const sanitized = sanitizePolygon(coords);
    const vertexCount = countPolygonVertices(coords);
    const splitAllowed = shouldSplit
      && (tuning.maxVerticesForSplit <= 0 || vertexCount <= tuning.maxVerticesForSplit);
    const pieces = splitAllowed ? splitPolygon(sanitized) : [sanitized];
    return pieces.map((piece) => ({
      coords: piece,
      area: Math.abs(geometryArea({ type: 'Polygon', coordinates: piece } as Polygon, geometryEngine)),
      vertexCount: countPolygonVertices(piece),
    }));
  });

  const filtered = options.dropSmallPolygons
    ? candidates.filter((entry) => entry.area >= minPolygonArea && entry.vertexCount >= options.minRingVertices)
    : candidates;
  const fallbackCandidates = candidates.filter((entry) => entry.vertexCount >= options.minRingVertices);
  const effective = filtered.length > 0
    ? filtered
    : fallbackCandidates.length > 0
      ? [fallbackCandidates.reduce((best, current) => (current.area > best.area ? current : best))]
      : [];
  if (effective.length === 0) return null;

  const sorted = [...effective].sort((a, b) => b.area - a.area);
  const limit = config.maxPolygons > 0 ? config.maxPolygons : sorted.length;
  const selected = config.strategy === 'keep_all'
    ? sorted.slice(0, limit)
    : sorted.slice(0, 1);
  const coords = selected.map((entry) => entry.coords);
  if (coords.length === 1) {
    return { type: 'Polygon', coordinates: coords[0] } as Polygon;
  }
  return { type: 'MultiPolygon', coordinates: coords } as MultiPolygon;
};

export const recoverInvalidSelfIntersection = (
  geometry: Geometry,
  config: SelfIntersectionConfig,
  ringFix: RingFixConfig,
  minRingArea: number,
  dropInvalidHoles: boolean,
  geometryEngine: GeometryEngine,
): Geometry | null => {
  const toPolygonFeature = (coords: number[][][]): Feature<Polygon> => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: coords },
    properties: {},
  });
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates as number[][][]]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates as number[][][][]
      : [];
  if (polygons.length === 0) return null;

  const candidates = polygons.flatMap((coords) => {
    try {
      const pieces = geometryUnkinkPolygons(toPolygonFeature(coords), geometryEngine)
        .map((feature) => feature.coordinates);
      return pieces.length > 0 ? pieces : [coords];
    } catch {
      return [coords];
    }
  });

  const validPieces = candidates.flatMap((coords) => {
    const cleaned = cleanGeometry({ type: 'Polygon', coordinates: coords } as Polygon);
    const fixed = applyRingFix(
      cleaned,
      ringFix,
      minRingArea,
      dropInvalidHoles,
      geometryEngine,
    );
    if (!fixed || !isGeometryValid(fixed, geometryEngine)) return [];
    return [{
      coords: (fixed as Polygon).coordinates,
      area: Math.abs(geometryArea(fixed as Polygon, geometryEngine)),
    }];
  });

  if (validPieces.length === 0) return null;
  const sorted = [...validPieces].sort((a, b) => b.area - a.area);
  const limit = config.maxPolygons > 0 ? config.maxPolygons : sorted.length;
  const selected = config.strategy === 'keep_all'
    ? sorted.slice(0, limit)
    : sorted.slice(0, 1);
  const coords = selected.map((entry) => entry.coords);
  if (coords.length === 1) {
    return { type: 'Polygon', coordinates: coords[0] } as Polygon;
  }
  return { type: 'MultiPolygon', coordinates: coords } as MultiPolygon;
};
