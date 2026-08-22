import type { NodeId } from '@hierarchidb/core-types';
import {
  type EphemeralDB,
  type EphemeralGeometryCacheMetaRecord,
  type EphemeralGeometryCacheRecord,
  type EphemeralSourceCacheMetaRecord,
  type EphemeralSourceCacheRecord,
  ephemeralDB,
} from '@hierarchidb/gis-sdk';
import { shapeDB } from '@hierarchidb/shape-store';
import {
  deleteRawDataDataSourceBuffersForNode,
  deleteRawDataDataSourceBuffersForNodeKeys,
  isRawDataDataSourceCacheKey,
} from '~/services/utils/chunkStore';

export type ShapeArtifactCleanupSelection = {
  countryCode: string;
  adminLevel: number;
};

export type ShapeArtifactCascadeCleanupTarget =
  | {
      kind: 'selection';
      removedSelections: readonly ShapeArtifactCleanupSelection[];
    }
  | {
      kind: 'invalid-caches';
      sourceCacheIds: readonly string[];
      geometryCacheIds: readonly string[];
    }
  | {
      kind: 'stage';
      stage: 'source' | 'geometry' | 'tileEmit';
    };

export type ShapeArtifactCascadeCleanupResult = {
  sourceCachesDeleted: number;
  geometryCachesDeleted: number;
  taskRowsDeleted: number;
  relationRowsDeleted: number;
  geometryErrorRowsDeleted: number;
  rawSourceBuffersDeleted: number;
  persistentArtifactsDeleted: boolean;
};

type ShapeArtifactCascadeCleanupStep =
  | 'resolve-plan'
  | 'delete-persistent-artifacts'
  | 'delete-raw-source-buffers'
  | 'delete-ephemeral-lineage';

export class ShapeArtifactCascadeCleanupError extends Error {
  readonly code = 'SHAPE_ARTIFACT_CASCADE_CLEANUP_FAILED';

  constructor(
    readonly step: ShapeArtifactCascadeCleanupStep,
    options?: ErrorOptions
  ) {
    super(`[shape-artifact-cleanup] ${step} failed`, options);
    this.name = 'ShapeArtifactCascadeCleanupError';
  }
}

type ShapeArtifactCascadeCleanupDependencies = {
  ephemeralStore: EphemeralDB;
  deletePersistentArtifactsByNode: (nodeId: NodeId) => Promise<void>;
  deleteRawSourceBuffersByKeys: (nodeId: NodeId, cacheKeys: string[]) => Promise<number>;
  deleteAllRawSourceBuffersForNode: (nodeId: NodeId) => Promise<number>;
};

type ShapeArtifactCleanupPlan = {
  nodeId: NodeId;
  sourceCacheIds: string[];
  rawSourceCacheKeys: string[];
  geometryCacheIds: string[];
  taskScope: 'all' | 'tileEmit';
  deleteGeometryErrors: boolean;
};

type NodeOwnedCacheRecord = {
  nodeId: NodeId;
};

const SOURCE_KEY_PATTERN = /^[A-Z]{2}:(0|[1-9]\d*)$/;

const contractViolation = (message: string): never => {
  throw new ShapeArtifactCascadeCleanupError('resolve-plan', {
    cause: new Error(message),
  });
};

const requireNodeId = (value: NodeId): NodeId => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    return contractViolation('nodeId must be a non-empty canonical string');
  }
  return value;
};

const requireCacheId = (field: string, value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    return contractViolation(`${field} must be a non-empty canonical string`);
  }
  return value;
};

const requireSourceKey = (field: string, value: unknown): string => {
  const sourceKey = requireCacheId(field, value);
  if (!SOURCE_KEY_PATTERN.test(sourceKey)) {
    return contractViolation(`${field} must use canonical ISO2:adminLevel form`);
  }
  return sourceKey;
};

const requireSelection = (
  value: ShapeArtifactCleanupSelection,
  index: number
): ShapeArtifactCleanupSelection => {
  const countryCode = requireCacheId(`removedSelections[${index}].countryCode`, value.countryCode);
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return contractViolation(
      `removedSelections[${index}].countryCode must be a canonical ISO2 code`
    );
  }
  if (!Number.isInteger(value.adminLevel) || value.adminLevel < 0) {
    return contractViolation(
      `removedSelections[${index}].adminLevel must be a non-negative integer`
    );
  }
  return { countryCode, adminLevel: value.adminLevel };
};

const uniqueIds = (field: string, values: readonly unknown[]): string[] =>
  Array.from(
    new Set(values.map((value, index) => requireCacheId(`${field}[${index}]`, value)))
  ).sort((left, right) => left.localeCompare(right));

