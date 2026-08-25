// @vitest-environment node

import { ROUTE_MODES } from '@hierarchidb/route-api';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG, mergeRouteBuildConfig } from './buildConfig.js';

describe('route build config method settings', () => {
  it('provides system defaults for every supported route mode', () => {
    expect(DEFAULT_ROUTE_BUILD_CONFIG.routeMethodSettings.defaults).toMatchObject({
      [ROUTE_MODES.AIRWAY]: { method: 'great_circle' },
      [ROUTE_MODES.WATERWAY]: { method: 'searoute' },
      [ROUTE_MODES.RAILWAY]: { method: 'direct' },
      [ROUTE_MODES.H_RAILWAY]: { method: 'direct' },
      [ROUTE_MODES.ROAD]: { method: 'direct' },
      [ROUTE_MODES.HIGHWAY]: { method: 'direct' },
    });
  });

  it('merges node-level route method overrides without replacing system defaults', () => {
    const config = mergeRouteBuildConfig(DEFAULT_ROUTE_BUILD_CONFIG, {
      routeMethodSettings: {
        defaults: DEFAULT_ROUTE_BUILD_CONFIG.routeMethodSettings.defaults,
        overrides: {
          [ROUTE_MODES.ROAD]: { method: 'osm_route' },
        },
      },
    });

    expect(config.routeMethodSettings.defaults[ROUTE_MODES.WATERWAY]?.method).toBe('searoute');
    expect(config.routeMethodSettings.overrides?.[ROUTE_MODES.ROAD]?.method).toBe('osm_route');
  });
});
