export type CanonicalUiStageId = 'source' | 'geometry' | 'tileEmit';
export type LegacyUiStageId = 'source' | 'geometry' | 'tileEmit';

export const normalizeUiStageId = (
  stageId: string | null | undefined,
): CanonicalUiStageId | undefined => {
  if (!stageId) return undefined;
  if (
    stageId === 'source'
    || stageId === 'source-stage'
    || stageId.includes(':source-stage:')
    || stageId.includes(':source:')
  ) {
    return 'source';
  }
  if (
    stageId === 'geometry'
    || stageId === 'geometry-stage'
    || stageId.includes(':geometry-stage:')
    || stageId.includes(':geometry:')
  ) {
    return 'geometry';
  }
  if (
    stageId === 'tileEmit'
    || stageId === 'tile-emit-stage'
    || stageId.includes(':tile-emit-stage:')
    || stageId.includes(':tileEmit:')
  ) {
    return 'tileEmit';
  }
  return undefined;
};

export const isGeometryLikeStageId = (stageId: string | null | undefined): boolean => (
  normalizeUiStageId(stageId) === 'geometry'
);

export const isTileEmitLikeStageId = (stageId: string | null | undefined): boolean => (
  normalizeUiStageId(stageId) === 'tileEmit'
);

export const isSourceLikeStageId = (stageId: string | null | undefined): boolean => (
  normalizeUiStageId(stageId) === 'source'
);

export const toLegacyUiStageId = (stageId: CanonicalUiStageId): LegacyUiStageId => {
  if (stageId === 'source') return 'source';
  if (stageId === 'geometry') return 'geometry';
  return 'tileEmit';
};

export const resolveStageAliasValue = <T>(
  valuesByStage: Record<string, T>,
  stageId: string | null | undefined,
): T | undefined => {
  if (!stageId) return undefined;
  const direct = valuesByStage[stageId];
  if (direct !== undefined) return direct;
  const canonical = normalizeUiStageId(stageId);
  if (!canonical) return undefined;
  const canonicalValue = valuesByStage[canonical];
  if (canonicalValue !== undefined) return canonicalValue;
  const aliasEntry = Object.entries(valuesByStage).find(([key]) => normalizeUiStageId(key) === canonical);
  return aliasEntry?.[1];
};

export const resolveStageAliasArray = <T>(
  valuesByStage: Record<string, T[]>,
  stageId: string | null | undefined,
): T[] => (
  resolveStageAliasValue(valuesByStage, stageId) ?? []
);
