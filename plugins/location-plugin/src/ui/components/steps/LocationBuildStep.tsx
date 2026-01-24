import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { type BuildStatus, type BuildStage, BuildStepPanel } from '@hierarchidb/components';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { getWorkerBridge, type WorkerBridge } from '@hierarchidb/ui-worker-client';
import { HeapPressureDialog, useHeapPressureGuard } from '@hierarchidb/ui-memory';
import type { IdeGsmImportProgress } from '@hierarchidb/plugin-service-api';
import type { LocationEntity } from '../../../common/types/index.js';
import { useTranslation } from '../../../common/i18n/index.js';
import { useLocationProgress } from '../../../common/hooks/useLocationProgress.js';
import { subscribeIdeGsmProgress } from '../../state/ideGsmProgress.js';
import { CloudDownload, Layers, Tune } from '@mui/icons-material';

type Props = {
  nodeId: NodeId;
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
      return t('stage.ideGsm.fetch', 'IDE-GSM: downloading');
    case 'parse':
      return t('stage.ideGsm.parse', 'IDE-GSM: parsing rows');
    case 'filter':
      return t('stage.ideGsm.filter', 'IDE-GSM: filtering rows');
    case 'save':
      return t('stage.ideGsm.save', 'IDE-GSM: saving locations');
    case 'completed':
      return t('stage.ideGsm.completed', 'IDE-GSM: import completed');
    case 'failed':
      return t('stage.ideGsm.failed', 'IDE-GSM: import failed');
    default:
      return 'IDE-GSM';
  }
};

