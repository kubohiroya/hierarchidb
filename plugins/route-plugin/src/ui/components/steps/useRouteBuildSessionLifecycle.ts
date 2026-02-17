import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { proxy } from 'comlink';
import {
  IDE_GSM_BULK_CHUNK_SIZE,
  type IdeGsmRouteSelectionEntry,
  type IdeGsmImportProgress,
  type IdeGsmRouteError,
  type RouteEntity,
  type RouteMode,
} from '@hierarchidb/route-api';
import {
  executePauseBuildFlow,
  notify,
  type BuildStatus,
  type PauseBuildReason,
  useBuildSessionTransition,
} from '@hierarchidb/components';
import { ROUTE_MODE_COLUMNS } from './useRouteSelectionStep.js';

export type RouteBuildSessionTransitionPhase =
  | 'acquiring-lock'
  | 'initializing-worker'
  | 'fetch-stage'
  | 'transform-stage'
  | 'vt-stage'
  | 'finalizing';

type RouteMutationApi = {
  importIdeGsmRoutes: (
    args: {
      nodeId: NodeId;
      tabularSourceId: string;
      selectionEntries?: IdeGsmRouteSelectionEntry[];
      chunkSize: number;
    },
    onProgress: (progress: IdeGsmImportProgress) => void,
  ) => Promise<{ errors: IdeGsmRouteError[] }>;
  buildRouteTileIndex: (args: {
    nodeId: NodeId;
    minZoom: number;
    maxZoom: number;
    zoomBandBoundaries?: number[];
    minDistanceMetersByBand?: number[];
    simplifyToleranceByBand?: number[];
  }) => Promise<unknown>;
  generateRouteVectorTiles: (args: {
    nodeId: NodeId;
    minZoom: number;
    maxZoom: number;
    zoomBandBoundaries?: number[];
    bufferSize: number;
    inputFormat: 'geojson' | 'flatgeobuf';
    inputCompression: 'gzip' | 'none';
  }) => Promise<unknown>;
};

type RouteWorkerApi = {
  getRouteMutationAPI: () => Promise<RouteMutationApi>;
};

type UseRouteBuildSessionLifecycleArgs = {
  api: RouteWorkerApi | null;
  initialize: () => Promise<void>;
  draft: Partial<RouteEntity>;
  routeData: {
    processingStatus?: string;
    buildFinishedAt?: number | null;
  };
  onUpdate: (updates: Partial<RouteEntity>) => void;
  routeNodeId: NodeId | undefined;
  resolveZoomRange: () => [number, number];
  resolveRouteTransformConfig: () => {
    zoomBandBoundaries?: number[];
    minDistanceMetersByBand?: number[];
    simplifyToleranceByBand?: number[];
  };
  resolveVectorTileConfig: () => {
    bufferSize: number;
    inputFormat: 'geojson' | 'flatgeobuf';
    inputCompression: 'gzip' | 'none';
  };
  mapIdeGsmProgress: (progress: IdeGsmImportProgress) => number;
  fetchStageMax: number;
  transformStageMax: number;
  vtStageMax: number;
  t: (key: string, fallback?: string) => string;
};

const buildIdeGsmSelectionEntries = (
  selectedArrayByCountries?: Record<string, boolean[]>,
): IdeGsmRouteSelectionEntry[] => {
  if (!selectedArrayByCountries) return [];
  const entries: IdeGsmRouteSelectionEntry[] = [];
  Object.entries(selectedArrayByCountries).forEach(([countryCodeRaw, rawRow]) => {
    const countryCode = countryCodeRaw.trim().toUpperCase();
    if (!countryCode) return;
    const row = Array.isArray(rawRow) ? rawRow : [];
    const orModes: RouteMode[] = [];
    const andModes: RouteMode[] = [];
    ROUTE_MODE_COLUMNS.forEach((modeColumn, modeIndex) => {
      const orChecked = Boolean(row[modeIndex]);
      const andChecked = row.length >= ROUTE_MODE_COLUMNS.length * 2
        ? Boolean(row[modeIndex + ROUTE_MODE_COLUMNS.length])
        : orChecked;
      if (orChecked) {
        orModes.push(modeColumn.id);
      }
      if (andChecked || orChecked) {
        andModes.push(modeColumn.id);
      }
    });
    if (orModes.length === 0 && andModes.length === 0) return;
    entries.push({
      countryCode,
      countryName: getCountryDisplayName(countryCode),
      orModes,
      andModes,
    });
  });
  return entries;
};

const getCountryDisplayName = (countryCode: string): string => {
  if (!countryCode) return '';
  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') {
    return countryCode;
  }
  const locale = typeof navigator === 'undefined' || !navigator?.language ? 'en' : navigator.language;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
};

const SESSION_QUIET_THRESHOLD_MS = 5_000;

