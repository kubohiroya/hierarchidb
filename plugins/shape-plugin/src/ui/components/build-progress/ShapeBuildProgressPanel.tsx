import { useMemo } from 'react';
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
import type { NodeId } from '@hierarchidb/common-types';
import { BuildStepPanel } from '@hierarchidb/components';
import type { TaskWithMetadata } from './TaskListVirtualized.tsx';
import { TaskProgressSummaryCard } from './TaskProgressSummaryCard.tsx';
import { TaskProgressBar } from './TaskProgressBar.tsx';
import type { ShapeEntity } from '../../../common/types/ShapeEntity.ts';
import { ShapeBuildProgressStageContent } from './ShapeBuildProgressStageContent.js';
import { useBuildProgressPanelState } from './useBuildProgressPanelState.ts';

export const ShapeBuildProgressPanel = ({ data, nodeId }: { data?: Partial<ShapeEntity>; nodeId?: NodeId }) => {
  const {
    t,
    stages,
    stageProgress,
    paneProgress,
    isTasksLoading,
    isTaskSummaryLoading,
    tasksByStage,
    summary,
    controls,
    warningMessage,
    activeStageId,
    startWarning,
    crashHint,
    warningDialogOpen,
    setWarningDialogOpen,
    crashHintOpen,
    setCrashHintOpen,
    sizeWarningOpen,
    setSizeWarningOpen,
    completionDialogOpen,
    setCompletionDialogOpen,
    completionSnapshot,
    completionStageLabel,
    completionTaskTitle,
    completionTaskMessage,
    completionReason,
    resolveTaskTitle,
    resolveStatusLabel,
    resolveStatusColor,
    controlDetails,
    resolveStageValue,
    stageConcurrencyIndicators,
    handleStartClick,
    handleConfirmStart,
  } = useBuildProgressPanelState({ data, nodeId });

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
    t,
    tasksByStage,
    isTasksLoading,
    isTaskSummaryLoading,
  ]);

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
              resolveTaskTitle={resolveTaskTitle as (task: TaskWithMetadata) => string}
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
