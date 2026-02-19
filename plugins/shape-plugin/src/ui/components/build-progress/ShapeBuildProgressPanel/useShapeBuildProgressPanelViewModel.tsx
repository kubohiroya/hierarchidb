import { toNodeType } from '@hierarchidb/core-types';
import { BuildSessionLauncherPanel } from '@hierarchidb/ui-batch-progress';
import { Box } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import type { ShapeEntity } from '../../../../common/types/ShapeEntity.js';
import type { useShapeBuildProgressPanelController } from './useShapeBuildProgressPanelController.js';

type UseShapeBuildProgressPanelViewModelArgs = {
  coreState: ShapeBuildProgressPanelControllerResult;
  nodeId?: ShapeEntity['id'];
};

type StageSplitSizesByBreakpoint = number[];
type StageSplitAutoCloseCounts = [number, number, number, number];

type ShapeBuildProgressPanelControllerResult = ReturnType<typeof useShapeBuildProgressPanelController>;

type ShapeBuildProgressPanelViewModel = {
  status: ShapeBuildProgressPanelControllerResult['summary']['buildStatus'];
  overallProgress: number;
  stages: ShapeBuildProgressPanelControllerResult['stages'];
  stageProgress: ShapeBuildProgressPanelControllerResult['stageProgressForDisplay'];
  paneProgress: ShapeBuildProgressPanelControllerResult['paneProgressForDisplay'];
  stageLoadingState: ShapeBuildProgressPanelControllerResult['stageLoadingState'];
  splitViewBreakpoints: number[];
  splitViewInitialSizesByBreakpoint: [
    StageSplitSizesByBreakpoint,
    StageSplitSizesByBreakpoint,
    StageSplitSizesByBreakpoint,
    StageSplitSizesByBreakpoint,
  ];
  splitViewAutoCloseCountsByBreakpoint: StageSplitAutoCloseCounts;
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
  startIcon: JSX.Element;
  controlLabel: string;
  pauseLabel: string;
  stopRequested: boolean;
  pauseActsAsCancel: boolean;
  startPending: boolean;
  showResumeLabel: boolean;
  startLabel: string;
  resumeLabel: string;
  statusLabel: string;
  controlDetails: ShapeBuildProgressPanelControllerResult['controlDetails'];
  controlRightContent: JSX.Element;
  completionDialog: ShapeBuildProgressPanelControllerResult['completionDialog'];
  suspendDialog: ShapeBuildProgressPanelControllerResult['suspendDialog'];
  crashDialog: ShapeBuildProgressPanelControllerResult['crashDialog'];
  footer: ShapeBuildProgressPanelControllerResult['footer'];
};

export const useShapeBuildProgressPanelViewModel = ({
  coreState,
  nodeId,
}: UseShapeBuildProgressPanelViewModelArgs): ShapeBuildProgressPanelViewModel => {
  const {
    t,
    stages,
    stageProgressForDisplay,
    paneProgressForDisplay,
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
    isBuildStartupPending,
    pauseButtonLabel,
    handleStartClickWithHold,
  } = coreState;

  return {
    status: summary.buildStatus,
    overallProgress: summary.overallProgress,
    stages,
    stageProgress: stageProgressForDisplay,
    paneProgress: paneProgressForDisplay,
    stageLoadingState,
    splitViewBreakpoints: [600, 900, 1200],
    splitViewInitialSizesByBreakpoint: [
      Array.from({ length: stages.length }, () => 250),
      Array.from({ length: stages.length }, () => 250),
      Array.from({ length: stages.length }, () => 250),
      Array.from({ length: stages.length }, () => 250),
    ],
    splitViewAutoCloseCountsByBreakpoint: [
      Math.max(0, stages.length - 1),
      Math.max(0, stages.length - 2),
      Math.max(0, stages.length - 3),
      0,
    ],
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
    startIcon: <ConstructionIcon fontSize="small" />,
    controlLabel: t('stage.controls.title', 'Build controls'),
    pauseLabel: pauseButtonLabel,
    stopRequested: controls.stopRequested ?? false,
    pauseActsAsCancel: isBuildStartupPending,
    startPending: controls.startPending,
    showResumeLabel: controls.showResumeLabel ?? false,
    startLabel: t('stage.controls.start', 'Start Build'),
    resumeLabel: t('stage.controls.resume', 'Resume Build'),
    statusLabel: controls.statusLabel,
    controlDetails,
    controlRightContent: (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
        <BuildSessionLauncherPanel nodeType={toNodeType('shape')} excludeNodeId={nodeId} />
        {controlRightContent}
      </Box>
    ),
    completionDialog,
    suspendDialog,
    crashDialog,
    footer,
  };
};

export type { ShapeBuildProgressPanelViewModel };
