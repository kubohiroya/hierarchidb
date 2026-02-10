import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { proxy } from 'comlink';
import {
  IDE_GSM_BULK_CHUNK_SIZE,
  type IdeGsmImportProgress,
  type IdeGsmRouteError,
  type RouteEntity,
  type RouteUpdaterPayload,
} from '@hierarchidb/route-api';
import {
  createSessionCoordinator,
  type HeartbeatRecord,
  type SessionLockHandle,
  type SessionTabState,
} from '@hierarchidb/session-coordinator';
import {
  executePauseBuildFlow,
  notify,
  type BuildStatus,
  type PauseBuildReason,
  useBuildSessionTransition,
} from '@hierarchidb/components';

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
      chunkSize: number;
    },
    onProgress: (progress: IdeGsmImportProgress) => void,
  ) => Promise<{ errors: IdeGsmRouteError[] }>;
  buildRouteTileIndex: (args: { nodeId: NodeId; minZoom: number; maxZoom: number }) => Promise<unknown>;
  generateRouteVectorTiles: (args: {
    nodeId: NodeId;
    minZoom: number;
    maxZoom: number;
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
  draft: RouteUpdaterPayload;
  routeData: {
    processingStatus?: string;
    buildFinishedAt?: number | null;
  };
  onUpdate: (updates: Partial<RouteEntity>) => void;
  routeNodeId: NodeId | undefined;
  resolveZoomRange: () => [number, number];
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

export const useRouteBuildSessionLifecycle = ({
  api,
  initialize,
  draft,
  routeData,
  onUpdate,
  routeNodeId,
  resolveZoomRange,
  resolveVectorTileConfig,
  mapIdeGsmProgress,
  fetchStageMax,
  transformStageMax,
  vtStageMax,
  t,
}: UseRouteBuildSessionLifecycleArgs) => {
  const coordinator = useMemo(() => (
    createSessionCoordinator({
      channelName: 'sessions',
      pollIntervalTimeout: 3000,
      quietThresholdTimeout: 5000,
      semaphoreTtlTimeout: 10000,
    })
  ), []);
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
  const lockKey = useMemo(() => (
    sessionId ? `route:${sessionId}` : null
  ), [sessionId]);
  const isWebLockSupported = coordinator.isWebLockSupported();
  const completionStatusRef = useRef<BuildStatus | null>(null);
  const buildInFlightRef = useRef(false);
  const tabIdRef = useRef<string>(coordinator.getTabId());
  const lockRef = useRef<SessionLockHandle | null>(null);
  const lockKeyRef = useRef<string | null>(null);
  const [isLockOwner, setIsLockOwner] = useState(false);
  const [remoteHeartbeat, setRemoteHeartbeat] = useState<HeartbeatRecord<BuildStatus, { percentage: number }> | null>(null);
  const lastHeartbeatPruneAtRef = useRef<number | null>(null);
  const localTabStateRef = useRef<SessionTabState>('active');
  const lastAutoResumeAtRef = useRef<number | null>(null);
  const crashCheckStartedAtRef = useRef<number>(Date.now());
  const suspendTimeout = coordinator.quietThresholdTimeout * 3;
  const remoteUpdatedAt = remoteHeartbeat?.updatedAt ?? null;
  const remoteExpiresAt = remoteHeartbeat?.expiresAt ?? null;
  const remoteTabState = remoteHeartbeat?.tabState ?? null;
  const remoteTabId = remoteHeartbeat?.tabId ?? null;
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

  const releaseBuildLock = useCallback(() => {
    const lock = lockRef.current;
    if (!lock) return;
    lock.release();
    lockRef.current = null;
    lockKeyRef.current = null;
    setIsLockOwner(false);
  }, []);

  const tryAcquireBuildLock = useCallback(async (options?: { notifyOnFailure?: boolean }): Promise<boolean> => {
    if (!lockKey) return false;
    if (lockRef.current) return true;
    if (!isWebLockSupported) {
      if (options?.notifyOnFailure) {
        notify.error('Web Locks API is unavailable.');
      }
      return false;
    }
    const lock = await coordinator.tryAcquireSessionLock(lockKey);
    if (!lock) {
      if (options?.notifyOnFailure) {
        notify.info('Another tab is already running this build.');
      }
      return false;
    }
    lockRef.current = lock;
    lockKeyRef.current = lockKey;
    setIsLockOwner(true);
    return true;
  }, [coordinator, isWebLockSupported, lockKey]);

  useEffect(() => {
    if (!lockKeyRef.current) return;
    if (lockKeyRef.current === lockKey) return;
    releaseBuildLock();
  }, [lockKey, releaseBuildLock]);

  useEffect(() => {
    return () => {
      releaseBuildLock();
    };
  }, [releaseBuildLock]);

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
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      const isHidden = document.visibilityState === 'hidden';
      localTabStateRef.current = isHidden ? 'hidden' : 'active';
    };
    const handlePageHide = () => {
      localTabStateRef.current = 'frozen';
    };
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    if (status !== 'running') return;
    if (!isLockOwner) return;
    const tick = () => {
      const now = Date.now();
      const activeSessionId = coordinator.readActiveSessionId();
      if (activeSessionId !== sessionId) return;
      void coordinator.writeHeartbeat({
        sessionId,
        status,
        progress: { percentage: overallProgress },
        tabState: localTabStateRef.current,
        lockOwner: true,
        timestamp: now,
      });
    };
    tick();
    const intervalId = setInterval(tick, coordinator.pollIntervalTimeout);
    return () => {
      clearInterval(intervalId);
    };
  }, [coordinator, isLockOwner, overallProgress, sessionId, status]);

  useEffect(() => {
    if (!remoteHeartbeat) return;
    if (isLockOwner) return;
    if (remoteHeartbeat.status && remoteHeartbeat.status !== status) {
      setStatus(remoteHeartbeat.status);
    }
    const nextProgress = remoteHeartbeat.progress?.percentage;
    if (typeof nextProgress === 'number' && Number.isFinite(nextProgress)) {
      setOverallProgress(nextProgress);
    }
  }, [isLockOwner, remoteHeartbeat, status]);

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
    const dataSourceName = (draft as { dataSourceName?: string }).dataSourceName;
    if (dataSourceName !== 'ide-gsm') {
      notify.info(t('stage.errors.unsupportedSource', 'Selected data source is not supported yet.'));
      return;
    }
    const sourceId = (draft as { tabularSourceId?: string }).tabularSourceId;
    if (!sourceId) {
      notify.error(t('stage.errors.missingSource', 'IDE-GSM source is required.'));
      return;
    }

    beginBuildSessionTransition('acquiring-lock', {
      message: options?.autoResume
        ? 'Resuming build session...'
        : 'Starting build session...',
      level: 'info',
    });

    const now = Date.now();
    const hasRunner = coordinator.isRunnerTab(now);
    const activeSessionId = coordinator.readActiveSessionId();
    if (hasRunner && activeSessionId && activeSessionId !== sessionId) {
      notify.info('Another build session is active in this tab.');
      finishBuildSessionTransition({
        level: 'warning',
        message: 'Another build session is already active in this tab.',
      });
      return;
    }
    const acquired = await tryAcquireBuildLock({ notifyOnFailure: !options?.autoResume });
    if (!acquired) {
      finishBuildSessionTransition({
        level: 'warning',
        message: 'Failed to acquire build lock.',
      });
      return;
    }
    if (!options?.autoResume) {
      coordinator.writeActiveSessionId(sessionId);
    } else if (!activeSessionId) {
      coordinator.writeActiveSessionId(sessionId);
    }
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
      advanceBuildSessionTransitionPhase('transform-stage');
      setOverallProgress(fetchStageMax + 1);
      await routeMutation.buildRouteTileIndex({ nodeId: resolvedRouteNodeId, minZoom, maxZoom });
      setOverallProgress(transformStageMax);

      const vtConfig = resolveVectorTileConfig();
      advanceBuildSessionTransitionPhase('vt-stage');
      setOverallProgress(transformStageMax + 1);
      await routeMutation.generateRouteVectorTiles({
        nodeId: resolvedRouteNodeId,
        minZoom,
        maxZoom,
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
      releaseBuildLock();
      coordinator.clearActiveSessionId(sessionId);
    }
  }, [
    api,
    advanceBuildSessionTransitionPhase,
    beginBuildSessionTransition,
    coordinator,
    draft,
    fetchStageMax,
    finishBuildSessionTransition,
    initialize,
    mapIdeGsmProgress,
    onUpdate,
    releaseBuildLock,
    resolveVectorTileConfig,
    resolveZoomRange,
    routeNodeId,
    sessionId,
    t,
    transformStageMax,
    tryAcquireBuildLock,
    vtStageMax,
  ]);

  const maybeAutoResume = useCallback(async () => {
    if (!sessionId) return;
    if (!shouldAutoResume) return;
    if (status === 'running' || buildInFlightRef.current) return;
    if (!isWebLockSupported) return;
    const now = Date.now();
    if (remoteUpdatedAt && remoteTabId && remoteTabId !== tabIdRef.current) {
      if (now - remoteUpdatedAt < coordinator.quietThresholdTimeout) return;
    }
    if (remoteTabState && remoteTabState !== 'active' && remoteUpdatedAt && now - remoteUpdatedAt <= suspendTimeout) return;
    const lastAutoResumeAt = lastAutoResumeAtRef.current;
    if (lastAutoResumeAt && now - lastAutoResumeAt < coordinator.quietThresholdTimeout) return;
    const acquired = await tryAcquireBuildLock();
    if (!acquired) return;
    lastAutoResumeAtRef.current = now;
    await runIdeGsmBuild({ autoResume: true });
  }, [
    coordinator.quietThresholdTimeout,
    isWebLockSupported,
    remoteTabId,
    remoteTabState,
    remoteUpdatedAt,
    runIdeGsmBuild,
    sessionId,
    shouldAutoResume,
    status,
    suspendTimeout,
    tryAcquireBuildLock,
  ]);

  useEffect(() => {
    if (!sessionId) {
      setRemoteHeartbeat(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const now = Date.now();
      const record = await coordinator.readHeartbeat<BuildStatus, { percentage: number }>(sessionId);
      if (cancelled) return;
      setRemoteHeartbeat(record);
      if (!lastHeartbeatPruneAtRef.current || now - lastHeartbeatPruneAtRef.current > coordinator.quietThresholdTimeout) {
        lastHeartbeatPruneAtRef.current = now;
        void coordinator.pruneHeartbeats(now);
      }
      void maybeAutoResume();
    };
    void tick();
    const intervalId = setInterval(() => {
      void tick();
    }, coordinator.pollIntervalTimeout);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [coordinator, maybeAutoResume, sessionId]);

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
    if (elapsedSinceStart < coordinator.quietThresholdTimeout) return;
    let cancelled = false;
    const check = async () => {
      if (!lockKey) return;
      const lockState = await coordinator.probeSessionLock(lockKey);
      if (cancelled) return;
      const suspectWindowMs = coordinator.quietThresholdTimeout + coordinator.pollIntervalTimeout * 2;
      const heartbeatFresh = Boolean(
        remoteUpdatedAt && (
          (typeof remoteExpiresAt === 'number' && remoteExpiresAt > now)
          || now - remoteUpdatedAt <= suspectWindowMs
        )
      );
      const recentNonActive = Boolean(
        remoteTabState
        && remoteTabState !== 'active'
        && remoteUpdatedAt
        && now - remoteUpdatedAt <= suspendTimeout
      );
      if (lockState === 'held') {
        if (recentNonActive || !heartbeatFresh) {
          if (crashSuspectOpen) {
            closeCrashSuspect();
          }
          if (!suspendSuspectOpen) {
            setSuspendSuspectMessage(
              t('stage.progress.suspendSuspect', 'Build tab is in background; waiting for it to resume.'),
            );
            setSuspendSuspectOpen(true);
          }
          return;
        }
        if (crashSuspectOpen) {
          closeCrashSuspect();
        }
        if (suspendSuspectOpen) {
          closeSuspendSuspect();
        }
        return;
      }
      if (lockState === 'unsupported') {
        if (!crashSuspectOpen) {
          setCrashSuspectMessage(
            t('stage.progress.crashSuspect', 'Build session may have stopped unexpectedly.'),
          );
          setCrashSuspectOpen(true);
        }
        return;
      }
      if (heartbeatFresh) {
        if (crashSuspectOpen) {
          closeCrashSuspect();
        }
        if (suspendSuspectOpen) {
          closeSuspendSuspect();
        }
        return;
      }
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
        coordinator.clearActiveSessionId(sessionId);
      }
      releaseBuildLock();
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [
    closeCrashSuspect,
    closeSuspendSuspect,
    coordinator,
    crashSuspectOpen,
    lockKey,
    onUpdate,
    releaseBuildLock,
    remoteExpiresAt,
    remoteTabState,
    remoteUpdatedAt,
    sessionId,
    shouldAutoResume,
    status,
    suspendSuspectOpen,
    suspendTimeout,
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
          coordinator.clearActiveSessionId(sessionId);
        }
        releaseBuildLock();
      },
      onError: (error) => {
        notify.error(t('stage.progress.pauseFailed', 'Failed to pause build.'));
        console.error('[RouteBuildStep] pause failed', error);
      },
    });
  }, [coordinator, isPausePending, onUpdate, releaseBuildLock, sessionId, t]);

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
