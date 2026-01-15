import type { Feature, FeatureCollection } from 'geojson';
import { bbox as turfBbox } from '@turf/turf';
import {
  getTilesInBounds, type BoundingBox,} from '@hierarchidb/gis-sdk';
//import { type TransformByZoomTaskInput, type TransformByZoomStageContext, type BandConfig, DEFAULT_TASK_SPLIT } from '../types/index.js';
import { packTileId } from '../tiles/tileId.js';
import { decodeTransformByBandCache } from './geometry.js';
import type { TransformByZoomStageContext } from '../contexts.js';
import { DEFAULT_TASK_SPLIT, type StageHandler, type StageHandlerResult, type TransformByZoomTaskInput } from '../types/types.js';
//import { TransformByZoomConfig } from '../types/BuildConfig.js';
//import { StageHandler, StageHandlerResult, StageHandlerResult } from '../types/types.js';

const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error('task aborted');
  }
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
  const { ephemeralDB, bands, abortSignal } = context;
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

    assertNotAborted(abortSignal);
    const record = await ephemeralDB.transformByBandCache.get(input.transformByBandCacheId);
    if (!record) {
      return { status: 'failed', errorMessage: 'transform-by-zoom failed: transform-by-band cache not found' };
    }

    assertNotAborted(abortSignal);
    const collection = await decodeTransformByBandCache(record.data);
    if (!collection || collection.features.length === 0) {
      return { status: 'completed', message: 'skipped: transform-by-band cache empty' };
    }

    if (input.bandId === 3 && typeof record.adminLevel === 'number' && record.adminLevel >= 2) {
      assertNotAborted(abortSignal);
      const tiles = buildBand3Reservations(collection, band.zBase);
      const existingCount = await ephemeralDB.transformByZoomReservations.where('nodeId').equals(task.nodeId).count();
      const unique = new Set(tiles);
      if (existingCount + unique.size > DEFAULT_TASK_SPLIT.maxBand3Reservations) {
        throw new Error(`band3 reservation limit exceeded: ${existingCount + unique.size} > ${DEFAULT_TASK_SPLIT.maxBand3Reservations}`);
      }
      for (const tileId of unique) {
        assertNotAborted(abortSignal);
        const tileKey = String(tileId);
        await ephemeralDB.transformByZoomReservations.put({
          id: `${task.nodeId}:${tileKey}`,
          nodeId: task.nodeId,
          tileId: tileKey,
          createdAt: Date.now(),
        });
      }
    }

    return { status: 'completed', progress: 100 };
  };
};
