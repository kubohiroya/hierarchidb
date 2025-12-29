import { atom } from 'jotai';
import type { BuildStage, BuildStatus } from '@hierarchidb/components';
import type { PaneProgress } from '@hierarchidb/ui-lru-splitview';
import type { ShapeBatchTaskSummary } from '../hooks/useShapeBatchTasks.js';

export type ShapeBuildProgressSummary = {
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

export type ShapeBuildProgressControls = {
  canStartOrResume: boolean;
  statusLabel: string;
  handleStartOrResume?: () => Promise<void>;
  handlePause?: () => void;
};

export type ShapeBuildProgressAuthState = {
  authDialogOpen: boolean;
  closeAuthDialog: () => void;
  handleProviderSelect: (provider: import('@hierarchidb/ui-auth').AuthProviderType) => void;
};

export const shapeBuildTasksAtom = atom<ShapeBatchTaskSummary[]>([]);
export const shapeBuildPersistedTasksAtom = atom<ShapeBatchTaskSummary[]>([]);
export const shapeBuildTasksLoadingAtom = atom(false);
export const shapeBuildTasksErrorAtom = atom<Error | null>(null);
export const shapeBuildStagesAtom = atom<BuildStage[]>([]);
export const shapeBuildStageProgressAtom = atom<Record<string, number>>({});
export const shapeBuildPaneProgressAtom = atom<PaneProgress[]>([]);
export const shapeBuildTasksByStageAtom = atom<Record<string, ShapeBatchTaskSummary[]>>({});
export const shapeBuildBuildStatusAtom = atom<BuildStatus>('idle');
export const shapeBuildProgressSummaryAtom = atom<ShapeBuildProgressSummary>({
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
export const shapeBuildWarningMessageAtom = atom<string | null>(null);
export const shapeBuildProgressControlsAtom = atom<ShapeBuildProgressControls>({
  canStartOrResume: false,
  statusLabel: '',
  handleStartOrResume: async () => {},
  handlePause: () => {},
});
export const shapeBuildProgressAuthAtom = atom<ShapeBuildProgressAuthState>({
  authDialogOpen: false,
  closeAuthDialog: () => {},
  handleProviderSelect: () => {},
});
