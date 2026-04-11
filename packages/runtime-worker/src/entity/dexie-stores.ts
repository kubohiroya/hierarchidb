import type { Table } from 'dexie';
import type { NodeId } from '@hierarchidb/core-types';
import type { FeatureStore, VectorTileStore } from './storeTypes.js';

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
  vectorTiles: {
    where: (index: string) => {
      equals: (nodeId: NodeId) => {
        toArray: () => Promise<TRecord[]>;
      };
    };
    bulkPut: (rows: VectorTileItem<TRecord>[]) => Promise<unknown>;
    bulkDelete: (itemIds: VectorTileItem<TRecord>['id'][]) => Promise<unknown>;
  };
};

type DexieFeatureDb<TRecord extends FeatureRowBase> = {
  features: Table<TRecord, TRecord['id']>;
};

type VectorTileItem<TRecord extends VectorTileRowBase> = TRecord & {
  id: string;
};

type TimestampField<TRecord extends VectorTileRowBase> = {
  [K in keyof TRecord]: TRecord[K] extends number ? K : never;
}[keyof TRecord];

export type DexieVectorTileStoreOptions<TRecord extends VectorTileRowBase> = {
  buildTileId?: (nodeId: NodeId, z: number, x: number, y: number) => string;
  timestampField?: TimestampField<TRecord>;
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
  const assignTimestamp = <K extends TimestampField<TRecord>>(
    row: VectorTileItem<TRecord>,
    key: K,
    value: number
  ): void => {
    const target = row as Record<TimestampField<TRecord>, number>;
    target[key] = value;
  };

  return {
    async list(nodeId: NodeId): Promise<VectorTileItem<TRecord>[]> {
      const rows = await db.vectorTiles.where('nodeId').equals(nodeId).toArray();
      return rows.map((row) => ({ ...row, id: row.tileId }));
    },
    async bulkUpsert(nodeId: NodeId, items: VectorTileItem<TRecord>[]): Promise<void> {
      if (!items.length) return;
      const now = Date.now();
      const rows: VectorTileItem<TRecord>[] = items.map((item) => {
        const { id: _id, ...rowBase } = item;
        const tileId = buildTileId(nodeId, item.z, item.x, item.y);
        const row = {
          ...rowBase,
          id: tileId,
          tileId,
          nodeId,
        } as VectorTileItem<TRecord>;
        if (timestampField) {
          assignTimestamp(row, timestampField, now);
        }
        return row;
      });
      await db.vectorTiles.bulkPut(rows);
    },
    async bulkDelete(_nodeId: NodeId, itemIds: Array<VectorTileItem<TRecord>['id']>): Promise<void> {
      await db.vectorTiles.bulkDelete(itemIds);
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
