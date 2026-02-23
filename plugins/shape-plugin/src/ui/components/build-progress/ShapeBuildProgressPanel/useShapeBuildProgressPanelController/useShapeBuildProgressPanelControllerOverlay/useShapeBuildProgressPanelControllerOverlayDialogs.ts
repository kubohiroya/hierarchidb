import { type ReactNode, useMemo } from 'react';
import type { ShapeBuildProgressPanelControllerBaseResult } from '~/ui/components/build-progress/ShapeBuildProgressPanel/useShapeBuildProgressPanelController/base/useShapeBuildProgressPanelControllerBaseState';
import {
  renderShapeBuildProgressPanelCompletionDialogContent,
  renderShapeBuildProgressPanelConcurrencyEditorCard,
  renderShapeBuildProgressPanelControlRightContent,
  renderShapeBuildProgressPanelFetchRetryEditorCard,
  renderShapeBuildProgressPanelOverlayFooter,
} from './useShapeBuildProgressPanelControllerOverlayDialogs.view.js';

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
    crashHintOpen,
    setCrashHintOpen,
    sizeWarningOpen,
    setSizeWarningOpen,
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

  const concurrencyEditorCard = useMemo(() => renderShapeBuildProgressPanelConcurrencyEditorCard({
    t,
    concurrencyEditorStageId,
    disabledEditors,
    processingConfigForEdit,
    applyProcessingConfigUpdate,
    toLabel,
  }), [
    concurrencyEditorStageId,
    t,
    disabledEditors,
    applyProcessingConfigUpdate,
    processingConfigForEdit,
  ]);

  const fetchRetryEditorCard = useMemo(() => renderShapeBuildProgressPanelFetchRetryEditorCard({
    t,
    fetchRetryConfigForEdit,
    applyFetchRetryConfigUpdate,
    disabledEditors,
  }), [applyFetchRetryConfigUpdate, disabledEditors, fetchRetryConfigForEdit, t]);

  const completionDialog = {
    open: completionDialogOpen,
    onClose: closeCompletionDialog,
    title: toLabel(completionSnapshot?.status === 'completed'
      ? t('stage.progress.completedTitle', 'Build completed')
      : t('stage.progress.failedTitle', 'Build failed')),
    closeLabel: toLabel(t('common.close', 'Close')),
    content: renderShapeBuildProgressPanelCompletionDialogContent({
      t,
      completionSnapshot,
      completionStageLabel,
      completionTaskTitle,
      completionTaskMessage,
      completionReason,
      toLabel,
    }),
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

  const footer = renderShapeBuildProgressPanelOverlayFooter({
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
  });

  const controlRightContent = renderShapeBuildProgressPanelControlRightContent({
    taskSearchText,
    setTaskSearchText,
    t,
    toLabel,
  });

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
