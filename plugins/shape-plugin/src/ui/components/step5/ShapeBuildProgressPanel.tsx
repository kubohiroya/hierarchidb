import { useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Typography,
  Alert,
} from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { useAtomValue } from 'jotai';
import type { NodeId } from '@hierarchidb/common-types';
import { BuildStepPanel } from '@hierarchidb/components';
import { useTranslation } from '../../i18n.js';
import { useBuildCrashInsight } from './useBuildCrashInsight.js';
import { useBuildStages } from './useBuildStages.js';
import { useShapeBuildProgressWarnings } from '../../hooks/useShapeBuildProgressWarnings.js';
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
import type { ShapeEntity } from '../../../common/types/ShapeEntity.ts';
import { ShapeBuildProgressStageContent } from './ShapeBuildProgressStageContent.js';

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

export const ShapeBuildProgressPanel = ({ data, nodeId }: { data?: Partial<ShapeEntity>; nodeId?: NodeId }) => {
  const resolvedNodeId = nodeId as NodeId | undefined;
  const { t } = useTranslation();
  const stages = useAtomValue(buildStagesAtom);
  const fallbackStages = useBuildStages();
  const effectiveStages = stages.length > 0 ? stages : fallbackStages;
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

  const resolveStageValue = useCallback((stageId: string): number => (
    Math.min(100, Math.max(0, stageProgress[stageId] ?? summary.overallProgress))
  ), [stageProgress, summary.overallProgress]);

  const stageContents = useMemo(() => (
    effectiveStages.reduce<Record<string, JSX.Element>>((acc, stage) => {
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
        />
      );
      return acc;
    }, {})
  ), [
    effectiveStages,
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
          stageContents={stageContents}
          statusContent={summary.hasProgressData ? (
            <TaskProgressSummaryCard
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
