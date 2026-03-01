import type { BuildControlMenuItem } from '@hierarchidb/components';
import { IconButton } from '@mui/material';
import {
  type BuildSessionProgressPanelViewModel,
  resolveBuildSessionProgressPanelSplitViewProps,
} from '@hierarchidb/ui-build-progress';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import type { useShapeBuildProgressPanelController } from './useShapeBuildProgressPanelController.js';
import {
  renderShapeBuildProgressPanelControlRightContent,
  renderShapeBuildProgressPanelHeaderIcon,
  renderShapeBuildProgressPanelStartIcon,
} from './ShapeBuildProgressPanelViewModel.js';

type UseShapeBuildProgressPanelViewModelArgs = {
  coreState: ShapeBuildProgressPanelControllerResult;
  nodeId?: ShapeEntity['id'];
};

type ShapeBuildProgressPanelControllerResult = ReturnType<typeof useShapeBuildProgressPanelController>;

type ShapeBuildProgressPanelViewModel = {
  status: ShapeBuildProgressPanelControllerResult['summary']['buildStatus'];
  overallProgress: number;
  stages: ShapeBuildProgressPanelControllerResult['stages'];
  stageProgress: ShapeBuildProgressPanelControllerResult['stageProgressForDisplay'];
  paneProgress: ShapeBuildProgressPanelControllerResult['paneProgressForDisplay'];
  stageLoadingState: ShapeBuildProgressPanelControllerResult['stageLoadingState'];
  stageContents: ShapeBuildProgressPanelControllerResult['stageContents'];
  stageProgressContent: ShapeBuildProgressPanelControllerResult['stageProgressContent'];
  stageConcurrencyIndicators: ShapeBuildProgressPanelControllerResult['stageConcurrencyIndicators'];
  onStageConcurrencyIndicatorClick: ShapeBuildProgressPanelControllerResult['onStageConcurrencyIndicatorClick'];
  stageConcurrencyIndicatorAriaLabels: ShapeBuildProgressPanelControllerResult['stageConcurrencyIndicatorAriaLabels'];
  stageLeadingControls: ShapeBuildProgressPanelControllerResult['stageLeadingControls'];
  stageMenus: ShapeBuildProgressPanelControllerResult['stageMenus'];
  stageHeaderMeta: ShapeBuildProgressPanelControllerResult['stageHeaderMeta'];
  chipPlacement: 'belowProgress';
  suppressStatusFallback: true;
  onResume?: (() => void) | undefined;
  onPause?: (() => void) | undefined;
  controlHeaderIcon: ReactNode;
  startIcon: ReactNode;
  controlLabel: string;
  pauseLabel: string;
  cancelLabel: string;
  stopRequested: boolean;
  startPending: boolean;
  showResumeLabel: boolean;
  startLabel: string;
  resumeLabel: string;
  statusLabel: string;
  controlDetails: ShapeBuildProgressPanelControllerResult['controlDetails'];
  controlRightContent: ReactNode;
  controlMenuItems?: BuildControlMenuItem[];
  controlMenuAriaLabel?: string;
  controlMenuDisabled?: boolean;
  startLoading?: boolean;
  completionDialog: ShapeBuildProgressPanelControllerResult['completionDialog'];
  suspendDialog: ShapeBuildProgressPanelControllerResult['suspendDialog'];
  crashDialog: ShapeBuildProgressPanelControllerResult['crashDialog'];
  footer: ShapeBuildProgressPanelControllerResult['footer'];
} & BuildSessionProgressPanelViewModel;

