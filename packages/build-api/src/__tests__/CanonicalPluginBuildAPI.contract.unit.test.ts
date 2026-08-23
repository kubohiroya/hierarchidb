import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import {
  CanonicalBuildInputError,
  type CanonicalPluginBuildStartRequest,
  canonicalBuildInputSources,
  isCanonicalBuildInputSource,
  isLegacyCanonicalPluginBuildStartRequest,
  type LegacyCanonicalPluginBuildStartRequest,
} from '../index.js';

describe('CanonicalPluginBuildAPI input contract', () => {
  it('defines the explicit committed/working-copy source set', () => {
    expect(canonicalBuildInputSources).toEqual(['committed', 'working-copy']);
    expect(isCanonicalBuildInputSource('committed')).toBe(true);
    expect(isCanonicalBuildInputSource('working-copy')).toBe(true);
    expect(isCanonicalBuildInputSource('draftData')).toBe(false);
  });

  it('uses source/payload envelope for canonical start requests', () => {
    const request: CanonicalPluginBuildStartRequest = {
      nodeId: 'node-1' as NodeId,
      input: {
        source: 'committed',
        payload: { buildConfig: {} },
      },
    };

    expect(request.input.source).toBe('committed');
    expect(isLegacyCanonicalPluginBuildStartRequest(request)).toBe(false);
  });

  it('keeps legacy draftData request detectable for rollback isolation', () => {
    const request: LegacyCanonicalPluginBuildStartRequest = {
      nodeId: 'node-1' as NodeId,
      draftData: { buildConfig: {} },
    };

    expect(isLegacyCanonicalPluginBuildStartRequest(request)).toBe(true);
  });

  it('exposes typed canonical input errors', () => {
    const error = new CanonicalBuildInputError('missing committed payload', {
      code: 'CANONICAL_BUILD_INPUT_MISSING_SLOT',
      field: 'data',
      nodeId: 'node-1',
      nodeType: 'shape',
      source: 'committed',
    });

    expect(error.name).toBe('CanonicalBuildInputError');
    expect(error.code).toBe('CANONICAL_BUILD_INPUT_MISSING_SLOT');
    expect(error.details).toMatchObject({ field: 'data', source: 'committed' });
  });
});
