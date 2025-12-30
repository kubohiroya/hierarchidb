import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
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
import { useTheme } from '@mui/material/styles';
import ConstructionIcon from '@mui/icons-material/Construction';
import { Provider, useAtomValue, useSetAtom } from 'jotai';
import { createStore } from 'jotai/vanilla';
import { BuildStepPanel, type BuildStage } from '@hierarchidb/components';
import type { BatchTaskSummary } from '@hierarchidb/common-api';
import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { useShapeBuildProgressStep } from '../../hooks/useShapeBuildProgressStep.js';
import { ShapeBuildTaskItem } from './ShapeBuildTaskItem.js';
import { useBuildCrashInsight } from '../../hooks/useBuildCrashInsight.js';
import { getStageConcurrencyWarning } from '../../utils/buildWarnings.js';
import { HeapPressureDialog, useHeapPressureGuard } from '@hierarchidb/ui-memory';
import { AuthProviderDialog } from '@hierarchidb/ui-auth';
import { useTranslation } from '../../i18n.js';
import { useBuildStages } from '../../hooks/build/useBuildStages.js';
import {
  shapeBuildBuildStatusAtom,
  shapeBuildPaneProgressAtom,
  shapeBuildProgressAuthAtom,
  shapeBuildProgressControlsAtom,
  shapeBuildProgressSummaryAtom,
  shapeBuildWarningMessageAtom,
  shapeBuildStageProgressAtom,
  shapeBuildStagesAtom,
  shapeBuildTasksByStageAtom,
} from '../../state/shapeBuildProgressAtoms.js';

type ShapeBuildProgressPanelProps = Pick<ShapeDialogStepProps, 'data' | 'nodeId'>;

type TaskWithMetadata = BatchTaskSummary & { title?: string };

const isSkippedMessage = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized === 'skipped' || normalized.startsWith('skipped:');
};

const ShapeBuildProgressAtomSync: React.FC<ShapeDialogStepProps> = ({ data, onChange, nodeId }) => {
  const resolvedNodeId = nodeId as NodeId | undefined;
  const {
    stages,
    stageProgress,
    paneProgress,
    tasksByStage,
    buildStatus,
    overallProgress,
    stageLabel,
    taskLabel,
    statusLabel,
    completed,
    total,
    failed,
    skipped,
    hasProgressData,
    warningMessage,
    canStartOrResume,
    handleStartOrResume,
    handlePause,
    authDialogOpen,
    closeAuthDialog,
    handleProviderSelect,
  } = useShapeBuildProgressStep({ data, onChange, nodeId: resolvedNodeId });

  const setStages = useSetAtom(shapeBuildStagesAtom);
  const setStageProgress = useSetAtom(shapeBuildStageProgressAtom);
  const setPaneProgress = useSetAtom(shapeBuildPaneProgressAtom);
  const setTasksByStage = useSetAtom(shapeBuildTasksByStageAtom);
  const setBuildStatus = useSetAtom(shapeBuildBuildStatusAtom);
  const setSummary = useSetAtom(shapeBuildProgressSummaryAtom);
  const setWarningMessage = useSetAtom(shapeBuildWarningMessageAtom);
  const setControls = useSetAtom(shapeBuildProgressControlsAtom);
  const setAuth = useSetAtom(shapeBuildProgressAuthAtom);

  useEffect(() => {
    setStages(stages);
  }, [setStages, stages]);

  useEffect(() => {
    setStageProgress(stageProgress);
  }, [setStageProgress, stageProgress]);

  useEffect(() => {
    setPaneProgress(paneProgress ?? []);
  }, [setPaneProgress, paneProgress]);

  useEffect(() => {
    setTasksByStage(tasksByStage);
  }, [setTasksByStage, tasksByStage]);

  useEffect(() => {
    setBuildStatus(buildStatus);
  }, [buildStatus, setBuildStatus]);

  useEffect(() => {
    setSummary({
      stageLabel,
      taskLabel,
      overallProgress,
      completed,
      total,
      failed,
      skipped,
      buildStatus,
      hasProgressData,
    });
  }, [
    buildStatus,
    completed,
    failed,
    hasProgressData,
    overallProgress,
    skipped,
    stageLabel,
    taskLabel,
    total,
    setSummary,
  ]);

  useEffect(() => {
    setWarningMessage(warningMessage ?? null);
  }, [setWarningMessage, warningMessage]);

  useEffect(() => {
    setControls({
      canStartOrResume,
      statusLabel: statusLabel ?? '',
      handleStartOrResume,
      handlePause,
    });
  }, [
    canStartOrResume,
    handlePause,
    handleStartOrResume,
    setControls,
    statusLabel,
  ]);

  useEffect(() => {
    setAuth({
      authDialogOpen: Boolean(authDialogOpen),
      closeAuthDialog: closeAuthDialog ?? (() => {}),
      handleProviderSelect: handleProviderSelect ?? (() => {}),
    });
  }, [authDialogOpen, closeAuthDialog, handleProviderSelect, setAuth]);

  return null;
};

