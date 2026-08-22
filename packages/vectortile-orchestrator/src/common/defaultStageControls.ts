import type { StageControls } from '~/ports/StageControls';

const neverAbortController = new AbortController();

/**
 * Orchestrator 内部で StageControls が未指定でも安全に動くためのデフォルト。
 *
 * - waitIfPaused: 何もしない（即 resolve）
 * - getSignal: abort されない AbortSignal（この module 内の controller は abort されない）
 * - requestPause: 何もしない
 */
export function defaultStageControls(): Required<
  Pick<StageControls, 'waitIfPaused' | 'getSignal' | 'requestPause'>
> {
  return {
    waitIfPaused: async () => {},
    getSignal: () => neverAbortController.signal,
    requestPause: async () => {},
  };
}
