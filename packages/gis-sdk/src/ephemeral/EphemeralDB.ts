import { Dexie, type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/core-types';
import { getDBName } from '@hierarchidb/util';
import type {
  BuildSessionRecord,
  BuildSessionHeartbeat,
  BuildSessionStatus,
  BuildStage,
  BuildStageStatus,
  EphemeralBuildTaskRecord,
  EphemeralSourceCacheMetaRecord,
  EphemeralSourceCacheRecord,
  EphemeralTileIdToBufferRelation,
  EphemeralGeometryCacheMetaRecord,
  EphemeralGeometryCacheRecord,
  EphemeralGeometryErrorRecord,
} from './EphemeralDBRecordTypes';
import {
  EPHEMERAL_DB_SCHEMA_V1,
  EPHEMERAL_DB_SCHEMA_V2,
  EPHEMERAL_DB_SCHEMA_V3,
} from './EphemeralDBRecordTypes';

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

const isEphemeralSourceCacheRecord = (value: unknown): value is EphemeralSourceCacheRecord => {
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

const isEphemeralGeometryCacheRecord = (value: unknown): value is EphemeralGeometryCacheRecord => {
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

const toSourceCacheMeta = (record: EphemeralSourceCacheRecord): EphemeralSourceCacheMetaRecord => {
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

const toGeometryCacheMeta = (record: EphemeralGeometryCacheRecord): EphemeralGeometryCacheMetaRecord => {
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
  // V3 normalized tables
  buildSessions!: Table<BuildSessionRecord, string>;
  buildSessionHeartbeats!: Table<BuildSessionHeartbeat, string>;
  buildSessionStatuses!: Table<BuildSessionStatus, string>;
  buildStageStatuses!: Table<BuildStageStatus, string>;
  
  // Other tables
  buildTasks!: Table<EphemeralBuildTaskRecord, string>;
  sourceCache!: Table<EphemeralSourceCacheRecord, string>;
  sourceCacheMeta!: Table<EphemeralSourceCacheMetaRecord, string>;
  geometryCache!: Table<EphemeralGeometryCacheRecord, string>;
  geometryCacheMeta!: Table<EphemeralGeometryCacheMetaRecord, string>;
  geometryErrors!: Table<EphemeralGeometryErrorRecord, string>;
  tileEmitBufferRelations!: Table<EphemeralTileIdToBufferRelation, string>;

  constructor(dbName: string = getDBName('ephemeral')) {
    super(dbName);
    this.version(1).stores(EPHEMERAL_DB_SCHEMA_V1);
    this.version(2).stores(EPHEMERAL_DB_SCHEMA_V2);
    this.version(3).stores(EPHEMERAL_DB_SCHEMA_V3);
    // V4: Explicitly remove old sessions table
    this.version(4).stores({
      ...EPHEMERAL_DB_SCHEMA_V3,
      sessions: null, // Remove old sessions table
    });

    // V3 normalized tables
    this.buildSessions = this.table('buildSessions');
    this.buildSessionHeartbeats = this.table('buildSessionHeartbeats');
    this.buildSessionStatuses = this.table('buildSessionStatuses');
    this.buildStageStatuses = this.table('buildStageStatuses');
    
    // Other tables
    this.buildTasks = this.table('buildTasks');
    this.sourceCache = this.table('sourceCache');
    this.sourceCacheMeta = this.table('sourceCacheMeta');
    this.geometryCache = this.table('geometryCache');
    this.geometryCacheMeta = this.table('geometryCacheMeta');
    this.geometryErrors = this.table('geometryErrors');
    this.tileEmitBufferRelations = this.table('tileEmitBufferRelations');

    this.sourceCache.hook('creating', (_primaryKey, record, transaction) => {
      const tx = transaction as HookTransaction;
      const meta = toSourceCacheMeta(record);
      if (hasStore(tx, 'sourceCacheMeta')) {
        void tx.table('sourceCacheMeta').put(meta);
        return;
      }
      fireAndForgetMetaOperation(() => this.sourceCacheMeta.put(meta), 'sourceCacheMeta:create');
    });
    this.sourceCache.hook('updating', (mods, _primaryKey, record, transaction) => {
      if (!isEphemeralSourceCacheRecord(record) || !isRecord(mods)) return;
      const next = applyTopLevelMods(record, mods);
      const tx = transaction as HookTransaction;
      const meta = toSourceCacheMeta(next);
      if (hasStore(tx, 'sourceCacheMeta')) {
        void tx.table('sourceCacheMeta').put(meta);
      } else {
        fireAndForgetMetaOperation(() => this.sourceCacheMeta.put(meta), 'sourceCacheMeta:update');
      }
      return mods;
    });
    this.sourceCache.hook('deleting', (primaryKey, _record, transaction) => {
      if (typeof primaryKey === 'string') {
        const tx = transaction as HookTransaction;
        if (hasStore(tx, 'sourceCacheMeta')) {
          void tx.table('sourceCacheMeta').delete(primaryKey);
          return;
        }
        fireAndForgetMetaOperation(
          () => this.sourceCacheMeta.delete(primaryKey),
          'sourceCacheMeta:delete',
        );
      }
    });

    this.geometryCache.hook('creating', (_primaryKey, record, transaction) => {
      const tx = transaction as HookTransaction;
      const meta = toGeometryCacheMeta(record);
      if (hasStore(tx, 'geometryCacheMeta')) {
        void tx.table('geometryCacheMeta').put(meta);
        return;
      }
      fireAndForgetMetaOperation(() => this.geometryCacheMeta.put(meta), 'geometryCacheMeta:create');
    });
    this.geometryCache.hook('updating', (mods, _primaryKey, record, transaction) => {
      if (!isEphemeralGeometryCacheRecord(record) || !isRecord(mods)) return;
      const next = applyTopLevelMods(record, mods);
      const tx = transaction as HookTransaction;
      const meta = toGeometryCacheMeta(next);
      if (hasStore(tx, 'geometryCacheMeta')) {
        void tx.table('geometryCacheMeta').put(meta);
      } else {
        fireAndForgetMetaOperation(
          () => this.geometryCacheMeta.put(meta),
          'geometryCacheMeta:update',
        );
      }
      return mods;
    });
    this.geometryCache.hook('deleting', (primaryKey, _record, transaction) => {
      if (typeof primaryKey === 'string') {
        const tx = transaction as HookTransaction;
        if (hasStore(tx, 'geometryCacheMeta')) {
          void tx.table('geometryCacheMeta').delete(primaryKey);
          return;
        }
        fireAndForgetMetaOperation(
          () => this.geometryCacheMeta.delete(primaryKey),
          'geometryCacheMeta:delete',
        );
      }
    });
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await this.transaction('rw', [
      this.sourceCache,
      this.sourceCacheMeta,
      this.geometryCache,
      this.geometryCacheMeta,
      this.buildSessions,
      this.buildSessionHeartbeats,
      this.buildSessionStatuses,
      this.buildStageStatuses,
      this.tileEmitBufferRelations,
      this.buildTasks,
      this.geometryErrors,
    ], async () => {
      await this.sourceCache.where('nodeId').equals(nodeId).delete();
      await this.sourceCacheMeta.where('nodeId').equals(nodeId).delete();
      await this.geometryCache.where('nodeId').equals(nodeId).delete();
      await this.geometryCacheMeta.where('nodeId').equals(nodeId).delete();
      await this.buildSessions.where('nodeId').equals(nodeId).delete();
      await this.buildSessionHeartbeats.where('nodeId').equals(nodeId).delete();
      await this.buildSessionStatuses.where('nodeId').equals(nodeId).delete();
      await this.buildStageStatuses.where('nodeId').equals(nodeId).delete();
      await this.tileEmitBufferRelations.where('nodeId').equals(nodeId).delete();
      await this.buildTasks.where('nodeId').equals(nodeId).delete();
      await this.geometryErrors.where('nodeId').equals(nodeId).delete();
    });
  }

  async hasStageData(nodeId: NodeId, stage: BuildStage): Promise<boolean> {
    return this.transaction('r', [this.sourceCacheMeta, this.geometryCacheMeta, this.tileEmitBufferRelations], async () => {
      switch (stage) {
        case 'source':
          return (await this.sourceCacheMeta.where('nodeId').equals(nodeId).count()) > 0;
        case 'geometry':
          return (await this.geometryCacheMeta
            .where('[nodeId+timestamp]')
            .between([nodeId, 1], [nodeId, Dexie.maxKey])
            .count()) > 0;
        case 'tileEmit':
          return (await this.tileEmitBufferRelations.where('nodeId').equals(nodeId).count()) > 0;
        default:
          return false;
      }
    });
  }

  async clearStage(nodeId: NodeId, stage: BuildStage): Promise<void> {
    await this.transaction('rw', [
      this.sourceCache,
      this.sourceCacheMeta,
      this.geometryCache,
      this.geometryCacheMeta,
      this.buildSessions,
      this.buildSessionHeartbeats,
      this.buildSessionStatuses,
      this.buildStageStatuses,
      this.tileEmitBufferRelations,
      this.geometryErrors,
    ], async () => {
      switch (stage) {
        case 'source':
          await this.sourceCache.where('nodeId').equals(nodeId).delete();
          await this.sourceCacheMeta.where('nodeId').equals(nodeId).delete();
          break;
        case 'geometry':
          await this.geometryCache.where('nodeId').equals(nodeId).delete();
          await this.geometryCacheMeta.where('nodeId').equals(nodeId).delete();
          await this.tileEmitBufferRelations.where('nodeId').equals(nodeId).delete();
          await this.geometryErrors.where('nodeId').equals(nodeId).delete();
          break;
        case 'tileEmit':
          await this.tileEmitBufferRelations.where('nodeId').equals(nodeId).delete();
          break;
        default:
          break;
      }
      await this.buildSessions.where('nodeId').equals(nodeId).delete();
      await this.buildSessionHeartbeats.where('nodeId').equals(nodeId).delete();
      await this.buildSessionStatuses.where('nodeId').equals(nodeId).delete();
      await this.buildStageStatuses.where('nodeId').equals(nodeId).delete();
    });
  }

  async getNumCaches(): Promise<{
    numSourceCaches: number;
    numGeometryCaches: number;
    numSessions: number;
    totalSize: number;
  }> {
    return this.transaction('r', [this.sourceCacheMeta, this.geometryCacheMeta, this.buildSessions], async () => {
      const [numSourceCaches, numGeometryCaches, numSessions] = await Promise.all([
        this.sourceCacheMeta.count(),
        this.geometryCacheMeta.count(),
        this.buildSessions.count(),
      ]);
      const rawBuffers = await this.sourceCacheMeta.toArray();
      const totalSize = rawBuffers.reduce((sum, buffer) => (
        sum + (typeof buffer.size === 'number' ? buffer.size : 0)
      ), 0);
      return {
        numSourceCaches,
        numGeometryCaches,
        numSessions,
        totalSize,
      };
    });
  }

  async clearAll(): Promise<void> {
    await this.transaction('rw', [
      this.sourceCache,
      this.sourceCacheMeta,
      this.geometryCache,
      this.geometryCacheMeta,
      this.buildSessions,
      this.buildSessionHeartbeats,
      this.buildSessionStatuses,
      this.buildStageStatuses,
      this.tileEmitBufferRelations,
      this.buildTasks,
      this.geometryErrors,
    ], async () => {
      await Promise.all([
        this.sourceCache.clear(),
        this.sourceCacheMeta.clear(),
        this.geometryCache.clear(),
        this.geometryCacheMeta.clear(),
        this.buildSessions.clear(),
        this.buildSessionHeartbeats.clear(),
        this.buildSessionStatuses.clear(),
        this.buildStageStatuses.clear(),
        this.tileEmitBufferRelations.clear(),
        this.buildTasks.clear(),
        this.geometryErrors.clear(),
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
