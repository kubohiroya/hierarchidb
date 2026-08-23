// Minimal stub for @hierarchidb/runtime-worker-worker used in Vitest.
// Location plugin unit tests do not execute real worker logic; this file
// satisfies dynamic imports originating from runtime-worker-shared module paths.

export const workerBootstrap = {
  initialize: async () => undefined,
};

export const workerAPI = {
  startBuildSession: async () => ({
    nodeId: 'stub-node',
    status: 'running' as const,
  }),
  getBuildSessionStatus: async () => ({
    nodeId: 'stub-node',
    status: 'running' as const,
  }),
  pauseBuildSession: async () => undefined,
  subscribeTaskProgress: async () => () => undefined,
};

const defaultBuildTileId = (nodeId: string, z: number, x: number, y: number): string =>
  `${nodeId}-${String(z)}-${String(x)}-${String(y)}`;

export const createDexieVectorTileStore = <
  TRecord extends {
    tileId: string;
    nodeId: string;
    z: number;
    x: number;
    y: number;
  },
>(
  db: {
    vectorTiles: {
      where: (index: string) => {
        equals: (value: string) => {
          toArray: () => Promise<TRecord[]>;
        };
      };
      bulkPut: (rows: Array<TRecord & { id: string }>) => Promise<unknown>;
      bulkDelete: (ids: string[]) => Promise<unknown>;
    };
  },
  options: {
    buildTileId?: (nodeId: string, z: number, x: number, y: number) => string;
    timestampField?: keyof TRecord;
  } = {}
) => ({
  async list(nodeId: string) {
    const rows = await db.vectorTiles.where('nodeId').equals(nodeId).toArray();
    return rows.map((row) => ({ ...row, id: row.tileId }));
  },
  async bulkUpsert(nodeId: string, items: Array<TRecord & { id: string }>) {
    const buildTileId = options.buildTileId ?? defaultBuildTileId;
    const now = Date.now();
    const rows = items.map((item) => {
      const tileId = buildTileId(nodeId, item.z, item.x, item.y);
      const row = {
        ...item,
        id: tileId,
        tileId,
        nodeId,
      };
      if (options.timestampField) {
        Object.assign(row, { [options.timestampField]: now });
      }
      return row;
    });
    await db.vectorTiles.bulkPut(rows);
  },
  async bulkDelete(_nodeId: string, ids: string[]) {
    await db.vectorTiles.bulkDelete(ids);
  },
});

export default {
  createDexieVectorTileStore,
  workerBootstrap,
  workerAPI,
};
