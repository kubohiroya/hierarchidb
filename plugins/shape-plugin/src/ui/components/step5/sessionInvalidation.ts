import { ShapeBuildStage } from '@hierarchidb/plugin-service-api';
import type { BatchConfig, ShapeEntity } from '../../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../../common/types/index.js';
import { toNodeId, type NodeId } from '@hierarchidb/common-types';
import { shapeEphemeralAPIImpl } from '../../../services/batch/ShapeBuildApiClient.ts';

const STAGE_ORDER: ShapeBuildStage[] = ['fetch', 'transform', 'vt'];

type SimpleRecord = object;

const hasDiff = (left: SimpleRecord, right: SimpleRecord): boolean => {
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  for (const key of keys) {
    if (!Object.is(leftRecord[key], rightRecord[key])) {
      return true;
    }
  }
  return false;
};

const uniqueStages = (stages: ShapeBuildStage[]): ShapeBuildStage[] => {
  const set = new Set<ShapeBuildStage>();
  for (const stage of stages) set.add(stage);
  return STAGE_ORDER.filter((stage) => set.has(stage));
};

export const resolveShapeNodeId = (draft?: Partial<ShapeEntity> | null): NodeId | undefined =>
  draft?.nodeId ? toNodeId(String(draft.nodeId)) : undefined;

export async function clearStagesIfPresent(nodeId: NodeId, stages: ShapeBuildStage[]): Promise<ShapeBuildStage[]> {
  const targetStages = uniqueStages(stages);
  const cleared: ShapeBuildStage[] = [];
  for (const stage of targetStages) {
    if (await shapeEphemeralAPIImpl.hasStageData(nodeId, stage)) {
      await shapeEphemeralAPIImpl.clearStage(nodeId, stage);
      cleared.push(stage);
    }
  }
  return cleared;
}

export function resolveBatchConfigInvalidation(
  prevConfig: BatchConfig | undefined,
  nextConfig: BatchConfig | undefined,
): ShapeBuildStage[] {
  const prev = mergeBatchConfig(prevConfig ?? DEFAULT_PROCESSING_CONFIG);
  const next = mergeBatchConfig(nextConfig ?? DEFAULT_PROCESSING_CONFIG);

  const stages = new Set<ShapeBuildStage>();

  if (hasDiff(prev.fetchConfig ?? {}, next.fetchConfig ?? {})) {
    stages.add('fetch');
    stages.add('transform');
    stages.add('vt');
  }

  if (hasDiff(prev.extract1Config ?? {}, next.extract1Config ?? {})) {
    stages.add('transform');
    stages.add('vt');
  }

  if (hasDiff(prev.tileConfig ?? {}, next.tileConfig ?? {})) {
    stages.add('vt');
  }

  return uniqueStages(Array.from(stages));
}

export const FULL_INVALIDATION_STAGES: ShapeBuildStage[] = [
  'fetch',
  'transform',
  'vt'
];
