import type { StageControls } from './buildStageControls.js';

const neverAbortController = new AbortController();

/**
 * orchestrator 内部で StageControls が未指定でも安全に動くためのデフォルト。
 *
 * - waitIfPaused: 何もしない（即 resolve）
 * - getSignal: abort されない AbortSignal（この module 内の controller は abort されない）
 * - requestPause: 何もしない
 */
export function defaultStageControls(): Required<StageControls> {
  return {
    waitIfPaused: async () => {},
    getSignal: () => neverAbortController.signal,
    requestPause: async () => {},
  };
}
