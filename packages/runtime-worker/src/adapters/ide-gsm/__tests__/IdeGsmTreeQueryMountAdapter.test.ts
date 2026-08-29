import { type NodeId, toNodeId, toNodeType } from '@hierarchidb/core-types';
import {
  encodeIdeGsmMountedNodeId,
  type IdeGsmDirectoryNode,
  type IdeGsmDirectoryTreeReport,
  type IdeGsmFdmDirectoryRemoveReport,
  type IdeGsmMountDescriptor,
} from '@hierarchidb/ide-gsm-client';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it, vi } from 'vitest';
import {
  assertNodeIsNotIdeGsmMountedForTreeMutation,
  type IdeGsmMountedFilesystemActionClient,
  IdeGsmMountedFilesystemActionPort,
} from '../IdeGsmMountedFilesystemActionPort.js';
import {
  type IdeGsmTreeQueryClient,
  IdeGsmTreeQueryMountAdapter,
  isIdeGsmMountRootNode,
} from '../IdeGsmTreeQueryMountAdapter.js';

const projectDescriptor: IdeGsmMountDescriptor = {
  mountKind: 'ide-gsm',
  sourceKind: 'project-root',
  mountId: 'project-a',
  displayName: 'Project A',
  rootPath: '',
  capabilities: { read: true },
  projectId: 'group/project',
};

const fdmDescriptor: IdeGsmMountDescriptor = {
  mountKind: 'ide-gsm',
  sourceKind: 'fdm-space-root',
  mountId: 'fdm-default',
  displayName: 'FDM default',
  rootPath: 'runs',
  capabilities: { read: true, remove: true },
  spaceId: 'default',
};

function makeRootNode(id: string, descriptor: IdeGsmMountDescriptor): TreeNode {
  return {
    id: toNodeId(id),
    parentId: toNodeId('root'),
    nodeType: toNodeType('folder'),
    depth: 1,
    createdAt: 0,
    updatedAt: 0,
    version: 1,
    metadata: { name: descriptor.displayName, description: '', tags: [] },
    draftMetadata: null,
    data: descriptor,
    visible: true,
  };
}

function remoteNode(
  name: string,
  relativePath: string,
  directory: boolean,
  children: IdeGsmDirectoryNode[] = [],
  childCount = children.length
): IdeGsmDirectoryNode {
  return {
    name,
    relativePath,
    kind: directory ? 'DIRECTORY' : 'FILE',
    directory,
    exists: true,
    sizeBytes: directory ? 0 : 10,
    updatedAt: '2026-08-29T00:00:00Z',
    childCount,
    children,
  };
}

function treeReport(root: IdeGsmDirectoryNode): IdeGsmDirectoryTreeReport {
  return { selectedPath: root.relativePath, maxDepth: 3, root };
}

function makeClient(): IdeGsmTreeQueryClient & IdeGsmMountedFilesystemActionClient {
  return {
    fdmDirectoryTree: vi.fn(),
    fdmDirectoryInfo: vi.fn(),
    projectDirectoryTree: vi.fn(),
    projectDirectoryInfo: vi.fn(),
    fdmDirectoryRemove: vi.fn(),
  };
}

