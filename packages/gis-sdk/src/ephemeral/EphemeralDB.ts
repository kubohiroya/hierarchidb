import { Dexie, type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/core-types';
import { getDBName } from '@hierarchidb/util';
import type {
  BuildStage,
  EphemeralBuildSessionRecord,
  EphemeralBuildTaskRecord,
  EphemeralFetchCacheMetaRecord,
  EphemeralFetchCacheRecord,
  EphemeralTileIdToBufferRelation,
  EphemeralTransformCacheMetaRecord,
  EphemeralTransformCacheRecord,
  EphemeralTransformErrorRecord,
} from './EphemeralBuildState.js';
import {
  EPHEMERAL_DB_SCHEMA,
  EPHEMERAL_DB_SCHEMA_V1,
  EPHEMERAL_DB_SCHEMA_V2,
} from './EphemeralBuildState.js';

const applyTopLevelMods = <T extends object>(
  current: T,
  mods: Record<string, unknown>,
): T => {
  const next = { ...current } as Record<string, unknown>;
  const safeMods: Record<string, unknown> = {};
  Object.entries(mods).forEach(([key, value]) => {
    if (!key || key.includes('.')) return;
    safeMods[key] = value;
  });
  return Object.assign(next, safeMods) as T;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isEphemeralFetchCacheRecord = (value: unknown): value is EphemeralFetchCacheRecord => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.nodeId === 'string' &&
    typeof value.sourceKey === 'string' &&
    value.data instanceof ArrayBuffer &&
    typeof value.featureCount === 'number' &&
    Array.isArray(value.bbox) &&
    value.bbox.length === 4 &&
    value.bbox.every((value) => typeof value === 'number') &&
    typeof value.downloadTime === 'number' &&
    typeof value.timestamp === 'number' &&
    typeof value.size === 'number'
  );
};

const isEphemeralTransformCacheRecord = (value: unknown): value is EphemeralTransformCacheRecord => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.nodeId === 'string' &&
    typeof value.sourceKey === 'string' &&
    value.data instanceof ArrayBuffer &&
    typeof value.featureCount === 'number' &&
    typeof value.vertexCount === 'number' &&
    typeof value.polygonCount === 'number' &&
    typeof value.extractionRatio === 'number' &&
    typeof value.tolerance === 'number' &&
    typeof value.timestamp === 'number' &&
    typeof value.bandIndex === 'number'
  );
};

const toFetchCacheMeta = (record: EphemeralFetchCacheRecord): EphemeralFetchCacheMetaRecord => {
  return {
    id: record.id,
    nodeId: record.nodeId,
    sourceKey: record.sourceKey,
    countryCode: record.countryCode,
    adminLevel: record.adminLevel,
    featureCount: record.featureCount,
    bbox: record.bbox,
    downloadTime: record.downloadTime,
    size: record.size,
    metadata: record.metadata,
    timestamp: record.timestamp,
  };
};

const toTransformCacheMeta = (record: EphemeralTransformCacheRecord): EphemeralTransformCacheMetaRecord => {
  return {
    id: record.id,
    nodeId: record.nodeId,
    domainType: record.domainType,
    bandIndex: record.bandIndex,
    sourceKey: record.sourceKey,
    countryCode: record.countryCode,
    adminLevel: record.adminLevel,
    featureCount: record.featureCount,
    vertexCount: record.vertexCount,
    polygonCount: record.polygonCount,
    extractionRatio: record.extractionRatio,
    metadata: record.metadata,
    timestamp: record.timestamp,
  };
};

type HookTransaction = {
  storeNames?: string[] | { contains?: (name: string) => boolean };
  table: (name: string) => Table<unknown, string>;
};

const hasStore = (transaction: HookTransaction, storeName: string): boolean => {
  const { storeNames } = transaction;
  if (!storeNames) return false;
  if (Array.isArray(storeNames)) {
    return storeNames.includes(storeName);
  }
  if (typeof storeNames.contains === 'function') {
    return storeNames.contains(storeName);
  }
  return false;
};

const reportMetaSyncError = (label: string, error: unknown): void => {
  console.warn(`[EphemeralDB] failed to sync ${label}`, error);
};

const fireAndForgetMetaOperation = (operation: () => Promise<unknown>, label: string): void => {
  try {
    void Dexie.ignoreTransaction(operation).catch((error: unknown) => {
      reportMetaSyncError(label, error);
    });
  } catch (error) {
    reportMetaSyncError(`${label} (ignoreTransaction:sync-throw)`, error);
    const fallback = () => {
      void operation().catch((fallbackError: unknown) => {
        reportMetaSyncError(`${label} (fallback)`, fallbackError);
      });
    };
    if (typeof globalThis.queueMicrotask === 'function') {
      globalThis.queueMicrotask(fallback);
    } else {
      setTimeout(fallback, 0);
    }
  }
};

