import { describe, expect, it } from 'vitest';
import { toLegacyBuildStage, toLegacyBuildStageFromStageId } from '../../services/build/stageAlias';

describe('stageAlias (shape-plugin)', () => {
  it('maps canonical stageId to legacy stage keys', () => {
    expect(toLegacyBuildStageFromStageId('source-stage')).toBe('source');
    expect(toLegacyBuildStageFromStageId('geometry-stage')).toBe('geometry');
    expect(toLegacyBuildStageFromStageId('tile-emit-stage')).toBe('tileEmit');
  });

  it('accepts pipeline-style stageId markers', () => {
    expect(toLegacyBuildStageFromStageId('pipeline:source-stage:running')).toBe('source');
    expect(toLegacyBuildStageFromStageId('pipeline:geometry-stage:done')).toBe('geometry');
    expect(toLegacyBuildStageFromStageId('pipeline:tile-emit-stage:done')).toBe('tileEmit');
  });

  it('prioritizes stageId over stage when both are provided', () => {
    expect(toLegacyBuildStage('geometry', 'source-stage')).toBe('source');
    expect(toLegacyBuildStage('tileEmit', 'geometry-stage')).toBe('geometry');
  });
});
