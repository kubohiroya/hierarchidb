import type { ShapeBuildStage } from '@hierarchidb/plugin-service-api';
import type { ShapeEntity } from '../../../common/types/index.js';
import { DEFAULT_BUILD_CONFIG, mergeBuildConfig } from '../../../common/types/index.js';
import { toNodeId, type NodeId } from '@hierarchidb/common-types';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { ephemeralShapeAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';

const STAGE_ORDER: ShapeBuildStage[] = ['fetch', 'transform-by-band', 'transform-by-zoom', 'vt'];

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
    if (await ephemeralShapeAPIImpl.hasStageData(nodeId, stage)) {
      await ephemeralShapeAPIImpl.clearStage(nodeId, stage);
      cleared.push(stage);
    }
  }
  return cleared;
}

export function resolveBatchConfigInvalidation(
  prevConfig: ShapeBuildConfig | undefined,
  nextConfig: ShapeBuildConfig | undefined,
): ShapeBuildStage[] {
  const prev = mergeBuildConfig(prevConfig ?? DEFAULT_BUILD_CONFIG);
  const next = mergeBuildConfig(nextConfig ?? DEFAULT_BUILD_CONFIG);

  const stages = new Set<ShapeBuildStage>();

  if (hasDiff(prev.fetchConfig ?? {}, next.fetchConfig ?? {})) {
    stages.add('fetch');
    stages.add('transform-by-band');
    stages.add('transform-by-zoom');
    stages.add('vt');
  }

  if (hasDiff(prev.transformByBandConfig ?? {}, next.transformByBandConfig ?? {})) {
    stages.add('transform-by-band');
    stages.add('transform-by-zoom');
    stages.add('vt');
  }

  if (hasDiff(prev.transformByZoomConfig ?? {}, next.transformByZoomConfig ?? {})) {
    stages.add('transform-by-zoom');
    stages.add('vt');
  }

  if (hasDiff(prev.vtConfig ?? {}, next.vtConfig ?? {})) {
    stages.add('vt');
  }

  return uniqueStages(Array.from(stages));
}

export const FULL_INVALIDATION_STAGES: ShapeBuildStage[] = [
  'fetch',
  'transform-by-band',
  'transform-by-zoom',
  'vt'
];
