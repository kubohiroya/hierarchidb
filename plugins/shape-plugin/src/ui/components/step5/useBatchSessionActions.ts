import { useCallback, useMemo, useRef } from 'react';
import type { NodeType, NodeId } from '@hierarchidb/common-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { notify } from '@hierarchidb/components';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { BuildStatus } from '@hierarchidb/components';
import type { FetchTaskPayload, ShapeEntity } from '../../../common/types/index.js';
import { loadTreeConsoleSettings } from '@hierarchidb/util';

type Args = {
  nodeType: NodeType;
  nodeId?: NodeId;
  data?: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  buildStatus: BuildStatus;
  canResume: boolean;
};

export const useBatchSessionActions = ({
  nodeType,
  nodeId,
  data,
  onChange,
  buildStatus,
  canResume,
}: Args) => {
  const debugScope = '[ShapeBuildStep]';
  const bridgeRef = useRef(getWorkerBridge());
  const authDialogOpen = false;
  const workerClientHook = useMemo(() => {
    try {
      return getWorkerClientHook<WorkerClientRef | null>();
    } catch {
      return null;
    }
  }, []);
  const workerClient = workerClientHook ? workerClientHook() : null;
  const closeAuthDialog = useCallback(() => {}, []);
  const handleProviderSelect = useCallback(() => {}, []);

  const saveDraftBeforeBatch = useCallback(async (patch?: Partial<ShapeEntity>) => {
    console.debug(`${debugScope} saveDraftBeforeBatch:start`, {
      nodeId,
      hasWorkerClient: Boolean(workerClient),
      buildStatus,
    });
    if (!nodeId) {
      console.debug(`${debugScope} saveDraftBeforeBatch:missingNodeId`);
      notify.warning('NodeId is missing.');
      return false;
    }
    if (!workerClient) {
      console.debug(`${debugScope} saveDraftBeforeBatch:missingWorkerClient`);
      notify.error('Worker client is unavailable.');
      return false;
    }
    const baseBatchConfig = {
      ...(data?.buildConfig ?? {}),
      ...(patch?.buildConfig ?? {}),
    };
    try {
      console.debug(`${debugScope} saveDraftBeforeBatch:updateDraft`, {
        nodeId,
        dataSourceName: baseBatchConfig.dataSourceName ?? null,
      });
      const api = workerClient.getAPI();
      const updater = await api.getTreeNodeUpdaterAPI();
      await updater.updateTreeNode(nodeId, {
        mode: 'save-draft',
        draftData: {
          ...(data ?? {}),
          ...(patch ?? {}),
          batchConfig: baseBatchConfig,
        } as Record<string, unknown>,
      });
      console.debug(`${debugScope} saveDraftBeforeBatch:complete`, {
        nodeId,
        dataSourceName: baseBatchConfig.dataSourceName ?? null,
      });
      return true;
    } catch (error) {
      notify.error('Failed to save draft.');
      console.error('[ShapeBuildProgressStep] save draft failed', error);
      return false;
    }
  }, [data, nodeId, workerClient]);

  const persistDraftPatch = useCallback(async (patch: Partial<ShapeEntity>) => {
    if (!nodeId || !workerClient) return;
    try {
      const api = workerClient.getAPI();
      const updater = await api.getTreeNodeUpdaterAPI();
      await updater.updateTreeNode(nodeId, {
        mode: 'save-draft',
        draftData: {
          ...(data ?? {}),
          ...patch,
        } as Record<string, unknown>,
      });
      onChange(patch);
    } catch (error) {
      console.error('[ShapeBuildProgressStep] failed to persist build markers', error);
    }
  }, [data, nodeId, onChange, workerClient]);

  const buildDownloadTaskPayloads = useCallback(async (): Promise<FetchTaskPayload[] | null> => {
    if (!workerClient) {
      notify.error('Worker client is unavailable.');
      return null;
    }
    if (!nodeId) {
      notify.warning('NodeId is missing.');
      return null;
    }
    const resolvedDataSource = data?.buildConfig?.dataSourceName;
    if (!resolvedDataSource) {
      notify.warning('Data source is missing.');
      return null;
    }
    const selectionRecord = data?.selectedArrayByCountries;
    if (!selectionRecord || (typeof selectionRecord === 'object' && !Array.isArray(selectionRecord) && Object.keys(selectionRecord).length === 0)) {
      notify.warning('Selection is empty.');
      return null;
    }
    const api = workerClient.getAPI();
    return api.generateShapeDownloadTaskPayloadsFromSelection(
      nodeId,
      resolvedDataSource,
      selectionRecord,
    ) as Promise<FetchTaskPayload[]>;
  }, [data?.buildConfig?.dataSourceName, data?.selectedArrayByCountries, nodeId, workerClient]);

  const handleStartOrResume = useCallback(async (options?: { forceRestart?: boolean }): Promise<boolean> => {
    console.debug(`${debugScope} startOrResume:click`, {
      nodeId,
      buildStatus,
      forceRestart: options?.forceRestart ?? false,
    });
    if (!nodeId) {
      notify.warning('NodeId is missing.');
      return false;
    }
    if (canResume && !options?.forceRestart) {
      try {
        await bridgeRef.current.initialize();
        const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
        await bridgeRef.current.resumeBatchSession(nodeType, nodeId, policy);
        await persistDraftPatch({ processingStatus: 'processing' });
        return true;
      } catch (error) {
        notify.error('Failed to resume build.');
        console.error('[ShapeBuildProgressStep] resume failed', error);
        return false;
      }
    }
    const saved = await saveDraftBeforeBatch();
    if (!saved) {
      console.debug(`${debugScope} startOrResume:saveDraftFailed`);
      return false;
    }
    try {
      await bridgeRef.current.initialize();
      console.debug(`${debugScope} startOrResume:bridgeReady`);
      const payloads = await buildDownloadTaskPayloads();
      if (!payloads || payloads.length === 0) {
        console.debug(`${debugScope} startOrResume:missingPayloads`, { nodeId });
        return false;
      }
      console.debug(`${debugScope} startOrResume:startBatch`, {
        nodeId,
        nodeType,
        payloadCount: payloads.length,
      });
      const policy = loadTreeConsoleSettings().buildContinuationPolicy ?? 'finish_all_stages';
      const statusResult = await bridgeRef.current.startBatchSession(nodeType, nodeId, payloads, policy);
      console.debug(`${debugScope} startOrResume:startBatchResult`, statusResult ?? null);
      const nextStatus = statusResult.status === 'completed'
        ? 'completed'
        : statusResult.status === 'failed'
          ? 'failed'
          : 'processing';
      await persistDraftPatch({ processingStatus: nextStatus });
      return true;
    } catch (error) {
      notify.error('Failed to start or resume build.');
      console.error('[ShapeBuildProgressStep] start/resume failed', error);
      return false;
    }
  }, [buildDownloadTaskPayloads, buildStatus, nodeId, nodeType, persistDraftPatch, saveDraftBeforeBatch]);

  const handlePause = useCallback(async (): Promise<void> => {
    if (!nodeId) {
      notify.warning('NodeId is missing.');
      return;
    }
    try {
      await bridgeRef.current.initialize();
      await bridgeRef.current.pauseBatchSession(nodeType, nodeId);
      await persistDraftPatch({ processingStatus: 'paused' });
    } catch (error) {
      notify.error('Failed to pause build.');
      console.error('[ShapeBuildProgressStep] pause failed', error);
    }
  }, [nodeId, nodeType, persistDraftPatch]);

  return {
    handleStartOrResume,
    handlePause,
    authDialogOpen,
    closeAuthDialog,
    handleProviderSelect,
  };
};
