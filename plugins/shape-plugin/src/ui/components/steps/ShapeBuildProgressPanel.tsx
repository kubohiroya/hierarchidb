import { useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
  Alert,
} from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { useAtomValue } from 'jotai';
import type { NodeId } from '@hierarchidb/common-types';
import { BuildStepPanel, type BuildStage } from '@hierarchidb/components';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { useTranslation } from '../../i18n.js';
import { useBuildCrashInsight } from '../../hooks/useBuildCrashInsight.js';
import { useBuildStages } from '../../hooks/stage/useBuildStages.js';
import { useShapeBuildProgressWarnings } from '../../hooks/useShapeBuildProgressWarnings.js';
import {
  shapeBuildPaneProgressAtom,
  shapeBuildProgressControlsAtom,
  shapeBuildProgressSummaryAtom,
  shapeBuildTaskSummaryLoadingAtom,
  shapeBuildTasksLoadingAtom,
  shapeBuildWarningMessageAtom,
  shapeBuildStageProgressAtom,
  shapeBuildStagesAtom,
  shapeBuildTasksByStageAtom,
  type ShapeBuildProgressSummary,
} from '../../state/shapeBuildProgressAtoms.js';
import {
  TaskListVirtualized,
  type TaskWithMetadata,
  sortVectorTileTasks,
} from './ShapeBuildProgressTaskList.js';
import { BatchProgressSummaryCard } from './BatchProgressSummaryCard.tsx';

type ShapeBuildProgressPanelProps = Pick<ShapeDialogStepProps, 'data' | 'nodeId'>;
type Translate = ReturnType<typeof useTranslation>['t'];
type StageFilter = { failedMode: boolean; completedMode: boolean };
type StatusColor = 'default' | 'success' | 'error' | 'warning' | 'info';

type ProgressStageContentProps = {
  stage: BuildStage;
  stageValue: number;
  filter: StageFilter;
  tasksByStage: Record<string, TaskWithMetadata[]>;
  paneProgress: Array<{ paneId: string; taskCount?: number }>;
  isTasksLoading: boolean;
  isTaskSummaryLoading: boolean;
  buildStatus: ShapeBuildProgressSummary['buildStatus'];
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (statusValue?: string, skipped?: boolean) => StatusColor;
  resolveTaskTitle: (task: TaskWithMetadata) => string;
  t: Translate;
};

const ProgressStageContent = ({
  stage,
  stageValue,
  filter,
  tasksByStage,
  paneProgress,
  isTasksLoading,
  isTaskSummaryLoading,
  buildStatus,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  t,
}: ProgressStageContentProps) => {
  const stageTasks = tasksByStage[stage.id] ?? [];
  const filteredTasks = stageTasks.filter((task) => {
    if (task.status === 'failed') return filter.failedMode;
    if (task.status === 'completed') return filter.completedMode;
    return true;
  });
  const displayTasks = stage.id === 'vt'
    ? sortVectorTileTasks(filteredTasks)
    : filteredTasks;
  const hasTasks = filteredTasks.length > 0;
  const stagePane = paneProgress.find((entry) => entry.paneId === stage.id);
  const hasSummaryTasks = (stagePane?.taskCount ?? 0) > 0;
  const isBuildRunning = buildStatus === 'running';
  const showSummarySkeleton = isBuildRunning && isTaskSummaryLoading && !hasTasks && !hasSummaryTasks;
  const showTaskSkeleton = isBuildRunning && !hasTasks && !showSummarySkeleton && (isTasksLoading || hasSummaryTasks);

  return (
    <Stack spacing={1} sx={{ p: 2, height: '100%', minHeight: 0 }}>
      {showSummarySkeleton ? (
        <>
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="rounded" height={88} />
        </>
      ) : showTaskSkeleton ? (
        <>
          <Typography variant="subtitle2">{stage.title}</Typography>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="rounded" height={160} />
        </>
      ) : !hasTasks ? (
        <>
          <Typography variant="subtitle2">{stage.title}</Typography>
          {stage.description ? (
            <Typography variant="body2" color="text.secondary">
              {stage.description}
            </Typography>
          ) : null}
          <Typography variant="caption" color="text.secondary">
            {hasSummaryTasks
              ? t('stage.tasks.summaryOnly', 'Tasks are summarized. Detailed list is unavailable.')
              : t('stage.tasks.empty', 'No tasks yet.')}
          </Typography>
        </>
      ) : (
        <TaskListVirtualized
          tasks={displayTasks}
          stageValue={stageValue}
          resolveStatusLabel={resolveStatusLabel}
          resolveStatusColor={resolveStatusColor}
          resolveTaskTitle={resolveTaskTitle}
        />
      )}
    </Stack>
  );
};