const resolveRecordSourceKey = (
  field: string,
  dataRecord: EphemeralSourceCacheRecord | EphemeralGeometryCacheRecord | undefined,
  metaRecord: EphemeralSourceCacheMetaRecord | EphemeralGeometryCacheMetaRecord | undefined
): string | null => {
  const dataSourceKey =
    dataRecord === undefined
      ? null
      : requireSourceKey(`${field}.data.sourceKey`, dataRecord.sourceKey);
  const metaSourceKey =
    metaRecord === undefined
      ? null
      : requireSourceKey(`${field}.meta.sourceKey`, metaRecord.sourceKey);
  if (dataSourceKey !== null && metaSourceKey !== null && dataSourceKey !== metaSourceKey) {
    return contractViolation(`${field} data/meta sourceKey values must match`);
  }
  return dataSourceKey ?? metaSourceKey;
};

const listNodeSourceRecords = async (store: EphemeralDB, nodeId: NodeId) => {
  const [data, meta] = await Promise.all([
    store.sourceCache.where('nodeId').equals(nodeId).toArray(),
    store.sourceCacheMeta.where('nodeId').equals(nodeId).toArray(),
  ]);
  return { data, meta };
};

const listNodeGeometryRecords = async (store: EphemeralDB, nodeId: NodeId) => {
  const [data, meta] = await Promise.all([
    store.geometryCache.where('nodeId').equals(nodeId).toArray(),
    store.geometryCacheMeta.where('nodeId').equals(nodeId).toArray(),
  ]);
  return { data, meta };
};

const buildRecordMap = <T extends { id: string }>(records: readonly T[]): Map<string, T> =>
  new Map(records.map((record) => [requireCacheId('record.id', record.id), record]));

const resolveSourceKeys = (
  sourceCacheIds: readonly string[],
  sourceDataById: ReadonlyMap<string, EphemeralSourceCacheRecord>,
  sourceMetaById: ReadonlyMap<string, EphemeralSourceCacheMetaRecord>
): Set<string> => {
  const sourceKeys = new Set<string>();
  sourceCacheIds.forEach((cacheId) => {
    const sourceKey = resolveRecordSourceKey(
      `sourceCache[${cacheId}]`,
      sourceDataById.get(cacheId),
      sourceMetaById.get(cacheId)
    );
    if (sourceKey !== null) sourceKeys.add(sourceKey);
  });
  return sourceKeys;
};

const readRawSourceCacheKey = (
  field: string,
  record: EphemeralSourceCacheRecord | EphemeralSourceCacheMetaRecord | undefined
): string | null => {
  if (record === undefined) return null;
  const metadata = record.metadata;
  if (metadata === undefined || typeof metadata !== 'object' || metadata === null) {
    return contractViolation(`${field}.metadata must contain rawSourceCacheKey`);
  }
  const rawSourceCacheKey = requireCacheId(
    `${field}.metadata.rawSourceCacheKey`,
    metadata.rawSourceCacheKey
  );
  if (!isRawDataDataSourceCacheKey(rawSourceCacheKey)) {
    return contractViolation(
      `${field}.metadata.rawSourceCacheKey must be a canonical raw cache key`
    );
  }
  return rawSourceCacheKey;
};

const resolveRawSourceCacheKeys = (
  sourceCacheIds: readonly string[],
  sourceDataById: ReadonlyMap<string, EphemeralSourceCacheRecord>,
  sourceMetaById: ReadonlyMap<string, EphemeralSourceCacheMetaRecord>
): string[] => {
  const keys = new Set<string>();
  sourceCacheIds.forEach((cacheId) => {
    const dataKey = readRawSourceCacheKey(
      `sourceCache[${cacheId}].data`,
      sourceDataById.get(cacheId)
    );
    const metaKey = readRawSourceCacheKey(
      `sourceCache[${cacheId}].meta`,
      sourceMetaById.get(cacheId)
    );
    if (dataKey !== null && metaKey !== null && dataKey !== metaKey) {
      contractViolation(`sourceCache[${cacheId}] rawSourceCacheKey values must match`);
    }
    const key = dataKey ?? metaKey;
    if (key !== null) keys.add(key);
  });
  return [...keys].sort((left, right) => left.localeCompare(right));
};

