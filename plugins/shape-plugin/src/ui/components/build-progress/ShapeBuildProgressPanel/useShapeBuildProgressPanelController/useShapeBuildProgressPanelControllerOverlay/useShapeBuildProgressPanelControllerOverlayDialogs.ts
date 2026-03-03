import { type ReactNode, useMemo } from 'react';
import type { ShapeBuildProgressPanelControllerBaseResult } from '~/ui/components/build-progress/ShapeBuildProgressPanel/useShapeBuildProgressPanelController/base/useShapeBuildProgressPanelControllerBase';
import {
  ShapeBuildProgressPanelCompletionDialogContent,
  ShapeBuildProgressPanelConcurrencyEditorCard,
  ShapeBuildProgressPanelControlRightContent,
  ShapeBuildProgressPanelSourceRetryEditorCard,
  ShapeBuildProgressPanelOverlayFooter,
} from './ShapeBuildProgressPanelControllerOverlayDialogsView.js';

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
    sourceRetryEditorAnchor,
    closeConcurrencyEditor,
    closeSourceRetryEditor,
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
    applySourceRetryConfigUpdate,
    processingConfigForEdit,
    sourceRetryConfigForEdit,
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

  const concurrencyEditorCard = useMemo(() => (
    ShapeBuildProgressPanelConcurrencyEditorCard({
      t,
      concurrencyEditorStageId,
      disabledEditors,
      processingConfigForEdit,
      applyProcessingConfigUpdate,
      toLabel,
    })
  ), [
    concurrencyEditorStageId,
    t,
    disabledEditors,
    applyProcessingConfigUpdate,
    processingConfigForEdit,
  ]);

  const sourceRetryEditorCard = useMemo(() => (
    ShapeBuildProgressPanelSourceRetryEditorCard({
      t,
      sourceRetryConfigForEdit,
      applySourceRetryConfigUpdate,
      disabledEditors,
    })
  ), [applySourceRetryConfigUpdate, disabledEditors, sourceRetryConfigForEdit, t]);

  const completionDialog = {
    open: completionDialogOpen,
    onClose: closeCompletionDialog,
    title: toLabel(completionSnapshot?.status === 'completed'
      ? t('stage.progress.completedTitle', 'Build completed')
      : t('stage.progress.failedTitle', 'Build failed')),
    closeLabel: toLabel(t('common.close', 'Close')),
    content: ShapeBuildProgressPanelCompletionDialogContent({
      t,
      completionSnapshot,
      completionStageLabel,
      completionTaskTitle,
      completionTaskMessage,
      completionReason,
    }),
  };

  const handleSuspendSuspectClose = () => {
    suspendSuspectControls?.close();
  };

  const handleCrashSuspectClose = () => {
    crashSuspectControls?.close();
  };

  const suspendDialog = {
    open: suspendSuspectOpen,
    onClose: handleSuspendSuspectClose,
    title: toLabel(t('stage.progress.suspendSuspectTitle', 'Build tab suspended')),
    message: toLabel(suspendSuspectMessage ?? t('stage.progress.suspendSuspect', 'Build is paused while another tab is in background.')),
    closeLabel: toLabel(t('common.close', 'Close')),
  };

  const crashDialog = {
    open: crashSuspectOpen,
    onClose: handleCrashSuspectClose,
    title: toLabel(t('stage.progress.crashSuspectTitle', 'Build may have stopped')),
    message: toLabel(crashSuspectMessage ?? t('stage.progress.crashSuspect', 'Build session may have stopped unexpectedly.')),
    closeLabel: toLabel(t('common.close', 'Close')),
  };

  const footer = ShapeBuildProgressPanelOverlayFooter({
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
  });

  const controlRightContent = ShapeBuildProgressPanelControlRightContent({
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
