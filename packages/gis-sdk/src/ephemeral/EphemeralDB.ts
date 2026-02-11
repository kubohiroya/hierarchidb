import { Dexie, type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/core-types';
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
import { EPHEMERAL_DB_SCHEMA } from './EphemeralBuildState.js';

const EPHEMERAL_DB_SCHEMA_V3: Record<string, string> = {
  sessions:
    '&nodeId, domainType, status, updatedAt'
    + ', [domainType+status], [domainType+updatedAt]',
  buildTasks:
    '&taskId, nodeId, domainType, taskType, status, index, stagePriority, sequence'
    + ', [nodeId+status], [nodeId+taskType], [nodeId+stage], [nodeId+taskType+status], [nodeId+taskType+stagePriority]'
    + ', [nodeId+index], [nodeId+status+index], [nodeId+taskType+index], [nodeId+taskType+status+index]'
    + ', [domainType+status]',
  fetchCache:
    '&id, nodeId, domainType, [nodeId+sourceKey], [nodeId+countryCode+adminLevel]',
  transformCache:
    '&id, nodeId, domainType, [nodeId+bandIndex], [nodeId+countryCode+adminLevel]',
  transformErrors:
    '&id, nodeId, domainType',
  tileIdToBufferRelations:
    '&id, nodeId, domainType, bufferId, [nodeId+bandIndex], [nodeId+bandIndex+tileId]',
};

const applyTopLevelMods = <T extends Record<string, unknown>>(
  current: T,
  mods: Record<string, unknown>,
): T => {
  const next = { ...current };
  Object.entries(mods).forEach(([key, value]) => {
    if (!key || key.includes('.')) return;
    next[key as keyof T] = value as T[keyof T];
  });
  return next;
};

const toFetchCacheMeta = (record: EphemeralFetchCacheRecord): EphemeralFetchCacheMetaRecord => {
  const { data, ...meta } = record;
  void data;
  return meta;
};

const toTransformCacheMeta = (record: EphemeralTransformCacheRecord): EphemeralTransformCacheMetaRecord => {
  const { data, ...meta } = record;
  void data;
  return meta;
};

export abstract class EphemeralDB extends Dexie {
  sessions!: Table<EphemeralBuildSessionRecord, string>;
  buildTasks!: Table<EphemeralBuildTaskRecord, string>;
  fetchCache!: Table<EphemeralFetchCacheRecord, string>;
  fetchCacheMeta!: Table<EphemeralFetchCacheMetaRecord, string>;
  transformCache!: Table<EphemeralTransformCacheRecord, string>;
  transformCacheMeta!: Table<EphemeralTransformCacheMetaRecord, string>;
  transformErrors!: Table<EphemeralTransformErrorRecord, string>;
  tileIdToBufferRelations!: Table<EphemeralTileIdToBufferRelation, string>;

  protected constructor(dbName: string) {
    super(dbName);
    this.version(3).stores(EPHEMERAL_DB_SCHEMA_V3);
    this.version(4).stores(EPHEMERAL_DB_SCHEMA).upgrade(async (tx) => {
      const fetchRows = await tx.table('fetchCache').toArray() as EphemeralFetchCacheRecord[];
      if (fetchRows.length > 0) {
        await tx.table('fetchCacheMeta').bulkPut(fetchRows.map(toFetchCacheMeta));
      }
      const transformRows = await tx.table('transformCache').toArray() as EphemeralTransformCacheRecord[];
      if (transformRows.length > 0) {
        await tx.table('transformCacheMeta').bulkPut(transformRows.map(toTransformCacheMeta));
      }
    });
    this.version(5).stores(EPHEMERAL_DB_SCHEMA);
    this.version(6).stores(EPHEMERAL_DB_SCHEMA);

    this.sessions = this.table('sessions');
    this.buildTasks = this.table('buildTasks');
    this.fetchCache = this.table('fetchCache');
    this.fetchCacheMeta = this.table('fetchCacheMeta');
    this.transformCache = this.table('transformCache');
    this.transformCacheMeta = this.table('transformCacheMeta');
    this.transformErrors = this.table('transformErrors');
    this.tileIdToBufferRelations = this.table('tileIdToBufferRelations');

    this.fetchCache.hook('creating', (_primaryKey, record, transaction) => {
      transaction.table('fetchCacheMeta').put(toFetchCacheMeta(record));
    });
    this.fetchCache.hook('updating', (mods, _primaryKey, record, transaction) => {
      if (!record) return;
      const next = applyTopLevelMods(
        record as unknown as Record<string, unknown>,
        mods as Record<string, unknown>,
      ) as unknown as EphemeralFetchCacheRecord;
      transaction.table('fetchCacheMeta').put(toFetchCacheMeta(next));
      return mods;
    });
    this.fetchCache.hook('deleting', (primaryKey, _record, transaction) => {
      if (typeof primaryKey === 'string') {
        transaction.table('fetchCacheMeta').delete(primaryKey);
      }
    });

    this.transformCache.hook('creating', (_primaryKey, record, transaction) => {
      transaction.table('transformCacheMeta').put(toTransformCacheMeta(record));
    });
    this.transformCache.hook('updating', (mods, _primaryKey, record, transaction) => {
      if (!record) return;
      const next = applyTopLevelMods(
        record as unknown as Record<string, unknown>,
        mods as Record<string, unknown>,
      ) as unknown as EphemeralTransformCacheRecord;
      transaction.table('transformCacheMeta').put(toTransformCacheMeta(next));
      return mods;
    });
    this.transformCache.hook('deleting', (primaryKey, _record, transaction) => {
      if (typeof primaryKey === 'string') {
        transaction.table('transformCacheMeta').delete(primaryKey);
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
    } as EphemeralBuildTaskRecord;
    await this.buildTasks.put(fullTask);
    return fullTask;
  }

  async updateBuildTask(taskId: string, updates: Partial<EphemeralBuildTaskRecord>): Promise<void> {
    await this.buildTasks.update(taskId, updates);
  }
}
