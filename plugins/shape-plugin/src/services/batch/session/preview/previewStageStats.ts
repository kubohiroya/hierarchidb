import type { GeometryStatsSummary } from '../SessionTypes.js';

export type PreviewStatsAccumulator = {
  summarizeBufferStats: (buffer: ArrayBuffer) => Promise<GeometryStatsSummary>;
  accumulateStats: (prev: GeometryStatsSummary, next: GeometryStatsSummary) => GeometryStatsSummary;
};

/**
 * extracted buffers を originKey 単位に集計して statsByOrigin を作ります。
 * SessionController内の重複ロジック（extract1/extract2）を共通化するためのヘルパー。
 */
export async function buildStatsByOrigin(params: {
  tasks: Array<{ taskId: string; index?: number | null }>;
  inputsByTaskId: Map<string, { originKey?: string | null } | undefined>;
  buildBufferId: (index: number) => string;
  getExtractedBuffer: (bufferId: string) => Promise<{ data: ArrayBuffer } | null>;
  summarizeBufferStats: (buffer: ArrayBuffer) => Promise<GeometryStatsSummary>;
  accumulateStats: (prev: GeometryStatsSummary, next: GeometryStatsSummary) => GeometryStatsSummary;
}): Promise<Map<string, GeometryStatsSummary>> {
  const {
    tasks,
    inputsByTaskId,
    buildBufferId,
    getExtractedBuffer,
    summarizeBufferStats,
    accumulateStats,
  } = params;

  const statsByOrigin = new Map<string, GeometryStatsSummary>();

  for (const task of tasks) {
    const input = inputsByTaskId.get(task.taskId);
    const originKey = input?.originKey;
    if (!originKey) continue;

    const bufferId = buildBufferId(task.index ?? 0);
    const buffer = await getExtractedBuffer(bufferId);
    if (!buffer) continue;

    const stats = await summarizeBufferStats(buffer.data);
    const existing = statsByOrigin.get(originKey) ?? { vertexCount: 0, polygonCount: 0, area: 0 };
    statsByOrigin.set(originKey, accumulateStats(existing, stats));
  }

  return statsByOrigin;
}
