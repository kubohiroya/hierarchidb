import type { Feature, FeatureCollection } from 'geojson';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { Tile } from 'geojson-vt';
import type vtPbfNS = require('@maplibre/vt-pbf');
import type { StageHandler, StageHandlerResult } from '../runner.js';
import type { VtTaskInput, VtStageContext, BandConfig } from '../types.js';
import { packTileId, parentToChildRange, unpackTileId } from '../tiles/tileId.js';
import { buildVtTileKey } from '@hierarchidb/vt-store';
import { NobleSha3HashPort } from '@hierarchidb/chunk-store';

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

const collectFeatures = async (context: VtStageContext, bufferIds: string[]): Promise<FeatureCollection | null> => {
  const allFeatures: Feature[] = [];
  for (const bufferId of bufferIds) {
    const record = await context.shapeStore.transformByBandCache.get(bufferId);
    if (!record) continue;
    const collection = await decodeTransformByBandCache(record.data);
    if (!collection) continue;
    allFeatures.push(...collection.features);
  }
  if (allFeatures.length === 0) return null;
  return { type: 'FeatureCollection', features: allFeatures };
};

type GeojsonVtIndex = { getTile: (z: number, x: number, y: number) => Tile | null };

const buildLayerIndexes = async (
  layers: Map<string, Feature[]>,
  band: BandConfig,
  vtConfig: VtStageContext['vtConfig'],
): Promise<Map<string, GeojsonVtIndex>> => {
  const geojsonvt = await loadGeojsonVt();
  const indexes = new Map<string, GeojsonVtIndex>();
  for (const [layerName, features] of layers.entries()) {
    if (features.length === 0) continue;
    if (vtConfig.layers.length > 0 && !vtConfig.layers.includes(layerName)) continue;
    const collection: FeatureCollection = { type: 'FeatureCollection', features };
    const index = geojsonvt(collection, {
      maxZoom: band.zMax,
      indexMaxZoom: band.zMax,
      extent: vtConfig.extent,
      buffer: vtConfig.buffer,
      tolerance: vtConfig.vtSimplificationTolerance,
      promoteId: 'id',
    });
    indexes.set(layerName, index as unknown as GeojsonVtIndex);
  }
  return indexes;
};

export const createVtHandler = (context: VtStageContext): StageHandler<VtTaskInput> => {
  const { bands, vtConfig, vtStore } = context;
  const bandMap = new Map(bands.map((band) => [band.bandId, band] as const));

  return async (task): Promise<StageHandlerResult> => {
    const input = task.inputData;
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

    const collection = await collectFeatures(context, input.bufferIds);
    if (!collection) {
      return { status: 'completed', message: 'skipped: no features' };
    }

    const layerMap = buildLayerMap(collection);
    const indexes = await buildLayerIndexes(layerMap, band, vtConfig);
    if (indexes.size === 0) {
      return { status: 'completed', message: 'skipped: no layers' };
    }

    const vtpbf = await loadVtPbf();
    const parent = unpackTileId(input.tileId, band.zBase);
    const bufferSetHash = buildBufferSetHash(input.bufferIds);

    for (let z = band.zMin; z <= band.zMax; z++) {
      const { xStart, xEnd, yStart, yEnd } = parentToChildRange(parent, z);
      for (let x = xStart; x <= xEnd; x++) {
        for (let y = yStart; y <= yEnd; y++) {
          const layers: Record<string, Tile> = {};
          for (const [layerName, index] of indexes.entries()) {
            const tile = index.getTile(z, x, y) as Tile | null;
            if (!tile || !Array.isArray(tile.features) || tile.features.length === 0) continue;
            const finalTile = vtConfig.boundaryDedupe && layerName.endsWith('-boundary')
              ? dedupeTileLines(tile)
              : tile;
            layers[layerName] = finalTile;
          }
          if (Object.keys(layers).length === 0) {
            continue;
          }
          const pbf = vtpbf.fromGeojsonVt(layers as unknown as Tile[], { version: 2 });
          const bytes = pbf as Uint8Array;
          const tileId = packTileId(x, y, z);
          await vtStore.vtTiles.put({
            id: buildVtTileKey(tileId, bufferSetHash),
            nodeId: task.nodeId,
            tileId,
            z,
            x,
            y,
            layer: vtConfig.layerSetName,
            bufferSetHash,
            data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
            size: bytes.byteLength,
            contentType: 'application/vnd.mapbox-vector-tile',
            timestamp: Date.now(),
          });
        }
      }
    }

    return { status: 'completed', progress: 100 };
  };
};
