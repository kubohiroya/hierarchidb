import type { NodeId } from '@hierarchidb/core-types';
import type { RouteEntity, RouteTransportSelection } from '@hierarchidb/route-api';
import { resolveBuildStages } from '@hierarchidb/ui-build-progress';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import { useCanonicalBuildSessionControls } from '@hierarchidb/ui-build-sessions';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { CheckCircle } from '@mui/icons-material';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PLUGIN_NODE_TYPE } from '~/plugin-manifest';
import { useRouteBuildCrashInsight } from '~/ui/hooks/useRouteBuildCrashInsight';
import { useRouteBuildProgress } from '~/ui/hooks/useRouteBuildProgress';
import { RouteBuildProgressPanel } from './RouteBuildProgressPanel.js';
import { useRouteBuildProgressPanelViewModel } from './useRouteBuildProgressPanelViewModel.js';

interface RouteBuildStepProps {
  draft: Partial<RouteEntity>;
  onUpdate: (updates: Partial<RouteEntity>) => void;
  nodeId?: string;
  parentId?: string;
  mode: 'create' | 'edit';
}

const ROUTE_STAGE_IDS = ['source', 'geometry', 'tileEmit'] as const;
const ROUTE_BUILD_COMMAND_TRANSPORT = {
  kind: 'worker',
  nodeType: PLUGIN_NODE_TYPE,
} as const;

const TRANSPORT_SELECTION_LABELS: Record<
  RouteTransportSelection,
  { key: string; fallback: string }
> = {
  air: { key: 'transportModes.air', fallback: 'Air' },
  sea: { key: 'transportModes.sea', fallback: 'Sea' },
  rail: { key: 'transportModes.rail', fallback: 'Rail' },
  'high-speed-rail': {
    key: 'transportModes.highSpeedRail',
    fallback: 'High-speed rail',
  },
  highway: { key: 'transportModes.highway', fallback: 'Highway' },
  road: { key: 'transportModes.road', fallback: 'General road' },
};

const isTransportSelection = (value: unknown): value is RouteTransportSelection =>
  typeof value === 'string' && value in TRANSPORT_SELECTION_LABELS;

const resolveTransportLabel = (
  draft: Partial<RouteEntity>,
  t: (key: string, fallback?: string) => string
): string => {
  const selection = draft.transportSelection;
  if (selection == null) return t('stage.notConfigured', 'Not configured');
  if (!isTransportSelection(selection)) {
    throw new Error(`Unsupported transportSelection: ${String(selection)}`);
  }
  const entry = TRANSPORT_SELECTION_LABELS[selection];
  return t(entry.key, entry.fallback);
};

const resolveOverallProgress = (
  status: BuildStatus,
  activeStage: string | undefined,
  stagePercentage: number | undefined
): number => {
  if (status === 'completed') return 100;
  if (activeStage === undefined || stagePercentage === undefined) return 0;
  const stageIndex = ROUTE_STAGE_IDS.indexOf(activeStage as (typeof ROUTE_STAGE_IDS)[number]);
  if (stageIndex < 0) {
    throw new Error(`[RouteBuildStep] unsupported canonical stage: ${activeStage}`);
  }
  if (!Number.isFinite(stagePercentage) || stagePercentage < 0 || stagePercentage > 100) {
    throw new Error(
      `[RouteBuildStep] canonical stage progress must be finite 0..100: ${String(stagePercentage)}`
    );
  }
  return ((stageIndex + stagePercentage / 100) / ROUTE_STAGE_IDS.length) * 100;
};

const resolveUiBuildStatus = (status: string | undefined): BuildStatus => {
  if (status === undefined || status === 'idle' || status === 'queued') return 'idle';
  if (
    status === 'running' ||
    status === 'paused' ||
    status === 'completed' ||
    status === 'failed'
  ) {
    return status;
  }
  throw new Error(`[RouteBuildStep] unsupported canonical session status: ${status}`);
};

