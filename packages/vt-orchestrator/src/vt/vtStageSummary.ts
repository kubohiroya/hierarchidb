import type { Tile } from 'geojson-vt';

type TileGeometry = Tile['features'][number]['geometry'];

export type GeojsonVtEmptyTileDetail = {
  z: number;
  x: number;
  y: number;
  layerName: string;
  clippedFeatureCount: number;
  featureCount: number;
  matchedFeatureIds?: string[];
};

const formatCount = (value: number): string => value.toLocaleString('en-US');

export const buildTileSummary = (tilesByZoom: Map<number, { total: number; generated: number }>): string => {
  if (tilesByZoom.size === 0) return 'tiles -> 0/0';
  const parts = Array.from(tilesByZoom.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, counts]) => `${formatCount(counts.generated)}/${formatCount(counts.total)}`);
  return `tiles -> ${parts.join(', ')}`;
};

export const buildSkippedMessage = (featureSummary: string, tileSummary: string, reason: string): string => (
  `${featureSummary}, ${tileSummary} (skipped: ${reason})`
);

export const buildGeojsonVtEmptyTileReason = (detail: GeojsonVtEmptyTileDetail): string => ([
  'geojson-vt produced empty tile for clipped features',
  `tile=${detail.z}/${detail.x}/${detail.y}`,
  `layer=${detail.layerName}`,
  `clippedFeatures=${detail.clippedFeatureCount}`,
  `layerFeatures=${detail.featureCount}`,
].join(', '));

export const buildGeojsonVtEmptyTileSummaryReason = (
  emptyCount: number,
  firstDetail: GeojsonVtEmptyTileDetail,
): string => (
  emptyCount <= 1
    ? buildGeojsonVtEmptyTileReason(firstDetail)
    : `${buildGeojsonVtEmptyTileReason(firstDetail)}, emptyTileCount=${formatCount(emptyCount)}`
);

export const computeOutputTileTotals = (tiles: Tile[]): {
  featureCount: number;
  vertexCount: number;
  polygonCount: number;
  lineStringCount: number;
} => {
  const totals = {
    featureCount: 0,
    vertexCount: 0,
    polygonCount: 0,
    lineStringCount: 0,
  };
  return tiles.reduce((acc, tile) => {
    const features = Array.isArray(tile.features) ? tile.features : [];
    acc.featureCount += features.length;
    features.forEach((feature) => {
      if (feature.type === 3) {
        acc.polygonCount += countTilePolygons(feature.geometry as TileGeometry);
        acc.vertexCount += countTileVertices(feature.geometry as TileGeometry);
      } else if (feature.type === 2) {
        acc.lineStringCount += countTileLineStrings(feature.geometry as TileGeometry);
        acc.vertexCount += countTileVertices(feature.geometry as TileGeometry);
      } else {
        acc.vertexCount += countTileVertices(feature.geometry as TileGeometry);
      }
    });
    return acc;
  }, totals);
};

const countTileVertices = (geometry: TileGeometry): number => {
  if (!Array.isArray(geometry) || geometry.length === 0) return 0;
  const first = geometry[0];
  if (!Array.isArray(first)) return 0;
  if (typeof first[0] === 'number') return 1;
  return geometry.reduce((sum, child) => sum + countTileVertices(child as unknown as TileGeometry), 0);
};

const normalizeTileRings = (geometry: TileGeometry): number[][][] => {
  if (!Array.isArray(geometry) || geometry.length === 0) return [];
  const first = geometry[0];
  if (!Array.isArray(first)) return [];
  const first0 = first[0];
  if (Array.isArray(first0) && typeof first0[0] === 'number') {
    return geometry as unknown as number[][][];
  }
  if (Array.isArray(first0) && Array.isArray(first0[0])) {
    const rings: number[][][] = [];
    (geometry as unknown as number[][][][]).forEach((polygon) => {
      if (!Array.isArray(polygon)) return;
      polygon.forEach((ring) => {
        if (Array.isArray(ring)) rings.push(ring as number[][]);
      });
    });
    return rings;
  }
  return [];
};

const signedRingArea = (ring: number[][]): number => {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const pointA = ring[i];
    const pointB = ring[(i + 1) % ring.length];
    if (!pointA || !pointB || pointA.length < 2 || pointB.length < 2) continue;
    const x1 = pointA[0] ?? null;
    const y1 = pointA[1] ?? null;
    const x2 = pointB[0] ?? null;
    const y2 = pointB[1] ?? null;
    if (
      typeof x1 !== 'number' || !Number.isFinite(x1)
      || typeof y1 !== 'number' || !Number.isFinite(y1)
      || typeof x2 !== 'number' || !Number.isFinite(x2)
      || typeof y2 !== 'number' || !Number.isFinite(y2)
    ) {
      continue;
    }
    sum += (x1 * y2) - (x2 * y1);
  }
  return sum / 2;
};

const countTilePolygons = (geometry: TileGeometry): number => {
  const rings = normalizeTileRings(geometry);
  if (rings.length === 0) return 0;
  const areas = rings.map((ring) => signedRingArea(ring));
  let maxIndex = 0;
  let maxAbs = 0;
  for (let i = 0; i < areas.length; i += 1) {
    const abs = Math.abs(areas[i] ?? 0);
    if (abs > maxAbs) {
      maxAbs = abs;
      maxIndex = i;
    }
  }
  const targetSign = Math.sign(areas[maxIndex] ?? 0) || 1;
  return areas.reduce((count, area) => (Math.sign(area) === targetSign ? count + 1 : count), 0);
};

const countTileLineStrings = (geometry: TileGeometry): number => {
  if (!Array.isArray(geometry) || geometry.length === 0) return 0;
  const first = geometry[0];
  if (Array.isArray(first) && typeof first[0] === 'number') return 1;
  return geometry.length;
};
