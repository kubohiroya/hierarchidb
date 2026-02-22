import { describe, expect, it, vi } from 'vitest';

import type { NodeId, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { collectBuildUrlsForFolder, startBuildFlow } from '../buildFlow.ts';

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

  it('starts at build step without auto-build when canStartBuild returns false', async () => {
    const composeConfigs = vi
      .fn()
      .mockImplementation((nodeType: string) =>
        nodeType === 'shape'
          ? {
              configs: [
                {
                  id: 'build',
                  capabilities: {
                    canStartBuild: () => false,
                  },
                },
              ],
              hasHostBase: false,
            }
          : { configs: [{ id: 'build' }], hasHostBase: false }
      );
    composeStepConfigsMock.mockImplementation(composeConfigs);

    const node = makeNode({
      id: 'r:shape-no-autobuild' as NodeId,
      nodeType: 'shape',
      metadata: {
        name: 'Shape Not Autobuild',
        description: '',
        tags: [],
        buildMetadata: { buildRequired: true },
      },
    });
    const workerClient = {
      getQueryAPI: vi.fn(async () => ({
        getNode: vi.fn(async () => node),
        listDescendants: vi.fn(async () => []),
      })),
    };
    const navigate = vi.fn();

    await startBuildFlow({
      treeId: 'tree-1' as TreeId,
      pageNodeId: node.id as NodeId,
      node,
      returnTo: '/treeconsole',
      workerClient,
      navigate,
    });

    expect(navigate).toHaveBeenCalledTimes(1);
    const [urlValue] = navigate.mock.calls[0]!;
    const builtUrl = new URL(urlValue, 'http://localhost');
    expect(builtUrl.pathname).toBe('/t/tree-1/r:shape-no-autobuild/shape/edit/normal/2');
    expect(builtUrl.searchParams.get('build')).toBeNull();
    expect(builtUrl.searchParams.get('returnTo')).toBe('/treeconsole');
  });

  it('stores all resolvable buildable descendants into the build queue for folder build flow', async () => {
    composeStepConfigsMock.mockImplementation((nodeType: string) => {
      if (nodeType === 'shape') {
        return { configs: [{ id: 'build' }], hasHostBase: false };
      }
      if (nodeType === 'route') {
        return { configs: [{ id: 'data-source' }], hasHostBase: false };
      }
      if (nodeType === 'styler') {
        return { configs: [{ id: 'data-source' }], hasHostBase: false };
      }
      return { configs: [{ id: 'build' }], hasHostBase: false };
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
        id: 'r:styler-build' as NodeId,
        nodeType: 'styler',
        metadata: {
          name: 'Styler Build',
          description: '',
          tags: [],
          buildMetadata: { buildRequired: true },
        },
      }),
      makeNode({
        id: 'r:folder-child' as NodeId,
        nodeType: 'folder',
        metadata: {
          name: 'Folder child',
          description: '',
          tags: [],
          buildMetadata: { buildRequired: true },
        },
      }),
      makeNode({
        id: 'r:shape-not-build' as NodeId,
        nodeType: 'shape',
        metadata: {
          name: 'Shape No Build',
          description: '',
          tags: [],
          buildMetadata: { buildRequired: false },
        },
      }),
    ];
    const folderNode = makeNode({ id: 'r:root-folder' as NodeId, nodeType: 'folder' });
    const workerClient = {
      getQueryAPI: vi.fn(async () => ({
        getNode: vi.fn(async () => undefined),
        listDescendants: async () => descendants,
      })),
    };
    const navigate = vi.fn();

    window.localStorage.clear();
    await startBuildFlow({
      treeId: 'tree-1' as TreeId,
      pageNodeId: folderNode.id as NodeId,
      node: folderNode,
      returnTo: '/treeconsole',
      workerClient,
      navigate,
    });

    expect(navigate).toHaveBeenCalledTimes(1);
    const [navigatedUrl] = navigate.mock.calls[0]!;
    const url = new URL(navigatedUrl, 'http://localhost');
    const queueKey = url.searchParams.get('buildQueue');
    expect(queueKey).toBeTruthy();
    expect(url.searchParams.get('build')).toBe('1');
    const rawQueueKey = `hdb.buildQueue.${queueKey}`;
    const rawQueue = window.localStorage.getItem(rawQueueKey);
    expect(rawQueue).not.toBeNull();

    const queueState = JSON.parse(rawQueue as string) as {
      urls: string[];
      returnTo: string;
      createdAt: number;
      treeId?: string;
    };
    expect(queueState.urls).toHaveLength(3);
    expect(queueState.urls.map((item) => new URL(item, 'http://localhost').pathname)).toEqual(
      expect.arrayContaining([
        '/t/tree-1/r:root-folder/r:shape-build/shape/edit/normal/2',
        '/t/tree-1/r:root-folder/r:route-build/route/edit/normal/2',
        '/t/tree-1/r:root-folder/r:styler-build/styler/edit/normal/2',
      ])
    );
  });

  it('treats a folder as build-required when at least one descendant is build-required and resolvable', async () => {
    composeStepConfigsMock.mockImplementation((nodeType: string) => {
      if (nodeType === 'shape') {
        return { configs: [{ id: 'build' }], hasHostBase: false };
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
        id: 'r:folder-child' as NodeId,
        nodeType: 'folder',
        metadata: {
          name: 'Folder child',
          description: '',
          tags: [],
        },
      }),
    ];
    const folderNode = makeNode({ id: 'r:parent-folder' as NodeId, nodeType: 'folder' });
    const workerClient = {
      getQueryAPI: vi.fn(async () => ({
        listDescendants: async () => descendants,
      })),
    };

    const { urls } = await collectBuildUrlsForFolder({
      treeId: 'tree-1' as TreeId,
      pageNodeId: folderNode.id as NodeId,
      folderNode,
      returnTo: '/t/tree-1/r:parent-folder',
      workerClient,
    });

    const isFolderBuildRequired = urls.length > 0;
    expect(isFolderBuildRequired).toBe(true);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('r:shape-build');
  });

  it('does not mark a folder as build-required when no buildable descendants are collected', async () => {
    composeStepConfigsMock.mockImplementation(() => ({ configs: [{ id: 'data-source' }], hasHostBase: false }));

    const descendants: TreeNode[] = [
      makeNode({
        id: 'r:shape-not-build' as NodeId,
        nodeType: 'shape',
        metadata: {
          name: 'Shape No Build',
          description: '',
          tags: [],
          buildMetadata: { buildRequired: false },
        },
      }),
      makeNode({
        id: 'r:folder-child' as NodeId,
        nodeType: 'folder',
        metadata: {
          name: 'Folder child',
          description: '',
          tags: [],
        },
      }),
    ];
    const folderNode = makeNode({ id: 'r:parent-folder-empty' as NodeId, nodeType: 'folder' });
    const workerClient = {
      getQueryAPI: vi.fn(async () => ({
        listDescendants: async () => descendants,
      })),
    };

    const { urls } = await collectBuildUrlsForFolder({
      treeId: 'tree-1' as TreeId,
      pageNodeId: folderNode.id as NodeId,
      folderNode,
      returnTo: '/t/tree-1/r:parent-folder-empty',
      workerClient,
    });

    const isFolderBuildRequired = urls.length > 0;
    expect(isFolderBuildRequired).toBe(false);
    expect(urls).toHaveLength(0);
  });
});
