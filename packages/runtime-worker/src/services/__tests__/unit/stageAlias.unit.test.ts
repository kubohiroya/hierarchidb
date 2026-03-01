import { describe, expect, it } from 'vitest';
import {
  toCanonicalStageIdFromLegacyStage,
  toLegacyBuildStage,
  toLegacyBuildStageFromStageId,
} from '../../stageAlias.js';

describe('stageAlias (runtime-worker)', () => {
  it('maps canonical stageId to legacy stage', () => {
    expect(toLegacyBuildStageFromStageId('source-stage')).toBe('source');
    expect(toLegacyBuildStageFromStageId('geometry-stage')).toBe('geometry');
    expect(toLegacyBuildStageFromStageId('tile-emit-stage')).toBe('tileEmit');
  });

  it('accepts pipeline-style stageId fragments', () => {
    expect(toLegacyBuildStageFromStageId('pipeline:source-stage:running')).toBe('source');
    expect(toLegacyBuildStageFromStageId('pipeline:geometry-stage:done')).toBe('geometry');
    expect(toLegacyBuildStageFromStageId('pipeline:tile-emit-stage:done')).toBe('tileEmit');
  });

  it('prefers stageId over legacy stage argument', () => {
    expect(toLegacyBuildStage('tileEmit', 'source-stage')).toBe('source');
    expect(toLegacyBuildStage('source', 'geometry-stage')).toBe('geometry');
  });

  it('falls back to legacy stage when stageId is missing or unknown', () => {
    expect(toLegacyBuildStage('source')).toBe('source');
    expect(toLegacyBuildStage('geometry')).toBe('geometry');
    expect(toLegacyBuildStage('tileEmit')).toBe('tileEmit');
    expect(toLegacyBuildStage('source', 'unknown-stage-id')).toBe('source');
  });

  it('maps legacy stage to canonical stageId', () => {
    expect(toCanonicalStageIdFromLegacyStage('source')).toBe('source-stage');
    expect(toCanonicalStageIdFromLegacyStage('geometry')).toBe('geometry-stage');
    expect(toCanonicalStageIdFromLegacyStage('tileEmit')).toBe('tile-emit-stage');
  });
});