export const RouteBuildStep: React.FC<RouteBuildStepProps> = ({ draft, onUpdate, nodeId }) => {
  const { t } = useTranslation('route-plugin');
  const routeNodeId = (nodeId as NodeId | undefined) ?? null;
  const {
    progress,
    status: lifecycleStatus,
    lastError,
    subscriptionReady,
  } = useRouteBuildProgress(routeNodeId);
  const {
    canStartBuildSession,
    pendingCommand,
    mutationError,
    pauseBuildSession,
    startBuildSession,
  } = useCanonicalBuildSessionControls({
    nodeId: routeNodeId,
    subscriptionReady,
    commandTransport: ROUTE_BUILD_COMMAND_TRANSPORT,
  });
  const isMutating = pendingCommand !== null;
  const status = resolveUiBuildStatus(lifecycleStatus?.status ?? progress?.status);
  const overallProgress = resolveOverallProgress(status, progress?.stage, progress?.percentage);
  const crashInsight = useRouteBuildCrashInsight({
    draft,
    nodeId: routeNodeId ? String(routeNodeId) : null,
  });
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const completionStatusRef = useRef<BuildStatus>(status);
  const persistedStatusRef = useRef<BuildStatus | null>(null);

  const stages = useMemo(
    () =>
      resolveBuildStages({
        t,
        includeDescriptions: true,
        overrides: {
          source: {
            title: String(t('processing.source.title', 'Source')),
            description: String(
              t(
                'stage.route.source.description',
                'Generate and persist canonical route source artifacts.'
              )
            ),
          },
          geometry: {
            title: String(t('processing.geometry.title', 'Geometry')),
            description: String(
              t(
                'stage.route.geometry.description',
                'Build geometry cache and the tile transpose index.'
              )
            ),
          },
          tileEmit: {
            title: String(t('processing.tileEmit.title', 'TileEmit')),
            description: String(
              t(
                'stage.route.tileEmit.description',
                'Generate and persist canonical route vector tiles.'
              )
            ),
            icon: <CheckCircle />,
          },
        },
      }),
    [t]
  );

  const stageProgress = useMemo(() => {
    const activeIndex = progress
      ? ROUTE_STAGE_IDS.indexOf(progress.stage as (typeof ROUTE_STAGE_IDS)[number])
      : -1;
    if (progress && activeIndex < 0) {
      throw new Error(`[RouteBuildStep] unsupported canonical stage: ${String(progress.stage)}`);
    }
    return Object.fromEntries(
      ROUTE_STAGE_IDS.map((stageId, index) => {
        if (status === 'completed' || index < activeIndex) return [stageId, 100];
        if (index > activeIndex || !progress) return [stageId, 0];
        return [stageId, progress.percentage];
      })
    );
  }, [progress, status]);

  const hasRequiredFields = Boolean(
    routeNodeId &&
      draft.buildConfig &&
      draft.routeMode &&
      draft.startLocationId &&
      draft.endLocationId &&
      Array.isArray(draft.lineGeometry) &&
      draft.lineGeometry.length >= 2
  );

  const handleStartOrResume = useCallback(async (): Promise<void> => {
    await startBuildSession();
  }, [startBuildSession]);

  const handlePause = useCallback(async (): Promise<void> => {
    await pauseBuildSession();
  }, [pauseBuildSession]);

  useEffect(() => {
    if (persistedStatusRef.current === status) return;
    persistedStatusRef.current = status;
    if (status === 'running') {
      onUpdate({
        processingStatus: 'processing',
        buildStartedAt: lifecycleStatus?.startedAt ?? draft.buildStartedAt ?? Date.now(),
        buildFinishedAt: undefined,
        processingError: undefined,
      });
      return;
    }
    if (status === 'paused') {
      onUpdate({ processingStatus: 'pending', buildFinishedAt: undefined });
      return;
    }
    if (status === 'completed') {
      const completedAt = lifecycleStatus?.completedAt;
      if (completedAt === undefined) {
        throw new Error('[RouteBuildStep] completed session is missing completedAt');
      }
      onUpdate({
        processingStatus: 'completed',
        processedAt: completedAt,
        buildFinishedAt: completedAt,
        processingError: undefined,
      });
      return;
    }
    if (status === 'failed') {
      const completedAt = lifecycleStatus?.completedAt;
      if (completedAt === undefined) {
        throw new Error('[RouteBuildStep] failed session is missing completedAt');
      }
      onUpdate({
        processingStatus: 'failed',
        processingError: lastError ?? String(t('stage.progress.failedReason', 'Build failed.')),
        buildFinishedAt: completedAt,
      });
    }
  }, [
    draft.buildStartedAt,
    lastError,
    lifecycleStatus?.completedAt,
    lifecycleStatus?.startedAt,
    onUpdate,
    status,
    t,
  ]);

  useEffect(() => {
    if (completionStatusRef.current === status) return;
    completionStatusRef.current = status;
    if (status === 'completed' || status === 'failed') {
      setCompletionDialogOpen(true);
    }
  }, [status]);

  const progressPanelViewModel = useRouteBuildProgressPanelViewModel({
    status,
    overallProgress,
    stages,
    stageProgress,
    onPause: status === 'running' && !isMutating ? () => void handlePause() : undefined,
    onResume:
      hasRequiredFields && canStartBuildSession && status !== 'running'
        ? () => void handleStartOrResume()
        : undefined,
    stopRequested: status === 'running' && isMutating,
    startPending: status !== 'running' && isMutating,
    statusLabel: !subscriptionReady
      ? String(t('stage.status.connectingWorker', 'Connecting to the build worker...'))
      : undefined,
    completionDialog: {
      open: completionDialogOpen,
      onClose: () => setCompletionDialogOpen(false),
      title:
        status === 'completed'
          ? t('stage.progress.completedTitle', 'Build completed')
          : t('stage.progress.failedTitle', 'Build failed'),
      closeLabel: t('common.close', 'Close'),
      content: (
        <Typography variant="body2">
          {status === 'completed'
            ? t('stage.progress.completedReason', 'All canonical tasks completed.')
            : (lastError ?? t('stage.progress.failedReason', 'Build failed due to task errors.'))}
        </Typography>
      ),
    },
    stagesLength: stages.length,
  });

  const visibleError = mutationError?.message ?? lastError;
  const dataSource = draft.dataSourceName ?? t('stage.notConfigured', 'Not configured');
  const generationMethod = draft.generationMethod ?? t('stage.notConfigured', 'Not configured');
  const startLocation = draft.startLocationId ?? t('stage.notConfigured', 'Not configured');
  const endLocation = draft.endLocationId ?? t('stage.notConfigured', 'Not configured');

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="body2" color="text.secondary">
        {t(
          'stage.review',
          'Review the configuration and press Build to start the canonical route build.'
        )}
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('stage.dataSource', 'Data Source:')}</Typography>
        <Chip size="small" label={String(dataSource)} />
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Typography variant="subtitle2">{t('stage.transportMode', 'Transport Mode:')}</Typography>
        <Chip size="small" label={resolveTransportLabel(draft, t)} />
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

      {!hasRequiredFields ? (
        <Alert severity="info">
          {t(
            'stage.missingCanonicalInput',
            'Build config, route mode, start/end locations, and line geometry are required.'
          )}
        </Alert>
      ) : null}
      {visibleError ? <Alert severity="error">{visibleError}</Alert> : null}
      {crashInsight ? (
        <Alert severity="warning">
          {t(
            'stage.crashHint',
            'Previous stage did not finish. Review the canonical task failure before restarting.'
          )}
        </Alert>
      ) : null}

      <Typography variant="subtitle1">{t('stage.title', 'Build routes')}</Typography>
      <RouteBuildProgressPanel {...progressPanelViewModel} />
    </Box>
  );
};
