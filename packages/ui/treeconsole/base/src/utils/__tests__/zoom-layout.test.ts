import { describe, it, expect } from 'vitest';
import {
    computeZoomLayout,
    CELL_GAP_PX,
    NAME_MIN_WIDTH_PX,
    NAME_MIN_HEIGHT_PX,
} from '../zoom-layout';

describe('computeZoomLayout', () => {
    it('returns iconSize 32 at zoomLevel 0', () => {
        const layout = computeZoomLayout(0);
        expect(layout.iconSize).toBe(32);
    });

    it('returns iconSize 144 at zoomLevel 50', () => {
        const layout = computeZoomLayout(50);
        expect(layout.iconSize).toBe(88);
    });

    it('returns iconSize 256 at zoomLevel 100', () => {
        const layout = computeZoomLayout(100);
        expect(layout.iconSize).toBe(144);
    });

    it('cellSize.width is at least NAME_MIN_WIDTH_PX + CELL_GAP_PX', () => {
        for (const z of [0, 25, 50, 75, 100]) {
            const layout = computeZoomLayout(z);
            expect(layout.cellSize.width).toBeGreaterThanOrEqual(NAME_MIN_WIDTH_PX + CELL_GAP_PX);
        }
    });

    it('cellSize.height equals iconSize + NAME_MIN_HEIGHT_PX + CELL_GAP_PX', () => {
        for (const z of [0, 25, 50, 75, 100]) {
            const layout = computeZoomLayout(z);
            expect(layout.cellSize.height).toBe(layout.iconSize + NAME_MIN_HEIGHT_PX + CELL_GAP_PX);
        }
    });

    it('cellSize.width grows with iconSize', () => {
        const layout = computeZoomLayout(100);
        expect(layout.cellSize.width).toBe(
            Math.max(layout.iconSize + CELL_GAP_PX * 4, NAME_MIN_WIDTH_PX) + CELL_GAP_PX,
        );
    });

    describe('contract violations', () => {
        it('throws for zoomLevel -1', () => {
            expect(() => computeZoomLayout(-1)).toThrow('zoomLevel must be a finite number in [0, 100]');
        });

        it('throws for zoomLevel 101', () => {
            expect(() => computeZoomLayout(101)).toThrow('zoomLevel must be a finite number in [0, 100]');
        });

        it('throws for NaN', () => {
            expect(() => computeZoomLayout(NaN)).toThrow('zoomLevel must be a finite number in [0, 100]');
        });

        it('throws for Infinity', () => {
            expect(() => computeZoomLayout(Infinity)).toThrow('zoomLevel must be a finite number in [0, 100]');
        });

        it('throws for -Infinity', () => {
            expect(() => computeZoomLayout(-Infinity)).toThrow('zoomLevel must be a finite number in [0, 100]');
        });
    });

    it('iconSize is strictly monotonically increasing for all integer zoom levels', () => {
        let prev = computeZoomLayout(0).iconSize;
        for (let z = 1; z <= 100; z++) {
            const current = computeZoomLayout(z).iconSize;
            expect(current).toBeGreaterThan(prev);
            prev = current;
        }
    });
});
