import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { BuildStepPanel, type BuildStatus, type BuildStage } from '@hierarchidb/components';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { getWorkerBridge, type WorkerBridge } from '@hierarchidb/ui-worker-client';
import { HeapPressureDialog, useHeapPressureGuard } from '@hierarchidb/ui-memory';
import type { IdeGsmImportProgress } from '@hierarchidb/plugin-service-api';
import type { LocationEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { useLocationProgress } from '../../../common/hooks/useLocationProgress.js';
import { subscribeIdeGsmProgress } from '../../state/ideGsmProgress.js';

type Props = {
  nodeId?: string;
  draft: Partial<LocationEntity>;
  onUpdate?: (updates: Partial<LocationEntity>) => void;
};

const LOCATION_NODE_TYPE = 'location' as NodeType;

const SPLITVIEW_BREAKPOINTS = [600, 900, 1200];

const mapStatusToBuildStatus = (phase?: string, fallbackStage?: string, nodeId?: string | null): BuildStatus => {
  if (!nodeId) return 'idle';
  if (phase === 'completed') return 'completed';
  if (phase === 'failed') return 'failed';
  if (phase === 'paused' || fallbackStage === 'paused' || fallbackStage === 'auth-required') return 'paused';
  return 'running';
};

const resolveStageIndex = (stageId: string | undefined, stages: BuildStage[]): number => {
  if (!stageId) return -1;
  const normalized = stageId.toLowerCase();
  return stages.findIndex((stage) => normalized.includes(stage.id));
};

const mapIdeGsmProgressToPercent = (progress: IdeGsmImportProgress): number => {
  const total = progress.total ?? 0;
  const processed = progress.processed ?? 0;
  const ratio = total > 0 ? Math.min(1, processed / total) : 0;
  switch (progress.phase) {
    case 'fetch':
      return 10;
    case 'parse':
      return 20 + Math.round(ratio * 30);
    case 'filter':
      return 55;
    case 'save':
      return 60 + Math.round(ratio * 35);
    case 'completed':
      return 100;
    case 'failed':
      return Math.max(0, Math.min(100, Math.round(ratio * 100)));
    default:
      return 0;
  }
};

const resolveIdeGsmTaskLabel = (t: (key: string, fallback?: string) => string, progress: IdeGsmImportProgress): string => {
  switch (progress.phase) {
    case 'fetch':
      return t('build.ideGsm.fetch', 'IDE-GSM: downloading');
    case 'parse':
      return t('build.ideGsm.parse', 'IDE-GSM: parsing rows');
    case 'filter':
      return t('build.ideGsm.filter', 'IDE-GSM: filtering rows');
    case 'save':
      return t('build.ideGsm.save', 'IDE-GSM: saving locations');
    case 'completed':
      return t('build.ideGsm.completed', 'IDE-GSM: import completed');
    case 'failed':
      return t('build.ideGsm.failed', 'IDE-GSM: import failed');
    default:
      return 'IDE-GSM';
  }
};

export const LocationBuildStep: React.FC<Props> = ({ nodeId, draft, onUpdate: _onUpdate }) => {
  const { t, translations } = useTranslation();
  const stageLabels = translations.batch?.stages ?? {};
  const stages = useMemo<Array<BuildStage & { description: string }>>(() => ([
    {
      id: 'download',
      title: stageLabels.download ?? t('build.stages.download', 'Download'),
      description: t('build.stageDescriptions.download', 'Download points and metadata.'),
    },
    {
      id: 'simplify1',
      title: stageLabels.filtering ?? t('build.stages.filter', 'Filter'),
      description: t('build.stageDescriptions.filter', 'Normalize and filter the source data.'),
    },
    {
      id: 'simplify2',
      title: stageLabels.clustering ?? t('build.stages.cluster', 'Cluster'),
      description: t('build.stageDescriptions.cluster', 'Prepare point clusters and indexes.'),
    },
    {
      id: 'vectortile',
      title: stageLabels.indexing ?? t('build.stages.index', 'Index'),
      description: t('build.stageDescriptions.index', 'Generate vector tiles for previews.'),
    },
  ]), [stageLabels.clustering, stageLabels.download, stageLabels.filtering, stageLabels.indexing, t]);
  const splitViewInitialSizes = useMemo(
    () => Array.from({ length: SPLITVIEW_BREAKPOINTS.length + 1 }, () =>
      Array.from({ length: stages.length }, () => 300),
    ),
    [stages.length],
  );
  const splitViewAutoCloseCounts = useMemo(
    () => ([
      Math.max(0, stages.length - 1),
      Math.max(0, stages.length - 2),
      Math.max(0, stages.length - 3),
      0,
    ]),
    [stages.length],
  );
  const activeNodeId = nodeId ?? null;
  const bridgeRef = useRef<WorkerBridge>(getWorkerBridge());
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [heapDialogOpen, setHeapDialogOpen] = useState(false);
  const heapPauseRef = useRef<string | null>(null);
  const [ideGsmProgress, setIdeGsmProgress] = useState<IdeGsmImportProgress | null>(null);
  const { progress, unifiedProgress } = useLocationProgress(activeNodeId, { autoSubscribe: Boolean(activeNodeId) });

  useEffect(() => {
    if (!activeNodeId) return;
    void bridgeRef.current.initialize().catch((error: unknown) => {
      console.warn('[LocationBuildStep] failed to initialize worker bridge', error);
    });
  }, [activeNodeId]);

  const phase = unifiedProgress?.phase ?? progress?.stage;
  const baseStatus = mapStatusToBuildStatus(
    typeof phase === 'string' ? phase : undefined,
    progress?.stage,
    activeNodeId,
  );
  const ideGsmActive = Boolean(ideGsmProgress && ideGsmProgress.phase !== 'completed' && ideGsmProgress.phase !== 'failed');
  const ideGsmFailed = ideGsmProgress?.phase === 'failed';
  const buildStatus: BuildStatus = ideGsmFailed
    ? 'failed'
    : ideGsmActive
      ? 'running'
      : baseStatus;
  const { event: heapEvent, dismiss: dismissHeapEvent } = useHeapPressureGuard({
    enabled: buildStatus === 'running' || buildStatus === 'paused',
    workerBridge: bridgeRef.current,
  });
  const overallProgress = useMemo(() => {
    const fallback = progress?.percentage ?? 0;
    const value = unifiedProgress?.percentage ?? fallback;
    if (buildStatus === 'completed') return 100;
    return Math.max(0, Math.min(100, Math.round(value)));
  }, [buildStatus, progress?.percentage, unifiedProgress?.percentage]);
  const ideGsmOverallProgress = ideGsmProgress ? mapIdeGsmProgressToPercent(ideGsmProgress) : overallProgress;

  const normalizedStage = unifiedProgress?.stage ?? progress?.stage;
  const stageProgress = useMemo(() => {
    if (ideGsmActive) {
      return stages.reduce<Record<string, number>>((acc, stage, index) => {
        acc[stage.id] = index === 0 ? ideGsmOverallProgress : 0;
        return acc;
      }, {});
    }
    const currentIndex = resolveStageIndex(normalizedStage, stages);
    return stages.reduce<Record<string, number>>((acc, stage, index) => {
      if (currentIndex === -1) {
        acc[stage.id] = index === 0 ? overallProgress : 0;
        return acc;
      }
      if (index < currentIndex) {
        acc[stage.id] = 100;
        return acc;
      }
      if (index === currentIndex) {
        acc[stage.id] = overallProgress;
        return acc;
      }
      acc[stage.id] = 0;
      return acc;
    }, {});
  }, [ideGsmActive, ideGsmOverallProgress, normalizedStage, overallProgress, stages]);

  const handlePause = useCallback(async () => {
    if (!activeNodeId || isMutating) return;
    setIsMutating(true);
    setMutationError(null);
    try {
      await bridgeRef.current.pauseBatchSession(LOCATION_NODE_TYPE, activeNodeId);
      // Status will refresh via batch progress polling/subscription.
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setMutationError(message);
      console.warn('[LocationBuildStep] pause failed', error);
    } finally {
      setIsMutating(false);
    }
  }, [activeNodeId, isMutating]);

  useEffect(() => {
    if (!heapEvent) return;
    setHeapDialogOpen(true);
  }, [heapEvent]);

  useEffect(() => {
    if (!nodeId) return;
    return subscribeIdeGsmProgress(nodeId as NodeId, setIdeGsmProgress);
  }, [nodeId]);

  useEffect(() => {
    if (buildStatus !== 'running') {
      heapPauseRef.current = null;
      return;
    }
    if (!heapEvent) return;
    if (!activeNodeId) return;
    const eventKey = `${activeNodeId}:${heapEvent.source}:${heapEvent.timestamp}`;
    if (heapPauseRef.current === eventKey) return;
    heapPauseRef.current = eventKey;
    const pauseAndWarn = async () => {
      await handlePause();
      setHeapDialogOpen(true);
    };
    void pauseAndWarn();
  }, [activeNodeId, buildStatus, handlePause, heapEvent]);

  const handleResume = useCallback(async () => {
    if (!activeNodeId || isMutating) return;
    setIsMutating(true);
    setMutationError(null);
    try {
      await bridgeRef.current.resumeBatchSession(LOCATION_NODE_TYPE, activeNodeId);
      // Status will refresh via batch progress polling/subscription.
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setMutationError(message);
      console.warn('[LocationBuildStep] resume failed', error);
    } finally {
      setIsMutating(false);
    }
  }, [activeNodeId, isMutating]);

  const total = ideGsmActive
    ? (ideGsmProgress?.total ?? 0)
    : (unifiedProgress?.total ?? progress?.total ?? 0);
  const completed = ideGsmActive
    ? (ideGsmProgress?.processed ?? 0)
    : (unifiedProgress?.completed ?? progress?.completed ?? 0);
  const failed = ideGsmActive
    ? 0
    : (unifiedProgress?.failed ?? progress?.failed ?? 0);
  const currentTask = ideGsmProgress
    ? resolveIdeGsmTaskLabel(t, ideGsmProgress)
    : (unifiedProgress?.currentTask ?? progress?.currentTask ?? normalizedStage ?? '');

  const hasPrerequisites = Boolean(nodeId && draft.dataSource);
  const statusLabel = t('build.statusLabel', 'Build status');
  const statusText = buildStatus === 'idle'
    ? t('build.status.idle', 'Waiting for build start.')
    : buildStatus === 'paused'
      ? t('build.status.paused', 'Build paused.')
      : buildStatus === 'completed'
        ? t('build.status.completed', 'Build completed.')
        : buildStatus === 'failed'
          ? t('build.status.failed', 'Build failed.')
          : t('build.status.running', 'Build in progress.');

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Box>
        <Typography variant="h6" gutterBottom>
          {t('build.title', 'Build vector tiles')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {hasPrerequisites
            ? t(
              'build.description',
              'Review progress and control the build. Use the footer Build button to start when prerequisites are met.'
            )
            : t('build.prereq', 'Select a data source and complete previous steps before building.')}
        </Typography>
      </Box>

      {mutationError ? (
        <Alert severity="warning">
          {t('build.mutationError', 'Build control failed: {{message}}').replace('{{message}}', mutationError)}
        </Alert>
      ) : null}

      <BuildStepPanel
        status={buildStatus}
        overallProgress={ideGsmActive ? ideGsmOverallProgress : overallProgress}
        stages={stages}
        stageProgress={stageProgress}
        splitViewBreakpoints={SPLITVIEW_BREAKPOINTS}
        splitViewInitialSizesByBreakpoint={splitViewInitialSizes}
        splitViewAutoCloseCountsByBreakpoint={splitViewAutoCloseCounts}
        onPause={activeNodeId ? handlePause : undefined}
        onResume={activeNodeId ? handleResume : undefined}
        statusLabel={statusLabel}
        statusContent={(
          <Stack spacing={0.5}>
            <Typography variant="body2">{statusText}</Typography>
            {currentTask ? (
              <Typography variant="caption" color="text.secondary">
                {t('build.currentTask', 'Current task: {{task}}').replace('{{task}}', currentTask)}
              </Typography>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              {t('build.progressSummary', '{{completed}} / {{total}} (failed: {{failed}})')
                .replace('{{completed}}', String(completed))
                .replace('{{total}}', String(total))
                .replace('{{failed}}', String(failed))}
            </Typography>
          </Stack>
        )}
        pauseLabel={t('build.pauseLabel', 'Pause')}
        resumeLabel={t('build.resumeLabel', 'Resume')}
        startLabel={t('build.startLabel', 'Start')}
        controlLabel={t('build.controlsLabel', 'Build controls')}
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
    </Box>
  );
};
