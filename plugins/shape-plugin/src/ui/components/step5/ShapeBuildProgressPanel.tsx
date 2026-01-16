import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Snackbar,
  Stack,
  Typography,
  Alert,
} from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { useAtomValue } from 'jotai';
import type { NodeId } from '@hierarchidb/common-types';
import { BuildStepPanel } from '@hierarchidb/components';
import { useTranslation } from '../../i18n.js';
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
import { ShapeBuildProgressStageContent } from './ShapeBuildProgressStageContent.js';

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
  const crashInsight = useBuildCrashInsight({
    draft: data,
    nodeId: resolvedNodeId ? String(resolvedNodeId) : undefined,
  });
  const isDev = import.meta.env.DEV;
  const lastTaskStageSnapshotRef = useRef<string | null>(null);
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
  }, [isDev, stages, tasksByStage]);

  const resolveTaskTitle = useCallback(
    (task: TaskWithMetadata): string =>
      task.title ?? t('stage.tasks.unknown', '(Title unavailable)'),
    [t],
  );

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
      const isStageRunning = summary.buildStatus === 'running'
        && stageTasks.some((task) => task.status === 'running');
      acc[stage.id] = (
        <Stack gap={1}>
          <TaskProgressBar
            stages={[stage]}
            tasksByStage={{ [stage.id]: stageTasks }}
            buildStatus={summary.buildStatus}
          />
          <LinearProgress
            variant="indeterminate"
            sx={{
              height: 6,
              borderRadius: 6,
              visibility: isStageRunning ? 'visible' : 'hidden',
            }}
          />
        </Stack>
      );
      return acc;
    }, {})
  ), [stages, tasksByStage, summary.buildStatus]);

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
          buildStatus={summary.buildStatus}
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
    isTaskSummaryLoading,
    isTasksLoading,
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
