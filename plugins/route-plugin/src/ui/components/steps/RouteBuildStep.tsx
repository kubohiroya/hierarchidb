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
import { BuildStepPanel, type BuildStatus, notify } from '@hierarchidb/components';
import { HeapPressureDialog, useHeapPressureGuard } from '@hierarchidb/ui-memory';
import { GenericDataGrid, type GridColumn } from '@hierarchidb/ui-grid';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { findRelatedNodesByPriority } from '@hierarchidb/common-api';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';
import { proxy } from 'comlink';
import {
  IDE_GSM_BULK_CHUNK_SIZE,
  type IdeGsmImportProgress,
  type IdeGsmRouteError,
} from '@hierarchidb/plugin-service-api';
import type { RouteTransportSelection, RouteUpdaterPayload } from '../../../common/entities/RouteEntity.js';
import type { RouteEntity } from '../../../common/entities/RouteEntity.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { getRouteUpdaterPayload } from '../../../common/utils/draft.js';
import { useRouteBuildCrashInsight } from '../../hooks/useRouteBuildCrashInsight.js';
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

const STAGES = [
  { id: 'prepare', title: 'Prepare', description: 'Validate route parameters.' },
  { id: 'fetch', title: 'Fetch', description: 'Fetch route graph data.' },
  { id: 'compute', title: 'Compute', description: 'Calculate routes and metrics.' },
  { id: 'finalize', title: 'Finalize', description: 'Persist results and indexes.' },
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
  storagePrefix: 'hdb:route:build-monitor',
  keyMode: 'node',
  maxSamples: 3,
  memoryPressureRatio: 0.85,
} as const;

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
    return t('build.notConfigured', 'Not configured');
  }
  if (!isTransportSelection(selection)) {
    throw new Error(`Unsupported transportSelection: ${String(selection)}`);
  }
  const entry = TRANSPORT_SELECTION_LABELS[selection];
  return t(entry.key, entry.fallback);
};

