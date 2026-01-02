import type { GeometryStatsSummary } from '../SessionTypes.js';
import { accumulateGeometryStats } from './stats.js';

export async function buildStageStatsByOrigin<TInput extends { originKey?: string }>(params: {
  tasks: Array<{ taskId: string; index?: number }>;
  inputsByTaskId: Map<string, TInput>;
  buildBufferId: (task: { taskId: string; index?: number }) => string;
  getBuffer: (bufferId: string) => Promise<{ data: ArrayBuffer } | null>;
  summarizeBufferStats: (buffer: ArrayBuffer) => Promise<GeometryStatsSummary>;
}): Promise<Map<string, GeometryStatsSummary>> {
  const statsByOrigin = new Map<string, GeometryStatsSummary>();

  for (const task of params.tasks) {
    const originKey = params.inputsByTaskId.get(task.taskId)?.originKey;
    if (!originKey) continue;

    const bufferId = params.buildBufferId(task);
    const buffer = await params.getBuffer(bufferId);
    if (!buffer) continue;

    const stats = await params.summarizeBufferStats(buffer.data);
    const existing = statsByOrigin.get(originKey) ?? { vertexCount: 0, polygonCount: 0 };
    statsByOrigin.set(originKey, accumulateGeometryStats(existing, stats));
  }

  return statsByOrigin;
}

