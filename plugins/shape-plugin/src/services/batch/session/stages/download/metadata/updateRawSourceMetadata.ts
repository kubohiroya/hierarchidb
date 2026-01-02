import type { NodeId } from '@hierarchidb/common-types';
import type { DownloadStageOutput } from '../../../../strategies/DownloadStageStrategy.js';
import type { GeometryStatsSummary, OriginMetadata } from '../../../SessionTypes.js';

export async function updateRawSourceMetadata(params: {
  enabled: boolean;
  nodeId: NodeId;
  outputs: DownloadStageOutput[];
  indexOriginMetadata: (outputs: DownloadStageOutput[]) => OriginMetadata[];
  updateSourceMetadataBase: (entries: OriginMetadata[]) => Promise<void>;
  listRawBuffer: (bufferId: string) => Promise<{ data: ArrayBuffer } | null>;
  summarizeBufferStats: (buffer: ArrayBuffer) => Promise<GeometryStatsSummary>;
  accumulateStats: (prev: GeometryStatsSummary, next: GeometryStatsSummary) => GeometryStatsSummary;
  updateSourceMetadataStage: (stage: 'raw', statsByOrigin: Map<string, GeometryStatsSummary>) => Promise<void>;
}): Promise<void> {
  const {
    enabled,
    outputs,
    indexOriginMetadata,
    updateSourceMetadataBase,
    listRawBuffer,
    summarizeBufferStats,
    accumulateStats,
    updateSourceMetadataStage,
  } = params;

  const originEntries = indexOriginMetadata(outputs);

  if (!enabled) {
    return;
  }

  await updateSourceMetadataBase(originEntries);

  const rawStatsByOrigin = new Map<string, GeometryStatsSummary>();
  for (const entry of originEntries) {
    const raw = await listRawBuffer(entry.inputBufferId);
    if (!raw) continue;

    const stats = await summarizeBufferStats(raw.data);
    const existing = rawStatsByOrigin.get(entry.originKey) ?? { vertexCount: 0, polygonCount: 0, area: 0 };
    rawStatsByOrigin.set(entry.originKey, accumulateStats(existing, stats));
  }

  await updateSourceMetadataStage('raw', rawStatsByOrigin);
}
