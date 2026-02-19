import { BuildSessionProgressPanel } from '@hierarchidb/components';
import type { ShapeBuildProgressPanelViewModel } from './useShapeBuildProgressPanelViewModel.js';

export type ShapeBuildProgressPanelViewProps = ShapeBuildProgressPanelViewModel;

export const ShapeBuildProgressPanelView = ({
  status,
  overallProgress,
  stages,
  stageProgress,
  paneProgress,
  stageLoadingState,
  splitViewBreakpoints,
  splitViewInitialSizesByBreakpoint,
  splitViewAutoCloseCountsByBreakpoint,
  stageContents,
  stageProgressContent,
  stageConcurrencyIndicators,
  onStageConcurrencyIndicatorClick,
  stageConcurrencyIndicatorAriaLabels,
  stageLeadingControls,
  stageMenus,
  stageHeaderMeta,
  chipPlacement,
  suppressStatusFallback,
  onResume,
  onPause,
  startIcon,
  controlLabel,
  pauseLabel,
  stopRequested,
  pauseActsAsCancel,
  startPending,
  showResumeLabel,
  startLabel,
  resumeLabel,
  statusLabel,
  controlDetails,
  controlRightContent,
  completionDialog,
  suspendDialog,
  crashDialog,
  footer,
}: ShapeBuildProgressPanelViewProps) => (
  <BuildSessionProgressPanel
    status={status}
    overallProgress={overallProgress}
    stages={stages}
    stageProgress={stageProgress}
    paneProgress={paneProgress}
    stageLoadingState={stageLoadingState}
    splitViewBreakpoints={splitViewBreakpoints}
    splitViewInitialSizesByBreakpoint={splitViewInitialSizesByBreakpoint}
    splitViewAutoCloseCountsByBreakpoint={splitViewAutoCloseCountsByBreakpoint}
    stageContents={stageContents}
    stageProgressContent={stageProgressContent}
    stageConcurrencyIndicators={stageConcurrencyIndicators}
    onStageConcurrencyIndicatorClick={onStageConcurrencyIndicatorClick}
    stageConcurrencyIndicatorAriaLabels={stageConcurrencyIndicatorAriaLabels}
    stageLeadingControls={stageLeadingControls}
    stageMenus={stageMenus}
    stageHeaderMeta={stageHeaderMeta}
    chipPlacement={chipPlacement}
    suppressStatusFallback={suppressStatusFallback}
    onResume={onResume}
    onPause={onPause}
    startIcon={startIcon}
    controlLabel={controlLabel}
    pauseLabel={pauseLabel}
    stopRequested={stopRequested}
    pauseActsAsCancel={pauseActsAsCancel}
    startPending={startPending}
    showResumeLabel={showResumeLabel}
    startLabel={startLabel}
    resumeLabel={resumeLabel}
    statusLabel={statusLabel}
    controlDetails={controlDetails}
    controlRightContent={controlRightContent}
    completionDialog={completionDialog}
    suspendDialog={suspendDialog}
    crashDialog={crashDialog}
    footer={footer}
  />
);

