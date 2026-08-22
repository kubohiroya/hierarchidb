import { type NodeId, toNodeId } from '@hierarchidb/core-types';
import type { ShapeBuildStage } from '@hierarchidb/shape-api';
import type { ShapeBuildConfig } from '~/common/types/BuildTaskResult';
import { ephemeralShapeAPIImpl } from '~/services/build/ShapeBuildAPIClient';

const STAGE_ORDER: ShapeBuildStage[] = ['source', 'geometry', 'tileEmit'];

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

export async function clearStagesIfPresent(
  nodeId: NodeId,
  stages: ShapeBuildStage[]
): Promise<ShapeBuildStage[]> {
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
  nextConfig: ShapeBuildConfig | undefined
): ShapeBuildStage[] {
  if (!prevConfig || !nextConfig) {
    return FULL_INVALIDATION_STAGES;
  }
  const prev = prevConfig;
  const next = nextConfig;

  const stages = new Set<ShapeBuildStage>();

  if (hasDiff(prev.sourceConfig, next.sourceConfig)) {
    stages.add('source');
    stages.add('geometry');
    stages.add('tileEmit');
  }

  if (hasDiff(prev.geometryConfig, next.geometryConfig)) {
    stages.add('geometry');
    stages.add('tileEmit');
  }

  if (hasDiff(prev.tileEmitConfig, next.tileEmitConfig)) {
    stages.add('tileEmit');
  }

  return uniqueStages(Array.from(stages));
}

export const FULL_INVALIDATION_STAGES: ShapeBuildStage[] = ['source', 'geometry', 'tileEmit'];
