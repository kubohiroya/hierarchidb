import type { BuildControlMenuItem } from '@hierarchidb/components';
import {
  type BuildSessionProgressPanelViewModel,
  resolveBuildSessionProgressPanelSplitViewProps,
} from '@hierarchidb/ui-build-progress';
import type { ReactNode } from 'react';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import type { useShapeBuildProgressPanelController } from './useShapeBuildProgressPanelController.js';
import {
  renderShapeBuildProgressPanelControlRightContent,
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

  return {
    status: summary.buildStatus,
    overallProgress: summary.overallProgress,
    stages,
    stageProgress: stageProgressForDisplay,
    paneProgress: paneProgressForDisplay,
    tasksByStageForDisplay,
    stageLoadingState,
    ...resolveBuildSessionProgressPanelSplitViewProps({ stagesLength: stages.length, splitViewPanelSize: 250 }),
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
    startIcon: renderShapeBuildProgressPanelStartIcon(),
    controlLabel: t('stage.controls.title', 'Build controls'),
    controlMenuItems,
    controlMenuAriaLabel,
    controlMenuDisabled: isControlMenuDisabled,
    pauseLabel: t('stage.controls.pause', 'Pause'),
    cancelLabel: t('cancel', 'Cancel'),
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
