import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type {
  EphemeralBuildSessionRecord,
  EphemeralBuildTaskRecord,
  EphemeralFetchCacheRecord,
  EphemeralTransformCacheRecord,
  EphemeralTransformErrorRecord,
  EphemeralTileIdToBufferRelation,
} from './EphemeralBuildState.js';
import { EPHEMERAL_DB_SCHEMA } from './EphemeralBuildState.js';

export class HidbEphemeralDB extends Dexie {
  sessions!: Table<EphemeralBuildSessionRecord, string>;
  buildTasks!: Table<EphemeralBuildTaskRecord, string>;
  fetchCache!: Table<EphemeralFetchCacheRecord, string>;
  transformCache!: Table<EphemeralTransformCacheRecord, string>;
  transformErrors!: Table<EphemeralTransformErrorRecord, string>;
  tileIdToBufferRelations!: Table<EphemeralTileIdToBufferRelation, string>;

  constructor(dbName: string = getDBName('ephemeral')) {
    super(dbName);
    this.version(1).stores(EPHEMERAL_DB_SCHEMA);
    this.sessions = this.table('sessions');
    this.buildTasks = this.table('buildTasks');
    this.fetchCache = this.table('fetchCache');
    this.transformCache = this.table('transformCache');
    this.transformErrors = this.table('transformErrors');
    this.tileIdToBufferRelations = this.table('tileIdToBufferRelations');
  }

  async clearNodeData(nodeId: string): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.transformCache,
      this.sessions,
      this.tileIdToBufferRelations,
      this.buildTasks,
      this.transformErrors,
    ], async () => {
      await this.fetchCache.where('nodeId').equals(nodeId).delete();
      await this.transformCache.where('nodeId').equals(nodeId).delete();
      await this.sessions.where('nodeId').equals(nodeId).delete();
      await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
      await this.buildTasks.where('nodeId').equals(nodeId).delete();
      await this.transformErrors.where('nodeId').equals(nodeId).delete();
    });
  }

  async hasStageData(nodeId: string, stage: 'fetch' | 'transform' | 'vt'): Promise<boolean> {
    return this.transaction('r', [this.fetchCache, this.transformCache, this.tileIdToBufferRelations], async () => {
      switch (stage) {
        case 'fetch':
          return (await this.fetchCache.where('nodeId').equals(nodeId).count()) > 0;
        case 'transform':
          return (await this.transformCache
            .where('nodeId')
            .equals(nodeId)
            .filter((record) => (record?.timestamp ?? 0) > 0)
            .count()) > 0;
        case 'vt':
          return (await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).count()) > 0;
        default:
          return false;
      }
    });
  }

  async clearStage(nodeId: string, stage: 'fetch' | 'transform' | 'vt'): Promise<void> {
    await this.transaction('rw', [
      this.fetchCache,
      this.transformCache,
      this.sessions,
      this.tileIdToBufferRelations,
      this.transformErrors,
    ], async () => {
      switch (stage) {
        case 'fetch':
          await this.fetchCache.where('nodeId').equals(nodeId).delete();
          break;
        case 'transform':
          await this.transformCache.where('nodeId').equals(nodeId).delete();
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
    return this.transaction('r', [this.fetchCache, this.transformCache, this.sessions], async () => {
      const [numFetchCaches, numTransformCaches, numSessions] = await Promise.all([
        this.fetchCache.count(),
        this.transformCache.count(),
        this.sessions.count(),
      ]);
      const rawBuffers = await this.fetchCache.toArray();
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
      this.transformCache,
      this.sessions,
      this.tileIdToBufferRelations,
      this.buildTasks,
      this.transformErrors,
    ], async () => {
      await Promise.all([
        this.fetchCache.clear(),
        this.transformCache.clear(),
        this.sessions.clear(),
        this.tileIdToBufferRelations.clear(),
        this.buildTasks.clear(),
        this.transformErrors.clear(),
      ]);
    });
  }

  async createBuildTask(
    task: Omit<EphemeralBuildTaskRecord, 'taskId'> & { taskId?: string }
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

  async getBuildTasks(nodeId: string): Promise<EphemeralBuildTaskRecord[]> {
    return this.buildTasks.where('nodeId').equals(nodeId).sortBy('index');
  }

  async getTasksByStatus(nodeId: string, status: string): Promise<EphemeralBuildTaskRecord[]> {
    return this.buildTasks.where('[nodeId+status]').equals([nodeId, status]).toArray();
  }
}

export const hidbEphemeralDB = new HidbEphemeralDB();
