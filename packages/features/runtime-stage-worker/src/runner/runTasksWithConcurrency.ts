import type { StageControls } from '@hierarchidb/batch-session-ports';

import type { RunTasksResult, TaskRunner } from '../types.js';

const defaultControls = (): Required<Pick<StageControls, 'waitIfPaused' | 'getSignal' | 'requestPause'>> => {
  const controller = new AbortController();
  return {
    waitIfPaused: async () => {},
    getSignal: () => controller.signal,
    requestPause: async () => {},
  };
};

/**
 * WebWorker 実行基盤の最小コア（現段階では worker/comlink 依存なし）。
 *
 * - maxConcurrent に従って taskRunner を並列実行
 * - 各 task の前に waitIfPaused を呼ぶ（pause 協調）
 * - getSignal() が aborted の場合は新規 task を開始しない
 */
export async function runTasksWithConcurrency<TTask>(params: {
  tasks: TTask[];
  taskRunner: TaskRunner<TTask>;
  controls?: StageControls;
}): Promise<RunTasksResult> {
  const { tasks, taskRunner, controls } = params;
  const c = { ...defaultControls(), ...controls };
  const maxConcurrent = Math.max(1, controls?.maxConcurrent ?? 1);

  let processed = 0;
  let failed = 0;

  let cursor = 0;
  const next = (): TTask | undefined => {
    if (cursor >= tasks.length) return undefined;
    const t = tasks[cursor];
    cursor += 1;
    return t;
  };

  const runOne = async (): Promise<void> => {
    for (;;) {
      if (c.getSignal().aborted) return;
      const t = next();
      if (!t) return;
      await c.waitIfPaused();
      if (c.getSignal().aborted) return;
      try {
        await taskRunner(t, c);
        processed += 1;
      } catch (e) {
        failed += 1;
        await c.requestPause(`Task failed: ${String((e as Error)?.message ?? e)}`);
      }
    }
  };

  const workers = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, () => runOne());
  await Promise.all(workers);

  return { processed, failed };
}
