import type { Feature, FeatureCollection } from 'geojson';
import { geojson as geojsonApi } from 'flatgeobuf';
import { bbox as turfBbox } from '@turf/turf';
import { getTilesInBounds, type BoundingBox } from '@hierarchidb/gis-sdk';
import type { StageHandler, StageHandlerResult } from '../runner.js';
import type { TransformByZoomTaskInput, TransformByZoomStageContext, BandConfig } from '../types.js';
import { packTileId } from '../tiles/tileId.js';
import { putTransformByZoomCache, reserveTransformByZoomTile } from '@hierarchidb/vt-shape-store';

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

const buildTileIndex = async (
  collection: FeatureCollection,
  band: BandConfig,
  indexConfig: TransformByZoomStageContext['zoomConfig']['tileIndex'],
): Promise<{ tileIdSet: Set<number> }> => {
  const zBase = band.zBase;
  const geojsonvt = await loadGeojsonVt();
  const index = geojsonvt(collection, {
    maxZoom: zBase,
    indexMaxZoom: zBase,
    buffer: indexConfig.buffer,
    extent: indexConfig.extent,
    promoteId: indexConfig.promoteId ?? 'id',
  });
  let bbox: BoundingBox | null = null;
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    try {
      const box = turfBbox(feature as Feature) as BoundingBox;
      if (box.every((value) => Number.isFinite(value))) {
        if (!bbox) {
          bbox = [box[0], box[1], box[2], box[3]];
        } else {
          bbox = [
            Math.min(bbox[0], box[0]),
            Math.min(bbox[1], box[1]),
            Math.max(bbox[2], box[2]),
            Math.max(bbox[3], box[3]),
          ];
        }
      }
    } catch {
      // ignore invalid geometry
    }
  }
  const tileIdSet = new Set<number>();
  if (!bbox) return { tileIdSet };
  const tiles = getTilesInBounds(bbox, zBase);
  for (const tile of tiles) {
    const layer = index.getTile(tile.z, tile.x, tile.y);
    if (!layer || !Array.isArray((layer as { features?: unknown[] }).features)) continue;
    if ((layer as { features?: unknown[] }).features?.length) {
      tileIdSet.add(packTileId(tile.x, tile.y, tile.z));
    }
  }
  return { tileIdSet };
};

const buildBand3Reservations = (
  collection: FeatureCollection,
  zBase: number,
): number[] => {
  let bbox: BoundingBox | null = null;
  for (const feature of collection.features) {
    if (!feature?.geometry) continue;
    try {
      const box = turfBbox(feature as Feature) as BoundingBox;
      if (box.every((value) => Number.isFinite(value))) {
        if (!bbox) {
          bbox = [box[0], box[1], box[2], box[3]];
        } else {
          bbox = [
            Math.min(bbox[0], box[0]),
            Math.min(bbox[1], box[1]),
            Math.max(bbox[2], box[2]),
            Math.max(bbox[3], box[3]),
          ];
        }
      }
    } catch {
      // ignore invalid geometry
    }
  }
  if (!bbox) return [];
  const tiles = getTilesInBounds(bbox, zBase);
  return tiles.map((tile) => packTileId(tile.x, tile.y, tile.z));
};

export const createTransformByZoomHandler = (
  context: TransformByZoomStageContext
): StageHandler<TransformByZoomTaskInput> => {
  const { shapeStore, zoomConfig, bands, maxBand3Reservations } = context;
  const bandMap = new Map(bands.map((band) => [band.bandId, band] as const));

  return async (task): Promise<StageHandlerResult> => {
    const input = task.inputData;
    if (!input) {
      return { status: 'failed', errorMessage: 'transform-by-zoom failed: task input is missing' };
    }
    const band = bandMap.get(input.bandId);
    if (!band) {
      return { status: 'failed', errorMessage: `transform-by-zoom failed: unknown bandId (${input.bandId})` };
    }

    const record = await shapeStore.transformByBandCache.get(input.transformByBandCacheId);
    if (!record) {
      return { status: 'failed', errorMessage: 'transform-by-zoom failed: transform-by-band cache not found' };
    }

    const collection = await decodeTransformByBandCache(record.data);
    if (!collection || collection.features.length === 0) {
      return { status: 'completed', message: 'skipped: transform-by-band cache empty' };
    }

    const { tileIdSet } = await buildTileIndex(collection, band, zoomConfig.tileIndex);
    for (const tileId of tileIdSet) {
      await putTransformByZoomCache(shapeStore, task.nodeId, input.bandId, tileId, record.id);
    }

    if (input.bandId === 3 && typeof record.adminLevel === 'number' && record.adminLevel >= 2) {
      const tiles = buildBand3Reservations(collection, band.zBase);
      const existingCount = await shapeStore.transformByZoomReservations.where('nodeId').equals(task.nodeId).count();
      const unique = new Set(tiles);
      if (existingCount + unique.size > maxBand3Reservations) {
        throw new Error(`band3 reservation limit exceeded: ${existingCount + unique.size} > ${maxBand3Reservations}`);
      }
      for (const tileId of unique) {
        await reserveTransformByZoomTile(shapeStore, task.nodeId, tileId);
      }
    }

    return { status: 'completed', progress: 100 };
  };
};