const resolveGeometryIdsForSourceKeys = (
  sourceKeys: ReadonlySet<string>,
  geometryDataById: ReadonlyMap<string, EphemeralGeometryCacheRecord>,
  geometryMetaById: ReadonlyMap<string, EphemeralGeometryCacheMetaRecord>
): string[] => {
  if (sourceKeys.size === 0) return [];
  const ids = new Set([...geometryDataById.keys(), ...geometryMetaById.keys()]);
  const matches: string[] = [];
  ids.forEach((cacheId) => {
    const sourceKey = resolveRecordSourceKey(
      `geometryCache[${cacheId}]`,
      geometryDataById.get(cacheId),
      geometryMetaById.get(cacheId)
    );
    if (sourceKey !== null && sourceKeys.has(sourceKey)) matches.push(cacheId);
  });
  return matches.sort((left, right) => left.localeCompare(right));
};

const resolveCleanupPlan = async (
  nodeIdValue: NodeId,
  target: ShapeArtifactCascadeCleanupTarget,
  store: EphemeralDB
): Promise<ShapeArtifactCleanupPlan | null> => {
  const nodeId = requireNodeId(nodeIdValue);
  const [{ data: sourceData, meta: sourceMeta }, { data: geometryData, meta: geometryMeta }] =
    await Promise.all([
      listNodeSourceRecords(store, nodeId),
      listNodeGeometryRecords(store, nodeId),
    ]);
  const sourceDataById = buildRecordMap(sourceData);
  const sourceMetaById = buildRecordMap(sourceMeta);
  const geometryDataById = buildRecordMap(geometryData);
  const geometryMetaById = buildRecordMap(geometryMeta);

  if (target.kind === 'stage') {
    if (target.stage === 'tileEmit') {
      return {
        nodeId,
        sourceCacheIds: [],
        rawSourceCacheKeys: [],
        geometryCacheIds: [],
        taskScope: 'tileEmit',
        deleteGeometryErrors: false,
      };
    }
    const sourceCacheIds =
      target.stage === 'source'
        ? uniqueIds('sourceCacheIds', [...sourceDataById.keys(), ...sourceMetaById.keys()])
        : [];
    return {
      nodeId,
      sourceCacheIds,
      rawSourceCacheKeys: resolveRawSourceCacheKeys(sourceCacheIds, sourceDataById, sourceMetaById),
      geometryCacheIds: uniqueIds('geometryCacheIds', [
        ...geometryDataById.keys(),
        ...geometryMetaById.keys(),
      ]),
      taskScope: 'all',
      deleteGeometryErrors: true,
    };
  }

  if (target.kind === 'selection') {
    if (target.removedSelections.length === 0) return null;
    const removedSourceKeys = new Set(
      target.removedSelections.map((selection, index) => {
        const validated = requireSelection(selection, index);
        return `${validated.countryCode}:${validated.adminLevel}`;
      })
    );
    const sourceCacheIds = uniqueIds(
      'sourceCacheIds',
      [...sourceDataById.keys(), ...sourceMetaById.keys()].filter((cacheId) => {
        const sourceKey = resolveRecordSourceKey(
          `sourceCache[${cacheId}]`,
          sourceDataById.get(cacheId),
          sourceMetaById.get(cacheId)
        );
        return sourceKey !== null && removedSourceKeys.has(sourceKey);
      })
    );
    return {
      nodeId,
      sourceCacheIds,
      rawSourceCacheKeys: resolveRawSourceCacheKeys(sourceCacheIds, sourceDataById, sourceMetaById),
      geometryCacheIds: resolveGeometryIdsForSourceKeys(
        removedSourceKeys,
        geometryDataById,
        geometryMetaById
      ),
      taskScope: 'all',
      deleteGeometryErrors: true,
    };
  }

  const sourceCacheIds = uniqueIds('sourceCacheIds', target.sourceCacheIds);
  const geometryCacheIds = new Set(uniqueIds('geometryCacheIds', target.geometryCacheIds));
  const sourceKeys = resolveSourceKeys(sourceCacheIds, sourceDataById, sourceMetaById);
  resolveGeometryIdsForSourceKeys(sourceKeys, geometryDataById, geometryMetaById).forEach(
    (cacheId) => {
      geometryCacheIds.add(cacheId);
    }
  );
  if (sourceCacheIds.length === 0 && geometryCacheIds.size === 0) return null;
  return {
    nodeId,
    sourceCacheIds,
    rawSourceCacheKeys: resolveRawSourceCacheKeys(sourceCacheIds, sourceDataById, sourceMetaById),
    geometryCacheIds: [...geometryCacheIds].sort((left, right) => left.localeCompare(right)),
    taskScope: 'all',
    deleteGeometryErrors: true,
  };
};

