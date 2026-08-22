/**
 * Property 3: Zoom level to icon size is monotonically increasing
 *
 * Validates: Requirements 4.3
 *
 * For any two zoomLevel values a and b where 0 <= a < b <= 100,
 * computeZoomLayout(b).iconSize > computeZoomLayout(a).iconSize.
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeZoomLayout } from '../zoom-layout';

// -- Arbitraries --

/**
 * Generate an ordered pair (a, b) where 0 <= a < b <= 100.
 * Strategy: pick two distinct integers from [0, 100] and sort them.
 */
const orderedPairArb: fc.Arbitrary<[number, number]> = fc
  .tuple(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }))
  .filter(([a, b]) => a !== b)
  .map(([a, b]) => (a < b ? [a, b] : [b, a]) as [number, number]);

// -- Tests --

// Feature: treeconsole-view-modes, Property 3: Zoom level to icon size is monotonically increasing
describe('Feature: treeconsole-view-modes, Property 3: Zoom level to icon size is monotonically increasing', () => {
  it('computeZoomLayout(b).iconSize > computeZoomLayout(a).iconSize for all 0 <= a < b <= 100', () => {
    fc.assert(
      fc.property(orderedPairArb, ([a, b]) => {
        const sizeA = computeZoomLayout(a).iconSize;
        const sizeB = computeZoomLayout(b).iconSize;
        expect(sizeB).toBeGreaterThan(sizeA);
      }),
      { numRuns: 100 }
    );
  });
});
