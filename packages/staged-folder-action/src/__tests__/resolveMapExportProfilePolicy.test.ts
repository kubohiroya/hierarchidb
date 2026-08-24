import { describe, expect, it } from 'vitest';
import { MapExportProfilePolicyError, resolveMapExportProfilePolicy } from '../index.js';

describe('resolveMapExportProfilePolicy', () => {
  it('uses the default persistent profile with reuse cache policy', () => {
    expect(resolveMapExportProfilePolicy({ defaultProfileDir: '.hdb-map-export/profile' })).toEqual(
      {
        profileMode: 'default-persistent',
        profileDir: '.hdb-map-export/profile',
        cachePolicy: 'reuse',
      }
    );
  });

  it('uses explicit persistent profile when --profile is provided', () => {
    expect(
      resolveMapExportProfilePolicy({
        defaultProfileDir: '.hdb-map-export/profile',
        profileDir: 'profiles/nightly',
        refresh: true,
      })
    ).toEqual({
      profileMode: 'explicit-persistent',
      profileDir: 'profiles/nightly',
      cachePolicy: 'refresh',
    });
  });

  it('uses a temporary profile for --fresh', () => {
    expect(
      resolveMapExportProfilePolicy({
        defaultProfileDir: '.hdb-map-export/profile',
        fresh: true,
      })
    ).toEqual({
      profileMode: 'temporary-fresh',
      profileDir: null,
      cachePolicy: 'fresh',
    });
  });

  it('rejects conflicting cache policies', () => {
    expect(() =>
      resolveMapExportProfilePolicy({
        defaultProfileDir: '.hdb-map-export/profile',
        offline: true,
        refresh: true,
      })
    ).toThrow(MapExportProfilePolicyError);
  });

  it('rejects --fresh with --profile', () => {
    expect(() =>
      resolveMapExportProfilePolicy({
        defaultProfileDir: '.hdb-map-export/profile',
        profileDir: 'profiles/nightly',
        fresh: true,
      })
    ).toThrow(MapExportProfilePolicyError);
  });
});
