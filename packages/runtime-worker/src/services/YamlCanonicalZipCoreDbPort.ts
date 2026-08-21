import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type {
  YamlCanonicalZipCoreDbPort as YamlCanonicalZipCoreDbPortContract,
  YamlCanonicalZipFolderSnapshot,
  YamlCanonicalZipImportNode,
  YamlCanonicalZipImportTransactionRequest,
} from '@hierarchidb/worker-api';
import type { CoreDB } from './CoreDB.js';

function compareStringArrays(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function matchesParentGuard(
  parent: TreeNode | undefined,
  request: YamlCanonicalZipImportTransactionRequest
): parent is TreeNode {
  return (
    parent !== undefined &&
    String(parent.id) === request.parentGuard.nodeId &&
    parent.nodeType === ('folder' as NodeType) &&
    parent.version === request.parentGuard.expectedVersion &&
    parent.depth === request.parentGuard.expectedDepth &&
    parent.hasChildren === request.parentGuard.expectedHasChildren
  );
}

function matchesSiblingGuards(
  siblings: readonly TreeNode[],
  request: YamlCanonicalZipImportTransactionRequest
): boolean {
  if (siblings.length !== request.siblingGuards.length) return false;
  const siblingsById = new Map(siblings.map((node) => [String(node.id), node] as const));
  return request.siblingGuards.every((guard) => {
    const sibling = siblingsById.get(guard.nodeId);
    return (
      sibling !== undefined &&
      String(sibling.parentId) === guard.parentId &&
      sibling.version === guard.expectedVersion &&
      sibling.metadata.name === guard.metadataName
    );
  });
}

function toImportedTreeNode(node: YamlCanonicalZipImportNode): TreeNode {
  return {
    id: node.id as NodeId,
    parentId: node.parentId as NodeId,
    nodeType: node.nodeType as NodeType,
    depth: node.depth,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    version: node.version,
    metadata: {
      name: node.metadata.name,
      description: node.metadata.description,
      tags: [...node.metadata.tags],
    },
    draftMetadata: null,
    data: node.data,
    visible: node.visible,
  } as unknown as TreeNode;
}

export class YamlCanonicalZipCoreDbPort implements YamlCanonicalZipCoreDbPortContract {
  constructor(private readonly coreDB: CoreDB) {}

  async readFolderSnapshot(parentId: NodeId): Promise<YamlCanonicalZipFolderSnapshot> {
    return this.coreDB.runInTx('r', ['nodes'], async () => {
      const [parent, children, existingNodeIds] = await Promise.all([
        this.coreDB.nodes.get(parentId),
        this.coreDB.nodes.where('parentId').equals(parentId).toArray(),
        this.coreDB.nodes.toCollection().primaryKeys(),
      ]);
      return Object.freeze({
        parent,
        children: Object.freeze(children),
        existingNodeIds: Object.freeze(existingNodeIds.map(String)),
      });
    });
  }

  async commitImport(
    request: YamlCanonicalZipImportTransactionRequest
  ): Promise<readonly NodeId[]> {
    let committedNodes: readonly TreeNode[] = Object.freeze([]);
    let previousParent: TreeNode | undefined;
    let nextParent: TreeNode | undefined;
    await this.coreDB.runInTx('rw', ['nodes'], async () => {
      const parentId = request.parentGuard.nodeId as NodeId;
      const [parent, siblings, existingNodeIds] = await Promise.all([
        this.coreDB.nodes.get(parentId),
        this.coreDB.nodes.where('parentId').equals(parentId).toArray(),
        this.coreDB.nodes.toCollection().primaryKeys(),
      ]);
      const sortedCurrentIds = existingNodeIds
        .map(String)
        .sort((left, right) => left.localeCompare(right));
      if (
        !matchesParentGuard(parent, request) ||
        !matchesSiblingGuards(siblings, request) ||
        !compareStringArrays(sortedCurrentIds, request.existingNodeIdGuard)
      ) {
        throw new Error('yaml-canonical-zip-import-guard-mismatch');
      }

      const nodes = request.nodes.map(toImportedTreeNode);
      await this.coreDB.nodes.bulkAdd(nodes);
      previousParent = parent;
      if (request.parentPatch !== undefined) {
        const updated = await this.coreDB.nodes.update(request.parentPatch.id as NodeId, {
          hasChildren: request.parentPatch.postimage.hasChildren,
          updatedAt: request.parentPatch.postimage.updatedAt,
          version: request.parentPatch.postimage.version,
        });
        if (updated !== 1) throw new Error('yaml-canonical-zip-parent-patch-failed');
        nextParent = await this.coreDB.nodes.get(request.parentPatch.id as NodeId);
        if (nextParent === undefined) throw new Error('yaml-canonical-zip-parent-reread-failed');
      }
      committedNodes = Object.freeze(nodes);
    });

    const eventTimestamp = Date.now();
    for (const node of committedNodes) {
      this.coreDB.changeSubject.next({
        type: 'node-created',
        nodeId: node.id,
        node,
        parentId: node.parentId,
        timestamp: eventTimestamp,
      });
    }
    if (previousParent !== undefined && nextParent !== undefined) {
      this.coreDB.changeSubject.next({
        type: 'node-updated',
        nodeId: nextParent.id,
        node: nextParent,
        previousNode: previousParent,
        parentId: nextParent.parentId,
        previousParentId: previousParent.parentId,
        timestamp: eventTimestamp,
      });
    }
    return Object.freeze(committedNodes.map((node) => node.id));
  }
}
