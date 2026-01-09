import type { VtMutationOptions, VtTilePayload, VtTileRecord } from '../types.js';
import { buildVtTileKey } from '../keys.js';
import type { VtDb } from '../db/vtDb.js';

export async function putTile(
  db: VtDb,
  payload: VtTilePayload
): Promise<VtTileRecord> {
  const id = buildVtTileKey(payload.tileId, payload.bufferSetHash);
  const data = payload.data;
  const size = payload.size ?? data.byteLength;
  const record: VtTileRecord = {
    id,
    nodeId: payload.nodeId,
    tileId: payload.tileId,
    z: payload.z,
    x: payload.x,
    y: payload.y,
    layer: payload.layer,
    bufferSetHash: payload.bufferSetHash,
    data,
    size,
    contentType: payload.contentType,
    timestamp: payload.timestamp ?? Date.now(),
  };
  await db.vtTiles.put(record);
  return record;
}

export async function bulkPutTiles(
  db: VtDb,
  tiles: VtTilePayload[]
): Promise<void> {
  if (tiles.length === 0) return;
  const records: VtTileRecord[] = tiles.map((tile) => {
    const id = buildVtTileKey(tile.tileId, tile.bufferSetHash);
    const size = tile.size ?? tile.data.byteLength;
    return {
      id,
      nodeId: tile.nodeId,
      tileId: tile.tileId,
      z: tile.z,
      x: tile.x,
      y: tile.y,
      layer: tile.layer,
      bufferSetHash: tile.bufferSetHash,
      data: tile.data,
      size,
      contentType: tile.contentType,
      timestamp: tile.timestamp ?? Date.now(),
    };
  });
  await db.vtTiles.bulkPut(records);
}

export async function deleteTile(
  db: VtDb,
  options: VtMutationOptions
): Promise<void> {
  const id = buildVtTileKey(options.tileId, options.bufferSetHash);
  await db.vtTiles.delete(id);
}

export async function deleteTilesByNode(
  db: VtDb,
  nodeId: VtMutationOptions['nodeId']
): Promise<void> {
  await db.vtTiles.where('nodeId').equals(nodeId).delete();
}
