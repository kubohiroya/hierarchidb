import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeType, NodeId } from '@hierarchidb/common-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { notify } from '@hierarchidb/components';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { BuildStatus } from '@hierarchidb/components';
import { normalizeDataSourceName, type DownloadTaskPayload, type ShapeEntity } from '../../../common/types/index.js';
import { type AuthProviderType, useAuth } from '@hierarchidb/ui-auth';

const SHARED_ZOOM_RANGE_KEY = 'sharedZoomRange';
const DEFAULT_SHARED_ZOOM_RANGE: [number, number] = [0, 7];
const DEFAULT_SHARED_ZOOM_SEGMENTS = 2;
const DEFAULT_SHARED_ZOOM_BREAKPOINTS: number[] = [0, 4, 7];
const SHARED_ZOOM_RANGE_MIN = 0;
const SHARED_ZOOM_RANGE_MAX = 12;

type SharedZoomConfig = {
  range: [number, number];
  segments: number;
  breakpoints: number[];
};

const clampRange = (range: [number, number]): [number, number] => {
  const min = Math.min(Math.max(range[0], SHARED_ZOOM_RANGE_MIN), SHARED_ZOOM_RANGE_MAX);
  const max = Math.min(Math.max(range[1], SHARED_ZOOM_RANGE_MIN), SHARED_ZOOM_RANGE_MAX);
  return min <= max ? [min, max] : [max, min];
};

const normalizeBreakpoints = (
  range: [number, number],
  segments: number,
  breakpoints?: number[],
): number[] => {
  const [min, max] = range;
  if (segments <= 1 || min === max) {
    return [min, max];
  }
  const expectedLength = segments + 1;
  if (!Array.isArray(breakpoints) || breakpoints.length !== expectedLength) {
    const step = (max - min) / segments;
    const points = Array.from({ length: expectedLength }, (_, index) => Math.round(min + step * index));
    points[0] = min;
    points[points.length - 1] = max;
    return points;
  }
  const sorted = [...breakpoints]
    .map((value) => Math.min(Math.max(Number(value), min), max))
    .sort((a, b) => a - b);
  sorted[0] = min;
  sorted[sorted.length - 1] = max;
  return sorted;
};

const normalizeSharedZoomConfig = (value: unknown): SharedZoomConfig => {
  if (Array.isArray(value)) {
    const range = clampRange([
      Number.isFinite(Number(value[0])) ? Number(value[0]) : DEFAULT_SHARED_ZOOM_RANGE[0],
      Number.isFinite(Number(value[1])) ? Number(value[1]) : DEFAULT_SHARED_ZOOM_RANGE[1],
    ]);
    const breakpoints = normalizeBreakpoints(range, DEFAULT_SHARED_ZOOM_SEGMENTS);
    return { range, segments: DEFAULT_SHARED_ZOOM_SEGMENTS, breakpoints };
  }
  if (value && typeof value === 'object') {
    const record = value as Partial<SharedZoomConfig>;
    const range = clampRange([
      Number.isFinite(Number(record.range?.[0])) ? Number(record.range?.[0]) : DEFAULT_SHARED_ZOOM_RANGE[0],
      Number.isFinite(Number(record.range?.[1])) ? Number(record.range?.[1]) : DEFAULT_SHARED_ZOOM_RANGE[1],
    ]);
    const segments = Number.isFinite(Number(record.segments)) ? Number(record.segments) : DEFAULT_SHARED_ZOOM_SEGMENTS;
    const breakpoints = normalizeBreakpoints(range, segments, record.breakpoints);
    return { range, segments, breakpoints };
  }
  return {
    range: DEFAULT_SHARED_ZOOM_RANGE,
    segments: DEFAULT_SHARED_ZOOM_SEGMENTS,
    breakpoints: DEFAULT_SHARED_ZOOM_BREAKPOINTS,
  };
};

const readSharedZoomConfig = (): SharedZoomConfig => {
  if (typeof window === 'undefined') {
    return normalizeSharedZoomConfig(null);
  }
  const stored = window.localStorage?.getItem(SHARED_ZOOM_RANGE_KEY);
  if (!stored) {
    return normalizeSharedZoomConfig(null);
  }
  try {
    const parsed = JSON.parse(stored);
    return normalizeSharedZoomConfig(parsed);
  } catch (error) {
    console.warn('[ShapeBuildProgressStep] Failed to parse shared zoom range', error);
    return normalizeSharedZoomConfig(null);
  }
};

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
    const resolvedDataSource = normalizeDataSourceName(baseBatchConfig.dataSource);
    const resolvedBatchConfig = resolvedDataSource
      ? { ...baseBatchConfig, dataSource: resolvedDataSource }
      : baseBatchConfig;
    const { range: [sharedMin, sharedMax], breakpoints } = readSharedZoomConfig();
    const mergedBatchConfig = {
      ...resolvedBatchConfig,
      tileConfig: {
        ...(resolvedBatchConfig.tileConfig ?? {}),
        minZoom: sharedMin,
        maxZoom: sharedMax,
        zoomBreakpoints: breakpoints,
      },
    };
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
          batchConfig: mergedBatchConfig,
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
    if (!nodeId) {
      notify.warning('NodeId is missing.');
      return null;
    }
    const resolvedDataSource = normalizeDataSourceName(data?.batchConfig?.dataSource);
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
    ) as Promise<DownloadTaskPayload[]>;
  }, [data?.batchConfig?.dataSource, data?.selectedArrayByCountries, nodeId, workerClient]);

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
      const payloads = await buildDownloadTaskPayloads();
      if (!payloads || payloads.length === 0) {
        console.debug(`${debugScope} startOrResume:missingPayloads`, { nodeId });
        return false;
      }
      const { range: [sharedMin, sharedMax] } = readSharedZoomConfig();
      console.debug(`${debugScope} startOrResume:startBatch`, {
        nodeId,
        nodeType,
        payloadCount: payloads.length,
      });
      const statusResult = await bridgeRef.current.startBatchSession(nodeType, nodeId, payloads);
      await persistDraftPatch({
        buildTileZoomRange: { minZoom: sharedMin, maxZoom: sharedMax },
      });
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

  return {
    handleStartOrResume,
    authDialogOpen,
    closeAuthDialog,
    handleProviderSelect,
  };
};
