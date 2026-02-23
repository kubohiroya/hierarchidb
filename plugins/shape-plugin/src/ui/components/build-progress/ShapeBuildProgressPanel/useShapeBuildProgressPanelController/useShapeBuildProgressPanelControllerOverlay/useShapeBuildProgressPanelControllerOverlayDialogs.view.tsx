import { type ReactNode } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Alert, Popover, Typography } from '@mui/material';
import { DownloadRetryControls, WorkerNumberConfigCard } from '@hierarchidb/ui-accordion-config';
import { TreeTableSearchInput } from '@hierarchidb/ui-search-input';
import type { ShapeBuildProgressPanelControllerBaseResult } from '~/ui/components/build-progress/ShapeBuildProgressPanel/useShapeBuildProgressPanelController/base/useShapeBuildProgressPanelControllerBaseState';

type ToLabel = (text: string | null | undefined) => string;

type UseShapeBuildProgressPanelControllerOverlayDialogsArgs = ShapeBuildProgressPanelControllerBaseResult;

type ConcurrencyEditorCardArgs = Pick<
  UseShapeBuildProgressPanelControllerOverlayDialogsArgs,
  | 't'
  | 'concurrencyEditorStageId'
  | 'processingConfigForEdit'
  | 'applyProcessingConfigUpdate'
> & {
  disabledEditors: boolean;
  toLabel: ToLabel;
};

type FetchRetryEditorCardArgs = Pick<
  UseShapeBuildProgressPanelControllerOverlayDialogsArgs,
  | 'fetchRetryConfigForEdit'
  | 'applyFetchRetryConfigUpdate'
  | 't'
> & {
  disabledEditors: boolean;
};

type CompletionDialogContentArgs = Pick<
  UseShapeBuildProgressPanelControllerOverlayDialogsArgs,
  't' | 'completionSnapshot' | 'completionStageLabel' | 'completionTaskTitle' | 'completionTaskMessage' | 'completionReason'
> & {
  toLabel: ToLabel;
};

type FooterArgs = Pick<
  UseShapeBuildProgressPanelControllerOverlayDialogsArgs,
  | 'isBuildStartupPending'
  | 'startupNoticeDismissed'
  | 'setStartupNoticeDismissed'
  | 'startupStatusMessage'
  | 'crashHintOpen'
  | 'setCrashHintOpen'
  | 'warningMessage'
  | 'startWarning'
  | 'crashHint'
> & {
  concurrencyEditorAnchor: UseShapeBuildProgressPanelControllerOverlayDialogsArgs['concurrencyEditorAnchor'];
  concurrencyEditorStageId: UseShapeBuildProgressPanelControllerOverlayDialogsArgs['concurrencyEditorStageId'];
  fetchRetryEditorAnchor: UseShapeBuildProgressPanelControllerOverlayDialogsArgs['fetchRetryEditorAnchor'];
  fetchRetryEditorCard: ReactNode;
  concurrencyEditorCard: ReactNode;
  closeConcurrencyEditor: () => void;
  closeFetchRetryEditor: () => void;
  warningDialogOpen: boolean;
  setWarningDialogOpen: (open: boolean) => void;
  sizeWarningOpen: boolean;
  setSizeWarningOpen: (open: boolean) => void;
  handleStartWarningConfirm: () => void;
};

type ControlRightContentArgs = Pick<
  UseShapeBuildProgressPanelControllerOverlayDialogsArgs,
  'taskSearchText' | 'setTaskSearchText' | 't'
> & {
  toLabel: ToLabel;
};

export const renderShapeBuildProgressPanelConcurrencyEditorCard = ({
  t,
  concurrencyEditorStageId,
  disabledEditors,
  processingConfigForEdit,
  applyProcessingConfigUpdate,
  toLabel,
}: ConcurrencyEditorCardArgs): ReactNode => {
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
};

export const renderShapeBuildProgressPanelFetchRetryEditorCard = ({
  t,
  fetchRetryConfigForEdit,
  applyFetchRetryConfigUpdate,
  disabledEditors,
}: FetchRetryEditorCardArgs): ReactNode => (
  <DownloadRetryControls
    baseRetryConfig={fetchRetryConfigForEdit}
    onChange={applyFetchRetryConfigUpdate}
    disabled={disabledEditors}
    t={t}
    disableHoverEffect
  />
);

export const renderShapeBuildProgressPanelCompletionDialogContent = ({
  t,
  completionSnapshot,
  completionStageLabel,
  completionTaskTitle,
  completionTaskMessage,
  completionReason,
  toLabel,
}: CompletionDialogContentArgs): ReactNode => (
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
);

export const renderShapeBuildProgressPanelOverlayFooter = ({
  isBuildStartupPending,
  fetchRetryEditorAnchor,
  closeFetchRetryEditor,
  startupNoticeDismissed,
  setStartupNoticeDismissed,
  startupStatusMessage,
  warningMessage,
  startWarning,
  warningDialogOpen,
  setWarningDialogOpen,
  closeConcurrencyEditor,
  concurrencyEditorAnchor,
  concurrencyEditorStageId,
  concurrencyEditorCard,
  fetchRetryEditorCard,
  crashHint,
  crashHintOpen,
  setCrashHintOpen,
  sizeWarningOpen,
  setSizeWarningOpen,
  t,
  handleStartWarningConfirm,
}: FooterArgs): ReactNode => (
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
      open={crashHintOpen}
      autoHideDuration={8000}
      onClose={() => setCrashHintOpen(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="warning" variant="filled" onClose={() => setCrashHintOpen(false)}>
        {crashHint}
      </Alert>
    </Snackbar>
    <Dialog open={sizeWarningOpen} onClose={() => setSizeWarningOpen(false)}>
      <DialogTitle>{t('stage.warning.title', 'Build warning')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {warningMessage}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSizeWarningOpen(false)}>
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

export const renderShapeBuildProgressPanelControlRightContent = ({
  taskSearchText,
  setTaskSearchText,
  t,
  toLabel,
}: ControlRightContentArgs): ReactNode => (
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
