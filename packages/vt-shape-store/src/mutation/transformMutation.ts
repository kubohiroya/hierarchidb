import type { NodeId } from '@hierarchidb/common-types';
import type { Band3Reservation, TileIndexRow, TransformBuffer, TransformBufferPayload } from '../types.js';
import { SHAPE_DOMAIN, bandIdToZBase, buildTransformBufferId } from '../ids.js';
import type { VtShapeDb } from '../db/shapeDb.js';

export async function putTransformBuffer(
  db: VtShapeDb,
  nodeId: NodeId,
  bandId: number,
  payload: TransformBufferPayload
): Promise<TransformBuffer> {
  const buffer: TransformBuffer = {
    id: buildTransformBufferId(nodeId, bandId, payload.sourceKey),
    nodeId,
    bandId,
    domainType: SHAPE_DOMAIN,
    sourceKey: payload.sourceKey,
    countryCode: payload.countryCode,
    adminLevel: payload.adminLevel,
    data: payload.data,
    featureCount: payload.featureCount,
    vertexCount: payload.vertexCount,
    timestamp: payload.timestamp ?? Date.now(),
  };
  await db.transformBandBuffers.put(buffer);
  return buffer;
}

export async function putTileIndexBand(
  db: VtShapeDb,
  nodeId: NodeId,
  bandId: number,
  tileId: number,
  bufferId: string
): Promise<TileIndexRow> {
  const row: TileIndexRow = {
    nodeId,
    bandId,
    zBase: bandIdToZBase(bandId),
    tileId,
    bufferId,
  };
  await db.tileIndexBand.put(row);
  return row;
}

export async function reserveBand3Tile(
  db: VtShapeDb,
  nodeId: NodeId,
  tileId: number
): Promise<Band3Reservation> {
  const reservation: Band3Reservation = {
    nodeId,
    tileId,
    createdAt: Date.now(),
  };
  await db.vtBand3Reservations.put(reservation);
  return reservation;
}
