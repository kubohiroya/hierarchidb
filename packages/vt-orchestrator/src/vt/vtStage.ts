import type { Feature, FeatureCollection } from 'geojson';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { Tile } from 'geojson-vt';
import type vtPbfNS = require('@maplibre/vt-pbf');
import { packTileId, parentToChildRange, unpackTileId } from '../tiles/tileId.js';
import { NobleSha3HashPort } from '@hierarchidb/chunk-store';
import type { VTStageContext } from '../contexts.js';
import type { BandConfig, StageHandler, StageHandlerResult, VtTaskInput } from '../types/types.js';
import { updateTask, VtTaskQueueDb } from '../task/taskQueue.js';

const normalizeFeatureCollection = async (decoded: unknown): Promise<FeatureCollection | null> => {
  if (!decoded || typeof decoded !== 'object') return null;
  const collection = decoded as FeatureCollection;
  if (collection.type === 'FeatureCollection') {
    const features = Array.isArray(collection.features) ? collection.features : [];
    return { ...collection, features };
  }
  if (typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    for await (const feature of decoded as AsyncIterable<Feature>) {
      features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }
  return null;
};

const decodeTransformByBandCache = async (buffer: ArrayBuffer): Promise<FeatureCollection | null> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  return normalizeFeatureCollection(decoded as unknown);
};

const loadGeojsonVt = async () => {
  const mod = await import('geojson-vt');
  const candidate = mod as unknown as { default?: typeof import('geojson-vt') } & typeof import('geojson-vt');
  return candidate.default ?? candidate;
};

const loadVtPbf = async (): Promise<typeof vtPbfNS> => {
  const mod = await import('@maplibre/vt-pbf');
  const candidate = mod as unknown as { default?: typeof vtPbfNS } & typeof vtPbfNS;
  return candidate.default ?? candidate;
};

const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error('task aborted');
  }
};

type TileBBox = { minX: number; minY: number; maxX: number; maxY: number };

type InputFeatureStats = {
  bbox: TileBBox;
  vertexCount: number;
  polygonCount: number;
  lineStringCount: number;
  bufferId: string;
};

const canonicalLineKey = (coords: number[][]): string => {
  const toKey = (points: number[][]): string =>
    points
      .map((p) => {
        const x = p[0] ?? 0;
        const y = p[1] ?? 0;
        return ((x << 16) ^ y).toString();
      })
      .join(',');
  const a = toKey(coords);
  const b = toKey([...coords].reverse());
  return a < b ? a : b;
};

const dedupeTileLines = (tile: Tile): Tile => {
  const seen = new Set<string>();
  const out: Tile['features'] = [];

  for (const feature of tile.features) {
    if (feature.type !== 2) {
      out.push(feature);
      continue;
    }
    const newGeom: number[][][] = [];
    const lines = (feature.geometry ?? []) as unknown as number[][][];
    for (const line of lines) {
      const key = canonicalLineKey(line);
      if (!seen.has(key)) {
        seen.add(key);
        newGeom.push(line);
      }
    }
    if (newGeom.length > 0) {
      out.push({ ...feature, geometry: newGeom as unknown as Tile['features'][number]['geometry'] });
    }
  }

  return { ...tile, features: out };
};

const toDeg = (r: number): number => r * 180 / Math.PI;

const tileToBBox = (z: number, x: number, y: number): TileBBox => {
  const n = 2 ** z;
  const lon1 = x / n * 360 - 180;
  const lon2 = (x + 1) / n * 360 - 180;
  const lat1 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))));
  const lat2 = toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))));
  return { minX: lon1, minY: lat2, maxX: lon2, maxY: lat1 };
};

const bboxIntersects = (a: TileBBox, b: TileBBox): boolean => (
  a.minX <= b.maxX
  && a.maxX >= b.minX
  && a.minY <= b.maxY
  && a.maxY >= b.minY
);

