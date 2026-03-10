import type { BuildStage, BuildStatus } from '@hierarchidb/components';
import type { NodeId } from '@hierarchidb/core-types';
import type { PaneProgress } from '@hierarchidb/ui-lru-splitview';
import type { BuildTaskSummary } from '@hierarchidb/build-api';
import type { TaskStage } from '@hierarchidb/build-api';

export type ShapeBuildTaskSummary = Omit<BuildTaskSummary, 'stage'> & {
  nodeId?: NodeId;
  stage: TaskStage;
  index?: number;
  stagePriority?: number;
  metadata?: Record<string, unknown>;
  retryAttempt?: number;
  title?: string;
  error?: string;
  errorMessage?: string;
};

export type TaskProgressSummary = {
  stageLabel: string;
  taskLabel: string;
  taskUnitLabel: string;
  overallProgress: number;
  completed: number;
  total: number;
  failed: number;
  skipped: number;
  buildStatus: BuildStatus;
  hasProgressData: boolean;
  timingStageId?: string | null;
  completedStageElapsedMs: Record<string, number>;
  totalElapsedMs: number;
  stageElapsedMs: number;
  stageRemainingMs: number | null;
  stageTotals: Record<string, {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  }>;
};

export type TaskProgressControls = {
  canStartOrResume: boolean;
  statusLabel: string;
  showResumeLabel?: boolean;
  startPending?: boolean;
  requestedControlAction?: 'none' | 'start' | 'pause' | 'cancel';
  handleStartOrResume?: () => Promise<void>;
  handlePause?: () => void;
  handleCancelQueued?: () => Promise<void> | void;
  stopRequested?: boolean;
};

export type TaskScrollTarget = {
  stageId: string;
  taskId: string;
  requestedAt: number;
};

export type TaskViewportRange = {
  stageId: string;
  startTaskId: string;
  endTaskId: string;
  startIndex: number;
  endIndex: number;
  total: number;
};

export type TaskListViewPhase =
  | 'idle'
  | 'ui-initializing'
  | 'streaming'
  | 'settledEmpty';

export type ShapeBuildProgressAtomShape = {
  stages: BuildStage[];
  paneProgress: PaneProgress[];
};
