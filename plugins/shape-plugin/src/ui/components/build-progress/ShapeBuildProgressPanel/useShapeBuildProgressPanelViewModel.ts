import type { BuildControlMenuItem } from '@hierarchidb/components';
import { IconButton } from '@mui/material';
import {
  type BuildSessionProgressPanelViewModel,
  resolveBuildSessionProgressPanelSplitViewProps,
} from '@hierarchidb/ui-build-progress';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PlaylistRemoveIcon from '@mui/icons-material/PlaylistRemove';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import PhonelinkEraseIcon from '@mui/icons-material/PhonelinkErase';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import type { useShapeBuildProgressPanelController } from './useShapeBuildProgressPanelController.js';
import {
  ShapeBuildProgressPanelControlRightContent,
  ShapeBuildProgressPanelHeaderIcon,
  ShapeBuildProgressPanelStartIcon,
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
  resetDeleteMenuItems?: Array<{ id: string; label: string; onClick: () => void; disabled?: boolean; icon?: ReactNode }>;
  resetDeleteMenuAriaLabel?: string;
  resetDeleteMenuDisabled?: boolean;
  completionDialog: ShapeBuildProgressPanelControllerResult['completionDialog'];
  suspendDialog: ShapeBuildProgressPanelControllerResult['suspendDialog'];
  crashDialog: ShapeBuildProgressPanelControllerResult['crashDialog'];
  footer: ShapeBuildProgressPanelControllerResult['footer'];
} & BuildSessionProgressPanelViewModel;

export const useShapeBuildProgressPanelViewModel = ({
  coreState,
  nodeId,
}: UseShapeBuildProgressPanelViewModelArgs): BuildSessionProgressPanelViewModel => {
  const {
    t,
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
    cacheCounts,
    cacheResultCounts,
    cacheCanDeleteSourceApiCache,
    cacheCanDeleteSourceFilteredCache,
    cacheCanDeleteGeometryCache,
    cacheCanDeleteTileEmitCache,
    cacheCanDeleteTransposeIndex,
    cacheCanDeleteMetadata,
    cacheHandleDeleteSourceApiCache,
    cacheHandleDeleteSourceFilteredCache,
    cacheHandleDeleteGeometryCache,
    cacheHandleDeleteTileEmitCache,
    cacheHandleDeleteTransposeIndex,
    cacheHandleDeleteMetadata,
    cacheHandleResetSession,
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
    chipPlacement: 'belowProgress' as const,
    suppressStatusFallback: true,
    onResume: controls.canStartOrResume ? handleStartClickWithHold : undefined,
    onPause: controls.stopRequested ? undefined : (() => {
      void controls.handlePause?.();
    }),
    onCancel: () => {
      void controls.handleCancelQueued?.();
    },
    controlHeaderIcon: null,
    startIcon: ShapeBuildProgressPanelStartIcon(),
    controlLabel: '',
    controlMenuItems: undefined, // Remove Build Session dropdown menu as requested
    controlMenuAriaLabel: undefined,
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
    controlRightContent: ShapeBuildProgressPanelControlRightContent({
      nodeId,
      controlRightContent,
    }),
    resetDeleteMenuItems: [
      { 
        id: 'reset-session', 
        label: t('stage.controls.resetSession', 'Reset build session'), 
        onClick: cacheHandleResetSession, 
        disabled: false, // Reset is always available
        icon: createElement(RestartAltIcon, { fontSize: 'small' }) 
      },
      { id: 'divider-1', label: '---', onClick: () => {}, disabled: true },
      { 
        id: 'delete-metadata', 
        label: t('stage.controls.deleteMetadata', 'Delete feature metadata'), 
        onClick: cacheHandleDeleteMetadata, 
        disabled: !cacheCanDeleteMetadata,
        icon: createElement(PlaylistRemoveIcon, { fontSize: 'small' }) 
      },
      { id: 'divider-2', label: '---', onClick: () => {}, disabled: true },
      { 
        id: 'delete-api-cache', 
        label: t('stage.controls.deleteApiCache', 'Delete API cache'), 
        onClick: cacheHandleDeleteSourceApiCache, 
        disabled: !cacheCanDeleteSourceApiCache,
        icon: createElement(CloudOffIcon, { fontSize: 'small' }) 
      },
      { 
        id: 'delete-filtered-cache', 
        label: t('stage.controls.deleteFilteredCache', 'Delete filtered cache'), 
        onClick: cacheHandleDeleteSourceFilteredCache, 
        disabled: !cacheCanDeleteSourceFilteredCache,
        icon: createElement(FilterAltOffIcon, { fontSize: 'small' }) 
      },
      { id: 'divider-3', label: '---', onClick: () => {}, disabled: true },
      { 
        id: 'delete-simplified-cache', 
        label: t('stage.controls.deleteSimplifiedCache', 'Delete simplified cache'), 
        onClick: cacheHandleDeleteGeometryCache, 
        disabled: !cacheCanDeleteGeometryCache,
        icon: createElement(FilterListOffIcon, { fontSize: 'small' }) 
      },
      { id: 'divider-4', label: '---', onClick: () => {}, disabled: true },
      { 
        id: 'delete-transpose-index', 
        label: t('stage.controls.deleteTransposeIndex', 'Delete transpose index'), 
        onClick: cacheHandleDeleteTransposeIndex, 
        disabled: !cacheCanDeleteTransposeIndex,
        icon: createElement(PhonelinkEraseIcon, { fontSize: 'small' }) 
      },
    ],
    resetDeleteMenuAriaLabel: t('stage.controls.resetDeleteMenu', 'Reset/Delete menu'),
    resetDeleteMenuDisabled: false,
    completionDialog,
    suspendDialog,
    crashDialog,
    footer,
  };
};

export type { ShapeBuildProgressPanelViewModel };
