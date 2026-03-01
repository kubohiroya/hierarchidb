import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
} from '@mui/icons-material';
import {
  type BuildStatus,
} from '@hierarchidb/components';
import {
  resolveBuildStages,
} from '@hierarchidb/ui-build-progress';
import { HeapPressureDialog, useHeapPressureGuard } from '@hierarchidb/ui-memory';
import { GenericDataGrid, type GridColumn } from '@hierarchidb/ui-grid';
import type { NodeId } from '@hierarchidb/core-types';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import type { IdeGsmImportProgress } from '@hierarchidb/route-api';
import type {
  IdeGsmRouteError,
  RouteTransportSelection,
  RouteEntity,
} from '@hierarchidb/route-api';
import { useTranslation } from '~/common/i18n/index';
import { useRouteBuildCrashInsight } from '~/ui/hooks/useRouteBuildCrashInsight';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '~/common/config/buildConfig';
import {
  BUILD_MONITOR_SAMPLE_INTERVAL_MS,
  appendBuildSample,
  getBuildMonitorKey,
  getMemorySnapshot,
  recordBuildFinish,
  recordBuildStart,
  type BuildMonitorStage,
} from '@hierarchidb/ui-monitoring';
import {
  useRouteBuildSessionLifecycle,
  type RouteBuildSessionTransitionPhase,
} from './useRouteBuildSessionLifecycle.ts';
import { RouteBuildProgressPanel } from './RouteBuildProgressPanel.tsx';
import { useRouteBuildProgressPanelViewModel } from './useRouteBuildProgressPanelViewModel.ts';

interface RouteBuildStepProps {
  draft: Partial<RouteEntity>;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  nodeId?: string;
  parentId?: string;
  mode: 'create' | 'edit';
}

const buildMonitorConfig = {
  storagePrefix: 'hdb:route:stage-monitor',
  keyMode: 'node',
  maxSamples: 3,
  memoryPressureRatio: 0.85,
} as const;
const SOURCE_STAGE_MAX = 33;
const GEOMETRY_STAGE_MAX = 66;
const TILE_EMIT_STAGE_MAX = 100;
const DEFAULT_MIN_ZOOM = 5;
const DEFAULT_MAX_ZOOM = 12;
const DEFAULT_BUFFER = 256;

const getRouteBuildTransitionStatusLabel = (
  t: (key: string, fallback?: string) => string,
  phase: RouteBuildSessionTransitionPhase | 'idle',
): string => {
  switch (phase) {
    case 'acquiring-lock':
      return t('stage.status.startingLock', 'Starting build (acquiring lock)...');
    case 'initializing-worker':
      return t('stage.status.startingWorker', 'Starting build (initializing worker)...');
    case 'source-stage':
      return t('stage.status.fetching', 'Build running (source stage)...');
    case 'geometry-stage':
      return t('stage.status.transforming', 'Build running (geometry stage)...');
    case 'tile-emit-stage':
      return t('stage.status.tileEmit', 'Build running (tile emit stage)...');
    case 'finalizing':
      return t('stage.status.finalizing', 'Finalizing build result...');
    default:
      return t('stage.status.starting', 'Starting stage...');
  }
};

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

