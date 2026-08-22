import type { NodeId } from '@hierarchidb/core-types';
import {
  isShapeBuildSessionRecoverableContractError,
  RESET_LEGACY_BUILD_SESSION_AND_TASKS,
  type ShapeBuildSessionRecoverableContractError,
  type ShapeBuildSessionRecoveryRequest,
  type ShapeBuildSessionRecoveryResult,
} from '@hierarchidb/shape-api';
import { Dexie, type Table } from 'dexie';
import type {
  BuildSessionHeartbeat,
  BuildSessionRecord,
  BuildSessionStatus,
  BuildStage,
  BuildStageStatus,
  EphemeralBuildTaskRecord,
  EphemeralGeometryCacheMetaRecord,
  EphemeralGeometryCacheRecord,
  EphemeralGeometryErrorRecord,
  EphemeralSourceCacheMetaRecord,
  EphemeralSourceCacheRecord,
  EphemeralTileIdToBufferRelation,
} from './EphemeralDBRecordTypes';
import {
  EPHEMERAL_DB_SCHEMA_V1,
  EPHEMERAL_DB_SCHEMA_V2,
  EPHEMERAL_DB_SCHEMA_V3,
  EPHEMERAL_DB_SCHEMA_V4,
} from './EphemeralDBRecordTypes';
import { probeBuildSession } from './sessionHelpers';

const applyTopLevelMods = <T extends object>(current: T, mods: Record<string, unknown>): T => {
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
  const { data, ...meta } = record;
  void data;
  return meta;
};

