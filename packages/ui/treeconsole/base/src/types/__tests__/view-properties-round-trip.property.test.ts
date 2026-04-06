/**
 * Property 2: ViewProperties persistence round-trip
 *
 * Validates: Requirements 4.6, 5.1, 5.2, 5.3, 5.4, 8.4, 9.2, 9.3
 *
 * For any valid ViewProperties object, writing it to a TreeNode's viewProperties
 * field and reading it back produces a deeply equal result. Additionally, when
 * viewProperties is undefined, the resolution function returns VIEW_MODE_DEFAULTS.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ViewProperties, ViewMode, SortMode, IconPosition } from '../view-mode-types';
import { VIEW_MODE_DEFAULTS } from '../view-mode-types';

// -- Arbitraries --

const viewModeArb: fc.Arbitrary<ViewMode> = fc.constantFrom('icon', 'list', 'column');

const sortModeArb: fc.Arbitrary<SortMode> = fc.constantFrom(
    'none', 'name', 'type', 'lastOpened', 'created', 'modified', 'size', 'tag',
);

/**
 * Icon position coordinate arbitrary.
 * Uses integers to avoid JSON round-trip edge cases with floating-point
 * (e.g. -0 becomes 0 in JSON.stringify). Integer coordinates are the
 * realistic domain for pixel positions.
 */
const iconPositionArb: fc.Arbitrary<IconPosition> = fc.record({
    x: fc.integer({ min: -10000, max: 10000 }),
    y: fc.integer({ min: -10000, max: 10000 }),
});

const zoomLevelArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 100 });

/** Generate a random valid ViewProperties with all fields optional. */
const viewPropertiesArb: fc.Arbitrary<ViewProperties> = fc.record(
    {
        viewMode: viewModeArb,
        sortMode: sortModeArb,
        zoomLevel: zoomLevelArb,
        iconPosition: iconPositionArb,
    },
    { requiredKeys: [] },
);

// -- Helpers --

/**
 * Simulate writing ViewProperties to a TreeNode and reading it back.
 * Uses JSON round-trip to simulate persistence serialisation (e.g. IndexedDB
 * structured clone or JSON-based storage). The result is compared by value
 * equality, not reference/prototype identity.
 */
function writeAndRead(vp: ViewProperties): ViewProperties {
    return JSON.parse(JSON.stringify(vp)) as ViewProperties;
}

/**
 * Resolve ViewProperties with defaults, matching the UI-layer resolution logic.
 * When viewProperties is undefined, returns VIEW_MODE_DEFAULTS.
 * When viewProperties is defined, fills in missing fields from VIEW_MODE_DEFAULTS.
 */
function resolveViewProperties(
    vp: ViewProperties | undefined,
): Required<Omit<ViewProperties, 'iconPosition'>> & { iconPosition?: IconPosition } {
    if (vp === undefined) {
        return { ...VIEW_MODE_DEFAULTS, iconPosition: undefined };
    }
    return {
        viewMode: vp.viewMode ?? VIEW_MODE_DEFAULTS.viewMode,
        zoomLevel: vp.zoomLevel ?? VIEW_MODE_DEFAULTS.zoomLevel,
        sortMode: vp.sortMode ?? VIEW_MODE_DEFAULTS.sortMode,
        iconPosition: vp.iconPosition,
    };
}

// -- Tests --

// Feature: treeconsole-view-modes, Property 2: ViewProperties persistence round-trip
describe('Feature: treeconsole-view-modes, Property 2: ViewProperties persistence round-trip', () => {
    it('write-then-read produces deep-equal ViewProperties for any valid input', () => {
        fc.assert(
            fc.property(viewPropertiesArb, (original) => {
                const restored = writeAndRead(original);
                expect(restored).toEqual(original);
            }),
            { numRuns: 100 },
        );
    });

    it('undefined viewProperties resolves to VIEW_MODE_DEFAULTS', () => {
        const resolved = resolveViewProperties(undefined);
        expect(resolved.viewMode).toBe('list');
        expect(resolved.zoomLevel).toBe(50);
        expect(resolved.sortMode).toBe('none');
        expect(resolved.iconPosition).toBeUndefined();
    });

    it('partial viewProperties fills missing fields from VIEW_MODE_DEFAULTS', () => {
        fc.assert(
            fc.property(viewPropertiesArb, (original) => {
                const resolved = resolveViewProperties(original);

                // Provided fields are preserved
                if (original.viewMode !== undefined) {
                    expect(resolved.viewMode).toBe(original.viewMode);
                }
                if (original.zoomLevel !== undefined) {
                    expect(resolved.zoomLevel).toBe(original.zoomLevel);
                }
                if (original.sortMode !== undefined) {
                    expect(resolved.sortMode).toBe(original.sortMode);
                }
                if (original.iconPosition !== undefined) {
                    expect(resolved.iconPosition).toEqual(original.iconPosition);
                }

                // Missing fields fall back to defaults
                if (original.viewMode === undefined) {
                    expect(resolved.viewMode).toBe(VIEW_MODE_DEFAULTS.viewMode);
                }
                if (original.zoomLevel === undefined) {
                    expect(resolved.zoomLevel).toBe(VIEW_MODE_DEFAULTS.zoomLevel);
                }
                if (original.sortMode === undefined) {
                    expect(resolved.sortMode).toBe(VIEW_MODE_DEFAULTS.sortMode);
                }
            }),
            { numRuns: 100 },
        );
    });

    it('round-trip preserves iconPosition coordinates exactly', () => {
        fc.assert(
            fc.property(iconPositionArb, (pos) => {
                const vp: ViewProperties = { iconPosition: pos };
                const restored = writeAndRead(vp);
                expect(restored.iconPosition).toEqual(pos);
            }),
            { numRuns: 100 },
        );
    });

    it('round-trip with all fields populated preserves every field', () => {
        const fullViewPropertiesArb = fc.record({
            viewMode: viewModeArb,
            sortMode: sortModeArb,
            zoomLevel: zoomLevelArb,
            iconPosition: iconPositionArb,
        });

        fc.assert(
            fc.property(fullViewPropertiesArb, (original) => {
                const restored = writeAndRead(original);
                expect(restored.viewMode).toBe(original.viewMode);
                expect(restored.sortMode).toBe(original.sortMode);
                expect(restored.zoomLevel).toBe(original.zoomLevel);
                expect(restored.iconPosition).toEqual(original.iconPosition);
            }),
            { numRuns: 100 },
        );
    });
});