export const LocationBuildStep: React.FC<Props> = ({ nodeId, draft, onUpdate: _onUpdate }) => {
  const { t, translations } = useTranslation();
  const stageLabels = translations.batch?.stages ?? {};
  const stages = useMemo<Array<BuildStage & { description: string }>>(() => ([
    {
      icon: <CloudDownload/>,
      id: 'fetch',
      title: stageLabels.download ?? t('stage.stages.download', 'Download'),
      description: t('stage.stageDescriptions.download', 'Download points and metadata.'),
    },
    {
      icon: <Tune/>,
      id: 'transform',
      title: stageLabels.filtering ?? t('stage.stages.filter', 'Filter'),
      description: t('stage.stageDescriptions.filter', 'Normalize and filter the source data.'),
    },
    {
      icon: <Layers/>,
      id: 'vt',
      title: stageLabels.indexing ?? t('stage.stages.index', 'Index'),
      description: t('stage.stageDescriptions.index', 'Generate vector tiles for previews.'),
    },
  ]), [stageLabels.download, stageLabels.filtering, stageLabels.indexing, t]);
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
  const activeNodeId = nodeId;
  const bridgeRef = useRef<WorkerBridge>(getWorkerBridge());
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [heapDialogOpen, setHeapDialogOpen] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionSnapshot, setCompletionSnapshot] = useState<{
    status: BuildStatus;
    stageLabel: string;
    taskTitle?: string;
    taskMessage?: string;
    reason?: string;
  } | null>(null);
  const heapPauseRef = useRef<string | null>(null);
  const [ideGsmProgress, setIdeGsmProgress] = useState<IdeGsmImportProgress | null>(null);
  const { progress, unifiedProgress } = useLocationProgress(activeNodeId, { autoSubscribe: true });
  const completionStatusRef = useRef<BuildStatus | null>(null);

  useEffect(() => {
    if (!activeNodeId) return;
    void bridgeRef.current.initialize().catch((error: unknown) => {
      console.warn('[LocationBuildStep] failed to initialize worker bridge', error);
    });
  }, [activeNodeId]);

  const phase = unifiedProgress?.phase ?? progress?.taskType;
  const baseStatus = mapStatusToBuildStatus(
    typeof phase === 'string' ? phase : undefined,
    progress?.taskType,
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

  const normalizedStage = unifiedProgress?.stage ?? progress?.taskType;
  const completionStageLabel = useMemo(() => {
    if (ideGsmProgress) return resolveIdeGsmTaskLabel(t, ideGsmProgress);
    const normalized = typeof normalizedStage === 'string' ? normalizedStage : undefined;
    const stageMatch = stages.find((stage) => normalized && normalized.includes(stage.id));
    return stageMatch?.title ?? normalized ?? t('stage.progress.unknownStage', 'Unknown stage');
  }, [ideGsmProgress, normalizedStage, stages, t]);
  const completionTaskTitle = useMemo(() => {
    const title = ideGsmProgress
      ? resolveIdeGsmTaskLabel(t, ideGsmProgress)
      : completionStageLabel;
    return title?.trim() ? title : t('stage.tasks.unknown', '(Task unavailable)');
  }, [completionStageLabel, ideGsmProgress, t]);
  const completionTaskMessage = useMemo(() => {
    return unifiedProgress?.message
      ?? progress?.message
      ?? t('stage.progress.failedReason', 'Build failed due to task errors.');
  }, [progress?.message, t, unifiedProgress?.message]);
  const completionReason = useMemo(() => {
    if (buildStatus === 'failed') {
      return unifiedProgress?.message ?? progress?.message ?? t('stage.progress.failedReason', 'Build failed due to task errors.');
    }
    if (buildStatus === 'completed') {
      return t('stage.progress.completedReason', 'All tasks completed.');
    }
    return t('stage.progress.endedReason', 'Build ended.');
  }, [buildStatus, progress?.message, t, unifiedProgress?.message]);
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
    if (completionStatusRef.current === null) {
      completionStatusRef.current = buildStatus;
      return;
    }
    if (buildStatus === completionStatusRef.current) return;
    completionStatusRef.current = buildStatus;
    if (buildStatus === 'completed') {
      setCompletionSnapshot({
        status: buildStatus,
        stageLabel: completionStageLabel,
        reason: completionReason,
      });
      setCompletionDialogOpen(true);
      return;
    }
    if (buildStatus === 'failed') {
      setCompletionSnapshot({
        status: buildStatus,
        stageLabel: completionStageLabel,
        taskTitle: completionTaskTitle,
        taskMessage: completionTaskMessage,
      });
      setCompletionDialogOpen(true);
    }
  }, [
    buildStatus,
    completionReason,
    completionStageLabel,
    completionTaskMessage,
    completionTaskTitle,
  ]);

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
  const taskLabel = ideGsmProgress
    ? resolveIdeGsmTaskLabel(t, ideGsmProgress)
    : (unifiedProgress?.message ?? progress?.message ?? normalizedStage ?? '');

  const hasPrerequisites = Boolean(nodeId && draft.dataSource);
  const statusLabel = t('stage.statusLabel', 'Build status');
  const statusText = buildStatus === 'idle'
    ? t('stage.status.idle', 'Waiting for stage start.')
    : buildStatus === 'paused'
      ? t('stage.status.paused', 'Build paused.')
      : buildStatus === 'completed'
        ? t('stage.status.completed', 'Build completed.')
        : buildStatus === 'failed'
          ? t('stage.status.failed', 'Build failed.')
          : t('stage.status.running', 'Build in progress.');

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Box>
        <Typography variant="h6" gutterBottom>
          {t('stage.title', 'Build vector tiles')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {hasPrerequisites
            ? t(
              'stage.description',
              'Review progress and control the stage. Use the footer Build button to start when prerequisites are met.'
            )
            : t('stage.prereq', 'Select a data source and complete previous steps before building.')}
        </Typography>
      </Box>

      {mutationError ? (
        <Alert severity="warning">
          {t('stage.mutationError', 'Build control failed: {{message}}').replace('{{message}}', mutationError)}
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
            {taskLabel ? (
              <Typography variant="caption" color="text.secondary">
                {t('stage.currentTask', 'Current task: {{task}}').replace('{{task}}', taskLabel)}
              </Typography>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              {t('stage.progressSummary', '{{completed}} / {{total}} (failed: {{failed}})')
                .replace('{{completed}}', String(completed))
                .replace('{{total}}', String(total))
                .replace('{{failed}}', String(failed))}
            </Typography>
          </Stack>
        )}
        pauseLabel={t('stage.pauseLabel', 'Pause')}
        resumeLabel={t('stage.resumeLabel', 'Resume')}
        startLabel={t('stage.startLabel', 'Start')}
        controlLabel={t('stage.controlsLabel', 'Build controls')}
      />
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
    </Box>
  );
};
