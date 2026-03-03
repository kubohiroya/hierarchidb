import type { ShapeBuildProgressPanelControllerBaseResult } from './base/useShapeBuildProgressPanelControllerBase.js';
import { useShapeBuildProgressPanelControllerOverlayDialogs } from './useShapeBuildProgressPanelControllerOverlay/useShapeBuildProgressPanelControllerOverlayDialogs.js';
import { useShapeBuildProgressPanelControllerOverlaySections } from './useShapeBuildProgressPanelControllerOverlay/useShapeBuildProgressPanelControllerOverlaySections.js';

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
  const { controls, ...baseState } = args;

  return {
    ...baseState,
    controls,
    stageProgressContent,
    stageContents,
    footer,
    completionDialog,
    suspendDialog,
    crashDialog,
    controlRightContent,
    stageLoadingState,
    stageHeaderMeta,
    buildStatusAction: {
      stopRequested: controls.stopRequested,
      startPending: controls.startPending,
      statusLabel: controls.statusLabel,
    },
  };
};