const resolveTransportLabel = (draft: Partial<RouteEntity>, t: (key: string, fallback?: string) => string): string => {
  const selection = draft.transportSelection;
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
  const routeData = draft;
  const routeNodeId = nodeId as NodeId | undefined;
  const dataSource = draft.dataSourceName ?? t('stage.notConfigured', 'Not configured');
  const generationMethod = draft.generationMethod ?? t('stage.notConfigured', 'Not configured');
  const transportLabel = resolveTransportLabel(draft, t);
  const startLocation = draft.startLocationId ?? t('stage.notConfigured', 'Not configured');
  const endLocation = draft.endLocationId ?? t('stage.notConfigured', 'Not configured');

  const hasRequiredFields = Boolean(
    draft.dataSourceName &&
      draft.transportMode &&
      draft.generationMethod &&
      draft.startLocationId &&
      draft.endLocationId,
  );

  const stages = useMemo(() => resolveBuildStages({
    t,
    includeDescriptions: true,
    overrides: {
      source: {
        title: t('processing.source.title', 'Source'),
        description: t('stage.route.source.description', 'Download, parse, and save source route features.'),
      },
      geometry: {
        title: t('processing.geometry.title', 'Geometry'),
        description: t('stage.route.geometry.description', 'Build tile index for route lookup.'),
      },
      tileEmit: {
        title: t('processing.tileEmit.title', 'TileEmit'),
        description: t('stage.route.tileEmit.description', 'Generate tile artifacts for rendering.'),
        icon: <CheckCircle />,
      },
    },
  }), [t]);
  const resolveZoomRange = useCallback((): [number, number] => {
    const zoomRange = draft.zoomRange;
    if (zoomRange && zoomRange.length === 2) {
      return zoomRange;
    }
    const buildConfig = (draft.buildConfig ?? DEFAULT_ROUTE_BUILD_CONFIG) as {
      geometryConfig?: { zoomBandBoundaries?: number[] };
    };
    const boundaries = buildConfig.geometryConfig?.zoomBandBoundaries ?? [DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM];
    const minZoom = boundaries[0] ?? DEFAULT_MIN_ZOOM;
    const maxZoom = boundaries[boundaries.length - 1] ?? DEFAULT_MAX_ZOOM;
    return [minZoom, maxZoom];
  }, [draft]);

  const resolveVectorTileConfig = useCallback(() => {
    const buildConfig = (draft.buildConfig ?? DEFAULT_ROUTE_BUILD_CONFIG) as {
      tileEmitConfig?: { bufferSize?: number; inputFormat?: 'geojson' | 'flatgeobuf'; inputCompression?: 'gzip' | 'none' };
    };
    return {
      bufferSize: buildConfig.tileEmitConfig?.bufferSize ?? DEFAULT_BUFFER,
      inputFormat: buildConfig.tileEmitConfig?.inputFormat ?? 'geojson',
      inputCompression: buildConfig.tileEmitConfig?.inputCompression ?? 'none',
    };
  }, [draft]);

  const resolveRouteGeometryConfig = useCallback(() => {
    const buildConfig = (draft.buildConfig ?? DEFAULT_ROUTE_BUILD_CONFIG) as {
      geometryConfig?: { zoomBandBoundaries?: number[] };
      routeGeometryConfig?: {
        minDistanceMetersByBand?: number[];
        simplifyToleranceByBand?: number[];
      };
    };
    return {
      zoomBandBoundaries: buildConfig.geometryConfig?.zoomBandBoundaries,
      minDistanceMetersByBand: buildConfig.routeGeometryConfig?.minDistanceMetersByBand,
      simplifyToleranceByBand: buildConfig.routeGeometryConfig?.simplifyToleranceByBand,
    };
  }, [draft]);

  const [heapDialogOpen, setHeapDialogOpen] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionSnapshot, setCompletionSnapshot] = useState<{
    status: BuildStatus;
    stageLabel: string;
    taskTitle?: string;
    taskMessage?: string;
    reason?: string;
  } | null>(null);
  const completionStatusRef = useRef<BuildStatus | null>(null);
  const heapPauseRef = useRef<number | null>(null);
  const crashInsight = useRouteBuildCrashInsight({ draft, nodeId: routeNodeId ? String(routeNodeId) : null });
  const monitorKey = useMemo(
    () => getBuildMonitorKey(buildMonitorConfig, routeNodeId ? String(routeNodeId) : null),
    [routeNodeId],
  );
  const mapIdeGsmProgress = useCallback((progress: IdeGsmImportProgress): number => {
    const total = progress.total ?? 0;
    const processed = progress.processed ?? 0;
    const ratio = total > 0 ? Math.min(1, processed / total) : 0;
    let percent = 0;
    switch (progress.phase) {
      case 'source':
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
    return Math.round((percent / 100) * SOURCE_STAGE_MAX);
  }, []);

  const resolveIdeGsmLabel = useCallback((progress: IdeGsmImportProgress): string => {
    switch (progress.phase) {
      case 'source':
        return t('stage.ideGsm.source', 'IDE-GSM: downloading');
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

  const {
    status,
    setStatus,
    overallProgress,
    setOverallProgress,
    isStopRequested,
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
  } = useRouteBuildSessionLifecycle({
    api,
    initialize,
    draft,
    routeData,
    onUpdate,
    routeNodeId,
    resolveZoomRange,
    resolveRouteGeometryConfig,
    resolveVectorTileConfig,
    mapIdeGsmProgress,
    sourceStageMax: SOURCE_STAGE_MAX,
    geometryStageMax: GEOMETRY_STAGE_MAX,
    tileEmitStageMax: TILE_EMIT_STAGE_MAX,
    t,
  });
  const { event: heapEvent, dismiss: dismissHeapEvent } = useHeapPressureGuard({
    enabled: status === 'running' || status === 'paused',
    workerEnabled: false,
  });

  const stageProgress = useMemo(() => {
    const map: Record<string, number> = {};
    const ranges: Record<string, { start: number; end: number }> = {
      source: { start: 0, end: SOURCE_STAGE_MAX },
      geometry: { start: SOURCE_STAGE_MAX, end: GEOMETRY_STAGE_MAX },
      tileEmit: { start: GEOMETRY_STAGE_MAX, end: TILE_EMIT_STAGE_MAX },
    };
    stages.forEach((stage) => {
      const range = ranges[stage.id] ?? { start: 0, end: TILE_EMIT_STAGE_MAX };
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
  }, [overallProgress, stages]);

  useEffect(() => {
    if (!heapEvent) return;
    setHeapDialogOpen(true);
  }, [heapEvent]);

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
  }, [heapEvent, setStatus, setHeapDialogOpen, status]);

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

  const completionStageLabel = useMemo(() => {
    if (ideGsmPhase) return resolveIdeGsmLabel(ideGsmPhase);
    const activeStage = [...stages].reverse().find((stage) => (stageProgress[stage.id] ?? 0) > 0);
    return activeStage?.title ?? stages[0]?.title ?? t('stage.progress.unknownStage', 'Unknown stage');
  }, [ideGsmPhase, resolveIdeGsmLabel, stageProgress, stages, t]);
  const completionTaskTitle = useMemo(() => {
    const title = ideGsmPhase ? resolveIdeGsmLabel(ideGsmPhase) : completionStageLabel;
    return title?.trim() ? title : t('stage.tasks.unknown', '(Task unavailable)');
  }, [completionStageLabel, ideGsmPhase, resolveIdeGsmLabel, t]);
  const completionTaskMessage = useMemo(() => {
    return draft.processingError
      ?? t('stage.progress.failedReason', 'Build failed due to task errors.');
  }, [draft, t]);
  const completionReason = useMemo(() => {
    if (status === 'failed') {
      return draft.processingError
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

  const progressPanelViewModel = useRouteBuildProgressPanelViewModel({
    status,
    overallProgress,
    stages,
    stageProgress,
    onPause: () => {
      void handlePause('user-pause');
    },
    onResume: isWebLockSupported && !isStopRequested ? runIdeGsmBuild : undefined,
    onComplete: () => {
      setStatus('completed');
      setOverallProgress(100);
    },
    stopRequested: isStopRequested,
    startPending: buildSessionTransition.active && status !== 'running',
    statusLabel: buildSessionTransition.active
      ? getRouteBuildTransitionStatusLabel(t, buildSessionTransition.phase)
      : undefined,
    suppressStatusFallback: true,
    suspendDialog: {
      open: suspendSuspectOpen,
      onClose: () => closeSuspendSuspect(),
      title: t('stage.progress.suspendSuspectTitle', 'Build tab suspended'),
      message: suspendSuspectMessage
        ?? t('stage.progress.suspendSuspect', 'Build tab is in background; waiting for it to resume.'),
      closeLabel: t('common.close', 'Close'),
    },
    crashDialog: {
      open: crashSuspectOpen,
      onClose: () => closeCrashSuspect(),
      title: t('stage.progress.crashSuspectTitle', 'Build may have stopped'),
      message: crashSuspectMessage
        ?? t('stage.progress.crashSuspect', 'Build session may have stopped unexpectedly.'),
      closeLabel: t('common.close', 'Close'),
    },
    completionDialog: {
      open: completionDialogOpen,
      onClose: () => setCompletionDialogOpen(false),
      title: completionSnapshot?.status === 'completed'
        ? t('stage.progress.completedTitle', 'Build completed')
        : t('stage.progress.failedTitle', 'Build failed'),
      closeLabel: t('common.close', 'Close'),
      content: (
        <>
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
        </>
      ),
    },
    footer: (
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
    ),
    stagesLength: stages.length,
  });

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

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="body2" color="text.secondary">
        {t('stage.review', 'Review the configuration and press Build to start the build route generation.')}
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
      <RouteBuildProgressPanel {...progressPanelViewModel} />
    </Box>
  );
};

const resolveMonitorStage = (phase?: string): BuildMonitorStage => {
  switch (phase) {
    case 'source':
      return 'source';
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
