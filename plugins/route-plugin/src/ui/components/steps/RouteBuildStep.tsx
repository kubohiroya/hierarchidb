import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { CheckCircle, CloudDownload, Tune } from '@mui/icons-material';
import { BuildProgressPanel, type BuildStage, type BuildStatus, notify } from '@hierarchidb/components';
import { HeapPressureDialog, useHeapPressureGuard } from '@hierarchidb/ui-memory';
import { GenericDataGrid, type GridColumn } from '@hierarchidb/ui-grid';
import type { NodeId } from '@hierarchidb/core-types';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import { proxy } from 'comlink';
import { IDE_GSM_BULK_CHUNK_SIZE, type IdeGsmImportProgress } from '@hierarchidb/route-api';
import type {
  IdeGsmRouteError,
  RouteTransportSelection,
  RouteUpdaterPayload,
  RouteEntity,
} from '@hierarchidb/route-api';
import { useTranslation } from '../../../common/i18n/index.js';
import { getRouteUpdaterPayload } from '../../../common/utils/draft.js';
import { useRouteBuildCrashInsight } from '../../hooks/useRouteBuildCrashInsight.js';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '../../../common/config/buildConfig.js';
import { createPollingTracker, createSessionCoordinator } from '@hierarchidb/session-coordinator';
import {
  BUILD_MONITOR_SAMPLE_INTERVAL_MS,
  appendBuildSample,
  getBuildMonitorKey,
  getMemorySnapshot,
  recordBuildFinish,
  recordBuildStart,
  type BuildMonitorStage,
} from '@hierarchidb/ui-monitoring';

interface RouteBuildStepProps {
  draft: RouteUpdaterPayload;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  nodeId?: string;
  parentId?: string;
  mode: 'create' | 'edit';
}

const STAGES: BuildStage[] = [
  {
    icon: <CloudDownload/>,
    id: 'fetch',
    title: 'Fetch',
    description: 'Download, parse, and save route features.',
  },
  {
    icon: <Tune/>,
    id: 'transform',
    title: 'Transform',
    description: 'Build tile index for route lookup.',
  },
  {
    icon: <CheckCircle/>,
    id: 'vt',
    title: 'Vector Tiles',
    description: 'Generate vector tiles for rendering.',
  },
];
const SPLITVIEW_BREAKPOINTS = [600, 900, 1200];
const SPLITVIEW_INITIAL_SIZES = [
  Array.from({ length: STAGES.length }, () => 300),
  Array.from({ length: STAGES.length }, () => 300),
  Array.from({ length: STAGES.length }, () => 300),
  Array.from({ length: STAGES.length }, () => 300),
];
const SPLITVIEW_AUTO_CLOSE_COUNTS = [
  Math.max(0, STAGES.length - 1),
  Math.max(0, STAGES.length - 2),
  Math.max(0, STAGES.length - 3),
  0,
];
const buildMonitorConfig = {
  storagePrefix: 'hdb:route:stage-monitor',
  keyMode: 'node',
  maxSamples: 3,
  memoryPressureRatio: 0.85,
} as const;
const FETCH_STAGE_MAX = 33;
const TRANSFORM_STAGE_MAX = 66;
const VT_STAGE_MAX = 100;
const DEFAULT_MIN_ZOOM = 5;
const DEFAULT_MAX_ZOOM = 12;
const DEFAULT_BUFFER = 256;

const TRANSPORT_SELECTION_LABELS: Record<RouteTransportSelection, { key: string; fallback: string }> = {
  air: { key: 'transportModes.air', fallback: 'Air' },
  sea: { key: 'transportModes.sea', fallback: 'Sea' },
  rail: { key: 'transportModes.rail', fallback: 'Rail' },
  'high-speed-rail': { key: 'transportModes.highSpeedRail', fallback: 'High-speed rail' },
  highway: { key: 'transportModes.highway', fallback: 'Highway' },
  road: { key: 'transportModes.road', fallback: 'General road' },
};

