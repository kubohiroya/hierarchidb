import { atom } from 'jotai';
import type { BuildStage, BuildStatus } from '@hierarchidb/components';
import type { PaneProgress } from '@hierarchidb/ui-lru-splitview';
import type { BuildTaskSummary } from '@hierarchidb/batch-api';
import type { TaskStage } from '@hierarchidb/batch-api';

export type ShapeBuildTaskSummary = Omit<BuildTaskSummary, 'stage'> & {
  stage: TaskStage;
  index?: number;
  stagePriority?: number;
  metadata?: Record<string, unknown>;
  title?: string;
  error?: string;
  errorMessage?: string;
  sequence?: number;
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
  handleStartOrResume?: () => Promise<void>;
  handlePause?: () => void;
  pausePending?: boolean;
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
  updatedAt: number;
};

export type TaskProgressAuthState = {
  authDialogOpen: boolean;
  closeAuthDialog: () => void;
  handleProviderSelect: (provider: import('@hierarchidb/ui-auth').AuthProviderType) => void;
};
export const persistedTasksAtom = atom<ShapeBuildTaskSummary[]>([]);
export const tasksAtom = atom<ShapeBuildTaskSummary[]>([]);
export const tasksLoadingAtom = atom(false);
export const taskSummaryLoadingAtom = atom(false);
export const tasksErrorAtom = atom<Error | null>(null);
export const buildStagesAtom = atom<BuildStage[]>([]);
export const buildStageProgressAtom = atom<Record<string, number>>({});
export const taskPaneProgressAtom = atom<PaneProgress[]>([]);
export const tasksByStageAtom = atom<Record<string, ShapeBuildTaskSummary[]>>({});
export const taskStatusAtom = atom<BuildStatus>('idle');
export const taskProgressSummaryAtom = atom<TaskProgressSummary>({
  stageLabel: '',
  taskLabel: '',
  taskUnitLabel: '',
  overallProgress: 0,
  completed: 0,
  total: 0,
  failed: 0,
  skipped: 0,
  buildStatus: 'idle',
  hasProgressData: false,
  timingStageId: null,
  completedStageElapsedMs: {},
  totalElapsedMs: 0,
  stageElapsedMs: 0,
  stageRemainingMs: null,
  stageTotals: {},
});
export const taskScrollTargetAtom = atom<TaskScrollTarget | null>(null);
export const taskViewportRangeAtom = atom<TaskViewportRange | null>(null);
export const taskWarningMessageAtom = atom<string | null>(null);
export const crashSuspectMessageAtom = atom<string | null>(null);
export const crashSuspectOpenAtom = atom(false);
export type CrashSuspectControls = {
  close: () => void;
};
export const crashSuspectControlsAtom = atom<CrashSuspectControls>({
  close: () => {},
});
export const suspendSuspectMessageAtom = atom<string | null>(null);
export const suspendSuspectOpenAtom = atom(false);
export type SuspendSuspectControls = {
  close: () => void;
};
export const suspendSuspectControlsAtom = atom<SuspendSuspectControls>({
  close: () => {},
});
export const taskProgressControlsAtom = atom<TaskProgressControls>({
  canStartOrResume: false,
  statusLabel: '',
  startPending: false,
  handleStartOrResume: async () => {},
  handlePause: () => {},
  pausePending: false,
});
export const taskProgressAuthAtom = atom<TaskProgressAuthState>({
  authDialogOpen: false,
  closeAuthDialog: () => {},
  handleProviderSelect: () => {},
});
