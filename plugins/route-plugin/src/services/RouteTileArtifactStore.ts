import type { NodeId } from '@hierarchidb/core-types';
import { getRouteDB, type RouteDB, type RouteVectorTileRecord } from '@hierarchidb/route-store';
import { packTileId, type VtTileWriter } from '@hierarchidb/vt-orchestrator';

export type RouteTileArtifactStore = Pick<RouteDB, 'open' | 'vectorTiles'>;

export type RouteTileArtifactWriter = {
  clear: () => Promise<void>;
  write: VtTileWriter;
  requirePersistedArtifacts: () => Promise<RouteVectorTileRecord[]>;
};

export const createRouteTileArtifactWriter = (params: {
  nodeId: NodeId;
  signal?: AbortSignal;
  store?: RouteTileArtifactStore;
}): RouteTileArtifactWriter => {
  const store = params.store ?? getRouteDB();
  const writtenTileKeys = new Set<string>();

  const requireActive = (): void => {
    if (params.signal?.aborted) {
      throw abortError('Route tile artifact persistence was paused');
    }
  };

  return {
    clear: async () => {
      requireActive();
      await store.open();
      await store.vectorTiles.where('nodeId').equals(params.nodeId).delete();
      const remaining = await store.vectorTiles.where('nodeId').equals(params.nodeId).count();
      if (remaining !== 0) {
        throw new Error('[route tileEmit] existing vector tiles were not cleared');
      }
      requireActive();
    },
    write: async ({ tileId, z, x, y, data, layers }) => {
      requireActive();
      requireTileCoordinate(tileId, z, x, y);
      if (!(data instanceof ArrayBuffer) || data.byteLength === 0) {
        throw new Error('[route tileEmit] generated MVT data must be a non-empty ArrayBuffer');
      }
      if (Object.keys(layers).length === 0) {
        throw new Error('[route tileEmit] generated MVT must contain at least one layer');
      }
      const tileKey = buildRouteVectorTileKey(params.nodeId, z, x, y);
      if (writtenTileKeys.has(tileKey)) {
        throw new Error(`[route tileEmit] duplicate tile output ${tileKey}`);
      }
      const timestamp = Date.now();
      if (!Number.isFinite(timestamp) || timestamp <= 0) {
        throw new Error('[route tileEmit] tile timestamp must be a positive finite number');
      }
      const record: RouteVectorTileRecord = {
        tileId: tileKey,
        nodeId: params.nodeId,
        z,
        x,
        y,
        data: data.slice(0),
        size: data.byteLength,
        contentType: 'application/vnd.mapbox-vector-tile',
        timestamp,
      };
      await store.vectorTiles.put(record);
      const persisted = await store.vectorTiles.get(tileKey);
      requirePersistedTile(record, persisted);
      writtenTileKeys.add(tileKey);
      requireActive();
    },
    requirePersistedArtifacts: async () => {
      requireActive();
      const rows = await store.vectorTiles.where('nodeId').equals(params.nodeId).toArray();
      if (rows.length === 0) {
        throw new Error('[route tileEmit] completed stage must persist at least one vector tile');
      }
      for (const row of rows) {
        requirePersistedTile(row, row);
      }
      requireActive();
      return rows;
    },
  };
};

export const buildRouteVectorTileKey = (nodeId: NodeId, z: number, x: number, y: number): string =>
  `${String(nodeId)}-${String(z)}-${String(x)}-${String(y)}`;

const requireTileCoordinate = (tileId: number, z: number, x: number, y: number): void => {
  if (
    !Number.isInteger(z) ||
    z < 0 ||
    z > 22 ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= 2 ** z ||
    y >= 2 ** z ||
    packTileId(x, y, z) !== tileId
  ) {
    throw new Error(
      `[route tileEmit] invalid generated tile coordinate: tileId=${String(tileId)}, z=${String(z)}, x=${String(x)}, y=${String(y)}`
    );
  }
};

const requirePersistedTile = (
  expected: RouteVectorTileRecord,
  actual: RouteVectorTileRecord | undefined
): void => {
  if (!actual) {
    throw new Error(`[route tileEmit] vector tile ${expected.tileId} is missing after persistence`);
  }
  if (
    actual.tileId !== expected.tileId ||
    actual.nodeId !== expected.nodeId ||
    actual.z !== expected.z ||
    actual.x !== expected.x ||
    actual.y !== expected.y ||
    actual.size !== expected.size ||
    actual.contentType !== 'application/vnd.mapbox-vector-tile' ||
    !Number.isFinite(actual.timestamp) ||
    actual.timestamp <= 0 ||
    !(actual.data instanceof ArrayBuffer) ||
    actual.data.byteLength !== expected.size ||
    !equalBytes(actual.data, expected.data)
  ) {
    throw new Error(`[route tileEmit] vector tile ${expected.tileId} failed read-back validation`);
  }
};

const equalBytes = (left: ArrayBuffer, right: ArrayBuffer): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  for (let index = 0; index < leftBytes.length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return false;
  }
  return true;
};

const abortError = (message: string): Error => {
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'AbortError');
  }
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
};