const isTransportSelection = (value: unknown): value is RouteTransportSelection => (
  typeof value === 'string' && value in TRANSPORT_SELECTION_LABELS
);

const resolveTransportLabel = (draft: RouteUpdaterPayload, t: (key: string, fallback?: string) => string): string => {
  const data = getRouteUpdaterPayload(draft);
  const selection = data.transportSelection;
  if (selection == null) {
    return t('stage.notConfigured', 'Not configured');
  }
  if (!isTransportSelection(selection)) {
    throw new Error(`Unsupported transportSelection: ${String(selection)}`);
  }
  const entry = TRANSPORT_SELECTION_LABELS[selection];
  if (!entry) {
    return t('stage.notConfigured', 'Not configured');
  }
  return t(entry.key, entry.fallback);
};

export const RouteBuildStep: React.FC<RouteBuildStepProps> = ({
  draft,
  onUpdate,
  nodeId,
}) => {
  const { t } = useTranslation();
  const { api, initialize } = useWorkerAPI();
  const coordinator = useMemo(() => (
    createSessionCoordinator({
      channelName: 'sessions',
      pollIntervalTimeout: 3000,
      quietThresholdTimeout: 5000,
      semaphoreTtlTimeout: 10000,
    })
  ), []);
  const routeData = useMemo(() => getRouteUpdaterPayload(draft), [draft]);
  const dataSource = (draft as { dataSourceName?: string }).dataSourceName ?? t('stage.notConfigured', 'Not configured');
  const generationMethod = (draft as { generationMethod?: string }).generationMethod ?? t('stage.notConfigured', 'Not configured');
  const transportLabel = resolveTransportLabel(draft, t);
  const startLocation = (draft as { startLocationId?: string }).startLocationId ?? t('stage.notConfigured', 'Not configured');
  const endLocation = (draft as { endLocationId?: string }).endLocationId ?? t('stage.notConfigured', 'Not configured');

  const hasRequiredFields = Boolean(
    (draft as { dataSourceName?: string }).dataSourceName &&
      (draft as { transportMode?: string }).transportMode &&
      (draft as { generationMethod?: string }).generationMethod &&
      (draft as { startLocationId?: string }).startLocationId &&
      (draft as { endLocationId?: string }).endLocationId,
  );

  const resolveZoomRange = useCallback((): [number, number] => {
    const zoomRange = (draft as { zoomRange?: [number, number] }).zoomRange;
    if (zoomRange && zoomRange.length === 2) {
      return zoomRange;
    }
    const buildConfig = (draft.draftData?.buildConfig ?? DEFAULT_ROUTE_BUILD_CONFIG) as {
      transformConfig?: { zoomBandBoundaries?: number[] };
    };
    const boundaries = buildConfig.transformConfig?.zoomBandBoundaries ?? [DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM];
    const minZoom = boundaries[0] ?? DEFAULT_MIN_ZOOM;
    const maxZoom = boundaries[boundaries.length - 1] ?? DEFAULT_MAX_ZOOM;
    return [minZoom, maxZoom];
  }, [draft]);

  const resolveVectorTileConfig = useCallback(() => {
    const buildConfig = (draft.draftData?.buildConfig ?? DEFAULT_ROUTE_BUILD_CONFIG) as {
      vtConfig?: { bufferSize?: number; inputFormat?: 'geojson' | 'flatgeobuf'; inputCompression?: 'gzip' | 'none' };
    };
    return {
      bufferSize: buildConfig.vtConfig?.bufferSize ?? DEFAULT_BUFFER,
      inputFormat: buildConfig.vtConfig?.inputFormat ?? 'geojson',
      inputCompression: buildConfig.vtConfig?.inputCompression ?? 'none',
    };
  }, [draft]);

  const [status, setStatus] = useState<BuildStatus>('idle');
  const [overallProgress, setOverallProgress] = useState(0);
  const [isPausePending, setIsPausePending] = useState(false);
  const [heapDialogOpen, setHeapDialogOpen] = useState(false);
  const [errorRows, setErrorRows] = useState<IdeGsmRouteError[]>([]);
  const [ideGsmPhase, setIdeGsmPhase] = useState<IdeGsmImportProgress | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionSnapshot, setCompletionSnapshot] = useState<{
    status: BuildStatus;
    stageLabel: string;
    taskTitle?: string;
    taskMessage?: string;
    reason?: string;
  } | null>(null);
  const [crashSuspectOpen, setCrashSuspectOpen] = useState(false);
  const [crashSuspectMessage, setCrashSuspectMessage] = useState<string | null>(null);
  const [suspendSuspectOpen, setSuspendSuspectOpen] = useState(false);
  const [suspendSuspectMessage, setSuspendSuspectMessage] = useState<string | null>(null);
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
  const completionStatusRef = useRef<BuildStatus | null>(null);
  const buildInFlightRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>(coordinator.getTabId());
  const pollingTrackerRef = useRef(createPollingTracker({ quietThresholdTimeout: coordinator.quietThresholdTimeout }));
  const lastBroadcastAtRef = useRef<number | null>(null);
  const lastBroadcastTabIdRef = useRef<string | null>(null);
  const lastAckAtRef = useRef<number | null>(null);
  const lastAckTabIdRef = useRef<string | null>(null);
  const tabStateRef = useRef<Map<string, { state: 'active' | 'hidden' | 'frozen'; at: number }>>(new Map());
  const lastAutoResumeAtRef = useRef<number | null>(null);
  const crashCheckStartedAtRef = useRef<number>(Date.now());
  const suspendTimeout = coordinator.quietThresholdTimeout * 3;
  const getRecentNonActiveState = useCallback((referenceTime: number) => {
    let latest: { state: 'active' | 'hidden' | 'frozen'; at: number } | null = null;
    for (const entry of tabStateRef.current.values()) {
      if (entry.state === 'active') continue;
      if (!latest || entry.at > latest.at) {
        latest = entry;
      }
    }
    if (!latest) return null;
    if (referenceTime - latest.at > suspendTimeout) return null;
    return latest;
  }, [suspendTimeout]);
  const heapPauseRef = useRef<number | null>(null);
  const routeNodeId = (draft.treeNodeId ?? nodeId) as NodeId | undefined;
  const sessionId = routeNodeId ? String(routeNodeId) : null;
  const crashInsight = useRouteBuildCrashInsight({ draft, nodeId: routeNodeId ? String(routeNodeId) : null });
  const monitorKey = useMemo(
    () => getBuildMonitorKey(buildMonitorConfig, routeNodeId ? String(routeNodeId) : null),
    [routeNodeId],
  );
  const { event: heapEvent, dismiss: dismissHeapEvent } = useHeapPressureGuard({
    enabled: status === 'running' || status === 'paused',
    workerEnabled: false,
  });

  const stageProgress = useMemo(() => {
    const map: Record<string, number> = {};
    const ranges: Record<string, { start: number; end: number }> = {
      fetch: { start: 0, end: FETCH_STAGE_MAX },
      transform: { start: FETCH_STAGE_MAX, end: TRANSFORM_STAGE_MAX },
      vt: { start: TRANSFORM_STAGE_MAX, end: VT_STAGE_MAX },
    };
    STAGES.forEach((stage) => {
      const range = ranges[stage.id] ?? { start: 0, end: VT_STAGE_MAX };
      if (overallProgress <= range.start) {
        map[stage.id] = 0;
        return;
      }
      if (overallProgress >= range.end) {
        map[stage.id] = 100;
        return;
      }
      const denom = Math.max(1, range.end - range.start);
      map[stage.id] = Math.round(((overallProgress - range.start) / denom) * 100);
    });
    return map;
  }, [overallProgress]);

  useEffect(() => {
    if (!heapEvent) return;
    setHeapDialogOpen(true);
  }, [heapEvent]);

  useEffect(() => {
    if (status !== 'running') {
      setIsPausePending(false);
    }
  }, [status]);

  useEffect(() => {
    if (!sessionId || typeof BroadcastChannel === 'undefined') return;
    const channel = coordinator.openChannel();
    channelRef.current = channel;
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!coordinator.isSessionChannelMessage(message)) return;
      if (message.sessionId !== sessionId) return;
      if (message.tabId === tabIdRef.current) return;
      const now = Date.now();
      if (message.type === 'broadcast') {
        lastBroadcastAtRef.current = now;
        lastBroadcastTabIdRef.current = message.tabId;
      }
      if (message.type === 'poll') {
        pollingTrackerRef.current.record(message.tabId, now);
      }
      if (message.type === 'tab-state') {
        tabStateRef.current.set(message.tabId, { state: message.tabState, at: now });
      }
      if (message.type === 'ack' && message.receivedTabId === tabIdRef.current) {
        lastAckAtRef.current = now;
        lastAckTabIdRef.current = message.tabId;
      }
      coordinator.sendAck(channel, message.sessionId, message.tabId);
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [coordinator, sessionId]);

  useEffect(() => {
    if (!sessionId || typeof BroadcastChannel === 'undefined') return;
    const channel = channelRef.current;
    if (!channel) return;
    const sendTabState = (state: 'active' | 'hidden' | 'frozen') => {
      coordinator.sendTabState(channel, sessionId, state);
    };
    const handleVisibility = () => {
      const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      sendTabState(isHidden ? 'hidden' : 'active');
    };
    const handlePageHide = () => {
      sendTabState('frozen');
    };
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [coordinator, sessionId]);

  useEffect(() => {
    if (!sessionId || typeof BroadcastChannel === 'undefined') return;
    if (status !== 'running') return;
    const channel = channelRef.current;
    if (!channel) return;
    const tick = () => {
      const now = Date.now();
      const activeSessionId = coordinator.readActiveSessionId();
      if (activeSessionId !== sessionId) return;
      coordinator.sendBroadcast(channel, sessionId, status, { percentage: overallProgress }, now);
      coordinator.writeBroadcastAt(now);
      lastBroadcastAtRef.current = now;
      lastBroadcastTabIdRef.current = tabIdRef.current;
    };
    tick();
    const intervalId = setInterval(tick, coordinator.pollIntervalTimeout);
    return () => {
      clearInterval(intervalId);
    };
  }, [coordinator, overallProgress, sessionId, status]);

  useEffect(() => {
    if (status !== 'running') {
      heapPauseRef.current = null;
      return;
    }
    if (!heapEvent) return;
    if (heapPauseRef.current === heapEvent.timestamp) return;
    heapPauseRef.current = heapEvent.timestamp;
    setStatus('paused');
    setHeapDialogOpen(true);
  }, [heapEvent, status]);

  useEffect(() => {
    if (!monitorKey) return;
    if (status !== 'running') return;
    const startedAt = draft.buildStartedAt ?? Date.now();
    recordBuildStart(buildMonitorConfig, monitorKey, {
      nodeId: routeNodeId ? String(routeNodeId) : undefined,
      startedAt,
    });
    const interval = window.setInterval(() => {
      appendBuildSample(buildMonitorConfig, monitorKey, {
        timestamp: Date.now(),
        stage: resolveMonitorStage(ideGsmPhase?.phase),
        ...getMemorySnapshot(),
      });
    }, BUILD_MONITOR_SAMPLE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [draft.buildStartedAt, ideGsmPhase?.phase, monitorKey, routeNodeId, status]);

  useEffect(() => {
    if (!monitorKey) return;
    if (status !== 'completed' && status !== 'failed') return;
    recordBuildFinish(buildMonitorConfig, monitorKey, Date.now());
  }, [monitorKey, status]);


  const errorColumns = useMemo<GridColumn<IdeGsmRouteError>[]>(() => ([
    { id: 'rowNumber', label: t('stage.errors.columns.row', 'Row'), width: 90, sortable: true },
    { id: 'start', label: t('stage.errors.columns.start', 'Start'), width: 160 },
    { id: 'end', label: t('stage.errors.columns.end', 'End'), width: 160 },
    { id: 'reason', label: t('stage.errors.columns.reason', 'Reason'), width: 360 },
  ]), [t]);

  const mapIdeGsmProgress = useCallback((progress: IdeGsmImportProgress): number => {
    const total = progress.total ?? 0;
    const processed = progress.processed ?? 0;
    const ratio = total > 0 ? Math.min(1, processed / total) : 0;
    let percent = 0;
    switch (progress.phase) {
      case 'fetch':
        percent = 10;
        break;
      case 'parse':
        percent = 20 + Math.round(ratio * 25);
        break;
      case 'waypoints':
        percent = 45 + Math.round(ratio * 35);
        break;
      case 'save':
        percent = 80 + Math.round(ratio * 20);
        break;
      case 'completed':
        percent = 100;
        break;
      case 'failed':
        percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
        break;
      default:
        percent = 0;
    }
    return Math.round((percent / 100) * FETCH_STAGE_MAX);
  }, []);

  const resolveIdeGsmLabel = useCallback((progress: IdeGsmImportProgress): string => {
    switch (progress.phase) {
      case 'fetch':
        return t('stage.ideGsm.fetch', 'IDE-GSM: downloading');
      case 'parse':
        return t('stage.ideGsm.parse', 'IDE-GSM: parsing rows');
      case 'waypoints':
        return t('stage.ideGsm.waypoints', 'IDE-GSM: generating waypoints');
      case 'save':
        return t('stage.ideGsm.save', 'IDE-GSM: saving routes');
      case 'completed':
        return t('stage.ideGsm.completed', 'IDE-GSM: import completed');
      case 'failed':
        return t('stage.ideGsm.failed', 'IDE-GSM: import failed');
      default:
        return 'IDE-GSM';
    }
  }, [t]);

  const completionStageLabel = useMemo(() => {
    if (ideGsmPhase) return resolveIdeGsmLabel(ideGsmPhase);
    const activeStage = [...STAGES].reverse().find((stage) => (stageProgress[stage.id] ?? 0) > 0);
    return activeStage?.title ?? STAGES[0]?.title ?? t('stage.progress.unknownStage', 'Unknown stage');
  }, [ideGsmPhase, resolveIdeGsmLabel, stageProgress, t]);
  const completionTaskTitle = useMemo(() => {
    const title = ideGsmPhase ? resolveIdeGsmLabel(ideGsmPhase) : completionStageLabel;
    return title?.trim() ? title : t('stage.tasks.unknown', '(Task unavailable)');
  }, [completionStageLabel, ideGsmPhase, resolveIdeGsmLabel, t]);
  const completionTaskMessage = useMemo(() => {
    return (draft as { processingError?: string }).processingError
      ?? t('stage.progress.failedReason', 'Build failed due to task errors.');
  }, [draft, t]);
  const completionReason = useMemo(() => {
    if (status === 'failed') {
      return (draft as { processingError?: string }).processingError
        ?? t('stage.progress.failedReason', 'Build failed due to task errors.');
    }
    if (status === 'completed') {
      if (errorRows.length > 0) {
        return t('stage.progress.completedWithErrors', 'Completed with errors. Review the error list.');
      }
      return t('stage.progress.completedReason', 'All tasks completed.');
    }
    return t('stage.progress.endedReason', 'Build ended.');
  }, [draft, errorRows.length, status, t]);

  useEffect(() => {
    if (completionStatusRef.current === null) {
      completionStatusRef.current = status;
      return;
    }
    if (status === completionStatusRef.current) return;
    completionStatusRef.current = status;
    if (status === 'completed') {
      setCompletionSnapshot({
        status,
        stageLabel: completionStageLabel,
        reason: completionReason,
      });
      setCompletionDialogOpen(true);
      return;
    }
    if (status === 'failed') {
      setCompletionSnapshot({
        status,
        stageLabel: completionStageLabel,
        taskTitle: completionTaskTitle,
        taskMessage: completionTaskMessage,
      });
      setCompletionDialogOpen(true);
    }
  }, [
    completionReason,
    completionStageLabel,
    completionTaskMessage,
    completionTaskTitle,
    status,
  ]);

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

    const now = Date.now();
    const hasRunner = coordinator.isRunnerTab(now);
    const activeSessionId = coordinator.readActiveSessionId();
    if (hasRunner && activeSessionId && activeSessionId !== sessionId) {
      notify.info('Another build session is active in this tab.');
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
      await initialize();
      const resolvedRouteNodeId = routeNodeId as NodeId;
      const routeMutation = await api.getRouteMutationAPI();
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
      setOverallProgress(FETCH_STAGE_MAX);

      const [minZoom, maxZoom] = resolveZoomRange();
      setOverallProgress(FETCH_STAGE_MAX + 1);
      await routeMutation.buildRouteTileIndex({ nodeId: resolvedRouteNodeId, minZoom, maxZoom });
      setOverallProgress(TRANSFORM_STAGE_MAX);

      const vtConfig = resolveVectorTileConfig();
      setOverallProgress(TRANSFORM_STAGE_MAX + 1);
      await routeMutation.generateRouteVectorTiles({
        nodeId: resolvedRouteNodeId,
        minZoom,
        maxZoom,
        bufferSize: vtConfig.bufferSize,
        inputFormat: vtConfig.inputFormat,
        inputCompression: vtConfig.inputCompression,
      });

      setStatus('completed');
      setOverallProgress(VT_STAGE_MAX);
      onUpdate({ processingStatus: 'completed', processedAt: Date.now(), buildFinishedAt: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify.error(message);
      setStatus('failed');
      onUpdate({ processingStatus: 'failed', processingError: message, buildFinishedAt: Date.now() });
    } finally {
      buildInFlightRef.current = false;
      coordinator.clearActiveSessionId(sessionId);
    }
  }, [
    api,
    coordinator,
    draft,
    initialize,
    mapIdeGsmProgress,
    routeNodeId,
    sessionId,
    onUpdate,
    resolveVectorTileConfig,
    resolveZoomRange,
    t,
  ]);

  const shouldAutoResume = Boolean(
    routeData.processingStatus === 'processing' && !routeData.buildFinishedAt,
  );
  const maybeAutoResume = useCallback(async () => {
    if (!sessionId) return;
    if (!shouldAutoResume) return;
    if (status === 'running' || buildInFlightRef.current) return;
    const now = Date.now();
    const recentNonActive = getRecentNonActiveState(now);
    if (recentNonActive) return;
    const lastBroadcast = lastBroadcastAtRef.current;
    if (lastBroadcast && now - lastBroadcast < coordinator.quietThresholdTimeout) return;
    const candidates = pollingTrackerRef.current.candidates(now);
    if (candidates.length === 0) return;
    if (candidates[0] !== tabIdRef.current) return;
    const lastAutoResumeAt = lastAutoResumeAtRef.current;
    if (lastAutoResumeAt && now - lastAutoResumeAt < coordinator.quietThresholdTimeout) return;
    const semaphoreKey = `route:${sessionId}`;
    const acquired = await coordinator.tryAcquireSemaphore(semaphoreKey, tabIdRef.current, coordinator.semaphoreTtlTimeout);
    if (!acquired) return;
    lastAutoResumeAtRef.current = now;
    await runIdeGsmBuild({ autoResume: true });
  }, [coordinator, getRecentNonActiveState, runIdeGsmBuild, sessionId, shouldAutoResume, status]);

  useEffect(() => {
    if (!sessionId || typeof BroadcastChannel === 'undefined') return;
    const channel = channelRef.current;
    if (!channel) return;
    const tick = () => {
      const now = Date.now();
      pollingTrackerRef.current.record(tabIdRef.current, now);
      coordinator.sendPoll(channel, sessionId, now);
      void maybeAutoResume();
    };
    tick();
    const intervalId = setInterval(tick, coordinator.pollIntervalTimeout);
    return () => {
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
    const suspectWindowMs = coordinator.quietThresholdTimeout + coordinator.pollIntervalTimeout * 2;
    const lastBroadcast = lastBroadcastAtRef.current;
    const lastAck = lastAckAtRef.current;
    const hasRecentBroadcast = lastBroadcast && now - lastBroadcast <= suspectWindowMs;
    const hasRecentAck = lastAck && now - lastAck <= suspectWindowMs;
    if (hasRecentBroadcast || hasRecentAck) {
      if (crashSuspectOpen) {
        closeCrashSuspect();
      }
      if (suspendSuspectOpen) {
        closeSuspendSuspect();
      }
      return;
    }
    const recentNonActive = getRecentNonActiveState(now);
    if (recentNonActive) {
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
    if (suspendSuspectOpen) {
      closeSuspendSuspect();
    }
    if (!crashSuspectOpen) {
      setCrashSuspectMessage(
        t('stage.progress.crashSuspect', 'Build session may have stopped unexpectedly.'),
      );
      setCrashSuspectOpen(true);
    }
  }, [
    closeCrashSuspect,
    closeSuspendSuspect,
    coordinator.pollIntervalTimeout,
    coordinator.quietThresholdTimeout,
    crashSuspectOpen,
    getRecentNonActiveState,
    sessionId,
    shouldAutoResume,
    status,
    suspendSuspectOpen,
    t,
  ]);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="body2" color="text.secondary">
        {t('stage.review', 'Review the configuration and press Build to start the batch route generation.')}
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('stage.dataSource', 'Data Source:')}</Typography>
        <Chip size="small" label={String(dataSource)} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('stage.transportMode', 'Transport Mode:')}</Typography>
        <Chip size="small" label={transportLabel} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('stage.routeType', 'Route Type:')}</Typography>
        <Chip size="small" label={String(generationMethod)} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('stage.startLocation', 'Start:')}</Typography>
        <Chip size="small" label={String(startLocation)} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('stage.endLocation', 'End:')}</Typography>
        <Chip size="small" label={String(endLocation)} />
      </Stack>

      {!hasRequiredFields && (
        <Alert severity="info">
          {t('stage.missing', 'Provide transport, route type, and start/end locations before building.')}
        </Alert>
      )}
      {crashInsight ? (
        <Alert severity="warning">
          {t(
            'stage.crashHint',
            'Previous stage did not finish. Consider cleaning data before restarting.',
          )}
        </Alert>
      ) : null}

      <Typography variant="subtitle1">
        {t('stage.title', 'Build routes')}
      </Typography>
      {ideGsmPhase ? (
        <Typography variant="caption" color="text.secondary">
          {resolveIdeGsmLabel(ideGsmPhase)}
        </Typography>
      ) : null}
      <BuildProgressPanel
        status={status}
        overallProgress={overallProgress}
        stages={STAGES}
        stageProgress={stageProgress}
        splitViewBreakpoints={SPLITVIEW_BREAKPOINTS}
        splitViewInitialSizesByBreakpoint={SPLITVIEW_INITIAL_SIZES}
        splitViewAutoCloseCountsByBreakpoint={SPLITVIEW_AUTO_CLOSE_COUNTS}
        onPause={() => {
          if (isPausePending) return;
          setIsPausePending(true);
          setStatus('paused');
          if (sessionId) {
            coordinator.clearActiveSessionId(sessionId);
          }
        }}
        onResume={runIdeGsmBuild}
        onComplete={() => {
          setStatus('completed');
          setOverallProgress(100);
        }}
        pauseLoading={isPausePending}
        footer={(
          <>
            <HeapPressureDialog
              open={heapDialogOpen}
              event={heapEvent}
              onClose={() => {
                setHeapDialogOpen(false);
                dismissHeapEvent();
              }}
              title={t('stage.heap.pauseTitle', 'Build paused due to memory pressure')}
              confirmLabel={t('stage.heap.pauseConfirm', 'OK')}
              description={t('stage.heap.pauseHint', 'Reduce concurrency and resume when ready.')}
            />
            <Dialog
              open={suspendSuspectOpen}
              onClose={() => closeSuspendSuspect()}
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle>{t('stage.progress.suspendSuspectTitle', 'Build tab suspended')}</DialogTitle>
              <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  {suspendSuspectMessage ?? t('stage.progress.suspendSuspect', 'Build tab is in background; waiting for it to resume.')}
                </Typography>
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={() => closeSuspendSuspect()} variant="contained">
                  {t('common.close', 'Close')}
                </Button>
              </DialogActions>
            </Dialog>
            <Dialog
              open={crashSuspectOpen}
              onClose={() => closeCrashSuspect()}
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle>{t('stage.progress.crashSuspectTitle', 'Build may have stopped')}</DialogTitle>
              <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  {crashSuspectMessage ?? t('stage.progress.crashSuspect', 'Build session may have stopped unexpectedly.')}
                </Typography>
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={() => closeCrashSuspect()} variant="contained">
                  {t('common.close', 'Close')}
                </Button>
              </DialogActions>
            </Dialog>
            <Dialog
              open={completionDialogOpen}
              onClose={() => setCompletionDialogOpen(false)}
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle>
                {completionSnapshot?.status === 'completed'
                  ? t('stage.progress.completedTitle', 'Build completed')
                  : t('stage.progress.failedTitle', 'Build failed')}
              </DialogTitle>
              <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  {t('stage.progress.completedStageLabel', 'Stage')}: {completionSnapshot?.stageLabel ?? completionStageLabel}
                </Typography>
                {completionSnapshot?.status === 'failed' ? (
                  <>
                    <Typography variant="body2">
                      {t('stage.progress.failedTaskLabel', 'Task')}: {completionSnapshot?.taskTitle ?? completionTaskTitle}
                    </Typography>
                    <Typography variant="body2">
                      {t('stage.progress.failedMessageLabel', 'Message')}: {completionSnapshot?.taskMessage ?? completionTaskMessage}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="body2">
                    {t('stage.progress.completedReasonLabel', 'Reason')}: {completionSnapshot?.reason ?? completionReason}
                  </Typography>
                )}
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={() => setCompletionDialogOpen(false)} variant="contained">
                  {t('common.close', 'Close')}
                </Button>
              </DialogActions>
            </Dialog>
            <Dialog
              open={errorDialogOpen}
              onClose={() => setErrorDialogOpen(false)}
              maxWidth="md"
              fullWidth
            >
              <DialogTitle>{t('stage.errors.title', 'Build errors')}</DialogTitle>
              <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('stage.errors.description', 'Some rows were skipped. Review the list below.')}
                </Typography>
                <Box sx={{ height: 360 }}>
                  <GenericDataGrid
                    columns={errorColumns}
                    rows={errorRows}
                    getRowId={(row) => row.id}
                    enableVirtualization
                    rowHeight={38}
                    maxHeight={360}
                    stickyHeader
                    dense
                  />
                </Box>
              </DialogContent>
              <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  {`${errorRows.length} ${t('stage.errors.countLabel', 'errors')}`}
                </Typography>
                <Chip
                  size="small"
                  label={t('stage.errors.close', 'Close')}
                  onClick={() => setErrorDialogOpen(false)}
                  clickable
                />
              </DialogActions>
            </Dialog>
          </>
        )}
      />
    </Box>
  );
};

const resolveMonitorStage = (phase?: string): BuildMonitorStage => {
  switch (phase) {
    case 'fetch':
      return 'fetch';
    case 'parse':
      return 'parse';
    case 'waypoints':
      return 'waypoints';
    case 'save':
      return 'save';
    default:
      return 'build';
  }
};
