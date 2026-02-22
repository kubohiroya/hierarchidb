import { vi } from 'vitest';

import type { ProgressInfo, VectorTileTask } from '~/ports/sharedTypes';
import type {
  RunVectorTileStageOrchestratorParams,
  VectorTileStageSummary,
} from '~/vectortile/orchestratorTypes';
import type { VectorTileStageAdapter, VectorTileStageAdapterResult } from '~/ports/VectorTileStageAdapter';

export type FakeTask = VectorTileTask & { index: number };

export function makeTask(index: number): FakeTask {
  return {
    taskId: `vt:${index}`,
    nodeId: 'node:test' as unknown as RunVectorTileStageOrchestratorParams['nodeId'],
    stage: 'wait',
    status: 'waiting',
    index,
    progress: 0,
  };
}

export function makeTasks(count: number): FakeTask[] {
  return Array.from({ length: count }, (_, i) => makeTask(i));
}

export function makeInputs(tasks: Array<{ taskId: string; index?: number }>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const t of tasks) {
    map.set(t.taskId, {
      inputBufferId: `buf:${t.index ?? 0}`,
      tileZ: 0,
      tileX: t.index ?? 0,
      tileY: t.index ?? 0,
    });
  }
  return map;
}

export function makeTaskRegistry(params?: {
  runnableTasks?: VectorTileTask[];
  completedCount?: number;
  failedCount?: number;
  total?: number;
}): RunVectorTileStageOrchestratorParams['taskRegistry'] {
  const runnableTasks = params?.runnableTasks ?? [];
  const total = params?.total ?? runnableTasks.length;
  const completedCount = params?.completedCount ?? 0;
  const failedCount = params?.failedCount ?? 0;

  return {
    registerTasks: vi.fn(async () => {}),
    resolveStageTasks: vi.fn(async () => ({ runnableTasks, completedCount, failedCount, total })),
  };
}

export function makePostprocess(callLog?: string[]): RunVectorTileStageOrchestratorParams['postprocess'] {
  return {
    persistPlaceholderMetadata: vi.fn(async () => {
      callLog?.push('postprocess.persistPlaceholderMetadata');
      return 0;
    }),
    syncVectorTilesToShapeStore: vi.fn(async () => {
      callLog?.push('postprocess.syncVectorTilesToShapeStore');
    }),
    summarizeVectorTilesByOrigin: vi.fn(async () => {
      callLog?.push('postprocess.summarizeVectorTilesByOrigin');
      return new Map();
    }),
    updateDataSourceMetadataStage: vi.fn(async () => {
      callLog?.push('postprocess.updateDataSourceMetadataStage');
    }),
    clearFeatureCache: vi.fn(() => {
      callLog?.push('postprocess.clearFeatureCache');
    }),
  };
}

export function makeAfterRun(out?: { last?: VectorTileStageSummary }): RunVectorTileStageOrchestratorParams['afterRun'] {
  return vi.fn(async (summary) => {
    if (out) out.last = summary;
  });
}

export type SummaryCapture = { last?: VectorTileStageSummary };
export function makeSummaryCapture(): SummaryCapture {
  return {};
}

export function makeAdapter(params?: {
  onCall?: (args: { tasks: VectorTileTask[]; controlsDefined: boolean }) => void;
  onProgress?: (report: (p: ProgressInfo) => void, tasks: VectorTileTask[]) => void;
  result?: VectorTileStageAdapterResult;
  allowPause?: boolean;
}): VectorTileStageAdapter {
  return {
    process: vi.fn(async (tasks, report, controls) => {
      params?.onCall?.({ tasks, controlsDefined: Boolean(controls) });
      params?.onProgress?.(report, tasks);
      if (params?.allowPause) {
        // cooperate with orchestrator's pause contract
        await controls?.waitIfPaused();
      }
      return params?.result ?? ({ processed: tasks.length, failed: 0 } satisfies VectorTileStageAdapterResult);
    }),
  };
}