const assertRecordOwnership = (
  field: string,
  nodeId: NodeId,
  ids: readonly string[],
  dataRecords: readonly (NodeOwnedCacheRecord | undefined)[],
  metaRecords: readonly (NodeOwnedCacheRecord | undefined)[]
): void => {
  ids.forEach((cacheId, index) => {
    const records = [dataRecords[index], metaRecords[index]];
    records.forEach((record, recordIndex) => {
      if (record === undefined) return;
      const ownerNodeId = requireNodeId(record.nodeId);
      if (ownerNodeId !== nodeId) {
        const recordKind = recordIndex === 0 ? 'data' : 'meta';
        contractViolation(`${field}[${cacheId}].${recordKind}.nodeId must match cleanup nodeId`);
      }
    });
  });
};

const assertCleanupPlanOwnership = async (
  plan: ShapeArtifactCleanupPlan,
  store: EphemeralDB
): Promise<void> => {
  const [sourceData, sourceMeta, geometryData, geometryMeta] = await Promise.all([
    store.sourceCache.bulkGet(plan.sourceCacheIds),
    store.sourceCacheMeta.bulkGet(plan.sourceCacheIds),
    store.geometryCache.bulkGet(plan.geometryCacheIds),
    store.geometryCacheMeta.bulkGet(plan.geometryCacheIds),
  ]);
  assertRecordOwnership('sourceCacheIds', plan.nodeId, plan.sourceCacheIds, sourceData, sourceMeta);
  assertRecordOwnership(
    'geometryCacheIds',
    plan.nodeId,
    plan.geometryCacheIds,
    geometryData,
    geometryMeta
  );
};

const deletePersistentArtifactsByNode = async (nodeId: NodeId): Promise<void> => {
  await shapeDB.transaction(
    'rw',
    [
      shapeDB.vectorTiles,
      shapeDB.tileSummaries,
      shapeDB.featureMetadata,
      shapeDB.dataSourceMetadata,
      shapeDB.borderGeometryDatasets,
      shapeDB.borderGeometryArcs,
      shapeDB.borderGeometryRings,
      shapeDB.borderGeometryPolygonRelations,
      shapeDB.borderSpatialIndexes,
    ],
    async () => {
      await Promise.all([
        shapeDB.vectorTiles.where('nodeId').equals(nodeId).delete(),
        shapeDB.tileSummaries.delete(nodeId),
        shapeDB.featureMetadata.where('nodeId').equals(nodeId).delete(),
        shapeDB.dataSourceMetadata.where('nodeId').equals(nodeId).delete(),
        shapeDB.borderGeometryDatasets.where('nodeId').equals(nodeId).delete(),
        shapeDB.borderGeometryArcs.where('nodeId').equals(nodeId).delete(),
        shapeDB.borderGeometryRings.where('nodeId').equals(nodeId).delete(),
        shapeDB.borderGeometryPolygonRelations.where('nodeId').equals(nodeId).delete(),
        shapeDB.borderSpatialIndexes.where('nodeId').equals(nodeId).delete(),
      ]);
    }
  );
};

const defaultDependencies = (): ShapeArtifactCascadeCleanupDependencies => ({
  ephemeralStore: ephemeralDB,
  deletePersistentArtifactsByNode,
  deleteRawSourceBuffersByKeys: deleteRawDataDataSourceBuffersForNodeKeys,
  deleteAllRawSourceBuffersForNode: deleteRawDataDataSourceBuffersForNode,
});

const wrapStepFailure = (step: ShapeArtifactCascadeCleanupStep, error: unknown): never => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  ) {
    throw error;
  }
  if (error instanceof ShapeArtifactCascadeCleanupError) throw error;
  throw new ShapeArtifactCascadeCleanupError(step, { cause: error });
};

const assertCleanupActive = (abortSignal?: AbortSignal): void => {
  if (abortSignal?.aborted) {
    throw new DOMException('Shape artifact cleanup was aborted', 'AbortError');
  }
};