const toGeometryCacheMeta = (
  record: EphemeralGeometryCacheRecord
): EphemeralGeometryCacheMetaRecord => {
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
    tolerance: record.tolerance,
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

const contractErrorsMatch = (
  expected: ShapeBuildSessionRecoverableContractError,
  actual: ShapeBuildSessionRecoverableContractError
): boolean =>
  expected.code === actual.code &&
  expected.recoverable === actual.recoverable &&
  expected.nodeId === actual.nodeId &&
  expected.table === actual.table &&
  expected.field === actual.field &&
  expected.fieldPath === actual.fieldPath &&
  expected.stageStatusId === actual.stageStatusId &&
  expected.stage === actual.stage &&
  expected.received === actual.received &&
  expected.message === actual.message;

const assertRecoveryRequest = (
  request: ShapeBuildSessionRecoveryRequest
): ShapeBuildSessionRecoverableContractError => {
  if (request === null || typeof request !== 'object') {
    throw new Error('[EphemeralDB] legacy build session recovery request must be an object');
  }
  if (typeof request.nodeId !== 'string' || request.nodeId.length === 0) {
    throw new Error(
      '[EphemeralDB] legacy build session recovery nodeId must be a non-empty string'
    );
  }
  if (request.confirmation !== RESET_LEGACY_BUILD_SESSION_AND_TASKS) {
    throw new Error('[EphemeralDB] legacy build session recovery requires explicit confirmation');
  }
  if (!isShapeBuildSessionRecoverableContractError(request.error)) {
    throw new Error('[EphemeralDB] legacy build session recovery error contract is invalid');
  }
  if (request.error.nodeId !== request.nodeId) {
    throw new Error('[EphemeralDB] legacy build session recovery nodeId does not match the error');
  }
  return request.error;
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
  buildSessionConfigs!: Table<BuildSessionRecord, string>;
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

  constructor(dbName: string) {
    super(dbName);
    this.version(1).stores(EPHEMERAL_DB_SCHEMA_V1);
    this.version(2).stores(EPHEMERAL_DB_SCHEMA_V2);
    this.version(3).stores(EPHEMERAL_DB_SCHEMA_V3);
    // V4: Explicitly remove old sessions table
    this.version(4).stores({
      ...EPHEMERAL_DB_SCHEMA_V3,
      sessions: null, // Remove old sessions table
    });
    // V5: keep schema at buildSessionConfigs without compatibility migration
    this.version(5).stores({
      ...EPHEMERAL_DB_SCHEMA_V4,
      sessions: null,
    });
    // V6: schema-stable no-op bump (keeps current runtime at latest version)
    this.version(6).stores({
      ...EPHEMERAL_DB_SCHEMA_V4,
      sessions: null,
    });

    // V3 normalized tables
    this.buildSessionConfigs = this.table('buildSessionConfigs');
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
          'sourceCacheMeta:delete'
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
      fireAndForgetMetaOperation(
        () => this.geometryCacheMeta.put(meta),
        'geometryCacheMeta:create'
      );
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
          'geometryCacheMeta:update'
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
          'geometryCacheMeta:delete'
        );
      }
    });
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await this.transaction(
      'rw',
      [
        this.sourceCache,
        this.sourceCacheMeta,
        this.geometryCache,
        this.geometryCacheMeta,
        this.buildSessionConfigs,
        this.buildSessionHeartbeats,
        this.buildSessionStatuses,
        this.buildStageStatuses,
        this.tileEmitBufferRelations,
        this.buildTasks,
        this.geometryErrors,
      ],
      async () => {
        await this.sourceCache.where('nodeId').equals(nodeId).delete();
        await this.sourceCacheMeta.where('nodeId').equals(nodeId).delete();
        await this.geometryCache.where('nodeId').equals(nodeId).delete();
        await this.geometryCacheMeta.where('nodeId').equals(nodeId).delete();
        await this.buildSessionConfigs.where('nodeId').equals(nodeId).delete();
        await this.buildSessionHeartbeats.where('nodeId').equals(nodeId).delete();
        await this.buildSessionStatuses.where('nodeId').equals(nodeId).delete();
        await this.buildStageStatuses.where('nodeId').equals(nodeId).delete();
        await this.tileEmitBufferRelations.where('nodeId').equals(nodeId).delete();
        await this.buildTasks.where('nodeId').equals(nodeId).delete();
        await this.geometryErrors.where('nodeId').equals(nodeId).delete();
      }
    );
  }

  async recoverLegacyBuildSession(
    request: ShapeBuildSessionRecoveryRequest
  ): Promise<ShapeBuildSessionRecoveryResult> {
    const expectedError = assertRecoveryRequest(request);
    const { nodeId } = request;

    return this.transaction(
      'rw',
      [
        this.buildSessionConfigs,
        this.buildSessionHeartbeats,
        this.buildSessionStatuses,
        this.buildStageStatuses,
        this.buildTasks,
      ],
      async () => {
        const probe = await probeBuildSession(nodeId, {
          getConfig: async (targetNodeId) => this.buildSessionConfigs.get(targetNodeId),
          getHeartbeat: async (targetNodeId) => this.buildSessionHeartbeats.get(targetNodeId),
          getStatus: async (targetNodeId) => this.buildSessionStatuses.get(targetNodeId),
          getStageStatuses: async (targetNodeId) =>
            this.buildStageStatuses.where('nodeId').equals(targetNodeId).toArray(),
          getTasks: async (targetNodeId) =>
            this.buildTasks.where('nodeId').equals(targetNodeId).toArray(),
        });
        if (probe.kind !== 'recoverable-contract-error') {
          throw new Error(
            `[EphemeralDB] build session is not recoverable for node ${String(nodeId)}: ${probe.kind}`
          );
        }
        if (!contractErrorsMatch(expectedError, probe.error)) {
          throw new Error(
            `[EphemeralDB] build session recovery error changed for node ${String(nodeId)}`
          );
        }

        const deletedRowCounts = {
          buildSessionConfigs: await this.buildSessionConfigs
            .where('nodeId')
            .equals(nodeId)
            .count(),
          buildSessionHeartbeats: await this.buildSessionHeartbeats
            .where('nodeId')
            .equals(nodeId)
            .count(),
          buildSessionStatuses: await this.buildSessionStatuses
            .where('nodeId')
            .equals(nodeId)
            .count(),
          buildStageStatuses: await this.buildStageStatuses.where('nodeId').equals(nodeId).count(),
          buildTasks: await this.buildTasks.where('nodeId').equals(nodeId).count(),
        };

        await Promise.all([
          this.buildSessionConfigs.where('nodeId').equals(nodeId).delete(),
          this.buildSessionHeartbeats.where('nodeId').equals(nodeId).delete(),
          this.buildSessionStatuses.where('nodeId').equals(nodeId).delete(),
          this.buildStageStatuses.where('nodeId').equals(nodeId).delete(),
          this.buildTasks.where('nodeId').equals(nodeId).delete(),
        ]);

        return { nodeId, deletedRowCounts };
      }
    );
  }

  async hasStageData(nodeId: NodeId, stage: BuildStage): Promise<boolean> {
    return this.transaction(
      'r',
      [this.sourceCacheMeta, this.geometryCacheMeta, this.tileEmitBufferRelations],
      async () => {
        switch (stage) {
          case 'source':
            return (await this.sourceCacheMeta.where('nodeId').equals(nodeId).count()) > 0;
          case 'geometry':
            return (
              (await this.geometryCacheMeta
                .where('[nodeId+timestamp]')
                .between([nodeId, 1], [nodeId, Dexie.maxKey])
                .count()) > 0
            );
          case 'tileEmit':
            return (await this.tileEmitBufferRelations.where('nodeId').equals(nodeId).count()) > 0;
          default:
            return false;
        }
      }
    );
  }

  async clearStage(nodeId: NodeId, stage: BuildStage): Promise<void> {
    await this.transaction(
      'rw',
      [
        this.sourceCache,
        this.sourceCacheMeta,
        this.geometryCache,
        this.geometryCacheMeta,
        this.buildSessionConfigs,
        this.buildSessionHeartbeats,
        this.buildSessionStatuses,
        this.buildStageStatuses,
        this.tileEmitBufferRelations,
        this.geometryErrors,
      ],
      async () => {
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
        await this.buildSessionConfigs.where('nodeId').equals(nodeId).delete();
        await this.buildSessionHeartbeats.where('nodeId').equals(nodeId).delete();
        await this.buildSessionStatuses.where('nodeId').equals(nodeId).delete();
        await this.buildStageStatuses.where('nodeId').equals(nodeId).delete();
      }
    );
  }

  async getNumCaches(): Promise<{
    numSourceCaches: number;
    numGeometryCaches: number;
    numSessions: number;
    totalSize: number;
  }> {
    return this.transaction(
      'r',
      [this.sourceCacheMeta, this.geometryCacheMeta, this.buildSessionConfigs],
      async () => {
        const [numSourceCaches, numGeometryCaches, numSessions] = await Promise.all([
          this.sourceCacheMeta.count(),
          this.geometryCacheMeta.count(),
          this.buildSessionConfigs.count(),
        ]);
        const rawBuffers = await this.sourceCacheMeta.toArray();
        const totalSize = rawBuffers.reduce(
          (sum, buffer) => sum + (typeof buffer.size === 'number' ? buffer.size : 0),
          0
        );
        return {
          numSourceCaches,
          numGeometryCaches,
          numSessions,
          totalSize,
        };
      }
    );
  }

  async clearAll(): Promise<void> {
    await this.transaction(
      'rw',
      [
        this.sourceCache,
        this.sourceCacheMeta,
        this.geometryCache,
        this.geometryCacheMeta,
        this.buildSessionConfigs,
        this.buildSessionHeartbeats,
        this.buildSessionStatuses,
        this.buildStageStatuses,
        this.tileEmitBufferRelations,
        this.buildTasks,
        this.geometryErrors,
      ],
      async () => {
        await Promise.all([
          this.sourceCache.clear(),
          this.sourceCacheMeta.clear(),
          this.geometryCache.clear(),
          this.geometryCacheMeta.clear(),
          this.buildSessionConfigs.clear(),
          this.buildSessionHeartbeats.clear(),
          this.buildSessionStatuses.clear(),
          this.buildStageStatuses.clear(),
          this.tileEmitBufferRelations.clear(),
          this.buildTasks.clear(),
          this.geometryErrors.clear(),
        ]);
      }
    );
  }

  async createBuildTask(
    task: Omit<EphemeralBuildTaskRecord, 'taskId'> & { taskId?: string }
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

let ephemeralDatabase: EphemeralDB | null = null;

export function initializeEphemeralDB(databaseName: string): EphemeralDB {
  if (typeof databaseName !== 'string' || databaseName.length === 0) {
    throw new Error('ephemeral-database-name-required');
  }
  if (ephemeralDatabase === null) {
    ephemeralDatabase = new EphemeralDB(databaseName);
  }
  if (ephemeralDatabase.name !== databaseName) {
    throw new Error('ephemeral-database-name-mismatch');
  }
  return ephemeralDatabase;
}

export function getEphemeralDB(): EphemeralDB {
  if (ephemeralDatabase === null) {
    throw new Error('ephemeral-database-not-initialized');
  }
  return ephemeralDatabase;
}

const createEphemeralDatabaseReference = (): EphemeralDB =>
  new Proxy({} as EphemeralDB, {
    get: (_target, property) => {
      const database = getEphemeralDB();
      const value = Reflect.get(database, property, database) as unknown;
      return typeof value === 'function' ? value.bind(database) : value;
    },
    set: (_target, property, value) => Reflect.set(getEphemeralDB(), property, value),
  });

/** Stable reference backed only by an explicitly initialized database. */
export const ephemeralDB = createEphemeralDatabaseReference();
