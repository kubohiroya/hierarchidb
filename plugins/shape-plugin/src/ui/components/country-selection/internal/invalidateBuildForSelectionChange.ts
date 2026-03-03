import { listTasks, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { NobleSha3HashPort } from '@hierarchidb/chunk-store';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { deleteRawDataDataSourceBuffersForNodeMetadataIds } from '~/services/utils/chunkStore';
import { shapeMutationAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { sanitizeShapeDraftData } from '~/ui/utils/sanitizeShapeDraftData';
import { type BuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import type { NodeId } from '@hierarchidb/core-types';
import { buildSelectionSet } from './selectionUtils.js';
import type { EphemeralTileIdToBufferRelation } from '@hierarchidb/gis-sdk';
import { normalizeUiStageId } from '~/ui/components/build-progress/stageIdAliases';

type BuildSessionUpdater = {
  initialize: () => Promise<void>;
  getTreeNodeUpdaterAPI: () => ReturnType<BuildWorkerBridge['getTreeNodeUpdaterAPI']>;
};

type InvalidateParams = {
  bridgeRef: BuildSessionUpdater;
  nodeId: NodeId;
  prev: Record<string, boolean[]>;
  nextSelection: Record<string, boolean[]>;
};

const buildHash = (bufferIds: string[]): string => {
  const encoder = new TextEncoder();
  const hasher = new NobleSha3HashPort();
  const sorted = [...bufferIds].sort();
  return hasher.digest(encoder.encode(JSON.stringify(sorted)).buffer, 'sha3-256');
};

export const invalidateBuildForSelectionChange = async (params: InvalidateParams): Promise<void> => {
  const { bridgeRef, nodeId, prev, nextSelection } = params;
  const prevSet = buildSelectionSet(prev);
  const nextSet = buildSelectionSet(nextSelection);
  const removed = Array.from(prevSet).filter((entry) => !nextSet.has(entry));
  if (removed.length === 0) return;

  const removedPairs = removed.map((entry) => {
    const [countryCode, adminLevelText] = entry.split(':');
    return {
      countryCode: countryCode ?? '',
      adminLevel: Number.parseInt(adminLevelText ?? '', 10),
    };
  }).filter((entry) => entry.countryCode && Number.isFinite(entry.adminLevel));

  if (removedPairs.length === 0) return;
  const taskQueue = new VtTaskQueueDb();
  const removedKeyTuples = removedPairs.map((entry) => (
    [nodeId, entry.countryCode, entry.adminLevel] as const
  ));

  const [sourceCacheIdsRaw, geometryCacheIdsRaw, allNodeTasks] = await Promise.all([
    ephemeralDB.sourceCacheMeta.where('[nodeId+countryCode+adminLevel]').anyOf(removedKeyTuples).primaryKeys(),
    ephemeralDB.geometryCacheMeta.where('[nodeId+countryCode+adminLevel]').anyOf(removedKeyTuples).primaryKeys(),
    listTasks(taskQueue, nodeId),
  ]);
  const tileEmitTasks = allNodeTasks.filter((task) => normalizeUiStageId(task.stageId ?? task.stage) === 'tileEmit');

  const toStringArray = (ids: readonly unknown[]): string[] => (
    ids
      .map((id) => {
        if (typeof id === 'string' || typeof id === 'number') return String(id);
        return null;
      })
      .filter((id): id is string => id !== null)
  );
  const sourceCacheIds = toStringArray(sourceCacheIdsRaw as readonly unknown[]);
  const geometryCacheIds = toStringArray(geometryCacheIdsRaw as readonly unknown[]);

  if (sourceCacheIds.length > 0) {
    await Promise.all([
      ephemeralDB.sourceCache.where('[nodeId+countryCode+adminLevel]').anyOf(removedKeyTuples).delete(),
      ephemeralDB.sourceCacheMeta.where('[nodeId+countryCode+adminLevel]').anyOf(removedKeyTuples).delete(),
    ]);
    await deleteRawDataDataSourceBuffersForNodeMetadataIds(nodeId, sourceCacheIds);
  }

  const removedBufferSet = new Set(geometryCacheIds);
  if (geometryCacheIds.length > 0) {
    await Promise.all([
      ephemeralDB.geometryCache.where('[nodeId+countryCode+adminLevel]').anyOf(removedKeyTuples).delete(),
      ephemeralDB.geometryCacheMeta.where('[nodeId+countryCode+adminLevel]').anyOf(removedKeyTuples).delete(),
    ]);
    const relations = await ephemeralDB.tileEmitBufferRelations
      .where('bufferId')
      .anyOf(geometryCacheIds)
      .toArray();
    const affectedTileIds = new Set(
      relations.map((row: EphemeralTileIdToBufferRelation) => row.tileId),
    );
    await ephemeralDB.tileEmitBufferRelations.where('bufferId').anyOf(geometryCacheIds).delete();

    const tileIdsToDelete = tileEmitTasks
      .map((task) => {
        const input = task.inputData as { bufferIds?: string[]; tileId?: number } | undefined;
        if (!input?.bufferIds?.length || typeof input.tileId !== 'number') return null;
        if (!input.bufferIds.some((bufferId) => removedBufferSet.has(bufferId))) return null;
        const hash = buildHash(input.bufferIds);
        return `${input.tileId}|${hash}`;
      })
      .filter((entry): entry is string => Boolean(entry));

    for (const tileId of tileIdsToDelete) {
      await shapeMutationAPIImpl.deleteVectorTile(tileId);
    }
    if (affectedTileIds.size > 0 && tileIdsToDelete.length === 0) {
      await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
    }
  }

  const tasks = allNodeTasks;
  const removedSet = new Set(removed.map((entry) => entry.toUpperCase()));
  const removedTaskIds = tasks
    .filter((task) => {
      const canonicalStage = normalizeUiStageId(task.stageId ?? task.stage);
      if (canonicalStage === 'source' || canonicalStage === 'geometry') {
        const input = task.inputData as { countryCode?: string; adminLevel?: number } | undefined;
        if (!input?.countryCode || typeof input.adminLevel !== 'number') return false;
        return removedSet.has(`${input.countryCode.toUpperCase()}:${input.adminLevel}`);
      }
      if (canonicalStage === 'tileEmit') {
        const input = task.inputData as { bufferIds?: string[] } | undefined;
        if (!input?.bufferIds?.length) return false;
        return input.bufferIds.some((bufferId) => removedBufferSet.has(bufferId));
      }
      return false;
    })
    .map((task) => task.taskId);

  if (removedTaskIds.length > 0) {
    await taskQueue.tasks.bulkDelete(removedTaskIds);
  }

  try {
    await bridgeRef.initialize();
    const updater = await bridgeRef.getTreeNodeUpdaterAPI();
    const node = await updater.getTreeNode(nodeId);
    const currentDraftData = (
      node?.draftData && typeof node.draftData === 'object'
        ? (node.draftData as Record<string, unknown>)
        : {}
    );
    await updater.updateTreeNode(nodeId, {
      mode: 'save-draft',
      draftData: {
        ...sanitizeShapeDraftData(currentDraftData),
        selectedArrayByCountries: nextSelection,
      } as Record<string, unknown>,
    });
    await shapeMutationAPIImpl.deleteBuildSession(nodeId);
  } catch (error) {
    console.warn('[ShapeCountrySelectionStep] failed to invalidate build after selection change', error);
  }
};