export const runShapeArtifactCascadeCleanup = async (params: {
  nodeId: NodeId;
  target: ShapeArtifactCascadeCleanupTarget;
  deleteAllRawSourceBuffers?: boolean;
  dependencies?: Partial<ShapeArtifactCascadeCleanupDependencies>;
  abortSignal?: AbortSignal;
}): Promise<ShapeArtifactCascadeCleanupResult> => {
  const dependencies = { ...defaultDependencies(), ...params.dependencies };
  let plan: ShapeArtifactCleanupPlan | null;
  try {
    assertCleanupActive(params.abortSignal);
    plan = await resolveCleanupPlan(params.nodeId, params.target, dependencies.ephemeralStore);
    assertCleanupActive(params.abortSignal);
    if (plan !== null) {
      await assertCleanupPlanOwnership(plan, dependencies.ephemeralStore);
      assertCleanupActive(params.abortSignal);
    }
  } catch (error) {
    return wrapStepFailure('resolve-plan', error);
  }
  if (plan === null) {
    let rawSourceBuffersDeleted = 0;
    if (params.deleteAllRawSourceBuffers === true) {
      try {
        assertCleanupActive(params.abortSignal);
        rawSourceBuffersDeleted = await dependencies.deleteAllRawSourceBuffersForNode(
          requireNodeId(params.nodeId)
        );
        assertCleanupActive(params.abortSignal);
      } catch (error) {
        return wrapStepFailure('delete-raw-source-buffers', error);
      }
    }
    return {
      sourceCachesDeleted: 0,
      geometryCachesDeleted: 0,
      taskRowsDeleted: 0,
      relationRowsDeleted: 0,
      geometryErrorRowsDeleted: 0,
      rawSourceBuffersDeleted,
      persistentArtifactsDeleted: false,
    };
  }

  try {
    assertCleanupActive(params.abortSignal);
    await dependencies.deletePersistentArtifactsByNode(plan.nodeId);
    assertCleanupActive(params.abortSignal);
  } catch (error) {
    return wrapStepFailure('delete-persistent-artifacts', error);
  }

  let rawSourceBuffersDeleted: number;
  try {
    assertCleanupActive(params.abortSignal);
    rawSourceBuffersDeleted = await dependencies.deleteRawSourceBuffersByKeys(
      plan.nodeId,
      plan.rawSourceCacheKeys
    );
    assertCleanupActive(params.abortSignal);
    if (params.deleteAllRawSourceBuffers === true) {
      rawSourceBuffersDeleted += await dependencies.deleteAllRawSourceBuffersForNode(plan.nodeId);
      assertCleanupActive(params.abortSignal);
    }
  } catch (error) {
    return wrapStepFailure('delete-raw-source-buffers', error);
  }

  try {
    assertCleanupActive(params.abortSignal);
    return await dependencies.ephemeralStore.transaction(
      'rw',
      [
        dependencies.ephemeralStore.sourceCache,
        dependencies.ephemeralStore.sourceCacheMeta,
        dependencies.ephemeralStore.geometryCache,
        dependencies.ephemeralStore.geometryCacheMeta,
        dependencies.ephemeralStore.tileEmitBufferRelations,
        dependencies.ephemeralStore.buildTasks,
        dependencies.ephemeralStore.geometryErrors,
      ],
      async () => {
        assertCleanupActive(params.abortSignal);
        const [taskRowsDeleted, relationRowsDeleted, geometryErrorRowsDeleted] = await Promise.all([
          plan.taskScope === 'all'
            ? dependencies.ephemeralStore.buildTasks.where('nodeId').equals(plan.nodeId).delete()
            : dependencies.ephemeralStore.buildTasks
                .where('[nodeId+stage]')
                .equals([plan.nodeId, 'tileEmit'])
                .delete(),
          dependencies.ephemeralStore.tileEmitBufferRelations
            .where('nodeId')
            .equals(plan.nodeId)
            .delete(),
          plan.deleteGeometryErrors
            ? dependencies.ephemeralStore.geometryErrors
                .where('nodeId')
                .equals(plan.nodeId)
                .delete()
            : Promise.resolve(0),
        ]);
        assertCleanupActive(params.abortSignal);
        if (plan.geometryCacheIds.length > 0) {
          await Promise.all([
            dependencies.ephemeralStore.geometryCache.bulkDelete(plan.geometryCacheIds),
            dependencies.ephemeralStore.geometryCacheMeta.bulkDelete(plan.geometryCacheIds),
          ]);
          assertCleanupActive(params.abortSignal);
        }
        if (plan.sourceCacheIds.length > 0) {
          await Promise.all([
            dependencies.ephemeralStore.sourceCache.bulkDelete(plan.sourceCacheIds),
            dependencies.ephemeralStore.sourceCacheMeta.bulkDelete(plan.sourceCacheIds),
          ]);
          assertCleanupActive(params.abortSignal);
        }
        return {
          sourceCachesDeleted: plan.sourceCacheIds.length,
          geometryCachesDeleted: plan.geometryCacheIds.length,
          taskRowsDeleted,
          relationRowsDeleted,
          geometryErrorRowsDeleted,
          rawSourceBuffersDeleted,
          persistentArtifactsDeleted: true,
        };
      }
    );
  } catch (error) {
    return wrapStepFailure('delete-ephemeral-lineage', error);
  }
};