export const useRouteBuildSessionLifecycle = ({
  api,
  initialize,
  draft,
  routeData,
  onUpdate,
  routeNodeId,
  resolveZoomRange,
  resolveRouteTransformConfig,
  resolveVectorTileConfig,
  mapIdeGsmProgress,
  fetchStageMax,
  transformStageMax,
  vtStageMax,
  t,
}: UseRouteBuildSessionLifecycleArgs) => {
  const [status, setStatus] = useState<BuildStatus>('idle');
  const [overallProgress, setOverallProgress] = useState(0);
  const [isPausePending, setIsPausePending] = useState(false);
  const [errorRows, setErrorRows] = useState<IdeGsmRouteError[]>([]);
  const [ideGsmPhase, setIdeGsmPhase] = useState<IdeGsmImportProgress | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [crashSuspectOpen, setCrashSuspectOpen] = useState(false);
  const [crashSuspectMessage, setCrashSuspectMessage] = useState<string | null>(null);
  const [suspendSuspectOpen, setSuspendSuspectOpen] = useState(false);
  const [suspendSuspectMessage, setSuspendSuspectMessage] = useState<string | null>(null);
  const sessionId = routeNodeId ? String(routeNodeId) : null;
  const isWebLockSupported = true;
  const completionStatusRef = useRef<BuildStatus | null>(null);
  const buildInFlightRef = useRef(false);
  const crashCheckStartedAtRef = useRef<number>(Date.now());
  const shouldAutoResume = Boolean(
    routeData.processingStatus === 'processing' && !routeData.buildFinishedAt,
  );

  const closeCrashSuspect = useCallback(() => {
    setCrashSuspectOpen(false);
    setCrashSuspectMessage(null);
    crashCheckStartedAtRef.current = Date.now();
  }, []);
  const closeSuspendSuspect = useCallback(() => {
    setSuspendSuspectOpen(false);
    setSuspendSuspectMessage(null);
    crashCheckStartedAtRef.current = Date.now();
  }, []);

  const {
    buildSessionTransition,
    beginBuildSessionTransition,
    advanceBuildSessionTransitionPhase,
    finishBuildSessionTransition,
  } = useBuildSessionTransition<RouteBuildSessionTransitionPhase>({
    logPrefix: '[RouteBuildStep]',
    context: {
      nodeId: routeNodeId ? String(routeNodeId) : null,
    },
    onNotify: (level, message) => {
      if (level === 'error') {
        notify.error(message);
        return;
      }
      if (level === 'warning') {
        notify.warning(message);
        return;
      }
      if (level === 'success') {
        notify.success(message);
        return;
      }
      notify.info(message);
    },
  });

  useEffect(() => {
    if (!isPausePending) return;
    if (status !== 'running') {
      setIsPausePending(false);
    }
  }, [isPausePending, status]);

  useEffect(() => {
    if (status !== 'running') {
      setIsPausePending(false);
    }
  }, [status]);

  useEffect(() => {
    completionStatusRef.current = status;
  }, [status]);

  const runIdeGsmBuild = useCallback(async (options?: { autoResume?: boolean }) => {
    if (buildInFlightRef.current) return;
    if (!sessionId) {
      notify.error(t('stage.errors.missingNode', 'Route node is missing.'));
      return;
    }
    if (!api) {
      notify.error(t('stage.errors.missingApi', 'Worker API is unavailable.'));
      return;
    }
    const dataSourceName = draft.dataSourceName;
    if (dataSourceName !== 'ide-gsm') {
      notify.info(t('stage.errors.unsupportedSource', 'Selected data source is not supported yet.'));
      return;
    }
    const sourceId = draft.tabularSourceId;
    if (!sourceId) {
      notify.error(t('stage.errors.missingSource', 'IDE-GSM source is required.'));
      return;
    }
    const selectionEntries = buildIdeGsmSelectionEntries(draft.selectedArrayByCountries);

    beginBuildSessionTransition('acquiring-lock', {
      message: options?.autoResume
        ? 'Resuming build session...'
        : 'Starting build session...',
      level: 'info',
    });
    buildInFlightRef.current = true;
    setStatus('running');
    setOverallProgress(0);
    setErrorRows([]);
    setErrorDialogOpen(false);
    setIdeGsmPhase(null);
    onUpdate({
      processingStatus: 'processing',
      buildStartedAt: draft.buildStartedAt ?? Date.now(),
      buildFinishedAt: undefined,
    });
    try {
      advanceBuildSessionTransitionPhase('initializing-worker');
      await initialize();
      const resolvedRouteNodeId = routeNodeId as NodeId;
      const routeMutation = await api.getRouteMutationAPI();
      advanceBuildSessionTransitionPhase('fetch-stage');
      const result = await routeMutation.importIdeGsmRoutes(
        {
          nodeId: resolvedRouteNodeId,
          tabularSourceId: sourceId,
          selectionEntries,
          chunkSize: IDE_GSM_BULK_CHUNK_SIZE,
        },
        proxy((progress: IdeGsmImportProgress) => {
          setIdeGsmPhase(progress);
          setOverallProgress(mapIdeGsmProgress(progress));
        }),
      );

      setErrorRows(result.errors);
      if (result.errors.length > 0) {
        setErrorDialogOpen(true);
      }
      setIdeGsmPhase(null);
      setOverallProgress(fetchStageMax);

      const [minZoom, maxZoom] = resolveZoomRange();
      const routeTransformConfig = resolveRouteTransformConfig();
      advanceBuildSessionTransitionPhase('transform-stage');
      setOverallProgress(fetchStageMax + 1);
      await routeMutation.buildRouteTileIndex({
        nodeId: resolvedRouteNodeId,
        minZoom,
        maxZoom,
        zoomBandBoundaries: routeTransformConfig.zoomBandBoundaries,
        minDistanceMetersByBand: routeTransformConfig.minDistanceMetersByBand,
        simplifyToleranceByBand: routeTransformConfig.simplifyToleranceByBand,
      });
      setOverallProgress(transformStageMax);

      const vtConfig = resolveVectorTileConfig();
      advanceBuildSessionTransitionPhase('vt-stage');
      setOverallProgress(transformStageMax + 1);
      await routeMutation.generateRouteVectorTiles({
        nodeId: resolvedRouteNodeId,
        minZoom,
        maxZoom,
        zoomBandBoundaries: routeTransformConfig.zoomBandBoundaries,
        bufferSize: vtConfig.bufferSize,
        inputFormat: vtConfig.inputFormat,
        inputCompression: vtConfig.inputCompression,
      });

      setStatus('completed');
      setOverallProgress(vtStageMax);
      advanceBuildSessionTransitionPhase('finalizing');
      onUpdate({ processingStatus: 'completed', processedAt: Date.now(), buildFinishedAt: Date.now() });
      finishBuildSessionTransition({
        level: 'success',
        message: 'Build completed.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify.error(message);
      setStatus('failed');
      onUpdate({ processingStatus: 'failed', processingError: message, buildFinishedAt: Date.now() });
      finishBuildSessionTransition({
        level: 'error',
        message,
      });
    } finally {
      buildInFlightRef.current = false;
    }
  }, [
    api,
    advanceBuildSessionTransitionPhase,
    beginBuildSessionTransition,
    draft,
    fetchStageMax,
    finishBuildSessionTransition,
    initialize,
    mapIdeGsmProgress,
    onUpdate,
    resolveRouteTransformConfig,
    resolveVectorTileConfig,
    resolveZoomRange,
    routeNodeId,
    sessionId,
    t,
    transformStageMax,
    vtStageMax,
  ]);

  useEffect(() => {
    if (!sessionId) return;
    const shouldMonitor = shouldAutoResume;
    if (!shouldMonitor) {
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    if (status === 'running' || buildInFlightRef.current) {
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    const now = Date.now();
    const elapsedSinceStart = now - crashCheckStartedAtRef.current;
    if (elapsedSinceStart < SESSION_QUIET_THRESHOLD_MS) return;
    if (suspendSuspectOpen) {
      closeSuspendSuspect();
    }
    if (!crashSuspectOpen) {
      setCrashSuspectMessage(
        t('stage.progress.crashSuspect', 'Build session may have stopped unexpectedly.'),
      );
      setCrashSuspectOpen(true);
    }
    setStatus('paused');
    if (sessionId) {
      onUpdate({ processingStatus: 'pending', buildFinishedAt: undefined });
    }
  }, [
    closeCrashSuspect,
    closeSuspendSuspect,
    crashSuspectOpen,
    onUpdate,
    sessionId,
    shouldAutoResume,
    status,
    suspendSuspectOpen,
    t,
  ]);

  const handlePause = useCallback(async (reason: PauseBuildReason = 'user-pause'): Promise<void> => {
    if (isPausePending) return;
    await executePauseBuildFlow({
      reason,
      onPendingChange: setIsPausePending,
      pauseSession: async () => {
        setStatus('paused');
      },
      persistPausedStatus: async () => {
        if (sessionId) {
          onUpdate({ processingStatus: 'pending', buildFinishedAt: undefined });
        }
      },
      onError: (error) => {
        notify.error(t('stage.progress.pauseFailed', 'Failed to pause build.'));
        console.error('[RouteBuildStep] pause failed', error);
      },
    });
  }, [isPausePending, onUpdate, sessionId, t]);

  return {
    status,
    setStatus,
    overallProgress,
    setOverallProgress,
    isPausePending,
    ideGsmPhase,
    errorRows,
    errorDialogOpen,
    setErrorDialogOpen,
    buildSessionTransition,
    crashSuspectOpen,
    crashSuspectMessage,
    suspendSuspectOpen,
    suspendSuspectMessage,
    closeCrashSuspect,
    closeSuspendSuspect,
    runIdeGsmBuild,
    handlePause,
    isWebLockSupported,
  };
};
