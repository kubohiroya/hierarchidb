import type { StageControls } from '@hierarchidb/batch-session-ports';

export type TaskRunner<TTask> = (
  task: TTask,
  controls: Required<Pick<StageControls, 'waitIfPaused' | 'getSignal' | 'requestPause'>>,
) => Promise<void>;

export type RunTasksResult = {
  processed: number;
  failed: number;
};
