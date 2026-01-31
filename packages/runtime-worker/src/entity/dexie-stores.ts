import type { Table } from 'dexie';
import type { NodeId } from '@hierarchidb/core-types';
import type { FeatureStore, VectorTileStore } from './store.js';

type VectorTileRowBase = {
  tileId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
};

type FeatureRowBase = {
  id: string | number;
  nodeId?: NodeId;
};

type DexieVectorTileDb<TRecord extends VectorTileRowBase> = {
  vectorTiles: Table<TRecord, string>;
};

type DexieFeatureDb<TRecord extends FeatureRowBase> = {
  features: Table<TRecord, TRecord['id']>;
};

type VectorTileItem<TRecord extends VectorTileRowBase> = TRecord & {
  id: string;
};

export type DexieVectorTileStoreOptions<TRecord extends VectorTileRowBase> = {
  buildTileId?: (nodeId: NodeId, z: number, x: number, y: number) => string;
  timestampField?: keyof TRecord;
};

export type DexieFeatureStoreOptions = {
  attachNodeId?: boolean;
};

const defaultBuildTileId = (nodeId: NodeId, z: number, x: number, y: number): string =>
  `${nodeId}-${z}-${x}-${y}`;

export function createDexieVectorTileStore<TRecord extends VectorTileRowBase>(
  db: DexieVectorTileDb<TRecord>,
  options: DexieVectorTileStoreOptions<TRecord> = {},
): VectorTileStore<VectorTileItem<TRecord>> {
  const buildTileId = options.buildTileId ?? defaultBuildTileId;
  const timestampField = options.timestampField;

  return {
    async list(nodeId: NodeId): Promise<VectorTileItem<TRecord>[]> {
      const rows = await db.vectorTiles.where('nodeId').equals(nodeId).toArray();
      return rows.map((row) => ({ ...row, id: row.tileId }));
    },
    async bulkUpsert(nodeId: NodeId, items: VectorTileItem<TRecord>[]): Promise<void> {
      if (!items.length) return;
      const now = Date.now();
      const rows = items.map((item) => {
        const { id: _id, ...rest } = item as VectorTileItem<TRecord> & { id?: string };
        const row = {
          ...rest,
          tileId: buildTileId(nodeId, item.z, item.x, item.y),
          nodeId,
        } as unknown as TRecord;
        if (timestampField) {
          (row as Record<string, unknown>)[timestampField as string] = now;
        }
        return row;
      });
      await db.vectorTiles.bulkPut(rows);
    },
    async bulkDelete(_nodeId: NodeId, itemIds: Array<VectorTileItem<TRecord>['id']>): Promise<void> {
      await db.vectorTiles.bulkDelete(itemIds as Array<string>);
    },
  };
}

export function createDexieFeatureStore<TRecord extends FeatureRowBase>(
  db: DexieFeatureDb<TRecord>,
  options: DexieFeatureStoreOptions = {},
): FeatureStore<TRecord> {
  const attachNodeId = options.attachNodeId ?? true;

  return {
    async list(nodeId: NodeId): Promise<TRecord[]> {
      const rows = await db.features.where('nodeId').equals(nodeId).toArray();
      return rows.map((row) => ({ ...row }));
    },
    async bulkUpsert(nodeId: NodeId, items: TRecord[]): Promise<void> {
      if (!items.length) return;
      const rows = items.map((item) =>
        attachNodeId ? ({ ...item, nodeId } as TRecord) : ({ ...item } as TRecord),
      );
      await db.features.bulkPut(rows);
    },
    async bulkDelete(_nodeId: NodeId, itemIds: Array<TRecord['id']>): Promise<void> {
      await db.features.bulkDelete(itemIds);
    },
  };
}
