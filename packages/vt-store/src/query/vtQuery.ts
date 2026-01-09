import type { VtQueryOptions, VtTileRecord } from '../types.js';
import { buildVtTileKey } from '../keys.js';
import type { VtDb } from '../db/vtDb.js';

export async function getTile(
  db: VtDb,
  options: VtQueryOptions
): Promise<VtTileRecord | null> {
  const id = buildVtTileKey(options.tileId, options.bufferSetHash);
  return (await db.vtTiles.get(id)) ?? null;
}

export async function listTilesByLayer(
  db: VtDb,
  nodeId: VtQueryOptions['nodeId'],
  layer: VtQueryOptions['layer']
): Promise<VtTileRecord[]> {
  return db.vtTiles.where('[nodeId+layer]').equals([nodeId, layer]).toArray();
}
