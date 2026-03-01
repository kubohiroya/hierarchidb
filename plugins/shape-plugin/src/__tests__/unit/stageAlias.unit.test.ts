import { describe, expect, it } from 'vitest';
import { toLegacyBuildStage, toLegacyBuildStageFromStageId } from '../../services/build/stageAlias';

describe('stageAlias (shape-plugin)', () => {
  it('maps canonical stageId to legacy stage keys', () => {
    expect(toLegacyBuildStageFromStageId('source-stage')).toBe('source');
    expect(toLegacyBuildStageFromStageId('geometry-stage')).toBe('geometry');
    expect(toLegacyBuildStageFromStageId('tile-emit-stage')).toBe('tileEmit');
  });

  it('accepts historical pipeline-style stageId markers', () => {
    expect(toLegacyBuildStageFromStageId('pipeline:fetch-stage:running')).toBe('source');
    expect(toLegacyBuildStageFromStageId('pipeline:transform-stage:done')).toBe('geometry');
    expect(toLegacyBuildStageFromStageId('pipeline:vt-stage:done')).toBe('tileEmit');
  });

  it('prioritizes stageId over stage when both are provided', () => {
    expect(toLegacyBuildStage('geometry', 'source-stage')).toBe('source');
    expect(toLegacyBuildStage('tileEmit', 'geometry-stage')).toBe('geometry');
  });
});
