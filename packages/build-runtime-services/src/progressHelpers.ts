import type { TaskStage } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';

type NumericValue = string | number | boolean;

export type StageCheckpointPhase = 'start' | 'success' | 'error';

export type StageHeartbeatWriter = (stage: TaskStage, phase: StageCheckpointPhase) => Promise<void>;

export type StageCheckpointContext = {
  nodeId: NodeId;
  runId?: string | null;
  stage: TaskStage;
  startedAt: number;
  errorMessage?: string;
  durationMs?: number;
  memory?: Record<string, NumericValue>;
};

export type StageCheckpointLogger = {
  onStart?: (ctx: StageCheckpointContext) => void;
  onSuccess?: (ctx: StageCheckpointContext) => void;
  onError?: (ctx: StageCheckpointContext) => void;
};

export function createMemorySnapshot(): Record<string, NumericValue> | undefined {
  const memory = (
    globalThis as {
      performance?: {
        memory?: {
          usedJSHeapSize?: number;
          totalJSHeapSize?: number;
          jsHeapSizeLimit?: number;
          usedJSHeapSizeLimit?: number;
        };
      };
    }
  ).performance?.memory;

  if (!memory) return undefined;
  if (memory.usedJSHeapSize === undefined && memory.totalJSHeapSize === undefined) return undefined;

  return {
    usedJSHeapSize: memory.usedJSHeapSize ?? 0,
    totalJSHeapSize: memory.totalJSHeapSize ?? 0,
    jsHeapSizeLimit: memory.jsHeapSizeLimit ?? 0,
    usedJSHeapSizeLimit: memory.usedJSHeapSizeLimit ?? 0,
  };
}

export async function runWithStageCheckpoint<T>(options: {
  nodeId: NodeId;
  stage: TaskStage;
  action: () => Promise<T>;
  writeHeartbeat: StageHeartbeatWriter;
  runId?: string | null;
  logger?: StageCheckpointLogger;
}): Promise<T> {
  const { nodeId, stage, action, writeHeartbeat, runId, logger } = options;
  const startedAt = Date.now();

  logger?.onStart?.({
    nodeId,
    stage,
    runId,
    startedAt,
    memory: createMemorySnapshot(),
  });
  await writeHeartbeat(stage, 'start');

  try {
    const result = await action();
    const finishedAt = Date.now();
    await writeHeartbeat(stage, 'success');
    logger?.onSuccess?.({
      nodeId,
      stage,
      runId,
      startedAt,
      durationMs: finishedAt - startedAt,
      memory: createMemorySnapshot(),
    });
    return result;
  } catch (error) {
    const finishedAt = Date.now();
    await writeHeartbeat(stage, 'error');
    logger?.onError?.({
      nodeId,
      stage,
      runId,
      startedAt,
      durationMs: finishedAt - startedAt,
      errorMessage: error instanceof Error ? error.message : String(error),
      memory: createMemorySnapshot(),
    });
    throw error;
  }
}
