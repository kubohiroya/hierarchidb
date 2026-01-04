import type { BatchConfig, ShapeEntity } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../common/types/index.js';
import type { ShapeEphemeralStage } from '@hierarchidb/plugin-service-api';
import { getShapeDbApiClient } from '../../services/batch/ShapeBatchApiClient.js';
import { toNodeId, type NodeId } from '@hierarchidb/common-types';

const STAGE_ORDER: ShapeEphemeralStage[] = ['download', 'extract1', 'extract2', 'vectorTiles'];

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

const uniqueStages = (stages: ShapeEphemeralStage[]): ShapeEphemeralStage[] => {
  const set = new Set<ShapeEphemeralStage>();
  for (const stage of stages) set.add(stage);
  return STAGE_ORDER.filter((stage) => set.has(stage));
};

export const resolveShapeNodeId = (draft?: Partial<ShapeEntity> | null): NodeId | undefined =>
  draft?.nodeId ? toNodeId(String(draft.nodeId)) : undefined;

export async function clearStagesIfPresent(nodeId: NodeId, stages: ShapeEphemeralStage[]): Promise<ShapeEphemeralStage[]> {
  const ephemeral = getShapeDbApiClient().ephemeral;
  const targetStages = uniqueStages(stages);
  const cleared: ShapeEphemeralStage[] = [];
  for (const stage of targetStages) {
    if (await ephemeral.hasStageData(nodeId, stage)) {
      await ephemeral.clearStage(nodeId, stage);
      cleared.push(stage);
    }
  }
  return cleared;
}

export function resolveBatchConfigInvalidation(
  prevConfig: BatchConfig | undefined,
  nextConfig: BatchConfig | undefined,
): ShapeEphemeralStage[] {
  const prev = mergeBatchConfig(prevConfig ?? DEFAULT_PROCESSING_CONFIG);
  const next = mergeBatchConfig(nextConfig ?? DEFAULT_PROCESSING_CONFIG);

  const stages = new Set<ShapeEphemeralStage>();

  if (hasDiff(prev.downloadConfig ?? {}, next.downloadConfig ?? {})) {
    stages.add('download');
    stages.add('extract1');
    stages.add('extract2');
    stages.add('vectorTiles');
  }

  if (hasDiff(prev.extract1Config ?? {}, next.extract1Config ?? {})) {
    stages.add('extract1');
    stages.add('extract2');
    stages.add('vectorTiles');
  }

  if (hasDiff(prev.extract2Config ?? {}, next.extract2Config ?? {})) {
    stages.add('extract2');
    stages.add('vectorTiles');
  }

  if (hasDiff(prev.tileConfig ?? {}, next.tileConfig ?? {})) {
    stages.add('vectorTiles');
  }

  return uniqueStages(Array.from(stages));
}

export const FULL_INVALIDATION_STAGES: ShapeEphemeralStage[] = [
  'download',
  'extract1',
  'extract2',
  'vectorTiles',
];
