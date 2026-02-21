import { describe, expect, it, vi } from 'vitest';

import type { NodeId, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { collectBuildUrlsForFolder } from '../buildFlow.ts';

const composeStepConfigsMock = vi.fn();

vi.mock('@hierarchidb/plugin-base', () => ({
  composeStepConfigs: (...args: Parameters<typeof composeStepConfigsMock>) =>
    composeStepConfigsMock(...args),
}));

vi.mock('~/plugin-loaders/ui-plugin-loader', () => ({
  loadUIPlugin: vi.fn(() => Promise.resolve(true)),
}));

const makeNode = (overrides: Partial<TreeNode>): TreeNode => ({
  id: 'r:folder' as NodeId,
  parentId: 'r:root' as NodeId,
  nodeType: 'folder',
  metadata: { name: 'folder', description: '', tags: [] },
  draftMetadata: null,
  data: null,
  draftData: undefined,
  depth: 1,
  createdAt: 1,
  updatedAt: 2,
  version: 1,
  visible: true,
  ...overrides,
});

describe('collectBuildUrlsForFolder', () => {
  it('collects only folder descendants with buildRequired=true and resolvable build targets', async () => {
    composeStepConfigsMock.mockImplementation((nodeType: string) => {
      if (nodeType === 'shape') {
        return { configs: [{ id: 'basic' }, { id: 'build' }], hasHostBase: false };
      }
      return { configs: [{ id: 'data-source' }], hasHostBase: false };
    });

    const descendants: TreeNode[] = [
      makeNode({
        id: 'r:shape-build' as NodeId,
        nodeType: 'shape',
        metadata: {
          name: 'Shape Build',
          description: '',
          tags: [],
          buildMetadata: { buildRequired: true },
        },
      }),
      makeNode({
        id: 'r:shape-no-build' as NodeId,
        nodeType: 'shape',
        metadata: {
          name: 'Shape Skip',
          description: '',
          tags: [],
        },
        draftMetadata: {
          name: 'draft',
          description: '',
          tags: [],
          buildMetadata: { buildRequired: true },
        },
      }),
      makeNode({
        id: 'r:route-build' as NodeId,
        nodeType: 'route',
        metadata: {
          name: 'Route Build',
          description: '',
          tags: [],
          buildMetadata: { buildRequired: true },
        },
      }),
      makeNode({
        id: 'r:folder-child' as NodeId,
        nodeType: 'folder',
        metadata: {
          name: 'Child Folder',
          description: '',
          tags: [],
          buildMetadata: { buildRequired: true },
        },
      }),
    ];
    const folderNode = makeNode({ id: 'r:root-folder' as NodeId, nodeType: 'folder' });
    const workerClient = {
      getQueryAPI: vi.fn(async () => ({
        listDescendants: async () => descendants,
      })),
    };

    const result = await collectBuildUrlsForFolder({
      treeId: 'tree-1' as TreeId,
      pageNodeId: folderNode.id as NodeId,
      folderNode,
      returnTo: '/t/tree-1/r:root-folder',
      workerClient,
    });

    expect(result.urls).toHaveLength(3);
    expect(result.urls.every((url) => url.includes('build=1'))).toBe(true);
    expect(result.urls.every((url) => url.includes(`buildQueue=${encodeURIComponent(result.queueKey)}`))).toBe(
      true
    );
    expect(result.urls.some((url) => decodeURIComponent(url).includes('shape-build'))).toBe(true);
    expect(result.urls.some((url) => decodeURIComponent(url).includes('shape-no-build'))).toBe(true);
    expect(result.urls.some((url) => decodeURIComponent(url).includes('route-build'))).toBe(true);
    expect(result.urls.every((url) => !decodeURIComponent(url).includes('/folder-child'))).toBe(true);
  });
});
