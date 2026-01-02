import type { ProcessingStage } from '../../../../../common/types/index.js';

/**
 * Pause/abort のための最小 controls。
 *
 * - download/extract1/extract2 はこれで十分（自発的 pause 要求はしない）。
 * - orchestrator は Plan A により未指定でも defaultStageControls() で安全に動くが、
 *   SessionController から渡す場合はこの形に揃える。
 */
export type StagePauseAbortControls = {
  waitIfPaused: () => Promise<void>;
  getSignal: () => AbortSignal;
};

/**
 * requestPause を含むフル controls。
 *
 * vectortile の adapter は処理中に「自発的に pause を要求」する可能性があるため、
 * SessionController は vectortile に対してのみ requestPause を配線する。
 */
export type StageControls = StagePauseAbortControls & {
  requestPause: (message: string) => Promise<void>;
};

export type StageControlsDeps = {
  waitForStageResume: (stage: ProcessingStage) => Promise<void>;
  getStageAbortSignal: (stage: ProcessingStage) => AbortSignal;
  pauseStage: (stage: ProcessingStage) => void;
  pauseHandler?: (stage: ProcessingStage, message: string) => Promise<void> | void;
};

/**
 * pause/abort の wiring だけを行う（requestPause は含めない）。
 */
export function buildStagePauseAbortControls(stage: ProcessingStage, deps: StageControlsDeps): StagePauseAbortControls {
  return {
    waitIfPaused: () => deps.waitForStageResume(stage),
    getSignal: () => deps.getStageAbortSignal(stage),
  };
}

/**
 * SessionController が持つ pause/resume/abort の仕組みを、任意ステージ向けの controls に集約する。
 *
 * NOTE: Plan A により orchestrator 側は controls を optional 受け取りにして defaultStageControls() を適用する。
 *       ただし SessionController 側では pause/abort を確実に効かせるため、明示的に渡し続ける。
 */
export function buildStageControls(stage: ProcessingStage, deps: StageControlsDeps): StageControls {
  return {
    waitIfPaused: () => deps.waitForStageResume(stage),
    getSignal: () => deps.getStageAbortSignal(stage),
    requestPause: async (message: string) => {
      deps.pauseStage(stage);
      await deps.pauseHandler?.(stage, message);
    },
  };
}