const expandTileBBox = (bbox: TileBBox, buffer: number, extent: number): TileBBox => {
  if (!Number.isFinite(buffer) || buffer <= 0) return bbox;
  if (!Number.isFinite(extent) || extent <= 0) return bbox;
  const lonSpan = bbox.maxX - bbox.minX;
  const latSpan = bbox.maxY - bbox.minY;
  if (!Number.isFinite(lonSpan) || !Number.isFinite(latSpan)) return bbox;
  const factor = buffer / extent;
  const lonMargin = lonSpan * factor;
  const latMargin = latSpan * factor;
  return {
    minX: bbox.minX - lonMargin,
    minY: bbox.minY - latMargin,
    maxX: bbox.maxX + lonMargin,
    maxY: bbox.maxY + latMargin,
  };
};

const isNumberArrayLike = (value: unknown): value is ArrayLike<number> => (
  Array.isArray(value) && typeof value[0] === 'number'
);

type NumberIndexable = { length: number; [index: number]: number };

const isNumberArrayView = (value: unknown): value is ArrayBufferView & NumberIndexable => {
  if (!ArrayBuffer.isView(value)) return false;
  if (typeof (value as { length?: unknown }).length !== 'number') return false;
  const view = value as unknown as NumberIndexable;
  return view.length > 0 && typeof view[0] === 'number';
};

const featureBBox = (feature: Feature): TileBBox | null => {
  const geometry = feature?.geometry ?? null;
  if (!geometry) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (p: unknown): void => {
    if (isNumberArrayView(p)) {
      const coords = p;
      for (let i = 0; i + 1 < coords.length; i += 2) {
        const x = coords[i];
        const y = coords[i + 1];
        if (typeof x !== 'number' || typeof y !== 'number') continue;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      return;
    }
    if (isNumberArrayLike(p)) {
      const coords = p as ArrayLike<number>;
      const x = coords[0];
      const y = coords[1];
      if (typeof x !== 'number' || typeof y !== 'number') return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      return;
    }
    if (Array.isArray(p)) {
      p.forEach((child) => visit(child));
    }
  };
  const visitGeometry = (geom: Feature['geometry']): void => {
    if (!geom) return;
    if (geom.type === 'GeometryCollection') {
      const geometries = Array.isArray(geom.geometries) ? geom.geometries : [];
      geometries.forEach((child) => visitGeometry(child));
      return;
    }
    if ('coordinates' in geom) {
      visit(geom.coordinates as unknown);
    }
  };
  visitGeometry(geometry);
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
};

const countVertices = (coords: unknown): number => {
  if (!coords) return 0;
  if (isNumberArrayView(coords)) {
    const view = coords;
    if (view.length < 2) return 0;
    return Math.floor(view.length / 2);
  }
  if (!Array.isArray(coords)) return 0;
  if (coords.length === 0) return 0;
  if (typeof coords[0] === 'number') return 1;
  return coords.reduce((sum: number, child: unknown) => sum + countVertices(child), 0);
};

const countVerticesFromGeometry = (geometry?: Feature['geometry'] | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countVerticesFromGeometry(child), 0);
  }
  const coords = 'coordinates' in geometry ? geometry.coordinates : undefined;
  return countVertices(coords);
};

const countPolygonsFromGeometry = (geometry?: Feature['geometry'] | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countPolygonsFromGeometry(child), 0);
  }
  if (geometry.type === 'Polygon') return 1;
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

const countLineStringsFromGeometry = (geometry?: Feature['geometry'] | null): number => {
  if (!geometry) return 0;
  if (geometry.type === 'GeometryCollection') {
    const geometries = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    return geometries.reduce((sum, child) => sum + countLineStringsFromGeometry(child), 0);
  }
  if (geometry.type === 'LineString') return 1;
  if (geometry.type === 'MultiLineString') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates.length : 0;
  }
  return 0;
};

const countTileVertices = (geometry: unknown): number => {
  if (!Array.isArray(geometry)) return 0;
  if (geometry.length === 0) return 0;
  if (typeof geometry[0] === 'number') return 1;
  return geometry.reduce((sum: number, child: unknown) => sum + countTileVertices(child), 0);
};

