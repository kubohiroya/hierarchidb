import { describe, expect, it } from 'vitest';
import { normalizeFeatureCollection } from '../vtStageFeatureSourceUtils.js';

describe('normalizeFeatureCollection', () => {
  it('rejects a FeatureCollection with a missing features payload', async () => {
    await expect(normalizeFeatureCollection({ type: 'FeatureCollection' })).resolves.toBeNull();
  });

  it('preserves an explicitly empty features array', async () => {
    await expect(
      normalizeFeatureCollection({
        type: 'FeatureCollection',
        features: [],
      })
    ).resolves.toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });
});
