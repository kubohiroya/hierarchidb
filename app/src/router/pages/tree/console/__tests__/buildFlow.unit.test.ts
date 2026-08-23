import type { NodeId, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectBuildTargetsForFolder,
  createBuildJobQueueForFolder,
  startBuildFlow,
} from '../buildFlow.ts';
import {
  BUILD_JOB_QUEUE_OPEN_EVENT,
  deleteBuildJobQueueSessions,
  deleteBuildJobQueues,
  deleteBuildJobQueuesForTree,
  getBuildJobQueue,
  listBuildJobQueues,
  openBuildJobQueueSurface,
  reloadBuildJobQueuesForTests,
  resetBuildJobQueuesForTests,
  startBuildJobQueue,
} from '../buildJobQueue.ts';

const composeStepConfigsMock = vi.fn();
const startBuildSessionMock = vi.fn();
const getBuildSessionStatusMock = vi.fn();

const createMemoryStorage = (): Storage => {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => Array.from(items.keys())[index] ?? null,
    removeItem: (key) => items.delete(key),
    setItem: (key, value) => items.set(key, value),
  };
};

const listStorageKeys = (): string[] =>
  Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
    .filter((key): key is string => typeof key === 'string')
    .sort();

vi.mock('@hierarchidb/plugin-base', () => ({
  composeStepConfigs: (...args: Parameters<typeof composeStepConfigsMock>) =>
    composeStepConfigsMock(...args),
}));

vi.mock('~/plugin-loaders/uiPluginLoaderUtils', () => ({
  loadUIPlugin: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@hierarchidb/ui-worker-client', () => ({
  getBuildWorkerBridge: () => ({
    initialize: vi.fn(async () => undefined),
    startBuildSession: startBuildSessionMock,
    getBuildSessionStatus: getBuildSessionStatusMock,
  }),
}));

beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage());
  resetBuildJobQueuesForTests();
  startBuildSessionMock.mockReset();
  getBuildSessionStatusMock.mockReset();
  startBuildSessionMock.mockResolvedValue({
    nodeId: 'r:shape-build',
    status: 'completed',
    progress: { total: 1, completed: 1, failed: 0, skipped: 0 },
  });
  getBuildSessionStatusMock.mockResolvedValue({
    nodeId: 'r:shape-build',
    status: 'completed',
    progress: { total: 1, completed: 1, failed: 0, skipped: 0 },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('collectBuildTargetsForFolder', () => {
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

    const targets = await collectBuildTargetsForFolder({
      folderNode,
      workerClient,
    });

    expect(targets).toHaveLength(2);
    expect(targets.map((target) => String(target.targetNodeId))).toEqual([
      'r:shape-build',
      'r:shape-no-build',
    ]);
    expect(targets.every((target) => target.inputSource === 'working-copy')).toBe(true);
    expect(targets.every((target) => target.stepId === 'build')).toBe(true);
  });

  it('does not collect folder descendants that cannot auto-start', async () => {
    composeStepConfigsMock.mockImplementation(() => ({
      configs: [
        {
          id: 'build',
          capabilities: {
            canStartBuild: () => false,
          },
        },
      ],
      hasHostBase: false,
    }));

    const folderNode = makeNode({ id: 'r:parent-folder' as NodeId, nodeType: 'folder' });
    const workerClient = {
      getQueryAPI: vi.fn(async () => ({
        listDescendants: async () => [
          makeNode({
            id: 'r:shape-not-ready' as NodeId,
            nodeType: 'shape',
            metadata: {
              name: 'Shape Not Ready',
              description: '',
              tags: [],
              buildMetadata: { buildRequired: true },
            },
          }),
        ],
      })),
    };

    await expect(
      collectBuildTargetsForFolder({
        folderNode,
        workerClient,
      })
    ).resolves.toEqual([]);
  });

  it('starts at build step without auto-build when canStartBuild returns false', async () => {
    const composeConfigs = vi.fn().mockImplementation((nodeType: string) =>
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
    const firstCall = navigate.mock.calls[0];
    const urlValue = firstCall?.[0];
    if (typeof urlValue !== 'string') {
      throw new Error('Expected navigation URL.');
    }
    const builtUrl = new URL(urlValue, 'http://localhost');
    expect(builtUrl.pathname).toBe(
      '/d/tree-1/r:shape-no-autobuild/r:shape-no-autobuild/shape/edit/normal/2'
    );
    expect(builtUrl.searchParams.get('build')).toBeNull();
    expect(builtUrl.searchParams.get('returnTo')).toBe('/treeconsole');
  });

  it('creates a build job queue for all resolvable buildable descendants in folder build flow', async () => {
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
    const openEvents: string[] = [];
    window.addEventListener(BUILD_JOB_QUEUE_OPEN_EVENT, (event) => {
      const detail = (event as CustomEvent<{ queueId: string }>).detail;
      openEvents.push(detail.queueId);
    });

    await startBuildFlow({
      treeId: 'tree-1' as TreeId,
      pageNodeId: folderNode.id as NodeId,
      node: folderNode,
      returnTo: '/treeconsole',
      workerClient,
      navigate,
    });

    expect(navigate).not.toHaveBeenCalled();
    const [createdQueue] = listBuildJobQueues();
    const queueKey = createdQueue?.queueId;
    expect(queueKey).toBeTruthy();
    expect(openEvents).toEqual([queueKey]);
    if (!queueKey) {
      throw new Error('Expected build job id.');
    }
    const queue = getBuildJobQueue(queueKey);
    expect(queue?.entries).toHaveLength(2);
    expect(queue?.entries.map((entry) => String(entry.targetNodeId))).toEqual([
      'r:shape-build',
      'r:styler-build',
    ]);
    expect(listStorageKeys().some((key) => key.startsWith('hdb.buildQueue.'))).toBe(false);
    expect(listStorageKeys().some((key) => key.startsWith('hdb.buildJobQueue.'))).toBe(true);
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

    const targets = await collectBuildTargetsForFolder({
      folderNode,
      workerClient,
    });

    const isFolderBuildRequired = targets.length > 0;
    expect(isFolderBuildRequired).toBe(true);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.targetNodeId).toBe('r:shape-build');
  });

  it('does not mark a folder as build-required when no buildable descendants are collected', async () => {
    composeStepConfigsMock.mockImplementation(() => ({
      configs: [{ id: 'data-source' }],
      hasHostBase: false,
    }));

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

    const targets = await collectBuildTargetsForFolder({
      folderNode,
      workerClient,
    });

    const isFolderBuildRequired = targets.length > 0;
    expect(isFolderBuildRequired).toBe(false);
    expect(targets).toHaveLength(0);
  });

  it('stores display URLs as job entry metadata instead of a localStorage URL queue', async () => {
    composeStepConfigsMock.mockImplementation(() => ({
      configs: [{ id: 'build' }],
      hasHostBase: false,
    }));

    const folderNode = makeNode({ id: 'r:parent-folder' as NodeId, nodeType: 'folder' });
    const workerClient = {
      getQueryAPI: vi.fn(async () => ({
        listDescendants: async () => [
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
        ],
      })),
    };

    const queue = await createBuildJobQueueForFolder({
      treeId: 'tree-1' as TreeId,
      pageNodeId: folderNode.id as NodeId,
      folderNode,
      returnTo: '/treeconsole',
      workerClient,
    });

    expect(queue?.entries).toHaveLength(1);
    const displayUrl = queue?.entries[0]?.displayUrl;
    expect(displayUrl).toBeTruthy();
    const url = new URL(String(displayUrl), 'http://localhost');
    expect(url.searchParams.get('buildJob')).toBe(queue?.queueId);
    expect(url.searchParams.get('buildQueue')).toBeNull();
    expect(url.searchParams.get('build')).toBeNull();
    expect(listStorageKeys().some((key) => key.startsWith('hdb.buildQueue.'))).toBe(false);
    expect(listStorageKeys().some((key) => key.startsWith('hdb.buildJobQueue.'))).toBe(true);
  });

  it('removes persisted build job queues for the selected tree only', async () => {
    composeStepConfigsMock.mockImplementation(() => ({
      configs: [{ id: 'build' }],
      hasHostBase: false,
    }));

    const createQueue = async (treeId: TreeId) =>
      createBuildJobQueueForFolder({
        treeId,
        pageNodeId: 'r:folder' as NodeId,
        folderNode: makeNode({ id: 'r:folder' as NodeId }),
        returnTo: '/treeconsole',
        workerClient: {
          getQueryAPI: vi.fn(async () => ({
            listDescendants: async () => [
              makeNode({
                id: `r:${String(treeId)}-shape` as NodeId,
                nodeType: 'shape',
                metadata: {
                  name: 'Shape Build',
                  description: '',
                  tags: [],
                  buildMetadata: { buildRequired: true },
                },
              }),
            ],
          })),
        },
      });

    const treeOneQueue = await createQueue('tree-1' as TreeId);
    const treeTwoQueue = await createQueue('tree-2' as TreeId);
    if (!treeOneQueue || !treeTwoQueue) {
      throw new Error('Expected build job queues.');
    }

    deleteBuildJobQueuesForTree('tree-1' as TreeId);

    expect(getBuildJobQueue(treeOneQueue.queueId)).toBeNull();
    expect(getBuildJobQueue(treeTwoQueue.queueId)?.queueId).toBe(treeTwoQueue.queueId);
    expect(listStorageKeys()).toEqual([`hdb.buildJobQueue.${treeTwoQueue.queueId}`]);
  });

  it('removes the selected persisted build job queues by id', async () => {
    composeStepConfigsMock.mockImplementation(() => ({
      configs: [{ id: 'build' }],
      hasHostBase: false,
    }));

    const createQueue = async (treeId: TreeId) =>
      createBuildJobQueueForFolder({
        treeId,
        pageNodeId: 'r:folder' as NodeId,
        folderNode: makeNode({ id: 'r:folder' as NodeId }),
        returnTo: '/treeconsole',
        workerClient: {
          getQueryAPI: vi.fn(async () => ({
            listDescendants: async () => [
              makeNode({
                id: `r:${String(treeId)}-shape` as NodeId,
                nodeType: 'shape',
                metadata: {
                  name: 'Shape Build',
                  description: '',
                  tags: [],
                  buildMetadata: { buildRequired: true },
                },
              }),
            ],
          })),
        },
      });

    const firstQueue = await createQueue('tree-1' as TreeId);
    const secondQueue = await createQueue('tree-2' as TreeId);
    if (!firstQueue || !secondQueue) {
      throw new Error('Expected build job queues.');
    }

    deleteBuildJobQueues([firstQueue.queueId]);

    expect(getBuildJobQueue(firstQueue.queueId)).toBeNull();
    expect(getBuildJobQueue(secondQueue.queueId)?.queueId).toBe(secondQueue.queueId);
    expect(listStorageKeys()).toEqual([`hdb.buildJobQueue.${secondQueue.queueId}`]);
  });

  it('marks interrupted persisted build job queues as paused on reload', () => {
    window.localStorage.setItem(
      'hdb.buildJobQueue.queue-reload',
      JSON.stringify({
        queueId: 'queue-reload',
        treeId: 'tree-1',
        ownerNodeId: 'r:folder',
        createdAt: 1,
        createdBy: 'tree-console',
        mode: 'web-ui',
        status: 'running',
        entries: [
          {
            targetNodeId: 'r:shape-running',
            nodeType: 'shape',
            inputSource: 'working-copy',
            stepId: 'build',
            stepNumber: 1,
            shouldAutoStart: true,
            entryId: 'queue-reload:1',
            order: 0,
            status: 'running',
            startedAt: 2,
          },
          {
            targetNodeId: 'r:shape-pending',
            nodeType: 'shape',
            inputSource: 'working-copy',
            stepId: 'build',
            stepNumber: 1,
            shouldAutoStart: true,
            entryId: 'queue-reload:2',
            order: 1,
            status: 'pending',
          },
        ],
      })
    );

    reloadBuildJobQueuesForTests();
    const queue = getBuildJobQueue('queue-reload');

    expect(queue?.status).toBe('paused');
    expect(queue?.entries.map((entry) => entry.status)).toEqual(['paused', 'pending']);
    expect(queue?.entries[0]?.error).toContain('interrupted before completion');
    const persisted = window.localStorage.getItem('hdb.buildJobQueue.queue-reload');
    expect(persisted).toContain('"status":"paused"');
  });

  it('deletes started build sessions before removing selected build job queues', async () => {
    composeStepConfigsMock.mockImplementation((nodeType: string) => {
      if (nodeType === 'styler') {
        return { configs: [{ id: 'data-source' }], hasHostBase: false };
      }
      return { configs: [{ id: 'build' }], hasHostBase: false };
    });

    const queue = await createBuildJobQueueForFolder({
      treeId: 'tree-1' as TreeId,
      pageNodeId: 'r:folder' as NodeId,
      folderNode: makeNode({ id: 'r:folder' as NodeId }),
      returnTo: '/treeconsole',
      workerClient: {
        getQueryAPI: vi.fn(async () => ({
          listDescendants: async () => [
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
              id: 'r:styler-build' as NodeId,
              nodeType: 'styler',
              metadata: {
                name: 'Styler Build',
                description: '',
                tags: [],
                buildMetadata: { buildRequired: true },
              },
            }),
          ],
        })),
      },
    });
    if (!queue) {
      throw new Error('Expected build job queue.');
    }

    await startBuildJobQueue(queue.queueId, {
      startBuildSession: async (nodeType, nodeId) => ({
        nodeId,
        status: 'completed',
        progress: { total: 1, completed: 1, failed: 0, skipped: 0 },
      }),
      getBuildSessionStatus: async (nodeType, nodeId) => ({
        nodeId,
        status: 'completed',
        progress: { total: 1, completed: 1, failed: 0, skipped: 0 },
      }),
    });
    const deleteBuildSession = vi.fn(async () => undefined);

    await deleteBuildJobQueueSessions([queue.queueId], {
      deleteBuildSession,
    });

    expect(deleteBuildSession.mock.calls).toEqual([
      ['shape', 'r:shape-build'],
      ['styler', 'r:styler-build'],
    ]);
    expect(getBuildJobQueue(queue.queueId)).toBeNull();
  });

  it('includes treeId when requesting the AppBar build job queue surface', async () => {
    composeStepConfigsMock.mockImplementation(() => ({
      configs: [{ id: 'build' }],
      hasHostBase: false,
    }));

    const queue = await createBuildJobQueueForFolder({
      treeId: 'tree-1' as TreeId,
      pageNodeId: 'r:folder' as NodeId,
      folderNode: makeNode({ id: 'r:folder' as NodeId }),
      returnTo: '/treeconsole',
      workerClient: {
        getQueryAPI: vi.fn(async () => ({
          listDescendants: async () => [
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
          ],
        })),
      },
    });
    if (!queue) {
      throw new Error('Expected build job queue.');
    }
    const openEvents: Array<{ queueId: string; treeId: TreeId }> = [];
    window.addEventListener(BUILD_JOB_QUEUE_OPEN_EVENT, (event) => {
      const detail = (event as CustomEvent<{ queueId: string; treeId: TreeId }>).detail;
      openEvents.push(detail);
    });

    openBuildJobQueueSurface(queue.queueId);

    expect(openEvents).toEqual([{ queueId: queue.queueId, treeId: 'tree-1' }]);
  });
});