const normalizeTileRings = (geometry: unknown): number[][][] => {
  if (!Array.isArray(geometry) || geometry.length === 0) return [];
  const first = geometry[0];
  if (!Array.isArray(first)) return [];
  const first0 = first[0];
  if (Array.isArray(first0) && typeof first0[0] === 'number') {
    return geometry as number[][][];
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
    const x1 = pointA[0];
    const y1 = pointA[1];
    const x2 = pointB[0];
    const y2 = pointB[1];
    if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) continue;
    sum += (x1 * y2) - (x2 * y1);
  }
  return sum / 2;
};

const countTilePolygons = (geometry: unknown): number => {
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

const countTileLineStrings = (geometry: unknown): number => {
  if (!Array.isArray(geometry)) return 0;
  if (geometry.length === 0) return 0;
  const first = geometry[0];
  if (Array.isArray(first) && typeof first[0] === 'number') return 1;
  return geometry.length;
};

const buildBufferSetHash = (bufferIds: string[]): string => {
  const sorted = [...bufferIds].sort();
  const json = JSON.stringify(sorted);
  const encoder = new TextEncoder();
  const port = new NobleSha3HashPort();
  return port.digest(encoder.encode(json).buffer, 'sha3-256');
};

const buildLayerMap = (collection: FeatureCollection): Map<string, Feature[]> => {
  const map = new Map<string, Feature[]>();
  for (const feature of collection.features) {
    if (!feature) continue;
    const props = feature.properties ?? {};
    const layer = typeof props.layer === 'string' ? props.layer : 'admin0';
    const bucket = map.get(layer);
    if (bucket) {
      bucket.push(feature);
    } else {
      map.set(layer, [feature]);
    }
  }
  return map;
};

const describeBuffer = (buffer: ArrayBuffer): {
  byteLength: number;
  headHex: string;
  headAscii: string;
  isJsonLike: boolean;
} => {
  const bytes = new Uint8Array(buffer);
  const head = bytes.slice(0, 16);
  const headHex = Array.from(head).map((value) => value.toString(16).padStart(2, '0')).join('');
  const headAscii = Array.from(head).map((value) => (
    value >= 0x20 && value <= 0x7e ? String.fromCharCode(value) : '.'
  )).join('');
  let firstNonWhitespace: number | null = null;
  for (let i = 0; i < bytes.length; i += 1) {
    const value = bytes[i];
    if (value === undefined) continue;
    if (value === 0x20 || value === 0x0a || value === 0x0d || value === 0x09) continue;
    firstNonWhitespace = value;
    break;
  }
  const isJsonLike = firstNonWhitespace === 0x7b || firstNonWhitespace === 0x5b;
  return {
    byteLength: bytes.byteLength,
    headHex,
    headAscii,
    isJsonLike,
  };
};

const collectFeatures = async (
  context: VTStageContext,
  bufferIds: string[],
  nodeId: string,
): Promise<{
  collection: FeatureCollection;
  featureStats: InputFeatureStats[];
  bufferSizes: Map<string, number>;
} | null> => {
  const allFeatures: Feature[] = [];
  const featureStats: InputFeatureStats[] = [];
  const bufferSizes = new Map<string, number>();
  await context.ephemeralDB.transaction('r', context.ephemeralDB.transformCache, async () => {
    for (const bufferId of bufferIds) {
      const record = await context.ephemeralDB.transformCache.get(bufferId);
      if (!record || record.timestamp <= 0) continue;
      bufferSizes.set(bufferId, record.data.byteLength);
      const collection = await decodeTransformByBandCache(record.data);
      if (!collection) {
        const debug = describeBuffer(record.data);
        console.warn('[shape-vt] failed to decode transform cache for vt stage', {
          nodeId,
          bufferId,
          timestamp: record.timestamp,
          byteLength: debug.byteLength,
          headHex: debug.headHex,
          headAscii: debug.headAscii,
          jsonLike: debug.isJsonLike,
        });
        continue;
      }
      collection.features.forEach((feature) => {
        allFeatures.push(feature);
        const bbox = featureBBox(feature);
        if (!bbox) return;
        featureStats.push({
          bbox,
          vertexCount: countVerticesFromGeometry(feature.geometry),
          polygonCount: countPolygonsFromGeometry(feature.geometry),
          lineStringCount: countLineStringsFromGeometry(feature.geometry),
          bufferId,
        });
      });
    }
  });
  if (allFeatures.length === 0) return null;
  return { collection: { type: 'FeatureCollection', features: allFeatures }, featureStats, bufferSizes };
};

type GeojsonVtIndex = { getTile: (z: number, x: number, y: number) => Tile | null };

const buildLayerIndexes = async (
  context: VTStageContext,
  layers: Map<string, Feature[]>,
  band: BandConfig,
  debugContext?: { taskId: string; nodeId: string; bandId?: number | null; tileId?: number | null }
): Promise<Map<string, GeojsonVtIndex>> => {
  const geojsonvt = await loadGeojsonVt();
  const indexes = new Map<string, GeojsonVtIndex>();
  const startAt = Date.now();
  if (debugContext) {
    console.info('[vt] index build start', JSON.stringify({
      ...debugContext,
      layerCount: layers.size,
      featureCount: Array.from(layers.values()).reduce((sum, features) => sum + features.length, 0),
      zRange: [band.zMin, band.zMax],
    }));
  }
  for (const [layerName, features] of layers.entries()) {
    if (features.length === 0) continue;

    //if ( > 0 && !vtConfig.layers.includes(layerName)) continue;
    //if (vtConfig.layers.length > 0 && !vtConfig.layers.includes(layerName)) continue;
    const collection: FeatureCollection = { type: 'FeatureCollection', features };
    const index = geojsonvt(collection, {
      maxZoom: band.zMax,
      indexMaxZoom: band.zMax,
      extent: context.vtConfig.extent,
      buffer: context.vtConfig.bufferSize,
      tolerance: context.vtConfig.tolerance,
      promoteId: context.vtConfig.promoteId,
      indexMaxPoints: context.vtConfig.indexMaxPoints > 0 ? context.vtConfig.indexMaxPoints : undefined,
    });
    indexes.set(layerName, index as unknown as GeojsonVtIndex);
  }
  if (debugContext) {
    console.info('[vt] index build done', JSON.stringify({
      ...debugContext,
      layerCount: layers.size,
      indexCount: indexes.size,
      durationMs: Date.now() - startAt,
    }));
  }
  return indexes;
};

export const createVtHandler = (context: VTStageContext): StageHandler<VtTaskInput> => {
  const { bands, vtConfig, tileWriter, abortSignal } = context;
  const layerSetName = vtConfig.layerSetName;
  if (!layerSetName) {
    throw new Error('vt stage requires layerSetName');
  }
  const bandMap = new Map(bands.map((band) => [band.bandId, band] as const));
  const taskQueue = new VtTaskQueueDb();

  return async (task): Promise<StageHandlerResult> => {
    const input = task.inputData;
    const bufferIds = input?.bufferIds ?? [];
    const bufferIdSample = bufferIds.length > 0
      ? bufferIds.slice(0, Math.min(bufferIds.length, 3))
      : [];
    const taskContext = {
      taskId: task.taskId,
      nodeId: String(task.nodeId),
      bandId: input?.bandId,
      tileId: input?.tileId,
      bufferCount: bufferIds.length,
    };
    try {
      if (!input) {
        return { status: 'failed', errorMessage: 'vt task input is missing' };
      }
      if (!input.bufferIds || input.bufferIds.length === 0) {
        return { status: 'completed', message: 'skipped: bufferIds is empty' };
      }
      const band = bandMap.get(input.bandId);
      if (!band) {
        return { status: 'failed', errorMessage: `Unknown bandId: ${input.bandId}` };
      }

      console.info('[vt] task start', JSON.stringify({
        ...taskContext,
        zRange: [band.zMin, band.zMax],
        layerSetName,
        bufferIdSample,
      }));

      assertNotAborted(abortSignal);
      const collected = await collectFeatures(context, input.bufferIds, String(task.nodeId));
      if (!collected) {
        return { status: 'completed', message: 'skipped: no features' };
      }

      const { collection, featureStats, bufferSizes } = collected;
      let totalBufferBytes = 0;
      let maxBufferBytes = 0;
      bufferSizes.forEach((size) => {
        totalBufferBytes += size;
        if (size > maxBufferBytes) maxBufferBytes = size;
      });
      console.info('[vt] feature collection ready', JSON.stringify({
        ...taskContext,
        features: collection.features.length,
        bufferBytes: totalBufferBytes,
        maxBufferBytes,
      }));

      const layerMap = buildLayerMap(collection);
      assertNotAborted(abortSignal);
      const indexes = await buildLayerIndexes(context, layerMap, band, taskContext);
      if (indexes.size === 0) {
        return { status: 'completed', message: 'skipped: no layers' };
      }

      assertNotAborted(abortSignal);
      const vtpbf = await loadVtPbf();
      const parent = unpackTileId(input.tileId, band.zBase);
      const bufferSetHash = buildBufferSetHash(input.bufferIds);
      const collectLayersForTile = (z: number, x: number, y: number): Record<string, Tile> | null => {
        const layers: Record<string, Tile> = {};
        for (const [layerName, index] of indexes.entries()) {
          const tile = index.getTile(z, x, y) as Tile | null;
          if (!tile || !Array.isArray(tile.features) || tile.features.length === 0) continue;
          const finalTile = vtConfig.boundaryDedupe && layerName.endsWith('-boundary')
            ? dedupeTileLines(tile)
            : tile;
          if (!Array.isArray(finalTile.features) || finalTile.features.length === 0) continue;
          layers[layerName] = finalTile;
        }
        return Object.keys(layers).length > 0 ? layers : null;
      };
      const countTilesForTask = (): number => {
        let total = 0;
        for (let z = band.zMin; z <= band.zMax; z++) {
          assertNotAborted(abortSignal);
          const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
          total += Math.max(0, xEnd - xStart + 1) * Math.max(0, yEnd - yStart + 1);
        }
        return total;
      };
      const totalTiles = countTilesForTask();
      console.info('[vt] tiling start', JSON.stringify({
        ...taskContext,
        zRange: [band.zMin, band.zMax],
        totalTiles,
      }));
      if (totalTiles === 0) {
        return { status: 'completed', message: 'skipped: no tiles' };
      }
      let processedTiles = 0;
      let generatedTiles = 0;
      let lastReportAt = 0;
      let lastReported = -1;
      let lastMessage: string | null = null;
      const reportTileProgress = async (force: boolean, message?: string): Promise<void> => {
        const shouldReportMessage = Boolean(message && message !== lastMessage);
        if (!force && !shouldReportMessage && processedTiles === lastReported) return;
        const now = Date.now();
        if (!force && !shouldReportMessage && (now - lastReportAt < 500) && (processedTiles - lastReported < 25)) return;
        lastReportAt = now;
        lastReported = processedTiles;
        if (shouldReportMessage && message) {
          lastMessage = message;
        }
        const progress = totalTiles > 0
          ? Math.min(100, Math.max(0, Math.round((processedTiles / totalTiles) * 100)))
          : 0;
        try {
          await updateTask(taskQueue, task.taskId, {
            progress,
            ...(shouldReportMessage && message ? { message } : {}),
            outputData: {
              tilesGenerated: generatedTiles,
              totalTiles,
            },
          });
        } catch (error) {
          console.warn('[vt] failed to report tile progress', JSON.stringify({
            taskId: task.taskId,
            nodeId: String(task.nodeId),
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      };
      await reportTileProgress(true, `tiles 0/${totalTiles}`);

      const computeInputTileStats = (bbox: TileBBox) => {
        let featureCount = 0;
        let vertexCount = 0;
        let polygonCount = 0;
        let lineStringCount = 0;
        const bufferSet = new Set<string>();
        for (const stats of featureStats) {
          if (!bboxIntersects(stats.bbox, bbox)) continue;
          featureCount += 1;
          vertexCount += stats.vertexCount;
          polygonCount += stats.polygonCount;
          lineStringCount += stats.lineStringCount;
          bufferSet.add(stats.bufferId);
        }
        let inputBytes = 0;
        bufferSet.forEach((bufferId) => {
          inputBytes += bufferSizes.get(bufferId) ?? 0;
        });
        return { featureCount, vertexCount, polygonCount, lineStringCount, inputBytes };
      };

      const computeOutputTileStats = (layers: Record<string, Tile>) => {
        let featureCount = 0;
        let vertexCount = 0;
        let polygonCount = 0;
        let lineStringCount = 0;
        Object.values(layers).forEach((tile) => {
          const features = Array.isArray(tile.features) ? tile.features : [];
          featureCount += features.length;
          features.forEach((feature) => {
            if (feature.type === 3) {
              polygonCount += countTilePolygons(feature.geometry);
              vertexCount += countTileVertices(feature.geometry);
            } else if (feature.type === 2) {
              lineStringCount += countTileLineStrings(feature.geometry);
              vertexCount += countTileVertices(feature.geometry);
            } else {
              vertexCount += countTileVertices(feature.geometry);
            }
          });
        });
        return { featureCount, vertexCount, polygonCount, lineStringCount };
      };

      for (let z = band.zMin; z <= band.zMax; z++) {
        assertNotAborted(abortSignal);
        const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
        for (let x = xStart; x <= xEnd; x++) {
          assertNotAborted(abortSignal);
          for (let y = yStart; y <= yEnd; y++) {
            assertNotAborted(abortSignal);
            const layers = collectLayersForTile(z, x, y);
            processedTiles += 1;
            if (!layers) {
              await reportTileProgress(false);
              continue;
            }
            const tileBBox = tileToBBox(z, x, y);
            const inputStats = computeInputTileStats(
              expandTileBBox(tileBBox, vtConfig.bufferSize, vtConfig.extent),
            );
            const outputStats = computeOutputTileStats(layers);
            let bytes: Uint8Array;
            try {
              bytes = vtpbf.fromGeojsonVt(layers as unknown as Tile[], { version: 2 }) as Uint8Array;
            } catch (error) {
              console.error('[vt] failed to encode tile', JSON.stringify({
                ...taskContext,
                stage: 'encode',
                z,
                x,
                y,
                inputStats,
                outputStats,
                layerCount: Object.keys(layers).length,
                error: error instanceof Error ? error.message : String(error),
              }));
              throw error;
            }
            const tileId = packTileId(x, y, z);
            try {
              await tileWriter({
                tileId,
                z,
                x,
                y,
                bufferSetHash,
                data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
                layers,
              });
            } catch (error) {
              console.error('[vt] tileWriter failed', JSON.stringify({
                ...taskContext,
                stage: 'tileWriter',
                z,
                x,
                y,
                tileId,
                bufferSetHash,
                inputStats,
                outputStats,
                byteLength: bytes.byteLength,
                error: error instanceof Error ? error.message : String(error),
              }));
              throw error;
            }
            generatedTiles += 1;
            const message = `tiles ${processedTiles}/${totalTiles} | tile z=${z} x=${x} y=${y} input(bytes=${inputStats.inputBytes}, features=${inputStats.featureCount}, polygons=${inputStats.polygonCount}, lines=${inputStats.lineStringCount}, vertices=${inputStats.vertexCount}) output(features=${outputStats.featureCount}, polygons=${outputStats.polygonCount}, lines=${outputStats.lineStringCount}, vertices=${outputStats.vertexCount})`;
            await reportTileProgress(false, message);
          }
        }
      }

      if (generatedTiles === 0) {
        await reportTileProgress(true, 'skipped: no tiles');
      } else {
        await reportTileProgress(true);
      }
      console.info('[vt] task completed', JSON.stringify({
        ...taskContext,
        processedTiles,
        generatedTiles,
        totalTiles,
      }));
      return {
        status: 'completed',
        progress: 100,
        outputData: {
          tilesGenerated: generatedTiles,
          totalTiles,
        },
      };
    } catch (error) {
      console.error('[vt] task failed', JSON.stringify({
        ...taskContext,
        stage: 'task',
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  };
};
