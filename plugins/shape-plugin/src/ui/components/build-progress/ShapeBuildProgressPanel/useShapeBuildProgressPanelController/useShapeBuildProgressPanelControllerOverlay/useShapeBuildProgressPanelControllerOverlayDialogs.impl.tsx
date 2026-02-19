import { type ReactNode, useMemo } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Alert, Popover, Typography } from '@mui/material';
import { DownloadRetryControls, WorkerNumberConfigCard } from '@hierarchidb/ui-accordion-config';
import { TreeTableSearchInput } from '@hierarchidb/ui-search-input';
import type { ShapeBuildProgressPanelControllerBaseResult } from '../base/useShapeBuildProgressPanelControllerBaseState.js';

type UseShapeBuildProgressPanelControllerOverlayDialogsArgs = ShapeBuildProgressPanelControllerBaseResult;

type UseShapeBuildProgressPanelControllerOverlayDialogsResult = {
  footer: ReactNode;
  completionDialog: {
    open: boolean;
    onClose: () => void;
    title: string;
    closeLabel: string;
    content: ReactNode;
  };
  suspendDialog: {
    open: boolean;
    onClose: () => void;
    title: string;
    message: string;
    closeLabel: string;
  };
  crashDialog: {
    open: boolean;
    onClose: () => void;
    title: string;
    message: string;
    closeLabel: string;
  };
  controlRightContent: ReactNode;
  stageLoadingState: ShapeBuildProgressPanelControllerBaseResult['stageLoadingState'];
  stageHeaderMeta: ShapeBuildProgressPanelControllerBaseResult['stageHeaderMeta'];
};