describe('startBuildJobQueue', () => {
  it('runs pending entries sequentially and completes the queue', async () => {
    const queue = await createBuildJobQueueForFolder({
      treeId: 'tree-1' as TreeId,
      pageNodeId: 'r:folder' as NodeId,
      folderNode: makeNode({ id: 'r:folder' as NodeId }),
      returnTo: '/treeconsole',
      workerClient: {
        getQueryAPI: vi.fn(async () => ({
          listDescendants: async () => [
            makeNode({
              id: 'r:first' as NodeId,
              nodeType: 'shape',
              metadata: {
                name: 'First',
                description: '',
                tags: [],
                buildMetadata: { buildRequired: true },
              },
            }),
            makeNode({
              id: 'r:second' as NodeId,
              nodeType: 'shape',
              metadata: {
                name: 'Second',
                description: '',
                tags: [],
                buildMetadata: { buildRequired: true },
              },
            }),
          ],
        })),
      },
    });
    if (!queue) {
      throw new Error('Expected build job queue.');
    }

    const start = vi.fn(async (nodeType: string, nodeId: NodeId) => ({
      nodeId,
      status: 'completed' as const,
      progress: { total: 1, completed: 1, failed: 0, skipped: 0 },
    }));
    const getStatus = vi.fn(async (nodeType: string, nodeId: NodeId) => ({
      nodeId,
      status: 'completed' as const,
      progress: { total: 1, completed: 1, failed: 0, skipped: 0 },
    }));

    const completed = await startBuildJobQueue(queue.queueId, {
      startBuildSession: start,
      getBuildSessionStatus: getStatus,
    });

    expect(completed.status).toBe('completed');
    expect(completed.entries.map((entry) => entry.status)).toEqual(['completed', 'completed']);
    expect(start.mock.calls.map((call) => String(call[1]))).toEqual(['r:first', 'r:second']);
  });

  it('marks the current entry and queue failed when a build session fails', async () => {
    const queue = await createBuildJobQueueForFolder({
      treeId: 'tree-1' as TreeId,
      pageNodeId: 'r:folder' as NodeId,
      folderNode: makeNode({ id: 'r:folder' as NodeId }),
      returnTo: '/treeconsole',
      workerClient: {
        getQueryAPI: vi.fn(async () => ({
          listDescendants: async () => [
            makeNode({
              id: 'r:first' as NodeId,
              nodeType: 'shape',
              metadata: {
                name: 'First',
                description: '',
                tags: [],
                buildMetadata: { buildRequired: true },
              },
            }),
            makeNode({
              id: 'r:second' as NodeId,
              nodeType: 'shape',
              metadata: {
                name: 'Second',
                description: '',
                tags: [],
                buildMetadata: { buildRequired: true },
              },
            }),
          ],
        })),
      },
    });
    if (!queue) {
      throw new Error('Expected build job queue.');
    }

    const completed = await startBuildJobQueue(queue.queueId, {
      startBuildSession: async (nodeType, nodeId) => ({
        nodeId,
        status: 'failed',
        error: 'boom',
        progress: { total: 1, completed: 0, failed: 1, skipped: 0 },
      }),
      getBuildSessionStatus: async (nodeType, nodeId) => ({
        nodeId,
        status: 'failed',
        error: 'boom',
        progress: { total: 1, completed: 0, failed: 1, skipped: 0 },
      }),
    });

    expect(completed.status).toBe('failed');
    expect(completed.entries.map((entry) => entry.status)).toEqual(['failed', 'pending']);
    expect(completed.entries[0]?.error).toBe('boom');
  });

  it('fails when terminal build status reports a different nodeId', async () => {
    const queue = await createBuildJobQueueForFolder({
      treeId: 'tree-1' as TreeId,
      pageNodeId: 'r:folder' as NodeId,
      folderNode: makeNode({ id: 'r:folder' as NodeId }),
      returnTo: '/treeconsole',
      workerClient: {
        getQueryAPI: vi.fn(async () => ({
          listDescendants: async () => [
            makeNode({
              id: 'r:first' as NodeId,
              nodeType: 'shape',
              metadata: {
                name: 'First',
                description: '',
                tags: [],
                buildMetadata: { buildRequired: true },
              },
            }),
          ],
        })),
      },
    });
    if (!queue) {
      throw new Error('Expected build job queue.');
    }

    await expect(
      startBuildJobQueue(queue.queueId, {
        startBuildSession: async () => ({
          nodeId: 'r:other' as NodeId,
          status: 'completed',
          progress: { total: 1, completed: 1, failed: 0, skipped: 0 },
        }),
        getBuildSessionStatus: async () => ({
          nodeId: 'r:other' as NodeId,
          status: 'completed',
          progress: { total: 1, completed: 1, failed: 0, skipped: 0 },
        }),
      })
    ).rejects.toThrow('build status nodeId mismatch');
    expect(getBuildJobQueue(queue.queueId)?.status).toBe('failed');
  });
});