export const RouteBuildStep: React.FC<RouteBuildStepProps> = ({
  draft,
  onUpdate,
  nodeId,
  parentId,
  mode,
}) => {
  const { t } = useTranslation();
  const { api, initialize } = useWorkerAPI();
  const dataSource = (draft as { dataSourceName?: string }).dataSourceName ?? t('build.notConfigured', 'Not configured');
  const generationMethod = (draft as { generationMethod?: string }).generationMethod ?? t('build.notConfigured', 'Not configured');
  const transportLabel = resolveTransportLabel(draft, t);
  const startLocation = (draft as { startLocationId?: string }).startLocationId ?? t('build.notConfigured', 'Not configured');
  const endLocation = (draft as { endLocationId?: string }).endLocationId ?? t('build.notConfigured', 'Not configured');

  const hasRequiredFields = Boolean(
    (draft as { dataSourceName?: string }).dataSourceName &&
      (draft as { transportMode?: string }).transportMode &&
      (draft as { generationMethod?: string }).generationMethod &&
      (draft as { startLocationId?: string }).startLocationId &&
      (draft as { endLocationId?: string }).endLocationId,
  );

  const [status, setStatus] = useState<BuildStatus>('idle');
  const [overallProgress, setOverallProgress] = useState(0);
  const [heapDialogOpen, setHeapDialogOpen] = useState(false);
  const [errorRows, setErrorRows] = useState<IdeGsmRouteError[]>([]);
  const [ideGsmPhase, setIdeGsmPhase] = useState<IdeGsmImportProgress | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const buildInFlightRef = useRef(false);
  const heapPauseRef = useRef<number | null>(null);
  const routeNodeId = (draft.treeNodeId ?? nodeId) as NodeId | undefined;
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
    STAGES.forEach((stage, idx) => {
      map[stage.id] = Math.min(100, Math.max(0, overallProgress - idx * 10));
    });
    return map;
  }, [overallProgress]);

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
    { id: 'rowNumber', label: t('build.errors.columns.row', 'Row'), width: 90, sortable: true },
    { id: 'start', label: t('build.errors.columns.start', 'Start'), width: 160 },
    { id: 'end', label: t('build.errors.columns.end', 'End'), width: 160 },
    { id: 'reason', label: t('build.errors.columns.reason', 'Reason'), width: 360 },
  ]), [t]);

  const mapIdeGsmProgress = useCallback((progress: IdeGsmImportProgress): number => {
    const total = progress.total ?? 0;
    const processed = progress.processed ?? 0;
    const ratio = total > 0 ? Math.min(1, processed / total) : 0;
    switch (progress.phase) {
      case 'fetch':
        return 10;
      case 'parse':
        return 20 + Math.round(ratio * 25);
      case 'waypoints':
        return 45 + Math.round(ratio * 35);
      case 'save':
        return 80 + Math.round(ratio * 20);
      case 'completed':
        return 100;
      case 'failed':
        return Math.max(0, Math.min(100, Math.round(ratio * 100)));
      default:
        return 0;
    }
  }, []);

  const resolveIdeGsmLabel = useCallback((progress: IdeGsmImportProgress): string => {
    switch (progress.phase) {
      case 'fetch':
        return t('build.ideGsm.fetch', 'IDE-GSM: downloading');
      case 'parse':
        return t('build.ideGsm.parse', 'IDE-GSM: parsing rows');
      case 'waypoints':
        return t('build.ideGsm.waypoints', 'IDE-GSM: generating waypoints');
      case 'save':
        return t('build.ideGsm.save', 'IDE-GSM: saving routes');
      case 'completed':
        return t('build.ideGsm.completed', 'IDE-GSM: import completed');
      case 'failed':
        return t('build.ideGsm.failed', 'IDE-GSM: import failed');
      default:
        return 'IDE-GSM';
    }
  }, [t]);

  const resolveLocationNodes = useCallback(async (): Promise<NodeId[]> => {
    if (!api) return [];
    const query = await api.getQueryAPI();
    let resolvedParentId: NodeId | null = null;

    if (mode === 'create' && parentId) {
      resolvedParentId = parentId as NodeId;
    } else if (nodeId) {
      const node = await query.getNode(nodeId as NodeId);
      resolvedParentId = node?.parentId ?? null;
    }

    if (!resolvedParentId) return [];
    const nodes = await findRelatedNodesByPriority(query, {
      parentId: resolvedParentId,
      nodeTypes: ['location' as NodeType],
    });
    return nodes.map((node) => node.id as NodeId);
  }, [api, mode, nodeId, parentId]);

  const runIdeGsmBuild = useCallback(async () => {
    if (buildInFlightRef.current) return;
    if (!api) {
      notify.error(t('build.errors.missingApi', 'Worker API is unavailable.'));
      return;
    }
    const dataSourceName = (draft as { dataSourceName?: string }).dataSourceName;
    if (dataSourceName !== 'ide-gsm') {
      notify.info(t('build.errors.unsupportedSource', 'Selected data source is not supported yet.'));
      return;
    }
    const sourceUrl = (draft as { ideGsmSourceUrl?: string }).ideGsmSourceUrl;
    if (!sourceUrl) {
      notify.error(t('build.errors.missingSource', 'IDE-GSM source URL is required.'));
      return;
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
      const locationNodeIds = await resolveLocationNodes();
      if (locationNodeIds.length === 0) {
        throw new Error('No related location nodes found.');
      }

      const routeNodeId = (draft.treeNodeId ?? nodeId) as NodeId;
      const routeMutation = await api.getRouteMutationAPI();
      const result = await routeMutation.importIdeGsmRoutes(
        {
          nodeId: routeNodeId,
          sourceUrl,
          locationNodeIds,
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
      setStatus('completed');
      setOverallProgress(100);
      onUpdate({ processingStatus: 'completed', processedAt: Date.now(), buildFinishedAt: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify.error(message);
      setStatus('failed');
      onUpdate({ processingStatus: 'failed', processingError: message, buildFinishedAt: Date.now() });
    } finally {
      buildInFlightRef.current = false;
    }
  }, [api, draft, initialize, mapIdeGsmProgress, nodeId, onUpdate, resolveLocationNodes, t]);

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="body2" color="text.secondary">
        {t('build.review', 'Review the configuration and press Build to start the batch route generation.')}
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('build.dataSource', 'Data Source:')}</Typography>
        <Chip size="small" label={String(dataSource)} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('build.transportMode', 'Transport Mode:')}</Typography>
        <Chip size="small" label={transportLabel} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('build.routeType', 'Route Type:')}</Typography>
        <Chip size="small" label={String(generationMethod)} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('build.startLocation', 'Start:')}</Typography>
        <Chip size="small" label={String(startLocation)} />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('build.endLocation', 'End:')}</Typography>
        <Chip size="small" label={String(endLocation)} />
      </Stack>

      {!hasRequiredFields && (
        <Alert severity="info">
          {t('build.missing', 'Provide transport, route type, and start/end locations before building.')}
        </Alert>
      )}
      {crashInsight ? (
        <Alert severity="warning">
          {t(
            'build.crashHint',
            'Previous build did not finish. Consider cleaning data before restarting.',
          )}
        </Alert>
      ) : null}

      <Typography variant="subtitle1">
        {t('build.title', 'Build routes')}
      </Typography>
      {ideGsmPhase ? (
        <Typography variant="caption" color="text.secondary">
          {resolveIdeGsmLabel(ideGsmPhase)}
        </Typography>
      ) : null}
      <BuildStepPanel
        status={status}
        overallProgress={overallProgress}
        stages={STAGES}
        stageProgress={stageProgress}
        splitViewBreakpoints={SPLITVIEW_BREAKPOINTS}
        splitViewInitialSizesByBreakpoint={SPLITVIEW_INITIAL_SIZES}
        splitViewAutoCloseCountsByBreakpoint={SPLITVIEW_AUTO_CLOSE_COUNTS}
        onPause={() => setStatus('paused')}
        onResume={runIdeGsmBuild}
        onComplete={() => {
          setStatus('completed');
          setOverallProgress(100);
        }}
      />
      <HeapPressureDialog
        open={heapDialogOpen}
        event={heapEvent}
        onClose={() => {
          setHeapDialogOpen(false);
          dismissHeapEvent();
        }}
        title={t('build.heap.pauseTitle', 'Build paused due to memory pressure')}
        confirmLabel={t('build.heap.pauseConfirm', 'OK')}
        description={t('build.heap.pauseHint', 'Reduce concurrency and resume when ready.')}
      />
      <Dialog
        open={errorDialogOpen}
        onClose={() => setErrorDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('build.errors.title', 'Build errors')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('build.errors.description', 'Some rows were skipped. Review the list below.')}
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
            {`${errorRows.length} ${t('build.errors.countLabel', 'errors')}`}
          </Typography>
          <Chip
            size="small"
            label={t('build.errors.close', 'Close')}
            onClick={() => setErrorDialogOpen(false)}
            clickable
          />
        </DialogActions>
      </Dialog>
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
