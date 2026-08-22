import { TreeTableSearchInput } from '@hierarchidb/components';
import { DownloadRetryControls, WorkerNumberConfigCard } from '@hierarchidb/ui-accordion-config';
import { DialogSafePopover } from '@hierarchidb/ui-dialog';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Typography,
} from '@mui/material';
import { type ReactNode } from 'react';
import type { ShapeBuildProgressPanelControllerBaseResult } from '~/ui/components/build-progress/ShapeBuildProgressPanel/useShapeBuildProgressPanelController/base/useShapeBuildProgressPanelControllerBase';

type ToLabel = (text: string | null | undefined) => string;

type ShapeBuildProgressPanelControllerOverlayDialogsArgs =
  ShapeBuildProgressPanelControllerBaseResult;

type ConcurrencyEditorCardArgs = Pick<
  ShapeBuildProgressPanelControllerOverlayDialogsArgs,
  't' | 'concurrencyEditorStageId' | 'processingConfigForEdit' | 'applyProcessingConfigUpdate'
> & {
  disabledEditors: boolean;
  toLabel: ToLabel;
};

type SourceRetryEditorCardArgs = Pick<
  ShapeBuildProgressPanelControllerOverlayDialogsArgs,
  'sourceRetryConfigForEdit' | 'applySourceRetryConfigUpdate' | 't'
> & {
  disabledEditors: boolean;
};

type CompletionDialogContentArgs = Pick<
  ShapeBuildProgressPanelControllerOverlayDialogsArgs,
  | 't'
  | 'completionSnapshot'
  | 'completionStageLabel'
  | 'completionTaskTitle'
  | 'completionTaskMessage'
  | 'completionReason'
>;

type FooterArgs = Pick<
  ShapeBuildProgressPanelControllerOverlayDialogsArgs,
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
  concurrencyEditorAnchor: ShapeBuildProgressPanelControllerOverlayDialogsArgs['concurrencyEditorAnchor'];
  concurrencyEditorStageId: ShapeBuildProgressPanelControllerOverlayDialogsArgs['concurrencyEditorStageId'];
  sourceRetryEditorAnchor: ShapeBuildProgressPanelControllerOverlayDialogsArgs['sourceRetryEditorAnchor'];
  sourceRetryEditorCard: ReactNode;
  concurrencyEditorCard: ReactNode;
  closeConcurrencyEditor: () => void;
  closeSourceRetryEditor: () => void;
  warningDialogOpen: boolean;
  setWarningDialogOpen: (open: boolean) => void;
  sizeWarningOpen: boolean;
  setSizeWarningOpen: (open: boolean) => void;
  handleStartWarningConfirm: () => void;
  t: ShapeBuildProgressPanelControllerOverlayDialogsArgs['t'];
};

type ControlRightContentArgs = Pick<
  ShapeBuildProgressPanelControllerOverlayDialogsArgs,
  'taskSearchText' | 'setTaskSearchText' | 't'
> & {
  toLabel: ToLabel;
};

