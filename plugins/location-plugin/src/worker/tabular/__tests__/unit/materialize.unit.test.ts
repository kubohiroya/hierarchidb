import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/core-types';
import type { TabularDataResult } from '@hierarchidb/ui-tabular';
import { buildTileIdByZoom, type LocationPointProperties } from '@hierarchidb/location-store';

const capturedPoints: LocationPointProperties[] = [];

vi.mock('../../../../services/pointRepository.js', () => ({
  replaceLocationPoints: vi.fn(async (_nodeId: string, points: LocationPointProperties[]) => {
    capturedPoints.length = 0;
    capturedPoints.push(...points);
  }),
}));

describe('materializeLocationPointsFromTabular', () => {
  beforeEach(() => {
    capturedPoints.length = 0;
  });

  it('adds tile id fields for z0-z9', async () => {
    const { materializeLocationPointsFromTabular } = await import('~/worker/tabular/materialize');
    const rows: TabularDataResult = {
      columns: [],
      totalRows: 1,
      rows: [
        { name: 'Test', lat: 35.0, lon: 139.0 },
      ],
    };
    await materializeLocationPointsFromTabular('node-1' as NodeId, rows);
    const point = capturedPoints[0];
    expect(point).toBeTruthy();
    const expected = buildTileIdByZoom(139.0, 35.0);
    expect(point.z0).toBe(expected.z0);
    expect(point.z9).toBe(expected.z9);
  });
});
