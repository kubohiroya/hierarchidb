type StageRef = { id: string };

import { normalizeUiStageId } from './stageIdAliases';

const CANONICAL_STAGE_ORDER = ['source', 'geometry', 'tileEmit'] as const;

const resolveCanonicalStageRank = (stageId: string): number | null => {
  const canonical = normalizeUiStageId(stageId);
  if (!canonical) return null;
  const index = CANONICAL_STAGE_ORDER.indexOf(canonical);
  return index >= 0 ? index : null;
};

export const resolveStagePriority = (stageId: string, stages: StageRef[]): number => {
  const canonicalRank = resolveCanonicalStageRank(stageId);
  if (canonicalRank !== null) {
    return canonicalRank;
  }
  const stageIndex = stages.findIndex((stage) => stage.id === stageId);
  if (stageIndex >= 0) {
    return CANONICAL_STAGE_ORDER.length + stageIndex;
  }
  return Number.MIN_SAFE_INTEGER;
};

export const resolveMostAdvancedStageId = (
  stageIds: Iterable<string>,
  stages: StageRef[]
): string | null => {
  let selectedStageId: string | null = null;
  let selectedPriority = Number.MIN_SAFE_INTEGER;
  for (const stageId of stageIds) {
    const priority = resolveStagePriority(stageId, stages);
    if (priority > selectedPriority) {
      selectedPriority = priority;
      selectedStageId = stageId;
    }
  }
  return selectedStageId;
};
