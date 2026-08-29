import { type NodeId, toNodeId, toNodeType } from '@hierarchidb/core-types';
import {
  assertIdeGsmMountDescriptor,
  assertLogicalPath,
  decodeIdeGsmMountedNodeId,
  encodeIdeGsmMountedNodeId,
  type IdeGsmDirectoryNode,
  type IdeGsmDirectoryTreeReport,
  type IdeGsmMountDescriptor,
  type IdeGsmMountedNodeReference,
} from '@hierarchidb/ide-gsm-client';
import type { ListChildrenOptions, TreeNode } from '@hierarchidb/tree-api';

export interface IdeGsmTreeQueryClient {
  fdmDirectoryTree(input?: {
    spaceId?: string;
    path?: string;
    depth?: number;
  }): Promise<IdeGsmDirectoryTreeReport>;
  fdmDirectoryInfo(input?: {
    spaceId?: string;
    path?: string;
    depth?: number;
  }): Promise<{ requestedPath: string; descendantCount: number; node: IdeGsmDirectoryNode }>;
  projectDirectoryTree(input: {
    projectRelativePath: string;
    path?: string;
    depth?: number;
  }): Promise<IdeGsmDirectoryTreeReport>;
  projectDirectoryInfo(input: {
    projectRelativePath: string;
    path?: string;
    depth?: number;
  }): Promise<{ requestedPath: string; descendantCount: number; node: IdeGsmDirectoryNode }>;
}

export interface IdeGsmMountRootReader {
  getNode(nodeId: NodeId): Promise<TreeNode | undefined>;
  getMountRootNodeByMountId(mountId: string): Promise<TreeNode | undefined>;
}

interface ResolvedMount {
  rootNode: TreeNode;
  descriptor: IdeGsmMountDescriptor;
  relativePath: string;
}

interface RemoteTreeRequest {
  descriptor: IdeGsmMountDescriptor;
  relativePath: string;
  depth: number;
}

export class IdeGsmTreeQueryMountAdapter {
  constructor(
    private readonly client: IdeGsmTreeQueryClient,
    private readonly mountRoots: IdeGsmMountRootReader
  ) {}

  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    const resolved = await this.resolveMount(nodeId);
    if (resolved === undefined) {
      return undefined;
    }
    if (resolved.relativePath.length === 0) {
      return resolved.rootNode;
    }
    const report = await this.requestInfo({
      descriptor: resolved.descriptor,
      relativePath: resolved.relativePath,
      depth: 0,
    });
    return this.toTreeNode(resolved.rootNode, resolved.descriptor, report.node);
  }

  async listChildren(parentId: NodeId, options?: ListChildrenOptions): Promise<TreeNode[]> {
    const resolved = await this.resolveMount(parentId);
    if (resolved === undefined) {
      return [];
    }
    const depth = options?.prefetch?.depth ?? 1;
    if (!Number.isInteger(depth) || depth < 0) {
      throw new Error('prefetch depth must be a non-negative integer');
    }
    if (depth === 0) {
      return [];
    }
    const report = await this.requestTree({
      descriptor: resolved.descriptor,
      relativePath: resolved.relativePath,
      depth: 1,
    });
    const children = this.sortRemoteNodes(report.root.children).map((node) =>
      this.toTreeNode(resolved.rootNode, resolved.descriptor, node)
    );
    if (depth <= 1) {
      return children;
    }
    const descendants = await this.collectDescendants(children, depth - 1);
    return [...children, ...descendants];
  }

  async listDescendants(nodeId: NodeId, maxDepth?: number): Promise<TreeNode[]> {
    if (maxDepth !== undefined && (!Number.isInteger(maxDepth) || maxDepth < 0)) {
      throw new Error('maxDepth must be a non-negative integer');
    }
    if (maxDepth === 0) {
      return [];
    }
    const children = await this.listChildren(nodeId);
    const descendants = await this.collectDescendants(children, decrementDepth(maxDepth));
    return [...children, ...descendants];
  }

  private async resolveMount(nodeId: NodeId): Promise<ResolvedMount | undefined> {
    const rootCandidate = await this.mountRoots.getNode(nodeId);
    const rootDescriptor = readMountDescriptor(rootCandidate);
    if (rootCandidate !== undefined && rootDescriptor !== undefined) {
      return { rootNode: rootCandidate, descriptor: rootDescriptor, relativePath: '' };
    }

    const decoded = decodeIdeGsmMountedNodeId(nodeId);
    if (decoded === null) {
      return undefined;
    }
    const rootNode = await this.mountRoots.getMountRootNodeByMountId(decoded.mountId);
    const descriptor = readMountDescriptor(rootNode);
    if (rootNode === undefined || descriptor === undefined) {
      return undefined;
    }
    return { rootNode, descriptor, relativePath: decoded.relativePath };
  }

  private async requestTree(input: RemoteTreeRequest): Promise<IdeGsmDirectoryTreeReport> {
    const path = toRemotePath(input.descriptor.rootPath, input.relativePath);
    if (input.descriptor.sourceKind === 'project-root') {
      return this.client.projectDirectoryTree({
        projectRelativePath: input.descriptor.projectId,
        path,
        depth: input.depth,
      });
    }
    return this.client.fdmDirectoryTree({
      spaceId: input.descriptor.spaceId,
      path,
      depth: input.depth,
    });
  }

  private async requestInfo(input: RemoteTreeRequest): Promise<{
    requestedPath: string;
    descendantCount: number;
    node: IdeGsmDirectoryNode;
  }> {
    const path = toRemotePath(input.descriptor.rootPath, input.relativePath);
    if (input.descriptor.sourceKind === 'project-root') {
      return this.client.projectDirectoryInfo({
        projectRelativePath: input.descriptor.projectId,
        path,
        depth: input.depth,
      });
    }
    return this.client.fdmDirectoryInfo({
      spaceId: input.descriptor.spaceId,
      path,
      depth: input.depth,
    });
  }

  private async collectDescendants(
    children: TreeNode[],
    remainingDepth: number | undefined
  ): Promise<TreeNode[]> {
    if (remainingDepth === 0) {
      return [];
    }
    const result: TreeNode[] = [];
    const visit = async (node: TreeNode, nextDepth: number | undefined): Promise<void> => {
      if (node.hasChildren !== true) {
        return;
      }
      const nestedChildren = await this.listChildren(node.id);
      result.push(...nestedChildren);
      const descendantDepth = decrementDepth(nextDepth);
      if (descendantDepth === 0) {
        return;
      }
      for (const child of nestedChildren) {
        await visit(child, descendantDepth);
      }
    };
    for (const child of children) {
      await visit(child, remainingDepth);
    }
    return result;
  }

  private sortRemoteNodes(nodes: IdeGsmDirectoryNode[]): IdeGsmDirectoryNode[] {
    return [...nodes].sort((left, right) => {
      const leftDirectory = left.directory;
      const rightDirectory = right.directory;
      if (leftDirectory !== rightDirectory) {
        return leftDirectory ? -1 : 1;
      }
      const leftName = left.name;
      const rightName = right.name;
      if (leftName < rightName) {
        return -1;
      }
      if (leftName > rightName) {
        return 1;
      }
      const leftPath = left.relativePath;
      const rightPath = right.relativePath;
      if (leftPath < rightPath) {
        return -1;
      }
      if (leftPath > rightPath) {
        return 1;
      }
      return 0;
    });
  }

  private toTreeNode(
    rootNode: TreeNode,
    descriptor: IdeGsmMountDescriptor,
    remoteNode: IdeGsmDirectoryNode
  ): TreeNode<IdeGsmMountedNodeReference> {
    const mountedRelativePath = toMountedRelativePath(descriptor.rootPath, remoteNode.relativePath);
    const updatedAt = toTimestamp(remoteNode.updatedAt);
    const data: IdeGsmMountedNodeReference = {
      mountKind: 'ide-gsm',
      mountId: descriptor.mountId,
      sourceKind: descriptor.sourceKind,
      relativePath: mountedRelativePath,
      ...(descriptor.sourceKind === 'project-root'
        ? { projectId: descriptor.projectId }
        : { spaceId: descriptor.spaceId }),
    };
    return {
      id: toNodeId(encodeIdeGsmMountedNodeId(descriptor.mountId, mountedRelativePath)),
      parentId:
        mountedRelativePath.length === 0
          ? rootNode.id
          : toNodeId(parentNodeId(rootNode.id, descriptor.mountId, mountedRelativePath)),
      nodeType: toNodeType(remoteNode.directory ? 'folder' : 'file'),
      depth: rootNode.depth + pathDepth(mountedRelativePath),
      createdAt: updatedAt,
      updatedAt,
      version: 1,
      metadata: {
        name: remoteNode.name,
        description: '',
        tags: [],
      },
      draftMetadata: null,
      data,
      visible: true,
      hasChildren: remoteNode.directory && remoteNode.childCount > 0,
      descendantCount: remoteNode.childCount,
      isEstimated: true,
    };
  }
}

