/**
 * Integration tests for view mode jotai atom families.
 *
 * Tests atom scoping (per-folder isolation) and navigation round-trip
 * (settings restored when returning to a folder) using jotai's createStore
 * directly — no React rendering needed.
 */

import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import type { NodeId } from '@hierarchidb/core-types';
import {
    viewModeAtomFamily,
    sortModeAtomFamily,
    zoomLevelAtomFamily,
} from '../../state/view-mode-atoms';
import { VIEW_MODE_DEFAULTS } from '../../types/view-mode-types';

describe('View mode atom integration', () => {
    it('atom scoping: changing viewMode in folder A does not affect folder B', () => {
        const store = createStore();
        const folderA = 'folder-a' as NodeId;
        const folderB = 'folder-b' as NodeId;

        // Set folder A to icon mode
        store.set(viewModeAtomFamily(folderA), 'icon');

        // Folder B should still be default
        expect(store.get(viewModeAtomFamily(folderB))).toBe(VIEW_MODE_DEFAULTS.viewMode);
        expect(store.get(viewModeAtomFamily(folderA))).toBe('icon');
    });

    it('atom scoping: changing sortMode in folder A does not affect folder B', () => {
        const store = createStore();
        const folderA = 'folder-a' as NodeId;
        const folderB = 'folder-b' as NodeId;

        store.set(sortModeAtomFamily(folderA), 'name');

        expect(store.get(sortModeAtomFamily(folderB))).toBe(VIEW_MODE_DEFAULTS.sortMode);
        expect(store.get(sortModeAtomFamily(folderA))).toBe('name');
    });

    it('atom scoping: changing zoomLevel in folder A does not affect folder B', () => {
        const store = createStore();
        const folderA = 'folder-a' as NodeId;
        const folderB = 'folder-b' as NodeId;

        store.set(zoomLevelAtomFamily(folderA), 80);

        expect(store.get(zoomLevelAtomFamily(folderB))).toBe(VIEW_MODE_DEFAULTS.zoomLevel);
        expect(store.get(zoomLevelAtomFamily(folderA))).toBe(80);
    });

    it('navigation round-trip: settings restored when returning to folder', () => {
        const store = createStore();
        const folder = 'folder-1' as NodeId;

        // Set custom values
        store.set(viewModeAtomFamily(folder), 'column');
        store.set(sortModeAtomFamily(folder), 'name');
        store.set(zoomLevelAtomFamily(folder), 75);

        // "Navigate away" — access a different folder
        const otherFolder = 'folder-2' as NodeId;
        store.set(viewModeAtomFamily(otherFolder), 'icon');

        // "Navigate back" — read original folder's atoms
        expect(store.get(viewModeAtomFamily(folder))).toBe('column');
        expect(store.get(sortModeAtomFamily(folder))).toBe('name');
        expect(store.get(zoomLevelAtomFamily(folder))).toBe(75);
    });

    it('defaults are applied for new folders', () => {
        const store = createStore();
        const newFolder = 'new-folder' as NodeId;

        expect(store.get(viewModeAtomFamily(newFolder))).toBe(VIEW_MODE_DEFAULTS.viewMode);
        expect(store.get(sortModeAtomFamily(newFolder))).toBe(VIEW_MODE_DEFAULTS.sortMode);
        expect(store.get(zoomLevelAtomFamily(newFolder))).toBe(VIEW_MODE_DEFAULTS.zoomLevel);
    });
});
