/**
 * Property 1: Sort comparator produces correctly ordered output
 *
 * Validates: Requirements 3.2, 4.4
 *
 * For any array of TreeNodeInUI objects and for any non-"none" SortMode value,
 * applying the sort comparator function to the array produces an output where
 * every adjacent pair (nodes[i], nodes[i+1]) satisfies the ordering relation.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createSortComparator } from '../sort-comparator';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import type { SortMode } from '../../types/view-mode-types';

// -- Arbitraries --

const nodeTypes = ['folder', 'document', 'shape', 'route', 'spreadsheet'] as const;

let nodeCounter = 0;

/**
 * Arbitrary that generates a valid TreeNodeInUI with randomized sort-relevant fields.
 * Uses an incrementing counter for unique ids to avoid fc.uuid() overhead.
 */
const treeNodeInUIArb: fc.Arbitrary<TreeNodeInUI> = fc
    .record({
        name: fc.string({ minLength: 0, maxLength: 20 }),
        tags: fc.array(fc.string({ minLength: 0, maxLength: 10 }), { minLength: 0, maxLength: 5 }),
        nodeType: fc.constantFrom(...nodeTypes),
        createdAt: fc.integer({ min: 0, max: 2_000_000_000 }),
        updatedAt: fc.integer({ min: 0, max: 2_000_000_000 }),
        lastTouchedAt: fc.option(fc.integer({ min: 0, max: 2_000_000_000 }), { nil: undefined }),
    })
    .map(({ name, tags, nodeType, createdAt, updatedAt, lastTouchedAt }) => {
        const id = `node-${++nodeCounter}`;
        return {
            id,
            parentId: 'parent-root',
            nodeType,
            depth: 0,
            createdAt,
            updatedAt,
            version: 1,
            metadata: { name, description: '', tags },
            draftMetadata: null,
            data: null,
            visible: true,
            ...(lastTouchedAt !== undefined ? { lastTouchedAt } : {}),
        } as TreeNodeInUI;
    });

// -- Invariant verification --

/**
 * Verifies that a sorted array satisfies the ordering invariant:
 * for every adjacent pair, the comparator returns <= 0.
 */
function verifySortOrder(
    sorted: TreeNodeInUI[],
    comparator: (a: TreeNodeInUI, b: TreeNodeInUI) => number,
): boolean {
    for (let i = 0; i < sorted.length - 1; i++) {
        if (comparator(sorted[i], sorted[i + 1]) > 0) return false;
    }
    return true;
}


// -- Property test --

// Feature: treeconsole-view-modes, Property 1: Sort comparator produces correctly ordered output
describe('Feature: treeconsole-view-modes, Property 1: Sort comparator produces correctly ordered output', () => {
    const nonNoneModes: SortMode[] = ['name', 'type', 'lastOpened', 'created', 'modified', 'size', 'tag'];

    for (const mode of nonNoneModes) {
        it(`sorted output satisfies ordering invariant for mode "${mode}"`, () => {
            fc.assert(
                fc.property(
                    fc.array(treeNodeInUIArb, { minLength: 0, maxLength: 20 }),
                    (nodes) => {
                        const comparator = createSortComparator(mode);
                        const sorted = [...nodes].sort(comparator);
                        expect(verifySortOrder(sorted, comparator)).toBe(true);
                    },
                ),
                { numRuns: 100 },
            );
        });
    }
});
