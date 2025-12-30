import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeType, NodeId } from '@hierarchidb/common-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { notify } from '@hierarchidb/components';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { BuildStatus } from '@hierarchidb/components';
import { normalizeDataSourceName, type DownloadTaskPayload, type ShapeEntity } from '../../../common/types/index.js';
import { type AuthProviderType, useAuth } from '@hierarchidb/ui-auth';

type Args = {
  nodeType: NodeType;
  nodeId?: NodeId;
  data?: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  buildStatus: BuildStatus;
};

export const useBatchSessionActions = ({
  nodeType,
  nodeId,
  data,
  onChange,
  buildStatus,
}: Args) => {
  const debugScope = '[ShapeBuildProgressStep]';
  const bridgeRef = useRef(getWorkerBridge());
  const { isAuthenticated, isLoading: isAuthLoading, signIn } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const workerClientHook = useMemo(() => {
    try {
      return getWorkerClientHook<WorkerClientRef | null>();
    } catch {
      return null;
    }
  }, []);
  const workerClient = workerClientHook ? workerClientHook() : null;
  const closeAuthDialog = useCallback(() => setAuthDialogOpen(false), []);
  const openAuthDialog = useCallback(() => setAuthDialogOpen(true), []);
  const handleProviderSelect = useCallback(
    async (provider: AuthProviderType) => {
      try {
        await signIn({ provider, isUserInitiated: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        notify.error(message || 'Authentication failed.');
      }
    },
    [signIn],
  );

  useEffect(() => {
    if (isAuthenticated) {
      closeAuthDialog();
    }
  }, [closeAuthDialog, isAuthenticated]);

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
      ...(data?.batchConfig ?? {}),
      ...(patch?.batchConfig ?? {}),
    };
    const resolvedDataSource = normalizeDataSourceName(
      baseBatchConfig.dataSource ?? data?.dataSourceName,
    );
    const resolvedBatchConfig = resolvedDataSource
      ? { ...baseBatchConfig, dataSource: resolvedDataSource }
      : baseBatchConfig;
    try {
      console.debug(`${debugScope} saveDraftBeforeBatch:updateDraft`, {
        nodeId,
        dataSource: resolvedDataSource ?? null,
      });
      const api = workerClient.getAPI();
      const updater = await api.getTreeNodeUpdaterAPI();
      await updater.updateTreeNode(nodeId, {
        mode: 'save-draft',
        draftData: {
          ...(data ?? {}),
          ...(patch ?? {}),
          batchConfig: resolvedBatchConfig,
          dataSourceName: resolvedDataSource ?? data?.dataSourceName,
        } as Record<string, unknown>,
      });
      console.debug(`${debugScope} saveDraftBeforeBatch:complete`, {
        nodeId,
        dataSource: resolvedDataSource ?? null,
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

  const buildDownloadTaskPayloads = useCallback(async (): Promise<DownloadTaskPayload[] | null> => {
    if (!workerClient) {
      notify.error('Worker client is unavailable.');
      return null;
    }
    const resolvedDataSource = normalizeDataSourceName(
      data?.batchConfig?.dataSource ?? data?.dataSourceName,
    );
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
      resolvedDataSource,
      selectionRecord,
    ) as Promise<DownloadTaskPayload[]>;
  }, [data?.batchConfig?.dataSource, data?.dataSourceName, data?.selectedArrayByCountries, workerClient]);

  const handleStartOrResume = useCallback(async (): Promise<boolean> => {
    console.debug(`${debugScope} startOrResume:click`, {
      nodeId,
      buildStatus,
    });
    if (!nodeId) {
      notify.warning('NodeId is missing.');
      return false;
    }
    if (!isAuthenticated) {
      console.debug(`${debugScope} startOrResume:notAuthenticated`, {
        isAuthLoading,
      });
      if (isAuthLoading) {
        notify.info('Authentication is still loading. Please try again.');
        return false;
      }
      openAuthDialog();
      return false;
    }
    const saved = await saveDraftBeforeBatch();
    if (!saved) {
      console.debug(`${debugScope} startOrResume:saveDraftFailed`);
      return false;
    }
    try {
      await bridgeRef.current.initialize();
      console.debug(`${debugScope} startOrResume:bridgeReady`);
      if (buildStatus === 'paused') {
        console.debug(`${debugScope} startOrResume:resume`, { nodeId });
        try {
          await bridgeRef.current.resumeBatchSession(nodeType, nodeId);
          console.debug(`${debugScope} startOrResume:resumeOk`, { nodeId });
          await persistDraftPatch({ processingStatus: 'processing' });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (/missing download payloads/i.test(message)) {
            notify.info('Download cache was cleared. Restarting stage.');
          } else if (!/session .*not found/i.test(message)) {
            throw error;
          }
          console.debug(`${debugScope} startOrResume:resumeNotFound`, { nodeId });
        }
      }
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
      const statusResult = await bridgeRef.current.startBatchSession(nodeType, nodeId, payloads);
      console.debug(`${debugScope} startOrResume:startBatchResult`, statusResult ?? null);
      const nextStatus = statusResult.status === 'paused'
        ? 'paused'
        : statusResult.status === 'completed'
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

  const handlePause = useCallback(async () => {
    console.debug(`${debugScope} pause:click`, { nodeId, nodeType });
    if (!nodeId) {
      notify.warning('NodeId is missing.');
      return;
    }
    const saved = await saveDraftBeforeBatch();
    if (!saved) {
      console.debug(`${debugScope} pause:saveDraftFailed`, { nodeId });
      return;
    }
    try {
      await bridgeRef.current.initialize();
      console.debug(`${debugScope} pause:bridgeReady`, { nodeId });
      await bridgeRef.current.pauseBatchSession(nodeType, nodeId);
      console.debug(`${debugScope} pause:ok`, { nodeId });
      await persistDraftPatch({ processingStatus: 'paused' });
    } catch (error) {
      notify.error('Failed to pause build.');
      console.error('[ShapeBuildProgressStep] pause failed', error);
    }
  }, [nodeId, nodeType, saveDraftBeforeBatch]);

  return {
    handleStartOrResume,
    handlePause,
    authDialogOpen,
    closeAuthDialog,
    handleProviderSelect,
  };
};
