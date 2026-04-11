import type { BuildTaskType } from '@hierarchidb/shape-store';

export const toLegacyBuildStageFromStageId = (
  stageId: string | undefined,
): BuildTaskType | undefined => {
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
): BuildTaskType | undefined => {
  const fromStageId = toLegacyBuildStageFromStageId(stageId);
  if (fromStageId !== undefined) return fromStageId;
  if (stage === 'source' || stage === 'geometry' || stage === 'tileEmit') {
    return stage;
  }
  return undefined;
};
