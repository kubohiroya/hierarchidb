/**
 * Property 5: Expansion toggle is self-inverse
 *
 * Validates: Requirements 7.1
 *
 * For any node NOT currently in expandedPath, toggling twice returns to original state.
 * For a node IN expandedPath, toggling collapses (truncates descendants), then
 * toggling again re-appends the node — but descendants are NOT restored.
 * This matches Finder column view behavior.
 */

import type { NodeId } from '@hierarchidb/core-types';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ColumnViewState } from '../useColumnView';

function simulateToggle(state: ColumnViewState, nodeId: NodeId): ColumnViewState {
  const idx = state.expandedPath.indexOf(nodeId);
  if (idx >= 0) {
    return { ...state, expandedPath: state.expandedPath.slice(0, idx) };
  }
  if (state.expandedPath.includes(nodeId)) return state;
  return { ...state, expandedPath: [...state.expandedPath, nodeId] };
}

const nodeIdArb = fc.stringMatching(/^node-[0-9]{1,4}$/).map((s) => s as NodeId);

const expandedPathArb = fc
  .array(nodeIdArb, { minLength: 0, maxLength: 5 })
  .map((ids) => [...new Set(ids)]);

const stateArb: fc.Arbitrary<ColumnViewState> = fc.record({
  expandedPath: expandedPathArb,
  selectedNodeId: fc.option(nodeIdArb, { nil: null }),
});

describe('Feature: treeconsole-view-modes, Property 5: Expansion toggle is self-inverse', () => {
  it('toggling a node NOT in path twice returns to original state', () => {
    fc.assert(
      fc.property(stateArb, nodeIdArb, (state, nodeId) => {
        // Only test nodes not already in the path
        fc.pre(!state.expandedPath.includes(nodeId));

        const afterFirst = simulateToggle(state, nodeId);
        const afterSecond = simulateToggle(afterFirst, nodeId);
        expect(afterSecond.expandedPath).toEqual(state.expandedPath);
      }),
      { numRuns: 100 }
    );
  });

  it('toggling a node IN path removes it, toggling again re-appends it', () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        if (state.expandedPath.length === 0) return;

        // Pick the last node in path (toggling it won't lose descendants)
        const nodeId = state.expandedPath[state.expandedPath.length - 1];

        const afterFirst = simulateToggle(state, nodeId);
        expect(afterFirst.expandedPath).not.toContain(nodeId);

        const afterSecond = simulateToggle(afterFirst, nodeId);
        expect(afterSecond.expandedPath).toContain(nodeId);
      }),
      { numRuns: 100 }
    );
  });

  it('toggling last element twice is a true self-inverse', () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        if (state.expandedPath.length === 0) return;

        const nodeId = state.expandedPath[state.expandedPath.length - 1];
        const afterFirst = simulateToggle(state, nodeId);
        const afterSecond = simulateToggle(afterFirst, nodeId);
        expect(afterSecond.expandedPath).toEqual(state.expandedPath);
      }),
      { numRuns: 100 }
    );
  });
});
