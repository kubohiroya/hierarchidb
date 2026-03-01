import type { ShapeBuildStage } from '@hierarchidb/shape-api';

export const toLegacyBuildStageFromStageId = (
  stageId: string | undefined,
): ShapeBuildStage | undefined => {
  if (!stageId) return undefined;
  if (
    stageId === 'source-stage'
    || stageId.includes(':source-stage:')
    || stageId.includes(':source:')
  ) {
    return 'source';
  }
  if (
    stageId === 'geometry-stage'
    || stageId.includes(':geometry-stage:')
    || stageId.includes(':geometry:')
  ) {
    return 'geometry';
  }
  if (
    stageId === 'tile-emit-stage'
    || stageId.includes(':tile-emit-stage:')
    || stageId.includes(':tileEmit:')
  ) {
    return 'tileEmit';
  }
  return undefined;
};

export const toLegacyBuildStage = (
  stage: unknown,
  stageId?: string,
): ShapeBuildStage | undefined => {
  const fromStageId = toLegacyBuildStageFromStageId(stageId);
  if (fromStageId !== undefined) return fromStageId;
  if (stage === 'source' || stage === 'geometry' || stage === 'tileEmit') {
    return stage;
  }
  return undefined;
};

export const toCanonicalStageIdFromLegacyStage = (
  stage: ShapeBuildStage | undefined,
): string | undefined => {
  if (stage === 'source') return 'source-stage';
  if (stage === 'geometry') return 'geometry-stage';
  if (stage === 'tileEmit') return 'tile-emit-stage';
  return undefined;
};
