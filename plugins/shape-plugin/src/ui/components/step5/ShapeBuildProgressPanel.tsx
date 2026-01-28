import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  Typography,
  Alert,
} from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { useAtomValue } from 'jotai';
import type { NodeId } from '@hierarchidb/common-types';
import { BuildStepPanel, type BuildStatus } from '@hierarchidb/components';
import { useTranslation } from '../../i18n.js';
import { resolveShapeTaskTitle } from '../../../common/utils/taskTitles.ts';
import { useBuildCrashInsight } from './useBuildCrashInsight.js';
import { useShapeBuildProgressWarnings } from './useShapeBuildProgressWarnings.js';
import {
  taskPaneProgressAtom,
  taskProgressControlsAtom,
  taskProgressSummaryAtom,
  taskSummaryLoadingAtom,
  tasksLoadingAtom,
  taskWarningMessageAtom,
  buildStageProgressAtom,
  buildStagesAtom,
  tasksByStageAtom,
} from '../../atoms/shapeBuildProgressAtoms.js';
import type { TaskWithMetadata } from './TaskListVirtualized.tsx';
import { TaskProgressSummaryCard } from './TaskProgressSummaryCard.tsx';
import { TaskProgressBar } from './TaskProgressBar.tsx';
import type { ShapeEntity } from '../../../common/types/ShapeEntity.ts';
import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.ts';
import { ShapeBuildProgressStageContent } from './ShapeBuildProgressStageContent.js';

const isDev = import.meta.env.DEV;