describe('IdeGsmTreeQueryMountAdapter', () => {
  it('projects root children deterministically without endpoint or credentials in node data', async () => {
    const client = makeClient();
    const root = makeRootNode('mount-root', projectDescriptor);
    vi.mocked(client.projectDirectoryTree).mockResolvedValue(
      treeReport(
        remoteNode('', '', true, [
          remoteNode('zeta.txt', 'zeta.txt', false),
          remoteNode('alpha', 'alpha', true),
        ])
      )
    );
    const adapter = new IdeGsmTreeQueryMountAdapter(client, {
      getNode: vi.fn(async (nodeId) => (nodeId === root.id ? root : undefined)),
      getMountRootNodeByMountId: vi.fn(async () => root),
    });

    const children = await adapter.listChildren(root.id);

    expect(isIdeGsmMountRootNode(root)).toBe(true);
    expect(children.map((node) => node.metadata.name)).toEqual(['alpha', 'zeta.txt']);
    expect(children.map((node) => node.parentId)).toEqual([root.id, root.id]);
    expect(children[0]?.id).toBe(encodeIdeGsmMountedNodeId('project-a', 'alpha'));
    expect(children[0]?.data).toEqual({
      mountKind: 'ide-gsm',
      mountId: 'project-a',
      sourceKind: 'project-root',
      relativePath: 'alpha',
      projectId: 'group/project',
    });
    expect(children[0]?.data).not.toHaveProperty('endpointUrl');
    expect(children[0]?.data).not.toHaveProperty('token');
    expect(client.projectDirectoryTree).toHaveBeenCalledWith({
      projectRelativePath: 'group/project',
      path: '',
      depth: 1,
    });
  });

  it('gets mounted child metadata through the project info query', async () => {
    const client = makeClient();
    const root = makeRootNode('mount-root', projectDescriptor);
    vi.mocked(client.projectDirectoryInfo).mockResolvedValue({
      requestedPath: 'src/index.ts',
      descendantCount: 0,
      node: remoteNode('index.ts', 'src/index.ts', false),
    });
    const adapter = new IdeGsmTreeQueryMountAdapter(client, {
      getNode: vi.fn(async () => undefined),
      getMountRootNodeByMountId: vi.fn(async () => root),
    });

    const node = await adapter.getNode(
      toNodeId(encodeIdeGsmMountedNodeId('project-a', 'src/index.ts'))
    );

    expect(node).toMatchObject({
      parentId: encodeIdeGsmMountedNodeId('project-a', 'src'),
      nodeType: 'file',
      metadata: { name: 'index.ts', description: '', tags: [] },
      hasChildren: false,
    });
    expect(client.projectDirectoryInfo).toHaveBeenCalledWith({
      projectRelativePath: 'group/project',
      path: 'src/index.ts',
      depth: 0,
    });
  });

  it('lists descendants from a prefetched FDM subtree relative to the mounted root', async () => {
    const client = makeClient();
    const root = makeRootNode('fdm-root', fdmDescriptor);
    vi.mocked(client.fdmDirectoryTree)
      .mockResolvedValueOnce(
        treeReport(
          remoteNode('runs', 'runs', true, [remoteNode('case-a', 'runs/case-a', true, [], 1)])
        )
      )
      .mockResolvedValueOnce(
        treeReport(
          remoteNode('case-a', 'runs/case-a', true, [
            remoteNode('result.json', 'runs/case-a/result.json', false),
          ])
        )
      );
    const adapter = new IdeGsmTreeQueryMountAdapter(client, {
      getNode: vi.fn(async (nodeId) => (nodeId === root.id ? root : undefined)),
      getMountRootNodeByMountId: vi.fn(async () => root),
    });

    const descendants = await adapter.listDescendants(root.id, 2);

    expect(descendants.map((node) => node.id)).toEqual([
      encodeIdeGsmMountedNodeId('fdm-default', 'case-a'),
      encodeIdeGsmMountedNodeId('fdm-default', 'case-a/result.json'),
    ]);
    expect(descendants[1]?.parentId).toBe(encodeIdeGsmMountedNodeId('fdm-default', 'case-a'));
    expect(client.fdmDirectoryTree).toHaveBeenNthCalledWith(1, {
      spaceId: 'default',
      path: 'runs',
      depth: 1,
    });
    expect(client.fdmDirectoryTree).toHaveBeenNthCalledWith(2, {
      spaceId: 'default',
      path: 'runs/case-a',
      depth: 1,
    });
  });
});

describe('IdeGsmMountedFilesystemActionPort', () => {
  it('routes FDM remove through the explicit mounted filesystem action port', async () => {
    const client = makeClient();
    const report: IdeGsmFdmDirectoryRemoveReport = {
      targetPath: 'runs/case-a',
      apply: true,
      existed: true,
      deleted: true,
      deletedFiles: 2,
      deletedBytes: 20,
      target: remoteNode('case-a', 'runs/case-a', true),
    };
    vi.mocked(client.fdmDirectoryRemove).mockResolvedValue(report);
    const port = new IdeGsmMountedFilesystemActionPort(client);

    await expect(
      port.remove({ descriptor: fdmDescriptor, path: 'case-a', apply: true })
    ).resolves.toBe(report);

    expect(client.fdmDirectoryRemove).toHaveBeenCalledWith({
      spaceId: 'default',
      path: 'runs/case-a',
      apply: true,
    });
  });

  it('rejects project-root remove before a network request', async () => {
    const client = makeClient();
    const port = new IdeGsmMountedFilesystemActionPort(client);

    await expect(
      port.remove({ descriptor: projectDescriptor, path: 'src', apply: true })
    ).rejects.toThrow('project-root');
    expect(client.fdmDirectoryRemove).not.toHaveBeenCalled();
  });

  it('rejects mounted IDs and nodes before generic TreeMutationAPI handlers can run', () => {
    const runTreeMutation = vi.fn();
    const mountedId = toNodeId(encodeIdeGsmMountedNodeId('project-a', 'src/index.ts'));
    const mountedRoot = makeRootNode('mount-root', projectDescriptor);

    expect(() => {
      assertNodeIsNotIdeGsmMountedForTreeMutation(mountedId);
      runTreeMutation();
    }).toThrow('TreeMutationAPI');
    expect(() => {
      assertNodeIsNotIdeGsmMountedForTreeMutation(mountedRoot);
      runTreeMutation();
    }).toThrow('TreeMutationAPI');
    expect(runTreeMutation).not.toHaveBeenCalled();
  });
});
