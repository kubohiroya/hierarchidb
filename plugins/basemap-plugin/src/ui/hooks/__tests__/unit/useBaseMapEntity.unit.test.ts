import { describe, expect, it } from 'vitest';
import type { TreeNode } from '@hierarchidb/common-types';
import { __testUtils } from '../../useBaseMapEntity.js';

const { buildBaseMapEntityFromNode, normalizeMapStyle, normalizeViewport } = __testUtils;

describe('useBaseMapEntity helpers', () => {
  it('buildBaseMapEntityFromNode returns defaults when node data is missing', () => {
    const node = {
      id: 'node-1',
      nodeType: 'basemap',
      parentId: 'root',
      name: 'Basemap',
      depth: 1,
      createdAt: 100,
      updatedAt: 200,
      version: 3,
    } satisfies Partial<TreeNode>;

    const entity = buildBaseMapEntityFromNode(node as TreeNode);
    expect(entity).not.toBeNull();
    expect(entity?.mapStyle.style).toBe('streets');
    expect(entity?.viewport.zoom).toBe(10);
    expect(entity?.createdAt).toBe(100);
    expect(entity?.updatedAt).toBe(200);
    expect(entity?.version).toBe(3);
  });

  it('buildBaseMapEntityFromNode maps mapStyle and viewport from node data', () => {
    const node = {
      id: 'node-2',
      nodeType: 'basemap',
      parentId: 'root',
      name: 'Basemap',
      depth: 1,
      createdAt: 0,
      updatedAt: 0,
      version: 1,
      data: {
        mapStyle: { style: 'satellite' },
        viewport: { center: [10, 20], zoom: 8, bearing: 5, pitch: 15 },
      },
    } satisfies Partial<TreeNode> & { data: Record<string, unknown> };

    const entity = buildBaseMapEntityFromNode(node as TreeNode);
    expect(entity?.mapStyle.style).toBe('satellite');
    expect(entity?.viewport.center).toEqual([10, 20]);
    expect(entity?.viewport.zoom).toBe(8);
  });

  it('normalize helpers fill missing values', () => {
    const mapStyle = normalizeMapStyle({ style: 'custom', customStyleUrl: 'https://example.com' });
    expect(mapStyle.style).toBe('custom');
    expect(mapStyle.customStyleUrl).toBe('https://example.com');

    const viewport = normalizeViewport({ center: [1, 2] });
    expect(viewport.center).toEqual([1, 2]);
    expect(viewport.zoom).toBe(10);
    expect(viewport.bearing).toBe(0);
  });
});
