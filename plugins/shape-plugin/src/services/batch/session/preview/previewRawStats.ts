import type { GeometryStatsSummary } from '../SessionTypes.js';

export type OriginEntry = {
  originKey: string;
  inputBufferId: string;
};

/**
 * raw(ダウンロード直後)のバッファ統計を originKey 単位で集計します。
 */
export async function buildRawStatsByOrigin(params: {
  entries: OriginEntry[];
  getRawBuffer: (bufferId: string) => Promise<{ data: ArrayBuffer } | null>;
  summarizeBufferStats: (buffer: ArrayBuffer) => Promise<GeometryStatsSummary>;
  accumulateStats: (prev: GeometryStatsSummary, next: GeometryStatsSummary) => GeometryStatsSummary;
}): Promise<Map<string, GeometryStatsSummary>> {
  const { entries, getRawBuffer, summarizeBufferStats, accumulateStats } = params;

  const statsByOrigin = new Map<string, GeometryStatsSummary>();

  for (const entry of entries) {
    const raw = await getRawBuffer(entry.inputBufferId);
    if (!raw) continue;

    const stats = await summarizeBufferStats(raw.data);
    const existing = statsByOrigin.get(entry.originKey) ?? { vertexCount: 0, polygonCount: 0, area: 0 };
    statsByOrigin.set(entry.originKey, accumulateStats(existing, stats));
  }

  return statsByOrigin;
}
