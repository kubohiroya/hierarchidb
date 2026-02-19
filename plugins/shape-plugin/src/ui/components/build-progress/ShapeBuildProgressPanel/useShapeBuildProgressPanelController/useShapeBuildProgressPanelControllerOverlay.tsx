import type { ShapeBuildProgressPanelControllerBaseResult } from './base/useShapeBuildProgressPanelControllerBaseState.js';
import { useShapeBuildProgressPanelControllerOverlayDialogs } from './useShapeBuildProgressPanelControllerOverlay/useShapeBuildProgressPanelControllerOverlayDialogs.tsx';
import { useShapeBuildProgressPanelControllerOverlaySections } from './useShapeBuildProgressPanelControllerOverlay/useShapeBuildProgressPanelControllerOverlaySections.tsx';

export const useShapeBuildProgressPanelControllerOverlay = (args: ShapeBuildProgressPanelControllerBaseResult) => {
  const { stageProgressContent, stageContents } = useShapeBuildProgressPanelControllerOverlaySections(args);
  const {
    footer,
    completionDialog,
    suspendDialog,
    crashDialog,
    controlRightContent,
    stageLoadingState,
    stageHeaderMeta,
  } = useShapeBuildProgressPanelControllerOverlayDialogs(args);

  return {
    footer,
    stageProgressContent,
    stageContents,
    completionDialog,
    suspendDialog,
    crashDialog,
    controlRightContent,
    stageLoadingState,
    stageHeaderMeta,
    stageMenus: args.stageMenus,
    controls: args.controls,
    stageConcurrencyIndicators: args.stageConcurrencyIndicators,
    stageConcurrencyIndicatorAriaLabels: args.stageConcurrencyIndicatorAriaLabels,
    stageLeadingControls: args.stageLeadingControls,
    onStageConcurrencyIndicatorClick: args.onStageConcurrencyIndicatorClick,
    controlDetails: args.controlDetails,
    summary: args.summary,
    pauseButtonLabel: args.pauseButtonLabel,
    hasAnyTasks: args.hasAnyTasks,
    isBuildStartupPending: args.isBuildStartupPending,
    buildStatusAction: {
      stopRequested: args.controls.stopRequested,
      startPending: args.controls.startPending,
      statusLabel: args.controls.statusLabel,
    },
  } as const;
};
