import { describe, expect, it } from 'vitest';
import { parseRouteGeometryBandValues } from './parseRouteGeometryBandValues.js';

describe('parseRouteGeometryBandValues', () => {
  it('accepts exactly one finite non-negative value per band', () => {
    expect(parseRouteGeometryBandValues('0, 5000, 0.0002', 3)).toEqual({
      ok: true,
      values: [0, 5000, 0.0002],
    });
  });

  it.each([
    ['0, 5000', 3, 'valueCount'],
    ['0, 5000, 10000, 20000', 3, 'valueCount'],
    ['0, , 10000', 3, 'invalidValue'],
    ['0, invalid, 10000', 3, 'invalidValue'],
    ['0, -1, 10000', 3, 'invalidValue'],
  ])('rejects %s without dropping or repairing entries', (raw, expectedCount, errorKind) => {
    expect(parseRouteGeometryBandValues(raw, expectedCount)).toMatchObject({
      ok: false,
      error: { kind: errorKind },
    });
  });

  it('rejects an invalid zoom-band count', () => {
    expect(parseRouteGeometryBandValues('', 0)).toEqual({
      ok: false,
      error: { kind: 'bandCount', expectedCount: 0 },
    });
  });
});