export const ShapeBuildProgressPanelConcurrencyEditorCard = ({
  t,
  concurrencyEditorStageId,
  disabledEditors,
  processingConfigForEdit,
  applyProcessingConfigUpdate,
  toLabel,
}: ConcurrencyEditorCardArgs): ReactNode => {
  if (!concurrencyEditorStageId) return null;

  if (concurrencyEditorStageId === 'source') {
    return (
      <WorkerNumberConfigCard
        title={t('processing.download.workers', 'Concurrent Source Workers')}
        value={processingConfigForEdit.source.maxConcurrent}
        helperText={toLabel(
          t('processing.download.workersHelp', 'Controls how many source tasks run in parallel.')
        )}
        warningText={undefined}
        onChange={(maxConcurrent) => {
          applyProcessingConfigUpdate({
            source: {
              ...processingConfigForEdit.source,
              maxConcurrent,
            },
          });
        }}
        min={1}
        max={4}
        step={1}
        formatLabel={(value) =>
          t('processing.workers.countLabel', '{{count}} workers', { count: value })
        }
        disabled={disabledEditors}
        disableHoverEffect
      />
    );
  }

  if (concurrencyEditorStageId === 'geometry') {
    return (
      <WorkerNumberConfigCard
        title={t('processing.geometry.workersStage1', 'Geometry Workers (Simplification)')}
        value={processingConfigForEdit.geometry.maxConcurrent}
        helperText={toLabel(
          t(
            'processing.geometry.workersStage1Help',
            'Higher concurrency can speed up processing but may exhaust browser memory.'
          )
        )}
        warningText={undefined}
        onChange={(maxConcurrent) => {
          applyProcessingConfigUpdate({
            geometry: {
              ...processingConfigForEdit.geometry,
              maxConcurrent,
            },
          });
        }}
        min={1}
        max={4}
        step={1}
        formatLabel={(value) =>
          t('processing.workers.countLabel', '{{count}} workers', { count: value })
        }
        disabled={disabledEditors}
        disableHoverEffect
      />
    );
  }

  return (
    <WorkerNumberConfigCard
      title={t('processing.tile.workers', 'Concurrent TileEmit Workers')}
      value={processingConfigForEdit.tileEmit.maxConcurrent}
      helperText={toLabel(
        t('processing.tile.workersHelp', 'Concurrent workers for TileEmit generation.')
      )}
      warningText={undefined}
      onChange={(maxConcurrent) => {
        const dynamicConcurrency = processingConfigForEdit.tileEmit.dynamicConcurrency ?? {
          enabled: false,
          minConcurrent: maxConcurrent,
          maxConcurrent,
          highWatermark: 0.85,
          lowWatermark: 0.6,
          adjustStep: 1,
          sampleMs: 2000,
        };
        applyProcessingConfigUpdate({
          tileEmit: {
            ...processingConfigForEdit.tileEmit,
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
      formatLabel={(value) =>
        t('processing.workers.countLabel', '{{count}} workers', { count: value })
      }
      disabled={disabledEditors}
      disableHoverEffect
    />
  );
};

export const ShapeBuildProgressPanelSourceRetryEditorCard = ({
  t,
  sourceRetryConfigForEdit,
  applySourceRetryConfigUpdate,
  disabledEditors,
}: SourceRetryEditorCardArgs): ReactNode => (
  <DownloadRetryControls
    baseRetryConfig={sourceRetryConfigForEdit}
    onChange={applySourceRetryConfigUpdate}
    disabled={disabledEditors}
    t={t}
    disableHoverEffect
  />
);

export const ShapeBuildProgressPanelCompletionDialogContent = ({
  t,
  completionSnapshot,
  completionStageLabel,
  completionTaskTitle,
  completionTaskMessage,
  completionReason,
}: CompletionDialogContentArgs): ReactNode => (
  <>
    <Typography variant="body2">
      {t('stage.progress.completedStageLabel', 'Stage')}:{' '}
      {completionSnapshot?.stageLabel ?? completionStageLabel}
    </Typography>
    {completionSnapshot?.status === 'failed' ? (
      <>
        <Typography variant="body2">
          {t('stage.progress.failedTaskLabel', 'Task')}:{' '}
          {completionSnapshot?.taskTitle ?? completionTaskTitle}
        </Typography>
        <Typography variant="body2">
          {t('stage.progress.failedMessageLabel', 'Message')}:{' '}
          {completionSnapshot?.taskMessage ?? completionTaskMessage}
        </Typography>
      </>
    ) : (
      <Typography variant="body2">
        {t('stage.progress.completedReasonLabel', 'Reason')}:{' '}
        {completionSnapshot?.reason ?? completionReason}
      </Typography>
    )}
  </>
);

export const ShapeBuildProgressPanelOverlayFooter = ({
  isBuildStartupPending,
  sourceRetryEditorAnchor,
  closeSourceRetryEditor,
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
  sourceRetryEditorCard,
  crashHint,
  crashHintOpen,
  setCrashHintOpen,
  sizeWarningOpen,
  setSizeWarningOpen,
  t,
  handleStartWarningConfirm,
}: FooterArgs): ReactNode => (
  <>
    <DialogSafePopover
      open={Boolean(sourceRetryEditorAnchor)}
      anchorEl={sourceRetryEditorAnchor}
      onClose={closeSourceRetryEditor}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
    >
      <Box sx={{ p: 2, width: 820, maxWidth: 'calc(100vw - 24px)' }}>{sourceRetryEditorCard}</Box>
    </DialogSafePopover>
    <DialogSafePopover
      open={Boolean(concurrencyEditorAnchor && concurrencyEditorStageId)}
      anchorEl={concurrencyEditorAnchor}
      onClose={closeConcurrencyEditor}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
    >
      <Box sx={{ p: 2, width: 360, maxWidth: 'calc(100vw - 24px)' }}>{concurrencyEditorCard}</Box>
    </DialogSafePopover>
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

export const ShapeBuildProgressPanelControlRightContent = ({
  taskSearchText,
  setTaskSearchText,
  t,
  toLabel,
}: ControlRightContentArgs): ReactNode => (
  <Box
    sx={{
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