export const useShapeBuildProgressPanelControllerOverlayDialogs = (
  args: UseShapeBuildProgressPanelControllerOverlayDialogsArgs,
): UseShapeBuildProgressPanelControllerOverlayDialogsResult => {
  const toLabel = (text: string | null | undefined) => text ?? '';

  const {
    t,
    concurrencyEditorAnchor,
    concurrencyEditorStageId,
    fetchRetryEditorAnchor,
    closeConcurrencyEditor,
    closeFetchRetryEditor,
    startupNoticeDismissed,
    setStartupNoticeDismissed,
    startupStatusMessage,
    warningMessage,
    startWarning,
    warningDialogOpen,
    setWarningDialogOpen,
    crashHint,
    crashSuspectMessage,
    crashSuspectOpen,
    crashSuspectControls,
    suspendSuspectMessage,
    suspendSuspectOpen,
    suspendSuspectControls,
    completionDialogOpen,
    setCompletionDialogOpen,
    completionSnapshot,
    completionStageLabel,
    completionTaskTitle,
    completionTaskMessage,
    completionReason,
    isBuildStartupPending,
    taskSearchText,
    setTaskSearchText,
    applyProcessingConfigUpdate,
    applyFetchRetryConfigUpdate,
    processingConfigForEdit,
    fetchRetryConfigForEdit,
  } = args;

  const stageLoadingState = useMemo(() => ({
    ...args.stageLoadingState,
  }), [args.stageLoadingState]);

  const stageHeaderMeta = useMemo(() => ({
    ...args.stageHeaderMeta,
  }), [args.stageHeaderMeta]);

  const disabledEditors = !args.onChange || args.isBuildSessionStarted;

  const handleStartWarningConfirm = () => {
    args.handleConfirmStartWithHold();
  };

  const closeCompletionDialog = () => {
    setCompletionDialogOpen(false);
  };

  const concurrencyEditorCard = useMemo(() => {
    if (!concurrencyEditorStageId) return null;

    if (concurrencyEditorStageId === 'fetch') {
      return (
        <WorkerNumberConfigCard
          title={t('processing.download.workers', 'Concurrent Fetch Workers')}
          value={processingConfigForEdit.fetch.maxConcurrent}
          helperText={toLabel(t('processing.download.workersHelp', 'Controls how many fetches run in parallel.'))}
          warningText={undefined}
          onChange={(maxConcurrent) => {
            applyProcessingConfigUpdate({
              fetch: {
                ...processingConfigForEdit.fetch,
                maxConcurrent,
              },
            });
          }}
          min={1}
          max={4}
          step={1}
          formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
          disabled={disabledEditors}
          disableHoverEffect
        />
      );
    }

    if (concurrencyEditorStageId === 'transform') {
      return (
        <WorkerNumberConfigCard
          title={t('processing.transform.workersStage1', 'Transform Workers (Simplification)')}
          value={processingConfigForEdit.transform.maxConcurrent}
          helperText={toLabel(t(
            'processing.transform.workersStage1Help',
            'Higher concurrency can speed up processing but may exhaust browser memory.',
          ))}
          warningText={undefined}
          onChange={(maxConcurrent) => {
            applyProcessingConfigUpdate({
              transform: {
                ...processingConfigForEdit.transform,
                maxConcurrent,
              },
            });
          }}
          min={1}
          max={4}
          step={1}
          formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
          disabled={disabledEditors}
          disableHoverEffect
        />
      );
    }

    return (
        <WorkerNumberConfigCard
          title={t('processing.tile.workers', 'Concurrent VT Workers')}
          value={processingConfigForEdit.vt.maxConcurrent}
          helperText={toLabel(t('processing.tile.workersHelp', 'Concurrent workers for VT generation.'))}
          warningText={undefined}
        onChange={(maxConcurrent) => {
          const dynamicConcurrency = processingConfigForEdit.vt.dynamicConcurrency ?? {
            enabled: false,
            minConcurrent: maxConcurrent,
            maxConcurrent,
            highWatermark: 0.85,
            lowWatermark: 0.6,
            adjustStep: 1,
            sampleMs: 2000,
          };
          applyProcessingConfigUpdate({
            vt: {
              ...processingConfigForEdit.vt,
              maxConcurrent,
              dynamicConcurrency: {
                ...dynamicConcurrency,
                enabled: maxConcurrent >= 2,
              },
            },
          });
        }}
        min={1}
        max={8}
        step={1}
        formatLabel={(value) => t('processing.workers.countLabel', '{{count}} workers', { count: value })}
        disabled={disabledEditors}
        disableHoverEffect
      />
    );
  }, [
    concurrencyEditorStageId,
    t,
    disabledEditors,
    applyProcessingConfigUpdate,
    processingConfigForEdit,
  ]);

  const fetchRetryEditorCard = useMemo(() => (
    <DownloadRetryControls
      baseRetryConfig={fetchRetryConfigForEdit}
      onChange={applyFetchRetryConfigUpdate}
      disabled={disabledEditors}
      t={t}
      disableHoverEffect
    />
  ), [applyFetchRetryConfigUpdate, disabledEditors, fetchRetryConfigForEdit, t]);

  const completionDialog = {
    open: completionDialogOpen,
    onClose: closeCompletionDialog,
    title: toLabel(completionSnapshot?.status === 'completed'
      ? t('stage.progress.completedTitle', 'Build completed')
      : t('stage.progress.failedTitle', 'Build failed')),
    closeLabel: toLabel(t('common.close', 'Close')),
    content: (
      <>
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
      </>
    ),
  };

  const suspendDialog = {
    open: suspendSuspectOpen,
    onClose: () => suspendSuspectControls.close(),
    title: toLabel(t('stage.progress.suspendSuspectTitle', 'Build tab suspended')),
    message: toLabel(suspendSuspectMessage ?? t('stage.progress.suspendSuspect', 'Build is paused while another tab is in background.')),
    closeLabel: toLabel(t('common.close', 'Close')),
  };

  const crashDialog = {
    open: crashSuspectOpen,
    onClose: () => crashSuspectControls.close(),
    title: toLabel(t('stage.progress.crashSuspectTitle', 'Build may have stopped')),
    message: toLabel(crashSuspectMessage ?? t('stage.progress.crashSuspect', 'Build session may have stopped unexpectedly.')),
    closeLabel: toLabel(t('common.close', 'Close')),
  };

  const footer = (
    <>
      <Popover
        open={Boolean(fetchRetryEditorAnchor)}
        anchorEl={fetchRetryEditorAnchor}
        onClose={closeFetchRetryEditor}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 820, maxWidth: 'calc(100vw - 24px)' }}>
          {fetchRetryEditorCard}
        </Box>
      </Popover>
      <Popover
        open={Boolean(concurrencyEditorAnchor && concurrencyEditorStageId)}
        anchorEl={concurrencyEditorAnchor}
        onClose={closeConcurrencyEditor}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 360, maxWidth: 'calc(100vw - 24px)' }}>
          {concurrencyEditorCard}
        </Box>
      </Popover>
      <Snackbar
        open={isBuildStartupPending && !startupNoticeDismissed}
        onClose={(_event, reason) => {
          if (reason === 'clickaway') return;
          setStartupNoticeDismissed(true);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" variant="filled" onClose={() => setStartupNoticeDismissed(true)}>
          {startupStatusMessage}
        </Alert>
      </Snackbar>
      <Snackbar
        open={args.crashHintOpen}
        autoHideDuration={8000}
        onClose={() => args.setCrashHintOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" variant="filled" onClose={() => args.setCrashHintOpen(false)}>
          {crashHint}
        </Alert>
      </Snackbar>
      <Dialog open={args.sizeWarningOpen} onClose={() => args.setSizeWarningOpen(false)}>
        <DialogTitle>{t('stage.warning.title', 'Build warning')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {warningMessage}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => args.setSizeWarningOpen(false)}>
            {t('stage.warning.confirm', 'OK')}
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
            <Button variant="contained" onClick={handleStartWarningConfirm}>
              {t('stage.warning.proceed', 'Proceed')}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </>
  );

  const controlRightContent = (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      justifyContent: 'flex-end',
      flexWrap: 'nowrap',
    }}
    >
      <TreeTableSearchInput
        fullWidth
        value={taskSearchText}
        onChange={setTaskSearchText}
        onClear={() => setTaskSearchText('')}
        placeholder={toLabel(t('stage.tasks.search', 'Search tasks'))}
        sx={{
          flex: '1 1 auto',
          minWidth: 0,
          maxWidth: 250,
        }}
      />
    </Box>
  );

  return {
    footer,
    completionDialog,
    suspendDialog,
    crashDialog,
    controlRightContent,
    stageLoadingState,
    stageHeaderMeta,
  };
};
