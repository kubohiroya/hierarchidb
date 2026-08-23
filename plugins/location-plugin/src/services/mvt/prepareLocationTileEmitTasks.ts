import type { NodeId } from '@hierarchidb/core-types';
import type { StageHandler, TaskQueueRecord } from '@hierarchidb/build-api';
import {
  buildLocationVectorTileId,
  LOCATION_VECTOR_TILE_CONTENT_TYPE,
  type LocationVectorTileRecord,
} from '@hierarchidb/location-store';
import type { EphemeralDB } from '@hierarchidb/gis-sdk';
import type { VectorTileStore } from '@hierarchidb/runtime-worker';
import {
  createVtHandler,
  listTasksByStageAndStatus,
  packTileId,
  putTasks,
  runStageTasks,
  unpackTileId,
  type BandConfig,
  type VtTaskInput,
  VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';
import type { LocationBuildConfig } from '~/common/entities/LocationEntity.js';

export type LocationTileEmitTask = {
  taskId: string;
  index: number;
  inputData: VtTaskInput;
};

type VTStoreRegistryLike = {
  getVectorTiles?: <T extends VectorTileStore = VectorTileStore>(nodeType: string) => T | undefined;
};

type RuntimeWorkerModuleWithVTStoreRegistry = {
  getVTStoreRegistry?: () => VTStoreRegistryLike;
};

export const prepareLocationTileEmitTasks = async (params: {
  nodeId: NodeId;
  bands: BandConfig[];
  expectedGeometryCacheIds: readonly string[];
  startIndex: number;
  store: EphemeralDB;
}): Promise<LocationTileEmitTask[]> => {
  const bandByIndex = new Map(params.bands.map((band) => [band.bandIndex, band]));
  if (bandByIndex.size !== params.bands.length || params.bands.length === 0) {
    throw new Error('[location tileEmit] bands must contain unique band indexes');
  }
  const expectedIds = [...new Set(params.expectedGeometryCacheIds)];
  if (
    expectedIds.length === 0 ||
    expectedIds.length !== params.expectedGeometryCacheIds.length ||
    expectedIds.some((id) => id.length === 0)
  ) {
    throw new Error('[location tileEmit] expected geometry cache ids must be non-empty and unique');
  }
  const [relations, records] = await Promise.all([
    params.store.tileEmitBufferRelations.where('bufferId').anyOf(expectedIds).toArray(),
    params.store.geometryCache.bulkGet(expectedIds),
  ]);
  const geometryById = new Map(
    records.map((record, index) => {
      const expectedId = expectedIds[index];
      if (!expectedId || !record) {
        throw new Error(
          `[location tileEmit] expected geometry buffer is missing: ${String(expectedId)}`
        );
      }
      if (
        record.id !== expectedId ||
        record.nodeId !== params.nodeId ||
        record.domainType !== 'location' ||
        !bandByIndex.has(record.bandIndex) ||
        record.metadata?.format !== 'flatgeobuf' ||
        !(record.data instanceof ArrayBuffer) ||
        record.data.byteLength <= 0
      ) {
        throw new Error(
          `[location tileEmit] geometry buffer ${record.id} does not satisfy the location artifact contract`
        );
      }
      return [record.id, record] as const;
    })
  );
  const grouped = new Map<
    string,
    { band: BandConfig; tileId: number; bufferIds: Set<string>; sourceKeys: Set<string> }
  >();
  for (const relation of relations) {
    if (relation.nodeId !== params.nodeId || relation.domainType !== 'location') {
      throw new Error(
        `[location tileEmit] relation ${relation.id} does not belong to the planned location node`
      );
    }
    const band = bandByIndex.get(relation.bandIndex);
    if (!band) {
      throw new Error(
        `[location tileEmit] relation ${relation.id} has unknown bandIndex ${String(relation.bandIndex)}`
      );
    }
    const tileId = requirePackedTileId(relation.tileId, band);
    const geometry = geometryById.get(relation.bufferId);
    if (!geometry) {
      throw new Error(
        `[location tileEmit] relation ${relation.id} references missing geometry buffer ${relation.bufferId}`
      );
    }
    if (relation.cacheTimestamp !== geometry.timestamp) {
      throw new Error(
        `[location tileEmit] relation ${relation.id} does not match geometry buffer ${geometry.id} lineage`
      );
    }
    const key = `${String(band.bandIndex)}:${String(tileId)}`;
    const current = grouped.get(key) ?? {
      band,
      tileId,
      bufferIds: new Set<string>(),
      sourceKeys: new Set<string>(),
    };
    current.bufferIds.add(geometry.id);
    current.sourceKeys.add(geometry.sourceKey);
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .sort((left, right) => left.band.bandIndex - right.band.bandIndex || left.tileId - right.tileId)
    .map((group, offset) => {
      const sourceKeys = [...group.sourceKeys].sort();
      const sourceKey = sourceKeys.length === 1 ? sourceKeys[0] : 'mixed';
      if (sourceKey === undefined) {
        throw new Error('[location tileEmit] planned tile task has no source key');
      }
      return {
        taskId: `${String(params.nodeId)}:location:tileEmit:${String(group.band.bandIndex)}:${String(group.band.zBase)}:${String(group.tileId)}`,
        index: params.startIndex + offset,
        inputData: {
          bandIndex: group.band.bandIndex,
          zBase: group.band.zBase,
          tileId: group.tileId,
          bufferIds: [...group.bufferIds].sort(),
          domainType: 'location',
          sourceKey,
        },
      };
    });
};

export const runLocationTileEmitStage = async (params: {
  nodeId: NodeId;
  buildConfig: LocationBuildConfig;
  bands: BandConfig[];
  tasks: LocationTileEmitTask[];
  store: EphemeralDB;
  signal: AbortSignal;
}): Promise<void> => {
  const vectorTileStore = await requireLocationVectorTileStore();
  const existingTiles = await vectorTileStore.list(params.nodeId);
  if (existingTiles.length > 0) {
    await vectorTileStore.bulkDelete(
      params.nodeId,
      existingTiles.map((tile) => tile.id)
    );
  }
  const handler = createVtHandler({
    ephemeralDB: params.store,
    tileEmitConfig: params.buildConfig.mvt.tileEmitConfig,
    bands: params.bands,
    geometryEngine: 'turf',
    abortSignal: params.signal,
    tileWriter: async ({ z, x, y, data }) => {
      const tileId = buildLocationVectorTileId(params.nodeId, z, x, y);
      const record: LocationVectorTileRecord & { id: string } = {
        id: tileId,
        tileId,
        nodeId: params.nodeId,
        z,
        x,
        y,
        data,
        size: data.byteLength,
        contentType: LOCATION_VECTOR_TILE_CONTENT_TYPE,
        timestamp: Date.now(),
      };
      await vectorTileStore.bulkUpsert(params.nodeId, [record]);
      const stored = (await vectorTileStore.list(params.nodeId)).find((tile) => tile.id === tileId);
      if (!stored) {
        throw new Error(
          `[location tileEmit] read-back validation failed for z=${String(z)} x=${String(x)} y=${String(y)}`
        );
      }
    },
  });
  const queue = new VtTaskQueueDb();
  const currentTaskIds = new Set(params.tasks.map((task) => task.taskId));
  await putTasks(
    queue,
    params.tasks.map((task) => toLocationTileEmitTaskQueueRecord(params.nodeId, task))
  );
  await runStageTasks<VtTaskInput>({
    nodeId: params.nodeId,
    stage: 'tileEmit',
    taskFilter: (task) => currentTaskIds.has(task.taskId),
    handler: handler as StageHandler<VtTaskInput>,
    maxConcurrent: params.buildConfig.mvt.tileEmitConfig.maxConcurrent,
    failureHandling: 'continue',
    abortController: createAbortController(params.signal),
  });
  const failedTasks = (
    await listTasksByStageAndStatus(queue, params.nodeId, 'tileEmit', 'failed')
  ).filter((task) => currentTaskIds.has(task.taskId));
  if (failedTasks.length > 0) {
    throw new Error(
      `[location tileEmit] ${String(failedTasks.length)} tileEmit task(s) failed: ${failedTasks
        .map((task) => task.taskId)
        .join(',')}`
    );
  }
};

export const toLocationTileEmitTaskQueueRecord = (
  nodeId: NodeId,
  task: LocationTileEmitTask
): TaskQueueRecord<VtTaskInput> => ({
  taskId: task.taskId,
  nodeId,
  version: 1,
  stage: 'tileEmit',
  status: 'queued',
  index: task.index,
  progress: 0,
  inputData: task.inputData,
});

const requirePackedTileId = (value: unknown, band: BandConfig): number => {
  const tileId = typeof value === 'string' && value.length > 0 ? Number(value) : value;
  if (typeof tileId !== 'number' || !Number.isSafeInteger(tileId) || tileId < 0) {
    throw new Error(
      `[location tileEmit] tileId must be a non-negative safe integer: ${String(value)}`
    );
  }
  const coordinate = unpackTileId(tileId, band.zBase);
  const scale = 2 ** band.zBase;
  if (
    !Number.isInteger(coordinate.x) ||
    !Number.isInteger(coordinate.y) ||
    coordinate.x < 0 ||
    coordinate.x >= scale ||
    coordinate.y < 0 ||
    coordinate.y >= scale ||
    packTileId(coordinate.x, coordinate.y, band.zBase) !== tileId
  ) {
    throw new Error(
      `[location tileEmit] tileId ${String(tileId)} is invalid for zBase ${String(band.zBase)}`
    );
  }
  return tileId;
};

const requireLocationVectorTileStore = async (): Promise<VectorTileStore> => {
  const runtimeWorkerModule =
    (await import('@hierarchidb/runtime-worker')) as RuntimeWorkerModuleWithVTStoreRegistry;
  const store = runtimeWorkerModule.getVTStoreRegistry?.().getVectorTiles?.('location');
  if (!store) throw new Error('[location tileEmit] VTStoreRegistry has no location vector store');
  return store;
};

const createAbortController = (signal: AbortSignal): AbortController => {
  const controller = new AbortController();
  if (signal.aborted) controller.abort(signal.reason);
  signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  return controller;
};
