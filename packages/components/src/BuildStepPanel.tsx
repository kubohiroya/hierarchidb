import { type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { type PaneProgress } from '@hierarchidb/ui-lru-splitview';
import type { BuildStage } from './BuildStage.tsx';
import type { BuildStatus } from './build-status/BuildStatus.ts';

export type BuildStepStageMenu = {
  items: any[];
  disabled?: boolean;
  ariaLabel?: string;
};

export type BuildControlDetail = {
  label: ReactNode;
  value: string;
  icon?: 'timelapse';
};

export type BuildControlMenuItem = {
  id: string;
  label: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

export type BuildStepPanelProps = {
  status: BuildStatus;
  overallProgress?: number;
  stages: BuildStage[];
  stageProgress?: Record<string, number>;
  paneProgress?: PaneProgress[];
  stageConcurrencyIndicators?: Record<string, ReactNode>;
  onStageConcurrencyIndicatorClick?: (stageId: string, event: ReactMouseEvent<HTMLElement>) => void;
  stageConcurrencyIndicatorAriaLabels?: Record<string, string>;
  stageLeadingControls?: Record<string, ReactNode>;
  stageMenus?: Record<string, BuildStepStageMenu>;
  stageHeaderMeta?: Record<string, ReactNode>;
  splitViewBreakpoints?: number[];
  splitViewInitialSizesByBreakpoint?: Record<number, number[]>;
  splitViewAutoCloseCountsByBreakpoint?: Record<number, number>;
  stageContents?: Record<string, ReactNode>;
  stageProgressContent?: Record<string, ReactNode>;
  stageLoadingState?: Record<string, boolean>;
  tasksByStageForDisplay?: Record<string, any[]>;
  chipPlacement?: 'top' | 'bottom';
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
  controlHeaderIcon?: ReactNode;
  controlLabel?: string;
  pauseLabel?: string;
  cancelLabel?: string;
  stopRequested?: boolean;
  startPending?: boolean;
  startLabel?: string;
  resumeLabel?: string;
  showResumeLabel?: boolean;
  startIcon?: ReactNode;
  resumeIcon?: ReactNode;
  statusLabel?: string;
  statusContent?: ReactNode;
  suppressStatusFallback?: boolean;
  controlDetails?: BuildControlDetail[];
  controlRightContent?: ReactNode;
  controlMenuItems?: BuildControlMenuItem[];
  controlMenuAriaLabel?: string;
  controlMenuDisabled?: boolean;
  startLoading?: boolean;
};

export const BuildStepPanel: React.FC<BuildStepPanelProps> = () => {
  // Minimal implementation - component will be properly implemented later
  return (
    <Box>
      Build Step Panel - Implementation in progress
    </Box>
  );
};