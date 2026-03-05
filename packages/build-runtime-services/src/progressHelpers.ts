import type { BuildProgressEvent, TaskStage } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';

type NumericValue = string | number | boolean;

export type ProgressBridgeUpdate = {
  jobId: string;
  progress: number;
  stage: TaskStage;
  ts?: number;
};

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

const assertProgressInRange = (progress: number): number => {
  if (!Number.isFinite(progress)) {
    throw new TypeError(`progress must be a finite number: ${String(progress)}`);
  }
  if (progress < 0 || progress > 100) {
    throw new RangeError(`progress must be within 0..100: ${progress}`);
  }
  return Math.round(progress);
};

export function toBuildProgressEventFromUpdate(update: ProgressBridgeUpdate): BuildProgressEvent {
  const completed = assertProgressInRange(update.progress);
  return {
    nodeId: update.jobId as NodeId,
    stage: update.stage,
    phase: completed >= 100 ? 'completed' : 'running',
    timestamp: update.ts ?? Date.now(),
    payload: {
      total: 100,
      completed,
      failed: 0,
    },
  };
};

export function createMemorySnapshot(): Record<string, NumericValue> | undefined {
  const memory = (globalThis as {
    performance?: {
      memory?: {
        usedJSHeapSize?: number;
        totalJSHeapSize?: number;
        jsHeapSizeLimit?: number;
        usedJSHeapSizeLimit?: number;
      };
    };
  }).performance?.memory;

  if (!memory) return undefined;
  if (memory.usedJSHeapSize === undefined && memory.totalJSHeapSize === undefined) return undefined;

  return {
    usedJSHeapSize: memory.usedJSHeapSize ?? 0,
    totalJSHeapSize: memory.totalJSHeapSize ?? 0,
    jsHeapSizeLimit: memory.jsHeapSizeLimit ?? 0,
    usedJSHeapSizeLimit: memory.usedJSHeapSizeLimit ?? 0,
  };
}

export async function runWithStageCheckpoint<T>(
  options: {
    nodeId: NodeId;
    stage: TaskStage;
    action: () => Promise<T>;
    writeHeartbeat: StageHeartbeatWriter;
    runId?: string | null;
    logger?: StageCheckpointLogger;
  },
): Promise<T> {
  const {
    nodeId,
    stage,
    action,
    writeHeartbeat,
    runId,
    logger,
  } = options;
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
