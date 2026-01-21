import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { vtStageTestUtils } from '../vtStage.js';

describe('vtStage summary helpers', () => {
  it('builds admin feature summary from feature levels', () => {
    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: null, properties: { level: 0, layer: 'admin0' } },
        { type: 'Feature', geometry: null, properties: { layer: 'admin1' } },
        { type: 'Feature', geometry: null, properties: { layer: 'admin1-boundary' } },
      ],
    };

    expect(vtStageTestUtils.buildAdminFeatureSummary(collection)).toBe('features: ADM0:1 / ADM1:1');
  });

  it('builds tile summary in zoom order', () => {
    const tilesByZoom = new Map<number, { total: number; generated: number }>([
      [1, { total: 4, generated: 2 }],
      [0, { total: 1, generated: 1 }],
    ]);

    expect(vtStageTestUtils.buildTileSummary(tilesByZoom)).toBe('tiles -> 1/1, 2/4');
  });

  it('builds skipped message with reason', () => {
    const summary = vtStageTestUtils.buildSkippedMessage(
      'features: ADM0:1',
      'tiles -> 0/1',
      'no layers',
    );

    expect(summary).toBe('features: ADM0:1, tiles -> 0/1 (skipped: no layers)');
  });
});
