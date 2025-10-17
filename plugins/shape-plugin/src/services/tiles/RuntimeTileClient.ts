import { getShapeRuntimeWorkerClient } from '../batch/adapters/RuntimeWorkerClient.js';

export async function listTiles(sessionId: string) {
  const client = await getShapeRuntimeWorkerClient();
  const vectorTile = client?.vectortile;
  if (!vectorTile?.listTiles) return [];
  return vectorTile.listTiles(sessionId) ?? [];
}

export async function getTile(sessionId: string, z: number, x: number, y: number): Promise<Uint8Array | null> {
  const client = await getShapeRuntimeWorkerClient();
  const vectorTile = client?.vectortile;
  if (!vectorTile?.getTile) return null;
  const result = await vectorTile.getTile(sessionId, z, x, y);
  if (!result) return null;
  return result instanceof Uint8Array ? result : new Uint8Array(result);
}

export async function getTileSummary(sessionId: string) {
  const client = await getShapeRuntimeWorkerClient();
  const vectorTile = client?.vectortile;
  if (!vectorTile?.getSummary) return { tiles: 0, totalBytes: 0 };
  return vectorTile.getSummary(sessionId);
}
