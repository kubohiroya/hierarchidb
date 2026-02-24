import type { ShapeBuildStage } from '@hierarchidb/shape-api';
import { toNodeId, type NodeId } from '@hierarchidb/core-types';
import { ephemeralShapeAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import type { ShapeBuildConfig } from '~/common/types/build';

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

export const resolveShapeNodeId = (nodeId?: NodeId | string | null): NodeId | undefined =>
  nodeId ? toNodeId(String(nodeId)) : undefined;

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

export function resolveBuildConfigInvalidation(
  prevConfig: ShapeBuildConfig | undefined,
  nextConfig: ShapeBuildConfig | undefined,
): ShapeBuildStage[] {
  if (!prevConfig || !nextConfig) {
    return FULL_INVALIDATION_STAGES;
  }
  const prev = prevConfig;
  const next = nextConfig;

  const stages = new Set<ShapeBuildStage>();

  if (hasDiff(prev.fetchConfig, next.fetchConfig)) {
    stages.add('fetch');
    stages.add('transform');
    stages.add('vt');
  }

  if (hasDiff(prev.transformConfig, next.transformConfig)) {
    stages.add('transform');
    stages.add('vt');
  }

  if (hasDiff(prev.vtConfig, next.vtConfig)) {
    stages.add('vt');
  }

  return uniqueStages(Array.from(stages));
}

export const FULL_INVALIDATION_STAGES: ShapeBuildStage[] = [
  'fetch',
  'transform',
  'vt'
];
