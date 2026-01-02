import type { NodeId } from '@hierarchidb/common-types';
import type { Feature } from 'geojson';
import type { GeometryStatsSummary } from '../SessionTypes.js';
import { buildStageStatsByOrigin } from '../metadata/stageStatsByOrigin.js';
import { summarizeFeatureCollectionStats } from '../metadata/stats.js';

export async function runStageMetadataOrchestrator<TInput extends { originKey?: string }>(params: {
  enabled: boolean;
  nodeId: NodeId;
  stage: 'extract1' | 'extract2' | 'vectorTile';
  tasks: Array<{ taskId: string; index?: number }>;
  inputsByTaskId: Map<string, TInput>;
  buildBufferId: (task: { taskId: string; index?: number }) => string;
  getBuffer: (bufferId: string) => Promise<{ data: ArrayBuffer } | null>;
  decodeFeatureCollection: (buffer: ArrayBuffer) => Promise<{ type: 'FeatureCollection'; features: Feature[] } | null>;
  extractGeometryStats: (feature: Feature) => {
    vertexCount: number;
    polygonCount: number;
    bbox?: [number, number, number, number];
    area: number;
  };
  updateSourceMetadataStage: (stage: 'extract1' | 'extract2' | 'vectorTile', statsByOrigin: Map<string, GeometryStatsSummary>) => Promise<void>;
}): Promise<void> {
  const {
    enabled,
    tasks,
    inputsByTaskId,
    buildBufferId,
    getBuffer,
    decodeFeatureCollection,
    extractGeometryStats,
    stage,
    updateSourceMetadataStage,
  } = params;

  if (!enabled) return;

  const statsByOrigin = await buildStageStatsByOrigin({
    tasks,
    inputsByTaskId,
    buildBufferId,
    getBuffer,
    summarizeBufferStats: async (buffer) => {
      return await summarizeFeatureCollectionStats({
        buffer,
        decodeFeatureCollection,
        extractGeometryStats: (feature) => ({
          vertexCount: extractGeometryStats(feature).vertexCount,
          polygonCount: extractGeometryStats(feature).polygonCount,
          bbox: extractGeometryStats(feature).bbox,
        }),
      });
    },
  });

  await updateSourceMetadataStage(stage, statsByOrigin);
}

