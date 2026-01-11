import { atom } from 'jotai';
import type { BuildStage, BuildStatus } from '@hierarchidb/components';
import type { PaneProgress } from '@hierarchidb/ui-lru-splitview';
import { BatchTaskSummary } from '@hierarchidb/common-api';

export type ShapeBuildTaskSummary = BatchTaskSummary & {
  metadata?: Record<string, unknown>;
  title?: string;
};

export type TaskProgressSummary = {
  stageLabel: string;
  taskLabel: string;
  overallProgress: number;
  completed: number;
  total: number;
  failed: number;
  skipped: number;
  buildStatus: BuildStatus;
  hasProgressData: boolean;
};

export type TaskProgressControls = {
  canStartOrResume: boolean;
  statusLabel: string;
  handleStartOrResume?: () => Promise<void>;
  handlePause?: () => void;
};

export type TaskProgressAuthState = {
  authDialogOpen: boolean;
  closeAuthDialog: () => void;
  handleProviderSelect: (provider: import('@hierarchidb/ui-auth').AuthProviderType) => void;
};
export const persistedTasksAtom = atom<BatchTaskSummary[]>([]);
export const tasksAtom = atom<BatchTaskSummary[]>([]);
export const tasksLoadingAtom = atom(false);
export const taskSummaryLoadingAtom = atom(false);
export const tasksErrorAtom = atom<Error | null>(null);
export const buildStagesAtom = atom<BuildStage[]>([]);
export const buildStageProgressAtom = atom<Record<string, number>>({});
export const taskPaneProgressAtom = atom<PaneProgress[]>([]);
export const tasksByStageAtom = atom<Record<string, BatchTaskSummary[]>>({});
export const taskStatusAtom = atom<BuildStatus>('idle');
export const taskProgressSummaryAtom = atom<TaskProgressSummary>({
  stageLabel: '',
  taskLabel: '',
  overallProgress: 0,
  completed: 0,
  total: 0,
  failed: 0,
  skipped: 0,
  buildStatus: 'idle',
  hasProgressData: false,
});
export const taskWarningMessageAtom = atom<string | null>(null);
export const taskProgressControlsAtom = atom<TaskProgressControls>({
  canStartOrResume: false,
  statusLabel: '',
  handleStartOrResume: async () => {},
  handlePause: () => {},
});
export const taskProgressAuthAtom = atom<TaskProgressAuthState>({
  authDialogOpen: false,
  closeAuthDialog: () => {},
  handleProviderSelect: () => {},
});
