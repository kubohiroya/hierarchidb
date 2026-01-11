import { useCallback, useEffect, useMemo, useState } from 'react';
import { useId } from 'react';
import type { FetchConfig, BatchConfig, ShapeEntity } from '../../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../../common/types/index.js';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { notify } from '@hierarchidb/components';
import { useTranslation } from '../../i18n.js';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom } from 'jotai';
import { persistedTasksAtom, tasksAtom } from '../../atoms/shapeBuildProgressAtoms.js';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { VtShapeDb, SHAPE_DOMAIN } from '@hierarchidb/vt-shape-store';
import type { BatchTaskType } from '@hierarchidb/shape-store';
import { shapeEphemeralAPIImpl, shapeMutationAPIImpl, shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildApiClient.ts';

type Args = {
  config: BatchConfig;
  nodeId: NodeId;
  draft: Partial<ShapeEntity>;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
  onResetSession?: () => void;
};

const isVectorTileStage = (stage?: string): boolean => stage === 'vt';
const SHAPE_NODE_TYPE = 'shape' as NodeType;

export const useFetchConfigSection = ({ config, nodeId, draft, disabled, onChange, onResetSession }: Args) => {
  const { t } = useTranslation();
  const switchId = useId();
  const baseFetchConfig: FetchConfig | undefined =
    config.fetchConfig ?? DEFAULT_PROCESSING_CONFIG.fetchConfig;
  const bridgeRef = useMemo(() => getWorkerBridge(), []);

  const [countsLoading, setCountsLoading] = useState(false);

  const [counts, setCounts] = useState<Record<"fetch"|"transform"|"vt", number>>({ fetch: 0, transform: 0, vt: 0 });
  const [failedCounts, setFailedCounts] = useState({ fetch: 0, transform: 0, vt: 0 });
  const [resultCounts, setResultCounts] = useState({ tiles: 0, metadata: 0 });

  const [isRunning, setIsRunning] = useState<boolean | null>(null);
  const setBuildTasks = useSetAtom(tasksAtom);
  const setPersistedTasks = useSetAtom(persistedTasksAtom);
  const deleteLabelMessage = useMemo(() => (
    counts.fetch > 0
      ? t('processing.download.deleteFetchedFilesWithCount', 'Delete fetch cache ({{count}} items)', { count: counts.fetch })
      : t('processing.download.deleteFetchedFiles', 'Delete fetch cache')
  ), [counts.fetch, t]);

  const loadCounts = useCallback(async () => {
    if (!nodeId) {
      setCounts({ fetch: 0, transform: 0, vt: 0 });
      setResultCounts({ tiles: 0, metadata: 0 });
      setFailedCounts({ fetch: 0, transform: 0, vt: 0 });
      setIsRunning(false);
      setCountsLoading(false);
      return;
    }

    setCountsLoading(true);

    try {
      const fetchTasks = await shapeEphemeralAPIImpl.listBuildTasksByType(nodeId, 'fetch');
      const transformTasks = await shapeEphemeralAPIImpl.listBuildTasksByType(nodeId, 'transform');
      const vtTasks = await shapeEphemeralAPIImpl.listBuildTasksByType(nodeId, 'vt');
      const numTiles = await shapeQueryAPIImpl.listVectorTileRows(nodeId).then((rows) => rows.length);
      const numMetadata = await shapeQueryAPIImpl.listFeatureMetadata(nodeId).then((rows) => rows.length);

      const sessionStatus = await bridgeRef
          .initialize()
          .then(() => bridgeRef.getBatchSessionStatus(SHAPE_NODE_TYPE, nodeId))
          .catch(() => null);

      setIsRunning(sessionStatus?.status === 'running' || sessionStatus?.status === 'paused');

      const failedFetchCount = fetchTasks.filter((task) => task.status === 'failed').length;
      const failedTransformCount = transformTasks.filter((task) => task.status === 'failed').length;
      const failedVTCount = vtTasks.filter((task) => task.status === 'failed').length;

      setCounts({ fetch: fetchTasks.length, transform: transformTasks.length, vt: transformTasks.length});
      setFailedCounts({fetch: failedFetchCount, transform: failedTransformCount, vt: failedVTCount});
      setResultCounts({ tiles: numTiles, metadata: numMetadata });
    } finally {
      setCountsLoading(false);
    }
  }, [nodeId, bridgeRef]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await loadCounts();
      if (cancelled) return;
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadCounts]);

  const hasFinalOutputs = resultCounts.tiles > 0 || resultCounts.metadata > 0;
  const canDeleteFetchCache = !isRunning && !disabled && (
    counts.fetch > 0
    || failedCounts.fetch > 0
  );
  const canDeleteTransformCache = !isRunning && !disabled && (
    counts.transform > 0
    || failedCounts.transform > 0
  );
  const canDeleteVTCache = !isRunning && !disabled && (
    counts.vt > 0
    || failedCounts.vt > 0
    || hasFinalOutputs
  );
  const canDeleteMetadata = !isRunning && !disabled && resultCounts.metadata > 0;

  const clearBatchTasksForType = useCallback(async (taskType: BatchTaskType) => {
    const rows = await shapeEphemeralAPIImpl.listBuildTasksByType(nodeId, taskType);
    await shapeEphemeralAPIImpl.deleteBuildTasksByIds(rows.map((task) => task.taskId));
    const vtStage = taskType;
    if (vtStage) {
      const taskQueue = new VtTaskQueueDb();
      await taskQueue.tasks
        .where('[nodeId+stage]')
        .equals([nodeId, vtStage])
        .delete();
    }
  }, [nodeId]);

  const clearFinalOutputs = useCallback(async () => {
    await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
    await shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId);
    await shapeMutationAPIImpl.deleteSourceMetadataByNode(nodeId);
  }, [nodeId]);

  const persistSessionReset = useCallback(async () => {
    if (!nodeId) return;
    try {
      await bridgeRef.initialize();
      const updater = await bridgeRef.getTreeNodeUpdaterAPI();
      await updater.updateTreeNode(nodeId, {
        mode: 'save-draft',
        draftData: {
          ...(draft ?? {}),
          processingStatus: 'idle',
          tileSummary: undefined,
          buildStartedAt: undefined,
          buildFinishedAt: undefined,
        } as Record<string, unknown>,
      });
    } catch (error) {
      console.warn('[ShapeDownloadConfigSection] failed to persist session reset', error);
    }
  }, [bridgeRef, draft, nodeId]);

  const persistTileSummaryReset = useCallback(async () => {
    if (!nodeId) return;
    try {
      await bridgeRef.initialize();
      const updater = await bridgeRef.getTreeNodeUpdaterAPI();
      await updater.updateTreeNode(nodeId, {
        mode: 'save-draft',
        draftData: {
          ...(draft ?? {}),
          tileSummary: undefined,
        } as Record<string, unknown>,
      });
    } catch (error) {
      console.warn('[ShapeDownloadConfigSection] failed to persist tile summary reset', error);
    }
  }, [bridgeRef, draft, nodeId]);

  const handleDeleteFetchCache = useCallback(async () => {
    await shapeEphemeralAPIImpl.clearStage(nodeId, 'fetch');
    await clearBatchTasksForType('fetch');
    const vtShapeDb = new VtShapeDb();
    await vtShapeDb.stage1Buffers
      .where('[nodeId+domainType]')
      .equals([nodeId, SHAPE_DOMAIN])
      .delete();
    await clearFinalOutputs();
    await loadCounts();
    onResetSession?.();
    await persistSessionReset();
    notify.success('Deleted fetch cache');
  }, [
    nodeId,
    clearBatchTasksForType,
    clearFinalOutputs,
    loadCounts,
    onResetSession,
    persistSessionReset,
  ]);

  const handleDeleteTransformCache = useCallback(async () => {
    await shapeEphemeralAPIImpl.clearStage(nodeId, 'transform');
    await clearBatchTasksForType('transform');
    setBuildTasks((prev) => prev.filter((task) => task.stage !== 'transform'));
    setPersistedTasks((prev) => prev.filter((task) => task.stage !== 'transform'));
    await loadCounts();
    notify.success('Deleted transform cache');
  }, [nodeId, clearBatchTasksForType, loadCounts, setBuildTasks, setPersistedTasks]);

  const handleDeleteVTCache = useCallback(async () => {
    await shapeEphemeralAPIImpl.clearStage(nodeId, 'vt');
    await clearBatchTasksForType('vt');
    await clearFinalOutputs();
    setBuildTasks((prev) => prev.filter((task) => !isVectorTileStage(task.stage)));
    setPersistedTasks((prev) => prev.filter((task) => !isVectorTileStage(task.stage)));
    await persistTileSummaryReset();
    await loadCounts();
    notify.success('Deleted vt cache');
  }, [
    nodeId,
    clearBatchTasksForType,
    clearFinalOutputs,
    loadCounts,
    persistTileSummaryReset,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteMetadata = useCallback(async () => {
    await shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId);
    await shapeMutationAPIImpl.deleteSourceMetadataByNode(nodeId);
    await loadCounts();
    notify.success('Deleted metadata');
  }, [nodeId, loadCounts]);

  const update = useCallback((partial: Partial<BatchConfig>) => {
    onChange(mergeBatchConfig({ ...config, ...partial }));
  }, [config, onChange]);

  const handleResetDefaults = useCallback(() => {
    const defaultDownloadConfig: FetchConfig = DEFAULT_PROCESSING_CONFIG.fetchConfig ?? { maxConcurrent: 2 };
    onChange(mergeBatchConfig({
      ...DEFAULT_PROCESSING_CONFIG,
      fetchConfig: defaultDownloadConfig,
      dataSource: config.dataSource ?? DEFAULT_PROCESSING_CONFIG.dataSource,
    }));
  }, [config.dataSource, onChange]);

  if (!baseFetchConfig) {
    throw new Error('DownloadConfigSection: baseDownloadConfig is not defined');
  }

  return {
    t,
    switchId,
    baseDownloadConfig: baseFetchConfig,
    deleteLabel: deleteLabelMessage,
    countsLoading,
    canDeleteFetchCache,
    canDeleteTransformCache,
    canDeleteVTCache,
    canDeleteMetadata,
    handleDeleteFetchCache,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    handleDeleteMetadata,
    handleResetDefaults,
    update,
  };
};
