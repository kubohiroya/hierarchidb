import type { NodeId } from '@hierarchidb/core-types';
import { type EphemeralDB, ephemeralDB } from '@hierarchidb/gis-sdk';
import {
  type BandConfig,
  packTileId,
  unpackTileId,
  type VtTaskInput,
} from '@hierarchidb/vt-orchestrator';

export type PreparedRouteTileEmitTask = {
  taskId: string;
  index: number;
  inputData: VtTaskInput;
};

export type PrepareRouteTileEmitTasksParams = {
  nodeId: NodeId;
  bands: BandConfig[];
  expectedGeometryCacheIds: string[];
  startIndex: number;
  store?: EphemeralDB;
};

export const prepareRouteTileEmitTasks = async (
  params: PrepareRouteTileEmitTasksParams
): Promise<PreparedRouteTileEmitTask[]> => {
  const store = params.store ?? ephemeralDB;
  const bandByIndex = new Map(params.bands.map((band) => [band.bandIndex, band]));
  if (bandByIndex.size !== params.bands.length || params.bands.length === 0) {
    throw new Error('[route tileEmit] bands must contain unique band indexes');
  }
  const expectedGeometryCacheIds = new Set(params.expectedGeometryCacheIds);
  if (
    expectedGeometryCacheIds.size === 0 ||
    expectedGeometryCacheIds.size !== params.expectedGeometryCacheIds.length ||
    params.expectedGeometryCacheIds.some((id) => typeof id !== 'string' || id.length === 0)
  ) {
    throw new Error('[route tileEmit] expected geometry cache ids must be non-empty and unique');
  }

  const expectedIds = [...expectedGeometryCacheIds];
  const [relations, loadedGeometryRecords] = await Promise.all([
    store.tileEmitBufferRelations.where('bufferId').anyOf(expectedIds).toArray(),
    store.geometryCache.bulkGet(expectedIds),
  ]);
  const routeGeometryRecords = loadedGeometryRecords.map((record, index) => {
    const expectedId = expectedIds[index];
    if (!expectedId || !record) {
      throw new Error(
        `[route tileEmit] expected geometry buffer is missing: ${String(expectedId)}`
      );
    }
    const expectedFormat = record.featureCount > 0 ? 'flatgeobuf' : 'geojson';
    if (
      record.id !== expectedId ||
      record.nodeId !== params.nodeId ||
      record.domainType !== 'route' ||
      !bandByIndex.has(record.bandIndex) ||
      typeof record.sourceKey !== 'string' ||
      record.sourceKey.length === 0 ||
      !Number.isInteger(record.featureCount) ||
      record.featureCount < 0 ||
      !(record.data instanceof ArrayBuffer) ||
      record.data.byteLength === 0 ||
      record.metadata?.format !== expectedFormat
    ) {
      throw new Error(
        `[route tileEmit] geometry buffer ${record.id} does not satisfy the planned route artifact contract`
      );
    }
    return record;
  });
  const geometryById = new Map(routeGeometryRecords.map((record) => [record.id, record]));
  const expectedBufferIds = new Set(
    routeGeometryRecords.filter((record) => record.featureCount > 0).map((record) => record.id)
  );
  if (expectedBufferIds.size === 0) {
    throw new Error('[route tileEmit] geometry cache has no route features to emit');
  }
  if (relations.length === 0) {
    throw new Error('[route tileEmit] tile transpose index is missing');
  }

  const indexedBufferIds = new Set<string>();
  const grouped = new Map<
    string,
    { band: BandConfig; tileId: number; bufferIds: Set<string>; sourceKeys: Set<string> }
  >();
  for (const relation of relations) {
    if (relation.nodeId !== params.nodeId || relation.domainType !== 'route') {
      throw new Error(
        `[route tileEmit] relation ${relation.id} does not belong to the planned route node`
      );
    }
    const band = bandByIndex.get(relation.bandIndex);
    if (!band) {
      throw new Error(
        `[route tileEmit] relation ${relation.id} has unknown bandIndex ${String(relation.bandIndex)}`
      );
    }
    const tileId = requirePackedTileId(relation.tileId, band);
    const geometry = geometryById.get(relation.bufferId);
    if (!geometry) {
      throw new Error(
        `[route tileEmit] relation ${relation.id} references missing geometry buffer ${relation.bufferId}`
      );
    }
    if (
      geometry.nodeId !== params.nodeId ||
      geometry.bandIndex !== band.bandIndex ||
      geometry.featureCount <= 0 ||
      !(geometry.data instanceof ArrayBuffer) ||
      geometry.data.byteLength === 0 ||
      geometry.metadata?.format !== 'flatgeobuf'
    ) {
      throw new Error(
        `[route tileEmit] geometry buffer ${geometry.id} does not satisfy the indexed route artifact contract`
      );
    }
    if (relation.featureCount !== geometry.featureCount) {
      throw new Error(
        `[route tileEmit] relation ${relation.id} featureCount does not match geometry buffer ${geometry.id}`
      );
    }
    if (
      relation.cacheTimestamp !== geometry.timestamp ||
      !Number.isFinite(relation.createdAt) ||
      relation.createdAt <= 0
    ) {
      throw new Error(
        `[route tileEmit] relation ${relation.id} does not match geometry buffer ${geometry.id} lineage`
      );
    }
    indexedBufferIds.add(geometry.id);
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

  for (const bufferId of expectedBufferIds) {
    if (!indexedBufferIds.has(bufferId)) {
      throw new Error(
        `[route tileEmit] geometry buffer ${bufferId} is missing from the tile index`
      );
    }
  }

  return [...grouped.values()]
    .sort((left, right) => left.band.bandIndex - right.band.bandIndex || left.tileId - right.tileId)
    .map((group, offset) => {
      const sourceKeys = [...group.sourceKeys].sort();
      const sourceKey = sourceKeys.length === 1 ? sourceKeys[0] : 'mixed';
      if (sourceKey === undefined) {
        throw new Error('[route tileEmit] planned tile task has no route source key');
      }
      return {
        taskId: `${String(params.nodeId)}:tileEmit:${String(group.band.bandIndex)}:${String(group.band.zBase)}:${String(group.tileId)}`,
        index: params.startIndex + offset,
        inputData: {
          bandIndex: group.band.bandIndex,
          zBase: group.band.zBase,
          tileId: group.tileId,
          bufferIds: [...group.bufferIds].sort(),
          domainType: 'route',
          sourceKey,
        },
      };
    });
};

const requirePackedTileId = (value: unknown, band: BandConfig): number => {
  const tileId = typeof value === 'string' && value.length > 0 ? Number(value) : value;
  if (typeof tileId !== 'number' || !Number.isSafeInteger(tileId) || tileId < 0) {
    throw new Error(
      `[route tileEmit] tileId must be a non-negative safe integer: ${String(value)}`
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
      `[route tileEmit] tileId ${String(tileId)} is invalid for zBase ${String(band.zBase)}`
    );
  }
  return tileId;
};