export class EphemeralDB extends Dexie {
  sessions!: Table<EphemeralBuildSessionRecord, string>;
  buildTasks!: Table<EphemeralBuildTaskRecord, string>;
  fetchCache!: Table<EphemeralFetchCacheRecord, string>;
  fetchCacheMeta!: Table<EphemeralFetchCacheMetaRecord, string>;
  transformCache!: Table<EphemeralTransformCacheRecord, string>;
  transformCacheMeta!: Table<EphemeralTransformCacheMetaRecord, string>;
  transformErrors!: Table<EphemeralTransformErrorRecord, string>;
  tileIdToBufferRelations!: Table<EphemeralTileIdToBufferRelation, string>;

  constructor(dbName: string = getDBName('ephemeral')) {
    super(dbName);
    this.version(1).stores(EPHEMERAL_DB_SCHEMA_V1);
    this.version(2).stores(EPHEMERAL_DB_SCHEMA_V2);
    this.version(3).stores(EPHEMERAL_DB_SCHEMA);
    this.version(4).stores(EPHEMERAL_DB_SCHEMA);

    this.sessions = this.table('sessions');
    this.buildTasks = this.table('buildTasks');
    this.fetchCache = this.table('fetchCache');
    this.fetchCacheMeta = this.table('fetchCacheMeta');
    this.transformCache = this.table('transformCache');
    this.transformCacheMeta = this.table('transformCacheMeta');
    this.transformErrors = this.table('transformErrors');
    this.tileIdToBufferRelations = this.table('tileIdToBufferRelations');

    this.fetchCache.hook('creating', (_primaryKey, record, transaction) => {
      const tx = transaction as HookTransaction;
      const meta = toFetchCacheMeta(record);
      if (hasStore(tx, 'fetchCacheMeta')) {
        void tx.table('fetchCacheMeta').put(meta);
        return;
      }
      fireAndForgetMetaOperation(() => this.fetchCacheMeta.put(meta), 'fetchCacheMeta:create');
    });
    this.fetchCache.hook('updating', (mods, _primaryKey, record, transaction) => {
      if (!isEphemeralFetchCacheRecord(record) || !isRecord(mods)) return;
      const next = applyTopLevelMods(record, mods);
      const tx = transaction as HookTransaction;
      const meta = toFetchCacheMeta(next);
      if (hasStore(tx, 'fetchCacheMeta')) {
        void tx.table('fetchCacheMeta').put(meta);
      } else {
        fireAndForgetMetaOperation(() => this.fetchCacheMeta.put(meta), 'fetchCacheMeta:update');
      }
      return mods;
    });
    this.fetchCache.hook('deleting', (primaryKey, _record, transaction) => {
      if (typeof primaryKey === 'string') {
        const tx = transaction as HookTransaction;
        if (hasStore(tx, 'fetchCacheMeta')) {
          void tx.table('fetchCacheMeta').delete(primaryKey);
          return;
        }
        fireAndForgetMetaOperation(
          () => this.fetchCacheMeta.delete(primaryKey),
          'fetchCacheMeta:delete',
        );
      }
    });

    this.transformCache.hook('creating', (_primaryKey, record, transaction) => {
      const tx = transaction as HookTransaction;
      const meta = toTransformCacheMeta(record);
      if (hasStore(tx, 'transformCacheMeta')) {
        void tx.table('transformCacheMeta').put(meta);
        return;
      }
      fireAndForgetMetaOperation(() => this.transformCacheMeta.put(meta), 'transformCacheMeta:create');
    });
    this.transformCache.hook('updating', (mods, _primaryKey, record, transaction) => {
      if (!isEphemeralTransformCacheRecord(record) || !isRecord(mods)) return;
      const next = applyTopLevelMods(record, mods);
      const tx = transaction as HookTransaction;
      const meta = toTransformCacheMeta(next);
      if (hasStore(tx, 'transformCacheMeta')) {
        void tx.table('transformCacheMeta').put(meta);
      } else {
        fireAndForgetMetaOperation(
          () => this.transformCacheMeta.put(meta),
          'transformCacheMeta:update',
        );
      }
      return mods;
    });
    this.transformCache.hook('deleting', (primaryKey, _record, transaction) => {
      if (typeof primaryKey === 'string') {
        const tx = transaction as HookTransaction;
        if (hasStore(tx, 'transformCacheMeta')) {
          void tx.table('transformCacheMeta').delete(primaryKey);
          return;
        }
        fireAndForgetMetaOperation(
          () => this.transformCacheMeta.delete(primaryKey),
          'transformCacheMeta:delete',
        );
      }
    });
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.fetchCacheMeta,
      this.transformCache,
      this.transformCacheMeta,
      this.sessions,
      this.tileIdToBufferRelations,
      this.buildTasks,
      this.transformErrors,
    ], async () => {
      await this.fetchCache.where('nodeId').equals(nodeId).delete();
      await this.fetchCacheMeta.where('nodeId').equals(nodeId).delete();
      await this.transformCache.where('nodeId').equals(nodeId).delete();
      await this.transformCacheMeta.where('nodeId').equals(nodeId).delete();
      await this.sessions.where('nodeId').equals(nodeId).delete();
      await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
      await this.buildTasks.where('nodeId').equals(nodeId).delete();
      await this.transformErrors.where('nodeId').equals(nodeId).delete();
    });
  }

  async hasStageData(nodeId: NodeId, stage: BuildStage): Promise<boolean> {
    return this.transaction('r', [this.fetchCacheMeta, this.transformCacheMeta, this.tileIdToBufferRelations], async () => {
      switch (stage) {
        case 'fetch':
          return (await this.fetchCacheMeta.where('nodeId').equals(nodeId).count()) > 0;
        case 'transform':
          return (await this.transformCacheMeta
            .where('[nodeId+timestamp]')
            .between([nodeId, 1], [nodeId, Dexie.maxKey])
            .count()) > 0;
        case 'vt':
          return (await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).count()) > 0;
        default:
          return false;
      }
    });
  }

  async clearStage(nodeId: NodeId, stage: BuildStage): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.fetchCacheMeta,
      this.transformCache,
      this.transformCacheMeta,
      this.sessions,
      this.tileIdToBufferRelations,
      this.transformErrors,
    ], async () => {
      switch (stage) {
        case 'fetch':
          await this.fetchCache.where('nodeId').equals(nodeId).delete();
          await this.fetchCacheMeta.where('nodeId').equals(nodeId).delete();
          break;
        case 'transform':
          await this.transformCache.where('nodeId').equals(nodeId).delete();
          await this.transformCacheMeta.where('nodeId').equals(nodeId).delete();
          await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
          await this.transformErrors.where('nodeId').equals(nodeId).delete();
          break;
        case 'vt':
          await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
          break;
        default:
          break;
      }
      await this.sessions.where('nodeId').equals(nodeId).delete();
    });
  }

  async getNumCaches(): Promise<{
    numFetchCaches: number;
    numTransformCaches: number;
    numSessions: number;
    totalSize: number;
  }> {
    return this.transaction('r', [this.fetchCacheMeta, this.transformCacheMeta, this.sessions], async () => {
      const [numFetchCaches, numTransformCaches, numSessions] = await Promise.all([
        this.fetchCacheMeta.count(),
        this.transformCacheMeta.count(),
        this.sessions.count(),
      ]);
      const rawBuffers = await this.fetchCacheMeta.toArray();
      const totalSize = rawBuffers.reduce((sum, buffer) => (
        sum + (typeof buffer.size === 'number' ? buffer.size : 0)
      ), 0);
      return {
        numFetchCaches,
        numTransformCaches,
        numSessions,
        totalSize,
      };
    });
  }

  async clearAll(): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.fetchCacheMeta,
      this.transformCache,
      this.transformCacheMeta,
      this.sessions,
      this.tileIdToBufferRelations,
      this.buildTasks,
      this.transformErrors,
    ], async () => {
      await Promise.all([
        this.fetchCache.clear(),
        this.fetchCacheMeta.clear(),
        this.transformCache.clear(),
        this.transformCacheMeta.clear(),
        this.sessions.clear(),
        this.tileIdToBufferRelations.clear(),
        this.buildTasks.clear(),
        this.transformErrors.clear(),
      ]);
    });
  }

  async createBuildTask(
    task: Omit<EphemeralBuildTaskRecord, 'taskId'> & { taskId?: string },
  ): Promise<EphemeralBuildTaskRecord> {
    const taskId = task.taskId ?? crypto.randomUUID();
    const fullTask: EphemeralBuildTaskRecord = {
      ...task,
      taskId,
    };
    await this.buildTasks.put(fullTask);
    return fullTask;
  }

  async updateBuildTask(taskId: string, updates: Partial<EphemeralBuildTaskRecord>): Promise<void> {
    await this.buildTasks.update(taskId, updates);
  }
}

export const ephemeralDB = new EphemeralDB();