export const ShapeBuildProgressPanel = ({ data, nodeId }: { data?: Partial<ShapeEntity>; nodeId?: NodeId }) => {
  const resolvedNodeId = nodeId as NodeId | undefined;
  const { t } = useTranslation();
  const stages = useAtomValue(buildStagesAtom);
  const stageProgress = useAtomValue(buildStageProgressAtom);
  const paneProgress = useAtomValue(taskPaneProgressAtom);
  const isTasksLoading = useAtomValue(tasksLoadingAtom);
  const isTaskSummaryLoading = useAtomValue(taskSummaryLoadingAtom);
  const tasksByStage = useAtomValue(tasksByStageAtom);
  const summary = useAtomValue(taskProgressSummaryAtom);
  const controls = useAtomValue(taskProgressControlsAtom);
  const warningMessage = useAtomValue(taskWarningMessageAtom);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionSnapshot, setCompletionSnapshot] = useState<{
    status: BuildStatus;
    stageLabel: string;
    taskTitle?: string;
    taskMessage?: string;
    reason?: string;
  } | null>(null);
  const completionKeyRef = useRef<string | null>(null);
  const crashInsight = useBuildCrashInsight({
    draft: data,
    nodeId: resolvedNodeId ? String(resolvedNodeId) : undefined,
  });
  const lastTaskStageSnapshotRef = useRef<string | null>(null);
  const activeStageId = useMemo(() => {
    if (summary.buildStatus !== 'running') return null;
    for (const stage of stages) {
      const stageTasks = tasksByStage[stage.id] ?? [];
      if (stageTasks.some((task) => task.status === 'running')) {
        return stage.id;
      }
    }
    return null;
  }, [stages, summary.buildStatus, tasksByStage]);
  const {
    startWarning,
    crashHint,
    warningDialogOpen,
    setWarningDialogOpen,
    crashHintOpen,
    setCrashHintOpen,
    sizeWarningOpen,
    setSizeWarningOpen,
  } = useShapeBuildProgressWarnings({
    crashInsight,
    data,
    stages,
    warningMessage,
    isDev,
    t
  });

  useEffect(() => {
    if (!isDev) return;
    const snapshot = JSON.stringify({
      stages: stages.map((stage) => stage.id),
      keys: Object.keys(tasksByStage),
      counts: Object.fromEntries(Object.entries(tasksByStage).map(([stageId, tasks]) => ([
        stageId,
        {
          total: tasks.length,
          completed: tasks.filter((task) => task.status === 'completed').length,
          failed: tasks.filter((task) => task.status === 'failed').length,
          running: tasks.filter((task) => task.status === 'running').length,
          queued: tasks.filter((task) => task.status === 'queued').length,
          paused: tasks.filter((task) => task.status === 'paused').length,
          regression: tasks.filter((task) => task.status === 'regression').length,
        },
      ]))),
    });
    if (snapshot === lastTaskStageSnapshotRef.current) return;
    lastTaskStageSnapshotRef.current = snapshot;
    console.debug('[ShapeBuildStep] stageTaskSnapshot', JSON.parse(snapshot));
  }, [stages, tasksByStage]);

  const resolveTaskTitle = useCallback(
    (task: TaskWithMetadata): string =>
      resolveShapeTaskTitle(task, t('stage.tasks.unknown', '(Title unavailable)')),
    [t],
  );
  const resolveFailureMessage = useCallback((task: ShapeBuildTaskSummary): string | null => {
    const message = typeof task.message === 'string' ? task.message.trim() : '';
    const errorMessage = typeof task.errorMessage === 'string' ? task.errorMessage.trim() : '';
    const error = typeof task.error === 'string' ? task.error.trim() : '';
    const fallback = errorMessage || error;
    const normalized = message.toLowerCase();
    const isGeneric = !message
      || normalized === 'failed'
      || normalized === 'stage task failed'
      || normalized.startsWith('phase=');
    if (fallback && isGeneric) return fallback;
    if (message) return message;
    return fallback || null;
  }, []);
  const failedTaskInfo = useMemo(() => {
    const failedStatuses = new Set(['failed', 'regression']);
    for (const stage of stages) {
      const stageTasks = tasksByStage[stage.id] ?? [];
      const failedTask = stageTasks.find((task) => failedStatuses.has(task.status));
      if (!failedTask) continue;
      const failureMessage = resolveFailureMessage(failedTask);
      if (!failureMessage) continue;
      return {
        title: resolveTaskTitle(failedTask as TaskWithMetadata),
        message: failureMessage,
      };
    }
    return null;
  }, [resolveFailureMessage, resolveTaskTitle, stages, tasksByStage]);

  const completionStageLabel = summary.stageLabel?.trim()
    ? summary.stageLabel
    : t('stage.progress.unknownStage', 'Unknown stage');
  const finalStage = stages[stages.length - 1];
  const finalStageLabel = finalStage?.title ?? finalStage?.id ?? completionStageLabel;
  const isFinalStageLabel = finalStage
    ? completionStageLabel === finalStage.title || completionStageLabel === finalStage.id
    : true;
  const completionTaskTitle = failedTaskInfo?.title
    ?? t('stage.tasks.unknown', '(Task unavailable)');
  const completionTaskMessage = failedTaskInfo?.message
    ?? t('stage.progress.failedReason', 'Build failed due to task errors.');
  const completionReason = (() => {
    if (summary.buildStatus === 'failed') {
      const candidate = summary.taskLabel?.trim();
      if (candidate && candidate.toLowerCase() !== 'failed') return candidate;
      return t('stage.progress.failedReason', 'Build failed due to task errors.');
    }
    if (summary.buildStatus === 'completed') {
      return t('stage.progress.completedReason', 'All tasks completed.');
    }
    return t('stage.progress.endedReason', 'Build ended.');
  })();

  useEffect(() => {
    if (summary.buildStatus === 'completed') {
      if (!isFinalStageLabel) return;
      const key = `${summary.buildStatus}:${completionStageLabel}`;
      if (completionKeyRef.current === key) return;
      completionKeyRef.current = key;
      setCompletionSnapshot({
        status: summary.buildStatus,
        stageLabel: finalStageLabel,
        reason: completionReason,
      });
      setCompletionDialogOpen(true);
      return;
    }
    if (summary.buildStatus === 'failed') {
      if (!failedTaskInfo?.message) {
        return;
      }
      const key = `${summary.buildStatus}:${completionStageLabel}:${completionTaskTitle ?? ''}:${completionTaskMessage ?? ''}`;
      if (completionKeyRef.current === key) return;
      completionKeyRef.current = key;
      setCompletionSnapshot({
        status: summary.buildStatus,
        stageLabel: completionStageLabel,
        taskTitle: completionTaskTitle,
        taskMessage: completionTaskMessage,
      });
      setCompletionDialogOpen(true);
      return;
    }
    completionKeyRef.current = null;
  }, [
    completionReason,
    completionStageLabel,
    completionTaskMessage,
    completionTaskTitle,
    failedTaskInfo?.message,
    finalStageLabel,
    isFinalStageLabel,
    summary.buildStatus,
  ]);

  const resolveStatusLabel = useCallback((statusValue?: string, skipped?: boolean): string => {
    if (skipped) {
      return t('stage.taskStatus.skipped', 'Skipped');
    }
    switch (statusValue) {
      case 'running':
        return t('stage.taskStatus.running', 'Running');
      case 'completed':
        return t('stage.taskStatus.completed', 'Completed');
      case 'failed':
        return t('stage.taskStatus.failed', 'Failed');
      case 'regression':
        return t('stage.taskStatus.regression', 'Regression');
      case 'paused':
        return t('stage.taskStatus.paused', 'Paused');
      case 'queued':
        return t('stage.taskStatus.queued', 'Queued');
      default:
        return t('stage.taskStatus.waiting', 'Waiting');
    }
  }, [t]);

  const resolveStatusColor = useCallback((statusValue?: string, skipped?: boolean) => {
    if (skipped) {
      return 'warning';
    }
    switch (statusValue) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'regression':
        return 'warning';
      case 'paused':
        return 'warning';
      case 'running':
        return 'info';
      default:
        return 'default';
    }
  }, []);

  const formatDuration = useCallback((durationMs?: number | null) => {
    if (durationMs == null || durationMs < 0 || !Number.isFinite(durationMs)) {
      return t('stage.timing.unknown', '-');
    }
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return t('stage.timing.duration', '{{hours}}h {{minutes}}m {{seconds}}s', {
      hours,
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
    });
  }, [t]);

  const formatElapsedDuration = useCallback((durationMs?: number | null) => {
    if (durationMs == null || durationMs <= 0 || !Number.isFinite(durationMs)) {
      return t('stage.timing.unknown', '-');
    }
    return formatDuration(durationMs);
  }, [formatDuration, t]);

  const controlDetails = useMemo(() => {
    const isBuildStarted = summary.buildStatus !== 'idle';
    const emptyValue = t('stage.timing.unknown', '-');
    return [
      {
        label: t('stage.timing.totalElapsed', 'Total elapsed'),
        value: isBuildStarted ? formatElapsedDuration(summary.totalElapsedMs) : emptyValue,
      },
      {
        label: t('stage.timing.stageElapsed', 'Stage elapsed'),
        value: isBuildStarted ? formatElapsedDuration(summary.stageElapsedMs) : emptyValue,
      },
      {
        label: t('stage.timing.stageRemaining', 'Stage remaining (estimate)'),
        value: formatDuration(summary.stageRemainingMs ?? null),
      },
    ];
  }, [formatDuration, formatElapsedDuration, summary.buildStatus, summary.stageElapsedMs, summary.stageRemainingMs, summary.totalElapsedMs, t]);

  const resolveStageValue = useCallback((stageId: string): number => (
    Math.min(100, Math.max(0, stageProgress[stageId] ?? summary.overallProgress))
  ), [stageProgress, summary.overallProgress]);

  const stageConcurrencyIndicators = useMemo(() => {
    const buildConfig = data?.buildConfig;
    if (!buildConfig) return undefined;
    return stages.reduce<Record<string, { maxConcurrent: number; isRunning: boolean }>>((acc, stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      const isStageRunning = summary.buildStatus === 'running'
        && stageTasks.some((task) => task.status === 'running');
      const maxConcurrent = (() => {
        switch (stage.id) {
          case 'fetch':
            return buildConfig.fetchConfig.maxConcurrent;
          case 'transform':
            return buildConfig.transformConfig.maxConcurrent;
          case 'vt':
            return buildConfig.vtConfig.maxConcurrent;
          default:
            return undefined;
        }
      })();
      if (maxConcurrent === undefined) return acc;
      acc[stage.id] = { maxConcurrent, isRunning: isStageRunning };
      return acc;
    }, {});
  }, [data?.buildConfig, stages, tasksByStage, summary.buildStatus]);

  const stageProgressContent = useMemo(() => (
    stages.reduce<Record<string, JSX.Element>>((acc, stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      acc[stage.id] = (
        <Stack gap={1}>
          <TaskProgressBar
            stages={[stage]}
            tasksByStage={{ [stage.id]: stageTasks }}
            buildStatus={summary.buildStatus}
            activeStageId={activeStageId}
            resolveTaskTitle={resolveTaskTitle}
          />
        </Stack>
      );
      return acc;
    }, {})
  ), [activeStageId, stages, tasksByStage, summary.buildStatus, resolveTaskTitle]);

  const stageContents = useMemo(() => (
    stages.reduce<Record<string, JSX.Element>>((acc, stage) => {
      acc[stage.id] = (
        <ShapeBuildProgressStageContent
          stage={stage}
          stageValue={resolveStageValue(stage.id)}
          tasksByStage={tasksByStage}
          paneProgress={paneProgress ?? []}
          isTasksLoading={isTasksLoading}
          isTaskSummaryLoading={isTaskSummaryLoading}
          resolveStatusLabel={resolveStatusLabel}
          resolveStatusColor={resolveStatusColor}
          resolveTaskTitle={resolveTaskTitle}
          t={t}
          showHeader={false}
        />
      );
      return acc;
    }, {})
  ), [
    stages,
    paneProgress,
    resolveStageValue,
    resolveStatusColor,
    resolveStatusLabel,
    resolveTaskTitle,
    summary.buildStatus,
    t,
    tasksByStage,
  ]);

  const handleStartClick = useCallback(async () => {
    if (startWarning) {
      setWarningDialogOpen(true);
      return;
    }
    await controls.handleStartOrResume?.();
  }, [controls, setWarningDialogOpen, startWarning]);

  const handleConfirmStart = useCallback(async () => {
    setWarningDialogOpen(false);
    await controls.handleStartOrResume?.();
  }, [controls, setWarningDialogOpen]);

  return (
    <Box display="flex" flexDirection="column" gap={3} height="100%" minHeight={0}>
      <Box flex={1} minHeight={0}>
        <BuildStepPanel
          status={summary.buildStatus}
          overallProgress={summary.overallProgress}
          stages={stages}
          stageProgress={stageProgress}
          paneProgress={paneProgress}
          splitViewBreakpoints={[600, 900, 1200]}
          splitViewInitialSizesByBreakpoint={[
            Array.from({ length: stages.length }, () => 250),
            Array.from({ length: stages.length }, () => 250),
            Array.from({ length: stages.length }, () => 250),
            Array.from({ length: stages.length }, () => 250),
          ]}
          splitViewAutoCloseCountsByBreakpoint={[
            Math.max(0, stages.length - 1),
            Math.max(0, stages.length - 2),
            Math.max(0, stages.length - 3),
            0,
          ]}
          stageContents={stageContents}
          stageProgressContent={stageProgressContent}
          stageConcurrencyIndicators={stageConcurrencyIndicators}
          statusContent={summary.hasProgressData ? (
            <TaskProgressSummaryCard
              summary={summary}
              stages={stages}
              tasksByStage={tasksByStage}
              activeStageId={activeStageId}
              resolveTaskTitle={resolveTaskTitle}
            />
          ) : undefined}
          startIcon={<ConstructionIcon fontSize="small" />}
          onResume={controls.canStartOrResume ? handleStartClick : undefined}
          onPause={controls.handlePause}
          controlLabel={t('stage.controls.title', 'Build controls')}
          pauseLabel={t('stage.controls.pause', 'Pause')}
          startLabel={t('stage.controls.start', 'Start Build')}
          resumeLabel={t('stage.controls.resume', 'Resume Build')}
          statusLabel={controls.statusLabel}
          controlDetails={controlDetails}
        />
      </Box>
      <Snackbar
        open={crashHintOpen}
        autoHideDuration={8000}
        onClose={() => setCrashHintOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity="warning" variant="filled" onClose={() => setCrashHintOpen(false)}>
          {crashHint}
        </Alert>
      </Snackbar>
      <Snackbar
        open={sizeWarningOpen}
        autoHideDuration={8000}
        onClose={() => setSizeWarningOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity="warning" variant="filled" onClose={() => setSizeWarningOpen(false)}>
          {warningMessage}
        </Alert>
      </Snackbar>
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
      {startWarning ? (
        <Dialog open={warningDialogOpen} onClose={() => setWarningDialogOpen(false)}>
          <DialogTitle>{startWarning.title}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              {startWarning.message}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setWarningDialogOpen(false)}>
              {t('stage.warning.cancel', 'Cancel')}
            </Button>
            <Button variant="contained" onClick={handleConfirmStart}>
              {t('stage.warning.proceed', 'Proceed')}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </Box>
  );
};
