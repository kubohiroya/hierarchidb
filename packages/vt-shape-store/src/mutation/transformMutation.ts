import type { NodeId } from '@hierarchidb/common-types';
import type { TransformByZoomReservation, TransformByZoomCacheRecord, TransformByBandCacheRecord, TransformByBandCachePayload } from '../types.js';
import { SHAPE_DOMAIN, bandIdToZBase, buildTransformByBandCacheRecordId } from '../ids.js';
import type { VtShapeDb } from '../db/shapeDb.js';

export async function putTransformByBandCache(
  db: VtShapeDb,
  nodeId: NodeId,
  bandId: number,
  payload: TransformByBandCachePayload
): Promise<TransformByBandCacheRecord> {
  const buffer: TransformByBandCacheRecord = {
    id: buildTransformByBandCacheRecordId(nodeId, bandId, payload.sourceKey),
    nodeId,
    bandId,
    domainType: SHAPE_DOMAIN,
    sourceKey: payload.sourceKey,
    countryCode: payload.countryCode,
    adminLevel: payload.adminLevel,
    data: payload.data,
    featureCount: payload.featureCount,
    vertexCount: payload.vertexCount,
    polygonCount: payload.polygonCount,
    timestamp: payload.timestamp ?? Date.now(),
  };
  await db.transformByBandCache.put(buffer);
  return buffer;
}

export async function putTransformByZoomCache(
  db: VtShapeDb,
  nodeId: NodeId,
  bandId: number,
  tileId: number,
  bufferId: string
): Promise<TransformByZoomCacheRecord> {
  const row: TransformByZoomCacheRecord = {
    nodeId,
    bandId,
    zBase: bandIdToZBase(bandId),
    tileId,
    bufferId,
  };
  await db.transformByZoomCache.put(row);
  return row;
}

export async function reserveTransformByZoomTile(
  db: VtShapeDb,
  nodeId: NodeId,
  tileId: number
): Promise<TransformByZoomReservation> {
  const reservation: TransformByZoomReservation = {
    nodeId,
    tileId,
    createdAt: Date.now(),
  };
  await db.transformByZoomReservations.put(reservation);
  return reservation;
}
