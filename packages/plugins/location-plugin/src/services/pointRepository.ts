import type { NodeId } from '@hierarchidb/common-type';
import type { GroupItemBase } from '@hierarchidb/runtime-worker';
import { LocationEntitiesDB } from '../worker/locationEntitiesDB.js';
import { toGroupRow, fromGroupRow } from '../worker/normalizers.js';
import type { LocationGroupItemData } from '../types/entities.js';
import type { LocationPointProperties } from '../entities/LocationPoint.js';

type PointItem = GroupItemBase<LocationGroupItemData>;
type PointProperties = LocationPointProperties<Record<string, unknown>>;

let dbPromise: Promise<LocationEntitiesDB> | null = null;

async function getDb(): Promise<LocationEntitiesDB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = new LocationEntitiesDB();
      await db.open?.();
      return db;
    })();
  }
  return dbPromise;
}

const toItem = (point: PointProperties): PointItem => ({
  id: point.pid,
  data: { ...point },
  updatedAt: Date.now(),
});

export async function appendLocationPoints(nodeId: NodeId, points: PointProperties[]): Promise<void> {
  if (!points.length) return;
  const db = await getDb();
  const now = Date.now();
  const rows = points.map((point) => toGroupRow(nodeId, toItem(point), now));
  await db.groupEntities.bulkPut(rows);
}

export async function replaceLocationPoints(nodeId: NodeId, points: PointProperties[]): Promise<void> {
  const db = await getDb();
  await db.transaction('rw', db.groupEntities, async () => {
    await db.groupEntities.where('nodeId').equals(nodeId).delete();
    if (!points.length) return;
    const now = Date.now();
    const rows = points.map((point) => toGroupRow(nodeId, toItem(point), now));
    await db.groupEntities.bulkPut(rows);
  });
}

export async function listLocationPoints(nodeId: NodeId): Promise<PointProperties[]> {
  const db = await getDb();
  const rows = await db.groupEntities.where('nodeId').equals(nodeId).toArray();
  return fromGroupRow(rows).map((item) => ({
    ...(item.data ?? {
      schemaVersion: 1,
      pid: item.id,
      name: '',
      latitude: 0,
      longitude: 0,
      kind: 'unknown',
      gid0: '',
      payload: {},
    }),
  }));
}

export async function deleteLocationPoints(nodeId: NodeId, pointIds: string[]): Promise<void> {
  if (!pointIds.length) return;
  const db = await getDb();
  await db.transaction('rw', db.groupEntities, async () => {
    for (const id of pointIds) {
      await db.groupEntities.delete([nodeId, id]);
    }
  });
}

export async function clearLocationPoints(nodeId: NodeId): Promise<void> {
  const db = await getDb();
  await db.groupEntities.where('nodeId').equals(nodeId).delete();
}
