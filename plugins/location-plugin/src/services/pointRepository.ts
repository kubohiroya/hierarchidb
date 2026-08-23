import type { NodeId } from '@hierarchidb/core-types';
import { buildTileIdByZoom, type LocationSourceArtifactRecord } from '@hierarchidb/location-store';
import type { FeatureItemBase } from '@hierarchidb/runtime-worker';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import type { LocationPointProperties } from '~/common/entities/LocationPoint';
import type { LocationGroupItemData } from '~/common/types/entities';
import { LocationDB } from '~/worker/locationEntitiesDB';
import { fromGroupRow, toGroupRow } from '~/worker/normalizerUtils';

type PointItem = FeatureItemBase<LocationGroupItemData>;
type PointProperties = LocationPointProperties;

export type LocationPointWriteProgress = {
  total: number;
  saved: number;
  chunkIndex: number;
  chunkSize: number;
};

let dbPromise: Promise<LocationDB> | null = null;

async function getDb(): Promise<LocationDB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = new LocationDB(getDBName(getBuildDatabasePrefix(), 'location'));
      await db.open?.();
      return db;
    })();
  }
  return dbPromise;
}

const toItem = (point: PointProperties): PointItem => {
  const longitude = point.longitude;
  const latitude = point.latitude;
  const withTiles =
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    typeof latitude === 'number' &&
    Number.isFinite(latitude)
      ? { ...point, ...buildTileIdByZoom(longitude, latitude) }
      : point;
  return {
    id: crypto.randomUUID(),
    data: { ...withTiles },
    updatedAt: Date.now(),
  };
};

export async function appendLocationPoints(
  nodeId: NodeId,
  points: PointProperties[]
): Promise<void> {
  if (!points.length) return;
  const db = await getDb();
  const now = Date.now();
  const rows = points.map((point) => toGroupRow(nodeId, toItem(point), now));
  await db.features.bulkPut(rows);
}

export async function replaceLocationPoints(
  nodeId: NodeId,
  points: PointProperties[]
): Promise<void> {
  const db = await getDb();
  await db.transaction('rw', db.features, async () => {
    await db.features.where('nodeId').equals(nodeId).delete();
    if (!points.length) return;
    const now = Date.now();
    const rows = points.map((point) => toGroupRow(nodeId, toItem(point), now));
    await db.features.bulkPut(rows);
  });
}

export async function replaceLocationArtifacts(
  nodeId: NodeId,
  points: PointProperties[],
  sourceArtifact: LocationSourceArtifactRecord
): Promise<void> {
  const db = await getDb();
  await db.transaction('rw', [db.features, db.sourceArtifacts], async () => {
    await db.features.where('nodeId').equals(nodeId).delete();
    await db.sourceArtifacts.delete(nodeId);
    if (points.length > 0) {
      const now = Date.now();
      const rows = points.map((point) => toGroupRow(nodeId, toItem(point), now));
      await db.features.bulkPut(rows);
    }
    await db.storeSourceArtifact(sourceArtifact);
  });
}

export async function replaceLocationPointsChunked(
  nodeId: NodeId,
  points: PointProperties[],
  options?: {
    chunkSize?: number;
    onProgress?: (progress: LocationPointWriteProgress) => void;
  }
): Promise<void> {
  const db = await getDb();
  const chunkSize = Math.max(1, options?.chunkSize ?? 1000);
  await db.transaction('rw', db.features, async () => {
    await db.features.where('nodeId').equals(nodeId).delete();
    if (!points.length) {
      options?.onProgress?.({ total: 0, saved: 0, chunkIndex: 0, chunkSize });
      return;
    }
    let saved = 0;
    let chunkIndex = 0;
    for (let i = 0; i < points.length; i += chunkSize) {
      chunkIndex += 1;
      const slice = points.slice(i, i + chunkSize);
      const now = Date.now();
      const rows = slice.map((point) => toGroupRow(nodeId, toItem(point), now));
      await db.features.bulkPut(rows);
      saved += slice.length;
      options?.onProgress?.({ total: points.length, saved, chunkIndex, chunkSize });
    }
  });
}

export async function listLocationPoints(nodeId: NodeId): Promise<PointProperties[]> {
  const db = await getDb();
  const rows = await db.features.where('nodeId').equals(nodeId).toArray();
  return fromGroupRow(rows).map((item) => {
    if (!item.data) {
      throw new Error(`[location points] feature row ${String(item.id)} is missing data`);
    }
    return { ...item.data };
  });
}

export async function deleteLocationPoints(nodeId: NodeId, pointIds: string[]): Promise<void> {
  if (!pointIds.length) return;
  const db = await getDb();
  await db.transaction('rw', db.features, async () => {
    for (const id of pointIds) {
      await db.features.delete([nodeId, id]);
    }
  });
}

export async function clearLocationPoints(nodeId: NodeId): Promise<void> {
  const db = await getDb();
  await db.features.where('nodeId').equals(nodeId).delete();
}

export async function clearLocationArtifacts(nodeId: NodeId): Promise<void> {
  const db = await getDb();
  await db.transaction('rw', [db.features, db.sourceArtifacts], async () => {
    await db.features.where('nodeId').equals(nodeId).delete();
    await db.sourceArtifacts.delete(nodeId);
  });
}
