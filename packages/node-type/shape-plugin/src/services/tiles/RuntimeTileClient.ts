import { getShapeRuntimeWorkerClient } from '../batch/adapters/RuntimeWorkerClient';

export async function listTiles(sessionId: string) {
  const client = await getShapeRuntimeWorkerClient();
  if (!client) return [];
  return client.vectortile.listTiles(sessionId);
}

export async function getTile(sessionId: string, z: number, x: number, y: number): Promise<Uint8Array | null> {
  const client = await getShapeRuntimeWorkerClient();
  if (!client) return null;
  return client.vectortile.getTile(sessionId, z, x, y);
}

export async function getTileSummary(sessionId: string) {
  const client = await getShapeRuntimeWorkerClient();
  if (!client) return { tiles: 0, totalBytes: 0 };
  return client.vectortile.getSummary(sessionId);
}