const normalizeStageId = (stage?: string): 'fetch' | 'transform' | 'vt' | undefined => {
  if (!stage) return undefined;
  switch (stage) {
    case 'download':
    case 'shape-fetch':
    case 'fetch':
      return 'fetch';
    case 'extract1':
    case 'extract2':
    case 'transform':
      return 'transform';
    case 'vectortile':
    case 'vectorTiles':
    case 'vt':
      return 'vt';
    default:
      return undefined;
  }
};

export const ShapeBuildProgressPanel = ({ data, nodeId }: ShapeBuildProgressPanelProps) => {
  const resolvedNodeId = nodeId as NodeId | undefined;
  const { t } = useTranslation();
  const stages = useAtomValue(shapeBuildStagesAtom);
  const fallbackStages = useBuildStages();
  const effectiveStages = stages.length > 0 ? stages : fallbackStages;
  const stageProgress = useAtomValue(shapeBuildStageProgressAtom);
  const paneProgress = useAtomValue(shapeBuildPaneProgressAtom);
  const isTasksLoading = useAtomValue(shapeBuildTasksLoadingAtom);
  const isTaskSummaryLoading = useAtomValue(shapeBuildTaskSummaryLoadingAtom);
  const tasksByStage = useAtomValue(shapeBuildTasksByStageAtom);
  const summary = useAtomValue(shapeBuildProgressSummaryAtom);
  const controls = useAtomValue(shapeBuildProgressControlsAtom);
  const warningMessage = useAtomValue(shapeBuildWarningMessageAtom);
  const crashInsight = useBuildCrashInsight({
    draft: data,
    nodeId: resolvedNodeId ? String(resolvedNodeId) : undefined,
  });
  const isDev = import.meta.env.DEV;
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
    stages: effectiveStages,
    warningMessage,
    isDev,
    t,
    normalizeStageId,
  });

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

  const renderStageContent = useCallback((stage: BuildStage, stageValue: number, filter: StageFilter) => (
    <ProgressStageContent
      stage={stage}
      stageValue={stageValue}
      filter={filter}
      tasksByStage={tasksByStage}
      paneProgress={paneProgress ?? []}
      isTasksLoading={isTasksLoading}
      isTaskSummaryLoading={isTaskSummaryLoading}
      buildStatus={summary.buildStatus}
      resolveStatusLabel={resolveStatusLabel}
      resolveStatusColor={resolveStatusColor}
      resolveTaskTitle={resolveTaskTitle}
      t={t}
    />
  ), [
    isTaskSummaryLoading,
    isTasksLoading,
    paneProgress,
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
          stages={effectiveStages}
          stageProgress={stageProgress}
          paneProgress={paneProgress}
          splitViewBreakpoints={[600, 900, 1200]}
          splitViewInitialSizesByBreakpoint={[
            Array.from({ length: effectiveStages.length }, () => 250),
            Array.from({ length: effectiveStages.length }, () => 250),
            Array.from({ length: effectiveStages.length }, () => 250),
            Array.from({ length: effectiveStages.length }, () => 250),
          ]}
          splitViewAutoCloseCountsByBreakpoint={[
            Math.max(0, effectiveStages.length - 1),
            Math.max(0, effectiveStages.length - 2),
            Math.max(0, effectiveStages.length - 3),
            0,
          ]}
          renderStageContent={renderStageContent}
          statusContent={summary.hasProgressData ? (
            <BatchProgressSummaryCard
              summary={summary}
              stages={effectiveStages}
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
