import type { NodeId } from '@hierarchidb/common-types';
import type { GeometryStatsSummary, OriginMetadata } from './SessionTypes.js';
import type { SessionArtifactStore } from '../SessionArtifactStore.js';
import { buildRawStatsByOrigin } from './previewRawStats.js';
import { buildStatsByOrigin } from './previewStageStats.js';
import { updatePreviewMetadataStage } from './previewMetadataUpdate.js';

export type PreviewPostprocessContext = {
  enabled: boolean;
  nodeId: NodeId;
  store: SessionArtifactStore;
  originByKey: Map<string, OriginMetadata>;
  summarizeBufferStats: (buffer: ArrayBuffer) => Promise<GeometryStatsSummary>;
  accumulateStats: (prev: GeometryStatsSummary, next: GeometryStatsSummary) => GeometryStatsSummary;
};

export type PreviewRawPostprocessParams = {
  ctx: PreviewPostprocessContext;
  entries: Array<{ originKey: string; inputBufferId: string }>;
  getRawBuffer: (bufferId: string) => Promise<{ data: ArrayBuffer } | null>;
};

export type PreviewExtractStagePostprocessParams = {
  ctx: PreviewPostprocessContext;
  stage: 'extract1' | 'extract2';
  tasks: Array<{ taskId: string; index?: number | null }>;
  inputsByTaskId: Map<string, { originKey?: string | null } | undefined>;
  buildBufferId: (index: number) => string;
  getExtractedBuffer: (bufferId: string) => Promise<{ data: ArrayBuffer } | null>;
};

export type PreviewVectorTilePostprocessParams = {
  ctx: PreviewPostprocessContext;
  statsByOrigin: Map<string, GeometryStatsSummary>;
};

export async function postprocessPreviewRaw(params: PreviewRawPostprocessParams): Promise<void> {
  const { ctx, entries, getRawBuffer } = params;
  const { enabled, nodeId, store, originByKey, summarizeBufferStats, accumulateStats } = ctx;
  if (!enabled) return;

  const statsByOrigin = await buildRawStatsByOrigin({
    entries,
    getRawBuffer,
    summarizeBufferStats,
    accumulateStats,
  });

  await updatePreviewMetadataStage({
    enabled,
    nodeId,
    store,
    originByKey,
    stage: 'raw',
    statsByOrigin,
  });
}

export async function postprocessPreviewExtractStage(params: PreviewExtractStagePostprocessParams): Promise<void> {
  const { ctx, stage, tasks, inputsByTaskId, buildBufferId, getExtractedBuffer } = params;
  const { enabled, nodeId, store, originByKey, summarizeBufferStats, accumulateStats } = ctx;
  if (!enabled) return;

  const statsByOrigin = await buildStatsByOrigin({
    tasks,
    inputsByTaskId,
    buildBufferId,
    getExtractedBuffer,
    summarizeBufferStats,
    accumulateStats,
  });

  await updatePreviewMetadataStage({
    enabled,
    nodeId,
    store,
    originByKey,
    stage,
    statsByOrigin,
  });
}

export async function postprocessPreviewVectorTile(params: PreviewVectorTilePostprocessParams): Promise<void> {
  const { ctx, statsByOrigin } = params;
  const { enabled, nodeId, store, originByKey } = ctx;
  if (!enabled) return;

  await updatePreviewMetadataStage({
    enabled,
    nodeId,
    store,
    originByKey,
    stage: 'vectorTile',
    statsByOrigin,
  });
}