export const useShapeBuildProgressPanelViewModel = ({
  coreState,
  nodeId,
}: UseShapeBuildProgressPanelViewModelArgs): ShapeBuildProgressPanelViewModel => {
  const {
    t,
    controlMenuItems,
    controlMenuAriaLabel,
    isControlMenuDisabled,
    isStartButtonLoading,
    stages,
    stageProgressForDisplay,
    paneProgressForDisplay,
    tasksByStageForDisplay,
    stageLoadingState,
    stageHeaderMeta,
    stageContents,
    stageProgressContent,
    stagePreviewWindowOpenMap,
    stagePreviewWindowPendingMap,
    toggleStagePreviewWindow,
    stageConcurrencyIndicators,
    onStageConcurrencyIndicatorClick,
    stageConcurrencyIndicatorAriaLabels,
    stageLeadingControls,
    stageMenus,
    controlDetails,
    summary,
    controls,
    footer,
    completionDialog,
    suspendDialog,
    crashDialog,
    controlRightContent,
    startPendingHold,
    isResetSessionLoading,
    handleStartClickWithHold,
  } = coreState;

  const stagesWithPreviewTrigger = stages.map((stage) => (
    {
      ...stage,
      icon: createElement(
        IconButton,
        {
          size: 'small',
          onClick: () => toggleStagePreviewWindow(stage.id),
          color: (stagePreviewWindowOpenMap[stage.id] ?? true) ? 'default' : 'primary',
          sx: { cursor: stagePreviewWindowPendingMap[stage.id] ? 'wait' : 'pointer' },
          'aria-label': `Toggle ${stage.title} preview window`,
          'aria-pressed': (stagePreviewWindowOpenMap[stage.id] ?? true) ? 'true' : 'false',
        },
        stage.icon,
      ),
    }
  ));
  const requestedControlAction = controls.requestedControlAction ?? 'none';
  const pauseLabel = controls.stopRequested && requestedControlAction === 'pause'
    ? t('stage.controls.pausing', 'Pausing...')
    : t('stage.controls.pause', 'Pause');
  const cancelLabel = controls.stopRequested && requestedControlAction === 'cancel'
    ? t('stage.controls.cancelling', 'Cancelling...')
    : t('cancel', 'Cancel');

  return {
    status: summary.buildStatus,
    overallProgress: summary.overallProgress,
    stages: stagesWithPreviewTrigger,
    stageProgress: stageProgressForDisplay,
    paneProgress: paneProgressForDisplay,
    tasksByStageForDisplay,
    stageLoadingState,
    ...resolveBuildSessionProgressPanelSplitViewProps({ stagesLength: stagesWithPreviewTrigger.length, splitViewPanelSize: 250 }),
    stageContents,
    stageProgressContent,
    stageConcurrencyIndicators,
    onStageConcurrencyIndicatorClick,
    stageConcurrencyIndicatorAriaLabels,
    stageLeadingControls,
    stageMenus,
    stageHeaderMeta,
    chipPlacement: 'belowProgress',
    suppressStatusFallback: true,
    onResume: controls.canStartOrResume ? handleStartClickWithHold : undefined,
    onPause: controls.stopRequested ? undefined : controls.handlePause,
    onCancel: controls.handleCancelQueued,
    controlHeaderIcon: renderShapeBuildProgressPanelHeaderIcon(),
    startIcon: renderShapeBuildProgressPanelStartIcon(),
    controlLabel: t('stage.controls.sessionTitle', 'Build Session'),
    controlMenuItems,
    controlMenuAriaLabel,
    controlMenuDisabled: isControlMenuDisabled,
    pauseLabel,
    cancelLabel,
    stopRequested: controls.stopRequested ?? false,
    startPending: controls.startPending || startPendingHold || isResetSessionLoading,
    startLoading: isStartButtonLoading,
    showResumeLabel: false,
    startLabel: t('stage.controls.start', 'Start Build'),
    resumeLabel: t('stage.controls.resume', 'Resume Build'),
    statusLabel: controls.statusLabel,
    controlDetails,
    controlRightContent: renderShapeBuildProgressPanelControlRightContent({
      nodeId,
      controlRightContent,
    }),
    completionDialog,
    suspendDialog,
    crashDialog,
    footer,
  };
};

export type { ShapeBuildProgressPanelViewModel };
