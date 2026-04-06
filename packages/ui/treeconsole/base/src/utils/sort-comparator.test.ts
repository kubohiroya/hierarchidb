import { describe, it, expect } from 'vitest';
import {
    createSortComparator,
    DEFAULT_NODE_SIZE_RESOLVER,
} from './sort-comparator';
import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import type { SortMode } from '../types/view-mode-types';

/**
 * Minimal TreeNodeInUI factory for testing.
 */
function makeNode(overrides: Partial<TreeNodeInUI> & { name?: string; tags?: string[] }): TreeNodeInUI {
    const { name = 'node', tags = [], ...rest } = overrides;
    return {
        id: 'id-1',
        parentId: 'parent-1',
        nodeType: 'folder',
        depth: 0,
        createdAt: 0,
        updatedAt: 0,
        version: 1,
        metadata: { name, description: '', tags },
        draftMetadata: null,
        data: null,
        visible: true,
        ...rest,
    } as TreeNodeInUI;
}

describe('createSortComparator', () => {
    it('returns 0 for "none" mode (preserves original order)', () => {
        const cmp = createSortComparator('none');
        const a = makeNode({ name: 'Z' });
        const b = makeNode({ name: 'A' });
        expect(cmp(a, b)).toBe(0);
    });

    it('sorts by name using locale-aware comparison', () => {
        const cmp = createSortComparator('name');
        const a = makeNode({ name: 'Apple' });
        const b = makeNode({ name: 'Banana' });
        expect(cmp(a, b)).toBeLessThan(0);
        expect(cmp(b, a)).toBeGreaterThan(0);
        expect(cmp(a, a)).toBe(0);
    });

    it('sorts by nodeType using locale-aware comparison', () => {
        const cmp = createSortComparator('type');
        const a = makeNode({ nodeType: 'document' });
        const b = makeNode({ nodeType: 'folder' });
        expect(cmp(a, b)).toBeLessThan(0);
        expect(cmp(b, a)).toBeGreaterThan(0);
    });

    it('sorts by lastOpened descending (most recent first)', () => {
        const cmp = createSortComparator('lastOpened');
        const a = makeNode({ lastTouchedAt: 100 });
        const b = makeNode({ lastTouchedAt: 200 });
        // b is more recent, so b should come first → cmp(a, b) > 0
        expect(cmp(a, b)).toBeGreaterThan(0);
        expect(cmp(b, a)).toBeLessThan(0);
    });

    it('treats undefined lastTouchedAt as 0 for lastOpened sort', () => {
        const cmp = createSortComparator('lastOpened');
        const a = makeNode({}); // lastTouchedAt undefined → 0
        const b = makeNode({ lastTouchedAt: 100 });
        expect(cmp(a, b)).toBeGreaterThan(0);
    });

    it('sorts by created descending (most recent first)', () => {
        const cmp = createSortComparator('created');
        const a = makeNode({ createdAt: 50 });
        const b = makeNode({ createdAt: 100 });
        expect(cmp(a, b)).toBeGreaterThan(0);
        expect(cmp(b, a)).toBeLessThan(0);
    });

    it('sorts by modified descending (most recent first)', () => {
        const cmp = createSortComparator('modified');
        const a = makeNode({ updatedAt: 10 });
        const b = makeNode({ updatedAt: 20 });
        expect(cmp(a, b)).toBeGreaterThan(0);
        expect(cmp(b, a)).toBeLessThan(0);
    });

    it('sorts by size using NodeSizeResolver', () => {
        const resolver = (node: TreeNodeInUI) => (node.metadata.name === 'big' ? 1000 : 100);
        const cmp = createSortComparator('size', resolver);
        const a = makeNode({ name: 'big' });
        const b = makeNode({ name: 'small' });
        // big (1000) should come first (descending) → cmp(a, b) < 0
        expect(cmp(a, b)).toBeLessThan(0);
        expect(cmp(b, a)).toBeGreaterThan(0);
    });

    it('uses DEFAULT_NODE_SIZE_RESOLVER (returns 0) when no resolver provided', () => {
        const cmp = createSortComparator('size');
        const a = makeNode({ name: 'a' });
        const b = makeNode({ name: 'b' });
        // Both resolve to 0, so equal
        expect(cmp(a, b)).toBe(0);
    });

    it('sorts by tag using joined tags string comparison', () => {
        const cmp = createSortComparator('tag');
        const a = makeNode({ tags: ['alpha', 'beta'] });
        const b = makeNode({ tags: ['gamma'] });
        // "alpha,beta" < "gamma"
        expect(cmp(a, b)).toBeLessThan(0);
        expect(cmp(b, a)).toBeGreaterThan(0);
    });

    it('handles empty tags array for tag sort', () => {
        const cmp = createSortComparator('tag');
        const a = makeNode({ tags: [] });
        const b = makeNode({ tags: ['something'] });
        // "" < "something"
        expect(cmp(a, b)).toBeLessThan(0);
    });

    it('DEFAULT_NODE_SIZE_RESOLVER returns 0 for any node', () => {
        const node = makeNode({ name: 'test' });
        expect(DEFAULT_NODE_SIZE_RESOLVER(node)).toBe(0);
    });

    it('covers all SortMode values', () => {
        const allModes: SortMode[] = ['none', 'name', 'type', 'lastOpened', 'created', 'modified', 'size', 'tag'];
        for (const mode of allModes) {
            const cmp = createSortComparator(mode);
            expect(typeof cmp).toBe('function');
        }
    });
});