export function isIdeGsmMountRootNode(node: TreeNode | undefined): boolean {
  return readMountDescriptor(node) !== undefined;
}

function readMountDescriptor(node: TreeNode | undefined): IdeGsmMountDescriptor | undefined {
  if (node?.data === undefined || node.data === null) {
    return undefined;
  }
  try {
    assertIdeGsmMountDescriptor(node.data);
    return node.data;
  } catch {
    return undefined;
  }
}

function toRemotePath(rootPath: string, relativePath: string): string {
  assertLogicalPath(rootPath, 'rootPath', true);
  assertLogicalPath(relativePath, 'relativePath', true);
  if (rootPath.length === 0) {
    return relativePath;
  }
  if (relativePath.length === 0) {
    return rootPath;
  }
  return `${rootPath}/${relativePath}`;
}

function toMountedRelativePath(rootPath: string, remoteRelativePath: string): string {
  assertLogicalPath(rootPath, 'rootPath', true);
  assertLogicalPath(remoteRelativePath, 'relativePath', true);
  if (rootPath.length === 0) {
    return remoteRelativePath;
  }
  if (remoteRelativePath === rootPath) {
    return '';
  }
  const prefix = `${rootPath}/`;
  if (!remoteRelativePath.startsWith(prefix)) {
    throw new Error('IDE-GSM remote node is outside the mounted root');
  }
  return remoteRelativePath.slice(prefix.length);
}

function parentNodeId(rootNodeId: NodeId, mountId: string, relativePath: string): string {
  const separator = relativePath.lastIndexOf('/');
  if (separator < 0) {
    return rootNodeId;
  }
  return encodeIdeGsmMountedNodeId(mountId, relativePath.slice(0, separator));
}

function pathDepth(relativePath: string): number {
  if (relativePath.length === 0) {
    return 0;
  }
  return relativePath.split('/').length;
}

function decrementDepth(depth: number | undefined): number | undefined {
  if (depth === undefined) {
    return undefined;
  }
  return depth - 1;
}

function toTimestamp(value: string | null): number {
  if (value === null) {
    return 0;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error('IDE-GSM remote node updatedAt is invalid');
  }
  return timestamp;
}