const ShapeBuildProgressPanel: React.FC<ShapeBuildProgressPanelProps> = ({ data, nodeId }) => {
  const resolvedNodeId = nodeId as NodeId | undefined;
  const theme = useTheme();
  const { t } = useTranslation();
  const stages = useAtomValue(shapeBuildStagesAtom);
  const fallbackStages = useBuildStages();
  const effectiveStages = stages.length > 0 ? stages : fallbackStages;
  const stageProgress = useAtomValue(shapeBuildStageProgressAtom);
  const paneProgress = useAtomValue(shapeBuildPaneProgressAtom);
  const tasksByStage = useAtomValue(shapeBuildTasksByStageAtom);
  const summary = useAtomValue(shapeBuildProgressSummaryAtom);
  const controls = useAtomValue(shapeBuildProgressControlsAtom);
  const warningMessage = useAtomValue(shapeBuildWarningMessageAtom);
  const crashInsight = useBuildCrashInsight({
    draft: data,
    nodeId: resolvedNodeId ? String(resolvedNodeId) : undefined,
  });
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [crashHintOpen, setCrashHintOpen] = useState(false);
  const [sizeWarningOpen, setSizeWarningOpen] = useState(false);
  const lastWarningRef = useRef<string | null>(null);
  const isDev = import.meta.env.DEV;

  const resolveTaskTitle = useCallback(
    (task: TaskWithMetadata): string =>
      task.title ?? t('build.tasks.unknown', '(Title unavailable)'),
    [t],
  );

  const resolveStatusLabel = useCallback((statusValue?: string, skipped?: boolean): string => {
    if (skipped) {
      return t('build.taskStatus.skipped', 'Skipped');
    }
    switch (statusValue) {
      case 'running':
        return t('build.taskStatus.running', 'Running');
      case 'completed':
        return t('build.taskStatus.completed', 'Completed');
      case 'failed':
        return t('build.taskStatus.failed', 'Failed');
      case 'regression':
        return t('build.taskStatus.regression', 'Regression');
      case 'paused':
        return t('build.taskStatus.paused', 'Paused');
      case 'queued':
        return t('build.taskStatus.queued', 'Queued');
      default:
        return t('build.taskStatus.waiting', 'Waiting');
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

  const renderStageContent = useCallback((stage: BuildStage, stageValue: number) => {
    const stageTasks = tasksByStage[stage.id] ?? [];
    const hasTasks = stageTasks.length > 0;
    return (
      <Stack spacing={1} sx={{ p: 2 }}>
        {!hasTasks ? (
          <>
            <Typography variant="subtitle2">{stage.title}</Typography>
            {stage.description ? (
              <Typography variant="body2" color="text.secondary">
                {stage.description}
              </Typography>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              {t('build.tasks.empty', 'No tasks yet.')}
            </Typography>
          </>
        ) : (
          <Stack spacing={1}>
            {stageTasks.map((task) => {
              const statusValue = task.status;
              const isSkipped = isSkippedMessage(task.message);
              const statusLabelValue = resolveStatusLabel(statusValue, isSkipped);
              const statusColor = resolveStatusColor(statusValue, isSkipped);
              const taskTitle = resolveTaskTitle(task as TaskWithMetadata);
              const taskMessage = (() => {
                if (task.message && task.message !== taskTitle) return task.message;
                return undefined;
              })();
              return (
                <ShapeBuildTaskItem
                  key={task.taskId}
                  title={taskTitle}
                  statusLabel={statusLabelValue}
                  statusColor={statusColor}
                  message={taskMessage}
                  progress={task.progress}
                  fallbackProgress={stageValue}
                />
              );
            })}
          </Stack>
        )}
      </Stack>
    );
  }, [resolveStatusColor, resolveStatusLabel, resolveTaskTitle, t, tasksByStage]);

  const startWarning = useMemo(() => {
    if (!crashInsight || !crashInsight.memoryPressure) return null;
    const stageId = crashInsight.stage;
    if (!stageId) {
      return {
        title: t('build.warning.title', 'Build warning'),
        message: t(
          'build.warning.unknownStage',
          'A previous build ended without a completion record. Consider lowering concurrency if it happens again.',
        ),
      };
    }
    const stage = effectiveStages.find((candidate) => candidate.id === stageId);
    const stageLabel = stage?.title ?? stageId;
    const currentValue = (() => {
      switch (stageId) {
        case 'download':
          return data?.batchConfig?.downloadConfig?.maxConcurrent;
        case 'extract1':
          return data?.batchConfig?.extract1Config?.workers;
        case 'extract2':
          return data?.batchConfig?.extract2Config?.workers;
        case 'vectorTiles':
          return data?.batchConfig?.tileConfig?.workers;
        default:
          return undefined;
      }
    })();
    const warning = getStageConcurrencyWarning(crashInsight, stageId, currentValue);
    if (!warning) return null;
    const ratioText = crashInsight.peakRatio
      ? `${(crashInsight.peakRatio * 100).toFixed(1)}%`
      : t('build.warning.memoryUnknown', 'unknown');
    return {
      title: t('build.warning.title', 'Build warning'),
      message: t(
        'build.warning.message',
        'The previous build ended without completion. Peak memory usage for {{stage}} was {{ratio}}. Current concurrency is {{value}} (threshold {{threshold}}). Consider lowering it.',
        {
          stage: stageLabel,
          ratio: ratioText,
          value: currentValue ?? '-',
          threshold: warning.threshold ?? '-',
        },
      ),
    };
  }, [crashInsight, data?.batchConfig, effectiveStages, t]);

  const crashHint = useMemo(() => {
    if (isDev) return null;
    if (!crashInsight) return null;
    if (!crashInsight.memoryPressure) {
      return t(
        'build.warning.genericHint',
        'A previous build ended without a completion record. Consider reducing concurrency if it happens again.',
      );
    }
    const stageLabel = crashInsight.stage
      ? effectiveStages.find((candidate) => candidate.id === crashInsight.stage)?.title ?? crashInsight.stage
      : t('build.warning.unknownStageShort', 'unknown stage');
    const ratioText = crashInsight.peakRatio
      ? `${(crashInsight.peakRatio * 100).toFixed(1)}%`
      : t('build.warning.memoryUnknown', 'unknown');
    return t(
      'build.warning.memoryHint',
      'Previous build likely hit memory pressure during {{stage}} (peak {{ratio}}). Lower concurrency to reduce memory usage.',
      { stage: stageLabel, ratio: ratioText },
    );
  }, [crashInsight, effectiveStages, isDev, t]);

  useEffect(() => {
    if (crashHint) {
      setCrashHintOpen(true);
    } else {
      setCrashHintOpen(false);
    }
  }, [crashHint]);

  useEffect(() => {
    if (!warningMessage) {
      setSizeWarningOpen(false);
      lastWarningRef.current = null;
      return;
    }
    if (lastWarningRef.current === warningMessage) return;
    lastWarningRef.current = warningMessage;
    setSizeWarningOpen(true);
  }, [warningMessage]);

  const renderTaskProgressBar = useCallback(() => {
    const waitingColor = theme.palette.grey[300];
    const emptyStageColor = theme.palette.grey[500];
    const runningColor = theme.palette.info.main;
    const segments: Array<{ fill: string }> = [];

    effectiveStages.forEach((stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      if (stageTasks.length === 0) {
        segments.push({ fill: emptyStageColor });
        return;
      }
      stageTasks.forEach((task) => {
        let fill = waitingColor;
        if (task.status === 'completed') fill = theme.palette.success.main;
        else if (task.status === 'failed') fill = theme.palette.error.main;
        else if (task.status === 'running') fill = runningColor;
        else if (task.status === 'paused') fill = theme.palette.warning.main;
        segments.push({ fill });
      });
    });

    const viewWidth = segments.length || 1;
    const rectHeight = 10;

    return (
      <Box sx={{ width: '100%', height: rectHeight }}>
        <svg width="100%" height={rectHeight} viewBox={`0 0 ${viewWidth} 1`} preserveAspectRatio="none">
          <title>---progress---</title>
          {segments.length > 0 ? segments.map((segment, index) => (
            <rect
              key={`task-${index.toString()}`}
              x={index}
              y={0}
              width={1}
              height={1}
              fill={segment.fill}
            />
          )) : (
            <rect
              key="task-empty"
              x={0}
              y={0}
              width={1}
              height={1}
              fill={emptyStageColor}
            />
          )}
        </svg>
      </Box>
    );
  }, [effectiveStages, tasksByStage, theme]);

  const BatchProgressSummaryCard = useCallback(() => (
    <Card
      variant="outlined"
      sx={{
        width: '100%',
        transition: 'none',
        '&:hover': { transform: 'none', boxShadow: 'none' },
      }}
      data-testid="shape-plugin-batch-progress-summary"
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack spacing={0.25} flex={1}>
            <Typography variant="caption" color="text.secondary">
              {t('build.progress.stage', 'Stage')}
            </Typography>
            <Typography variant="body2">{summary.stageLabel}</Typography>
          </Stack>
          <Stack spacing={0.25} flex={1}>
            <Typography variant="caption" color="text.secondary">
              {t('build.progress.task', 'Task')}
            </Typography>
            <Typography variant="body2">{summary.taskLabel}</Typography>
          </Stack>
        </Stack>
        <Stack gap={1}>
          {renderTaskProgressBar()}
          {summary.buildStatus === 'running' ? (
            <LinearProgress variant="indeterminate" sx={{ height: 6, borderRadius: 6 }} />
          ) : null}
          <Typography variant="caption" color="text.secondary">
            {t('build.progress.counts', '{{percentage}}% ・ {{completed}}/{{total}} completed ・ failed {{failed}} ・ skipped {{skipped}}', {
              percentage: Math.round(summary.overallProgress),
              completed: summary.completed,
              total: summary.total,
              failed: summary.failed,
              skipped: summary.skipped,
            })}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  ), [renderTaskProgressBar, summary, t]);

  const handleStartClick = useCallback(async () => {
    if (startWarning) {
      setWarningDialogOpen(true);
      return;
    }
    await controls.handleStartOrResume?.();
  }, [controls, startWarning]);

  const handleConfirmStart = useCallback(async () => {
    setWarningDialogOpen(false);
    await controls.handleStartOrResume?.();
  }, [controls]);

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
          statusContent={summary.hasProgressData ? <BatchProgressSummaryCard /> : undefined}
          startIcon={<ConstructionIcon fontSize="small" />}
          onPause={controls.handlePause}
          onResume={controls.canStartOrResume ? handleStartClick : undefined}
          controlLabel={t('build.controls.title', 'Build controls')}
          pauseLabel={t('build.controls.pause', 'Pause')}
          startLabel={t('build.controls.start', 'Start build')}
          resumeLabel={t('build.controls.resume', 'Resume build')}
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
              {t('build.warning.cancel', 'Cancel')}
            </Button>
            <Button variant="contained" onClick={handleConfirmStart}>
              {t('build.warning.proceed', 'Proceed')}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </Box>
  );
};

const ShapeBuildProgressDialogs: React.FC<ShapeBuildProgressPanelProps> = ({ data }) => {
  const { t } = useTranslation();
  const buildStatus = useAtomValue(shapeBuildBuildStatusAtom);
  const authState = useAtomValue(shapeBuildProgressAuthAtom);
  const controls = useAtomValue(shapeBuildProgressControlsAtom);
  const [heapDialogOpen, setHeapDialogOpen] = useState(false);
  const heapPauseRef = useRef<string | null>(null);
  const { event: heapEvent, dismiss: dismissHeapEvent } = useHeapPressureGuard({
    enabled: buildStatus === 'running' || buildStatus === 'paused',
  });

  useEffect(() => {
    if (!heapEvent) return;
    setHeapDialogOpen(true);
  }, [heapEvent]);

  useEffect(() => {
    if (buildStatus !== 'running') {
      heapPauseRef.current = null;
      return;
    }
    if (!heapEvent) return;
    const activeNodeId = data?.nodeId ?? null;
    if (!activeNodeId) return;
    const eventKey = `${activeNodeId}:${heapEvent.source}:${heapEvent.timestamp}`;
    if (heapPauseRef.current === eventKey) return;
    heapPauseRef.current = eventKey;
    const pauseAndWarn = async () => {
      await controls.handlePause?.();
      setHeapDialogOpen(true);
    };
    void pauseAndWarn();
  }, [buildStatus, controls, controls.handlePause, data?.nodeId, heapEvent]);

  return (
    <>
      <AuthProviderDialog
        open={authState.authDialogOpen}
        onClose={authState.closeAuthDialog}
        onSelectProvider={authState.handleProviderSelect}
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
    </>
  );
};

export const ShapeBuildProgressStep: React.FC<ShapeDialogStepProps> = (props) => {
  const store = useMemo(() => createStore(), []);
  return (
    <Provider store={store}>
      <ShapeBuildProgressAtomSync {...props} />
      <ShapeBuildProgressPanel data={props.data} nodeId={props.nodeId} />
      <ShapeBuildProgressDialogs data={props.data} nodeId={props.nodeId} />
    </Provider>
  );
};
