import type { ProcessingStage } from '../../../../common/types/index.js';

export type BatchTaskPauseHandler = (
  stage: ProcessingStage,
  message: string,
) => void | Promise<void>;

