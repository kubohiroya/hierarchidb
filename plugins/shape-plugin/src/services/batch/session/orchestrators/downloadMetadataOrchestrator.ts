import type { NodeId } from '@hierarchidb/common-types';
import type { Feature, FeatureCollection } from 'geojson';
import type { DownloadStageOutput } from '../../strategies/DownloadStageStrategy.js';
import type { GeometryStatsSummary, OriginMetadata } from '../SessionTypes.js';
import { summarizeFeatureCollectionStats, accumulateGeometryStats } from '../metadata/stats.js';
import { updateRawSourceMetadata } from '../stages/download/metadata/updateRawSourceMetadata.js';

export async function runDownloadMetadataOrchestrator(params: {
  enabled: boolean;
  nodeId: NodeId;
  outputs: DownloadStageOutput[];
  indexOriginMetadata: (outputs: DownloadStageOutput[]) => OriginMetadata[];
  updateSourceMetadataBase: (entries: OriginMetadata[]) => Promise<void>;
  listRawBuffer: (bufferId: string) => Promise<{ data: ArrayBuffer } | null>;
  decodeFeatureCollection: (buffer: ArrayBuffer) => Promise<FeatureCollection | null>;
  extractGeometryStats: (feature: Feature) => {
    vertexCount: number;
    polygonCount: number;
    bbox?: [number, number, number, number];
    area: number;
  };
  updateSourceMetadataStage: (stage: 'raw', statsByOrigin: Map<string, GeometryStatsSummary>) => Promise<void>;
}): Promise<void> {
  const {
    enabled,
    nodeId,
    outputs,
    indexOriginMetadata,
    updateSourceMetadataBase,
    listRawBuffer,
    decodeFeatureCollection,
    extractGeometryStats,
    updateSourceMetadataStage,
  } = params;

  await updateRawSourceMetadata({
    enabled,
    nodeId,
    outputs,
    indexOriginMetadata,
    updateSourceMetadataBase,
    listRawBuffer,
    summarizeBufferStats: (buffer) => summarizeFeatureCollectionStats({
      buffer,
      decodeFeatureCollection,
      extractGeometryStats,
    }),
    accumulateStats: (prev, next) => accumulateGeometryStats(prev, next),
    updateSourceMetadataStage,
  });
}
