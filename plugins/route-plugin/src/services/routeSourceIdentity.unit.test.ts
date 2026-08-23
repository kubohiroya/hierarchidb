import type { NodeId } from '@hierarchidb/core-types';
import { ROUTE_MODES } from '@hierarchidb/route-api';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '~/common/config/buildConfig.js';
import { buildRouteSourceIdentity } from './routeSourceIdentity.js';

const buildInput = () => ({
  routeMode: ROUTE_MODES.ROAD,
  start: {
    locationId: 'location-b' as NodeId,
    coordinates: [140, 36] as [number, number],
  },
  end: {
    locationId: 'location-a' as NodeId,
    coordinates: [139, 35] as [number, number],
  },
  generation: { method: 'direct' as const },
  sourceConfig: DEFAULT_ROUTE_BUILD_CONFIG.sourceConfig,
});

describe('buildRouteSourceIdentity', () => {
  it('preserves endpoint order for a directional route', () => {
    const identity = buildRouteSourceIdentity(buildInput());

    expect(identity.sourceKey).toBe('road:location-b:location-a');
    expect(identity.bidirectional).toBe(false);
  });

  it('canonicalizes only an explicitly bidirectional route', () => {
    const forward = buildRouteSourceIdentity({
      ...buildInput(),
      metadata: { bidirectional: true },
    });
    const reverse = buildRouteSourceIdentity({
      ...buildInput(),
      start: buildInput().end,
      end: buildInput().start,
      metadata: { oneway: false },
    });

    expect(forward.sourceKey).toBe('road:location-a:location-b');
    expect(reverse.sourceKey).toBe(forward.sourceKey);
    expect(reverse.inputHash).toBe(forward.inputHash);
  });

  it('changes the input signature when coordinates or generation config change', () => {
    const baseline = buildRouteSourceIdentity(buildInput());
    const moved = buildRouteSourceIdentity({
      ...buildInput(),
      end: { ...buildInput().end, coordinates: [139.5, 35] },
    });
    const generatedDifferently = buildRouteSourceIdentity({
      ...buildInput(),
      generation: { method: 'great_circle', options: { numPoints: 20 } },
    });

    expect(moved.inputHash).not.toBe(baseline.inputHash);
    expect(generatedDifferently.inputHash).not.toBe(baseline.inputHash);
  });

  it('includes explicit generation routeMode in the input signature', () => {
    const baseline = buildRouteSourceIdentity(buildInput());
    const explicitMatchingMode = buildRouteSourceIdentity({
      ...buildInput(),
      generation: { method: 'direct', routeMode: ROUTE_MODES.ROAD },
    });

    expect(explicitMatchingMode.inputHash).toBe(baseline.inputHash);
    expect(() =>
      buildRouteSourceIdentity({
        ...buildInput(),
        generation: { method: 'direct', routeMode: 'unsupported-route-mode' as never },
      })
    ).toThrow('routeMode is unsupported');
  });

  it('fails on invalid directionality metadata instead of defaulting it', () => {
    expect(() =>
      buildRouteSourceIdentity({
        ...buildInput(),
        metadata: { bidirectional: 'true' },
      })
    ).toThrow('metadata.bidirectional must be boolean');
  });

  it('fails on contradictory directionality metadata', () => {
    expect(() =>
      buildRouteSourceIdentity({
        ...buildInput(),
        metadata: { bidirectional: true, oneway: true },
      })
    ).toThrow('must not contain conflicting bidirectional and oneway values');
  });
});
