import type { ListChildrenOptions } from '@hierarchidb/common-api';
import type {
  DialogUIState,
  NodeId,
  NodeTagAssociation,
  NodePayload,
  NodeType,
  PersistedTreeNode,
  TagEntity,
  Tree,
  TreeChangeEvent,
  TreeId,
  TreeNode,
  TreeRootState,
} from '@hierarchidb/common-types';
import { getDBName, SingletonMixin } from '@hierarchidb/util';
import type { BulkError } from 'dexie';
import { Dexie, type Table } from 'dexie';
import { Subject } from 'rxjs';

const normalizeTreeNodeForPersist = (node: TreeNode): PersistedTreeNode => {
  const {
    id,
    parentId,
    nodeType,
    depth,
    createdAt,
    updatedAt,
    version,
    hasChildren,
    descendantCount,
    isEstimated,
    references,
    originalName,
    originalParentId,
    removedAt,
    lastTouchedAt,
  } = node as PersistedTreeNode;

  const rawMetadata = (node as { metadata?: unknown }).metadata;
  if (!rawMetadata) {
    throw new Error('metadata is required on TreeNode');
  }
  const metadata = rawMetadata as PersistedTreeNode['metadata'];
  const rawDraftMetadata = (node as { draftMetadata?: unknown }).draftMetadata;
  const draftMetadata =
    rawDraftMetadata !== undefined
      ? (rawDraftMetadata as PersistedTreeNode['draftMetadata'])
      : null;

  const rawData = (node as { data?: unknown }).data;
  const rawDraftData = (node as { draftData?: unknown }).draftData;
  const data = (rawData ?? null) as NodePayload;
  const draftData = (rawDraftData ?? null) as NodePayload;

  const dialogWindow =
    (node as { dialogUIState?: DialogUIState }).dialogUIState?.dialogWindow ?? undefined;
  const dialogProgress =
    (node as { dialogUIState?: DialogUIState }).dialogUIState?.dialogProgress ?? undefined;
  const dialogUIState: DialogUIState | undefined =
    dialogWindow !== undefined || dialogProgress !== undefined
      ? {
          dialogWindow: dialogWindow ?? null,
          dialogProgress: dialogProgress ?? null,
        }
      : undefined;

  return {
    id,
    parentId,
    nodeType,
    depth,
    createdAt,
    updatedAt,
    version,
    metadata,
    draftMetadata,
    data,
    draftData,
    dialogUIState,
    hasChildren,
    descendantCount,
    isEstimated,
    references,
    originalName,
    originalParentId,
    removedAt,
    lastTouchedAt,
  };
};

export class CoreDB extends Dexie {
  trees!: Table<Tree, TreeId>;
  nodes!: Table<TreeNode<NodePayload>, NodeId>;
  rootStates!: Table<TreeRootState, NodeId>;
  tags!: Table<TagEntity, TagEntity['id']>;
  tagAssociations!: Table<NodeTagAssociation, [NodeId, TagEntity['id']]>;

  //  Subject
  public readonly changeSubject = new Subject<TreeChangeEvent>();

  /**
   * Run a function within a Dexie transaction.
   * Accepts table names (e.g., 'nodes', 'trees') and resolves them to Table instances.
   * Note: Prefer wrapping write operations per command boundary via this helper.
   */
  async runInTx<T>(
    mode: 'r' | 'rw',
    tableNames: Array<
      | 'trees'
      | 'nodes'
      | 'rootStates'
      | 'tags'
      | 'tagAssociations'
    >,
    fn: () => Promise<T>
  ): Promise<T> {
    const tableMap = {
      trees: this.trees,
      nodes: this.nodes,
      rootStates: this.rootStates,
      tags: this.tags,
      tagAssociations: this.tagAssociations,
    } as const;

    const tables = tableNames
      .map((name) => tableMap[name])
      .filter((table): table is NonNullable<typeof table> => Boolean(table));
    // If no tables provided, just run function without a transaction
    if (tables.length === 0) return await fn();
    // Use Dexie's variadic or array form; cast to any to avoid TS tuple spread issues
    return await this.transaction(mode, tables, fn);
  }

  static async getSingleton(_name?: string): Promise<CoreDB> {
    return SingletonMixin.getSingleton(CoreDB.name, async () => {
      const instance = new CoreDB(getDBName('core-db'));
      await instance.open();
      await instance.initialize();
      return instance;
    });
  }

  private constructor(name: string) {
    super(name);

    this.version(4)
      .stores({
        trees: '&id, rootId, trashRootId, superRootId',
        nodes: ['&id', 'parentId', '&[parentId+metadata.name]', '[parentId+updatedAt]', 'depth', '*references'].join(
          ', '
        ),
        rootStates: '&rootNodeId',
        tags: '&id, name, category, usageCount, createdAt',
        tagAssociations: 'nodeId, tagId, createdAt, &[nodeId+tagId]',
      })
      .upgrade(async (tx) => {
        // Drop holder metadata and clear legacy draftData on non-draft nodes
        const nodesTable = tx.table<TreeNode, NodeId>('nodes');
        await nodesTable.toCollection().modify((node) => {
          if ((node as { holderType?: string }).holderType) {
            (node as { holderType?: string }).holderType = undefined;
            (node as { holderTargetId?: string }).holderTargetId = undefined;
            (node as { holderMetaParentId?: string }).holderMetaParentId = undefined;
          }
          if ((node as { draftData?: unknown }).draftData !== null && (node as { draftData?: unknown }).draftData !== undefined) {
            // keep draftData if present; no special handling needed
          }
        });
      });

    // Version 3 previously added fulltext tables; now a no-op to avoid creating them.
    // Version 4 defines the current schema with metadata-based name index.
  }

  // console name helper was unused in the current implementation

  async initialize(): Promise<void> {
    await this.transaction('rw', this.trees, this.nodes, this.rootStates, async () => {
      const now = Date.now();

      // Check database state
      const treesCount = await this.trees.count();
      const nodesCount = await this.nodes.count();
      const rootStatesCount = await this.rootStates.count();

      // If database is partially initialized, clear it and start fresh
      if (treesCount !== 2 || rootStatesCount !== 6) {
        console.warn('Database is in an inconsistent state. Clearing and reinitializing...');
        await this.trees.clear();
        await this.nodes.clear();
        await this.rootStates.clear();
      }

      type RootNodeId = NodeId;

      function getRootNodeId(treeId: string, nodeId: string): RootNodeId {
        return `${treeId}:${nodeId}` as RootNodeId;
      }

      if (treesCount === 0) {
        await this.trees.bulkPut(
          ['r', 'p'].map((treeId) => ({
            id: treeId as TreeId,
            name: treeId === 'r' ? 'Resources' : 'Projects',
            superRootId: getRootNodeId(treeId, 'superRoot'),
            rootId: getRootNodeId(treeId, 'root'),
            trashRootId: getRootNodeId(treeId, 'trash'),
          }))
        );
      }
      if (nodesCount === 0) {
        await this.nodes.bulkAdd(
          ['r', 'p'].flatMap((treeId) => [
            {
              parentId: getRootNodeId(treeId, 'superRoot'),
              id: getRootNodeId(treeId, 'root'),
              nodeType: 'folder' as NodeType,
              depth: 0, // Root nodes have depth 0
              createdAt: now,
              updatedAt: now,
              version: 1,
              metadata: {
                name: treeId === 'r' ? 'Resources' : 'Projects',
                description: undefined,
                tags: [],
              },
              draftMetadata: null,
              data: null,
              draftData: null,
            } as unknown as TreeNode,
            {
              parentId: getRootNodeId(treeId, 'superRoot'),
              id: getRootNodeId(treeId, 'trash'),
              nodeType: 'trash' as NodeType,
              depth: 0, // Trash root also has depth 0
              createdAt: now,
              updatedAt: now,
              version: 1,
              metadata: {
                name: 'Trash',
                description: undefined,
                tags: [],
              },
              draftMetadata: null,
              data: null,
              draftData: null,
            } as unknown as TreeNode,
          ])
        );
      }

      if (rootStatesCount === 0) {
        const rootStateData = ['r', 'p'].flatMap((treeId) =>
          ['root', 'trash', 'draft'].map((treeRootNodeType) => ({
            treeId: treeId as TreeId,
            rootNodeId: getRootNodeId(treeId, treeRootNodeType),
            expanded: {},
          }))
        );

        try {
          await this.rootStates.bulkAdd(rootStateData);
        } catch (error) {
          console.error('Failed to initialize rootStates:', error);
          console.error('Data that failed:', rootStateData);

          // Try to get more details about the error
          if (isBulkError(error) && error.failures) {
            console.error('Bulk add failures:', error.failures);
          }
          throw error;
        }
      }

    });
  }

  async getTree(treeId: TreeId): Promise<Tree | undefined> {
    const tree = await this.trees.get(treeId);

    if (!tree) {
      return undefined;
    }

    // Ensure we return a plain object that can be serialized by Comlink
    const plainTree: Tree = {
      id: tree.id,
      name: tree.name,
      rootId: tree.rootId,
      trashRootId: tree.trashRootId,
      superRootId: tree.superRootId,
    };
    return plainTree;
  }

  async listTrees(): Promise<Tree[]> {
    const trees = await this.trees.toArray();

    // Ensure we return plain objects that can be serialized by Comlink
    return trees.map(
      (tree): Tree => ({
        id: tree.id,
        name: tree.name,
        rootId: tree.rootId,
        trashRootId: tree.trashRootId,
        superRootId: tree.superRootId,
      })
    );
  }

  // CRUD operations for TreeNode
  async getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    // Validate nodeId to prevent Dexie errors
    if (!nodeId || typeof nodeId !== 'string' || nodeId.length === 0) {
      console.warn('Invalid nodeId provided to CoreDB.getNode:', nodeId);
      return undefined;
    }

    const node = await this.nodes.get(nodeId);

    // Ensure we return a plain object that can be serialized by Comlink
    if (node) {
      return { ...(normalizeTreeNodeForPersist(node) as TreeNode) };
    }

    return undefined;
  }

  async createNode(node: TreeNode): Promise<NodeId> {
    const normalized = normalizeTreeNodeForPersist(node);
    // Calculate depth if not provided
    if (normalized.depth === undefined || normalized.depth === null) {
      if (!normalized.parentId || normalized.parentId === ('' as NodeId)) {
        // Root nodes have depth 0
        normalized.depth = 0;
      } else {
        // Get parent node to calculate depth
        const parentNode = await this.nodes.get(normalized.parentId);
        if (parentNode) {
          normalized.depth = (parentNode.depth || 0) + 1;
        } else {
          // Default to depth 1 if parent not found
          normalized.depth = 1;
        }
      }
    }

    await this.nodes.add(normalized);

    this.changeSubject.next({
      type: 'node-created' as const,
      nodeId: normalized.id,
      node: normalized,
      parentId: normalized.parentId,
      timestamp: Date.now(),
    });

    return normalized.id;
  }

  async updateNode(node: Pick<TreeNode, 'id'> & Partial<TreeNode>): Promise<void> {
    const oldNode = await this.nodes.get(node.id);
    if (!oldNode) {
      throw new Error(`Node not found for update: ${String(node.id)}`);
    }

    const merged = { ...oldNode, ...node } as TreeNode;
    const next = normalizeTreeNodeForPersist(merged) as TreeNode;

    await this.nodes.put(next);

    const changes: {
      name: { old: string; new: string } | undefined;
      parentId: { old: NodeId; new: NodeId } | undefined;
    } = {
      name: undefined,
      parentId: undefined,
    };
    if (oldNode.metadata.name !== next.metadata.name) {
      changes.name = { old: oldNode.metadata.name, new: next.metadata.name };
    }
    if (oldNode.parentId !== next.parentId) {
      changes.parentId = { old: oldNode.parentId, new: next.parentId };
    }

    const changeEvent: TreeChangeEvent = {
      type: 'node-updated' as const,
      nodeId: node.id,
      node: next,
      previousNode: oldNode,
      parentId: next.parentId,
      previousParentId: oldNode.parentId,
      timestamp: Date.now(),
    };

    this.changeSubject.next(changeEvent);
  }

  async deleteNode(nodeId: NodeId): Promise<void> {
    const existing = await this.nodes.get(nodeId);
    await this.nodes.delete(nodeId);

    this.changeSubject.next({
      type: 'node-deleted' as const,
      nodeId: nodeId,
      parentId: existing?.parentId,
      previousParentId: existing?.parentId,
      previousNode: existing || undefined,
      timestamp: Date.now(),
    });
  }

  async listChildren(parentId: NodeId, options?: ListChildrenOptions): Promise<TreeNode[]> {
    const directChildren = await this.nodes.where('parentId').equals(parentId).sortBy('createdAt');
    /*
    console.log('[CoreDB.listChildren] direct', {
      parentId: String(parentId),
      requestedDepth: options?.prefetch?.depth ?? 1,
      directCount: directChildren.length,
      sample: directChildren.slice(0, 5).map((node) => ({ id: node.id, parentId: node.parentId, depth: node.depth })),
    });
     */

    const depth = options?.prefetch?.depth;
    if (!depth || depth <= 1) {
      /*
      console.log('[CoreDB.listChildren] returning direct children only', {
        parentId: String(parentId),
        total: directChildren.length,
      });
       */
      return directChildren;
    }

    const result = [...directChildren];
    const visited = new Set<string>(directChildren.map((node) => String(node.id)));
    const queue: Array<{ node: TreeNode; depth: number }> = directChildren.map((node) => ({
      node,
      depth: 1,
    }));

    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        continue;
      }
      const { node, depth: currentDepth } = next;
      if (currentDepth >= depth) {
        continue;
      }

      const nested = await this.nodes.where('parentId').equals(node.id).sortBy('createdAt');
      if (!nested || nested.length === 0) {
        continue;
      }

      for (const child of nested) {
        const key = String(child.id);
        if (!visited.has(key)) {
          visited.add(key);
          result.push(child);
          queue.push({ node: child, depth: currentDepth + 1 });
        }
      }
    }

    return result;
  }

  /**
   * List all descendants under a node (depth-first), excluding the node itself.
   * Optional maxDepth limits the depth relative to the start node.
   */
  async listDescendants(nodeId: NodeId, maxDepth?: number): Promise<TreeNode[]> {
    const out: TreeNode[] = [];
    // Stack holds pairs of (nodeId, depth)
    const stack: Array<{ id: NodeId; depth: number }> = [{ id: nodeId, depth: 0 }];
    const seen = new Set<NodeId>();

    while (stack.length) {
      const next = stack.pop();
      if (!next) {
        continue;
      }
      const { id, depth } = next;
      if (maxDepth !== undefined && depth >= maxDepth) continue;
      if (seen.has(id)) continue;
      seen.add(id);

      // Fetch direct children and append to result, then schedule their children
      const children = await this.listChildren(id);
      if (!children || children.length === 0) continue;
      for (const ch of children) {
        out.push(ch);
        stack.push({ id: ch.id, depth: depth + 1 });
      }
    }
    return out;
  }

  /**
   * Atomically remove all descendants under the given rootId within a single Dexie transaction.
   * Returns the list of deleted nodeIds (descendants only; rootId itselfは含まない)。
   */
  async removeSubtreeTx(rootId: NodeId): Promise<NodeId[]> {
    const deletedIds: NodeId[] = [];
    await this.runInTx('rw', ['nodes'], async () => {
      // Enumerate descendants inside the same transaction for a consistent snapshot
      const toDelete: TreeNode[] = [];
      const stack: Array<NodeId> = [rootId];
      const seen = new Set<NodeId>();
      while (stack.length) {
        const pid = stack.pop();
        if (!pid) {
          continue;
        }
        if (seen.has(pid)) continue;
        seen.add(pid);
        const children = await this.nodes.where('parentId').equals(pid).toArray();
        if (!children || children.length === 0) continue;
        for (const ch of children) {
          toDelete.push(ch as TreeNode);
          stack.push(ch.id as NodeId);
        }
      }

      if (toDelete.length === 0) return;
      const ids = toDelete.map((n) => n.id);
      await this.nodes.bulkDelete(ids);
      toDelete.forEach((node) => {
        this.changeSubject.next({
          type: 'node-deleted',
          nodeId: node.id,
          parentId: node.parentId,
          previousParentId: node.parentId,
          previousNode: node,
          timestamp: Date.now(),
        });
      });
      deletedIds.push(...ids);
    });
    return deletedIds;
  }

  /**
   * Subject
   */
  close(): void {
    this.changeSubject.complete();
    super.close();
  }

  /**
   */
  async bulkCreateNodes(nodes: TreeNode[]): Promise<void> {
    await this.nodes.bulkAdd(nodes);

    const parentIds = new Set<NodeId>();
    for (const node of nodes) {
      if (node.parentId) parentIds.add(node.parentId);
      this.changeSubject.next({
        type: 'node-created' as const,
        nodeId: node.id,
        node: node,
        parentId: node.parentId,
        timestamp: Date.now(),
      });
    }

    for (const parentId of parentIds) {
      const parent = await this.nodes.get(parentId);
      if (parent && !parent.hasChildren) {
        parent.hasChildren = true;
        parent.updatedAt = Date.now();
        parent.version = (parent.version || 0) + 1;
        await this.nodes.put(parent);
      }
    }
  }

  async bulkUpdateNodes(nodes: TreeNode[]): Promise<void> {
    const oldNodes = await Promise.all(nodes.map((node) => this.nodes.get(node.id)));

      await this.nodes.bulkPut(nodes);

    nodes.forEach((node, index) => {
      const oldNode = oldNodes[index];
      if (oldNode) {
        const changes: {
          name: { old: string; new: string } | undefined;
          parentId: { old: NodeId; new: NodeId } | undefined;
        } = {
          name: undefined,
          parentId: undefined,
        };
        if (oldNode.metadata?.name !== node.metadata?.name) {
          changes.name = {
            old: oldNode.metadata?.name ?? '',
            new: node.metadata?.name ?? '',
          };
        }
        if (oldNode.parentId !== node.parentId) {
          changes.parentId = { old: oldNode.parentId, new: node.parentId };
        }

        this.changeSubject.next({
          type: 'node-updated' as const,
          nodeId: node.id,
          node: node,
          previousNode: oldNode,
          parentId: node.parentId,
          previousParentId: oldNode.parentId,
          timestamp: Date.now(),
        });
      }
    });
  }

  async bulkDeleteNodes(nodeIds: NodeId[]): Promise<void> {
    const existingNodes = await this.nodes.bulkGet(nodeIds);
    await this.nodes.bulkDelete(nodeIds);

    existingNodes.forEach((node) => {
      if (!node) return;
      this.changeSubject.next({
        type: 'node-deleted' as const,
        nodeId: node.id,
        parentId: node.parentId,
        previousParentId: node.parentId,
        previousNode: node,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Move a node to a new parent and update depths for the subtree
   */
  async moveNode(nodeId: NodeId, newParentId: NodeId): Promise<void> {
    const node = await this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const newParent = await this.nodes.get(newParentId);
    if (!newParent) {
      throw new Error(`Parent node ${newParentId} not found`);
    }

    const oldDepth = node.depth;
    const newDepth = newParent.depth + 1;
    const depthDifference = newDepth - oldDepth;

    // Update the node's parent and depth
    node.parentId = newParentId;
    node.depth = newDepth;
    node.updatedAt = Date.now();
    node.version++;

    await this.updateNode(node);

    // If depth changed, update all descendants
    if (depthDifference !== 0) {
      await this.updateSubtreeDepth(nodeId, depthDifference);
    }
  }

  /**
   * Recursively update depths for all descendants
   */
  private async updateSubtreeDepth(parentId: NodeId, depthDifference: number): Promise<void> {
    const children = await this.nodes.where('parentId').equals(parentId).toArray();

    for (const child of children) {
      child.depth += depthDifference;
      child.updatedAt = Date.now();
      child.version++;
      await this.nodes.put(child);

      // Recursively update descendants
      await this.updateSubtreeDepth(child.id, depthDifference);
    }
  }

  /**
   * Get nodes by depth level
   */
  async getNodesByDepth(depth: number): Promise<TreeNode[]> {
    const nodes = await this.nodes.filter((node) => node.depth === depth).toArray();

    // Return plain objects
    return nodes.map(
      (node): TreeNode => ({
        ...node,
        data: node.data ?? null,
        draftData: node.draftData ?? null,
        draftMetadata: node.draftMetadata ?? null,
        metadata: node.metadata,
        ...(node.references && { references: node.references }),
      })
    );
  }

  /**
   * Migrate existing nodes to include depth property
   */
  async migrateNodeWithDepth(node: TreeNode): Promise<TreeNode> {
    if (node.depth !== undefined && node.depth !== null) {
      return node; // Already has depth
    }

    // Calculate depth based on parent
    if (!node.parentId || node.parentId === ('' as NodeId)) {
      node.depth = 0;
    } else {
      const parent = await this.nodes.get(node.parentId);
      if (parent && parent.depth !== undefined) {
        node.depth = parent.depth + 1;
      } else {
        // Need to calculate parent's depth first
        const parentWithDepth = await this.migrateNodeWithDepth(parent || ({} as TreeNode));
        node.depth = (parentWithDepth.depth || 0) + 1;
      }
    }

    await this.nodes.put(node);
    return node;
  }

  /**
   * Batch migrate all nodes in the database to include depth
   */
  async migrateAllNodesWithDepth(): Promise<{ success: boolean; migratedCount: number }> {
    let migratedCount = 0;

    try {
      // Start with root nodes
      const rootNodes = await this.nodes
        .filter((node) => !node.parentId || node.parentId === ('' as NodeId))
        .toArray();

      // Process in breadth-first order
      const queue: TreeNode[] = [...rootNodes];
      const processed = new Set<NodeId>();

      while (queue.length > 0) {
        const node = queue.shift();
        if (!node) {
          continue;
        }

        if (processed.has(node.id)) {
          continue;
        }

        // Set depth for root nodes
        if (!node.parentId || node.parentId === ('' as NodeId)) {
          node.depth = 0;
        } else {
          const parent = await this.nodes.get(node.parentId);
          if (parent && parent.depth !== undefined) {
            node.depth = parent.depth + 1;
          } else {
            // Skip this node for now, will process when parent is ready
            queue.push(node);
            continue;
          }
        }

        await this.nodes.put(node);
        processed.add(node.id);
        migratedCount++;

        // Add children to queue
        const children = await this.nodes.where('parentId').equals(node.id).toArray();

        queue.push(...children);
      }

      return { success: true, migratedCount };
    } catch (error) {
      console.error('Migration failed:', error);
      return { success: false, migratedCount };
    }
  }

  /**
   * Duplicate a node with correct depth calculation
   */
  async duplicateNode(
    sourceNodeId: NodeId,
    targetParentId: NodeId,
    newNodeId?: NodeId
  ): Promise<NodeId> {
    const sourceNode = await this.nodes.get(sourceNodeId);
    if (!sourceNode) {
      throw new Error(`Source node ${sourceNodeId} not found`);
    }

    const targetParent = await this.nodes.get(targetParentId);
    if (!targetParent) {
      throw new Error(`Target parent ${targetParentId} not found`);
    }

    const duplicatedNodeId = newNodeId || (crypto.randomUUID() as NodeId);
    const duplicatedNode: TreeNode = {
      ...sourceNode,
      id: duplicatedNodeId,
      parentId: targetParentId,
      depth: targetParent.depth + 1,
      metadata: {
        ...sourceNode.metadata,
        name: `${sourceNode.metadata.name} (Copy)`,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    await this.createNode(duplicatedNode);
    return duplicatedNodeId;
  }

  /**
   * Duplicate a subtree with correct depth calculation
   */
  async duplicateSubtree(sourceRootId: NodeId, targetParentId: NodeId): Promise<NodeId> {
    const { newRootId } = await this.duplicateSubtreeWithMap(sourceRootId, targetParentId);
    return newRootId;
  }

  /**
   * Duplicate a subtree and return the full oldnew id mapping as well as the new root id.
   */
  async duplicateSubtreeWithMap(
    sourceRootId: NodeId,
    targetParentId: NodeId,
    options?: { rootNameOverride?: string }
  ): Promise<{ newRootId: NodeId; idMap: Map<NodeId, NodeId> }> {
    const sourceRoot = await this.nodes.get(sourceRootId);
    if (!sourceRoot) {
      throw new Error(`Source root ${sourceRootId} not found`);
    }

    const targetParent = await this.nodes.get(targetParentId);
    if (!targetParent) {
      throw new Error(`Target parent ${targetParentId} not found`);
    }

    // Create mapping for old ID -> new ID
    const idMapping = new Map<NodeId, NodeId>();
    const newRootId = crypto.randomUUID() as NodeId;
    idMapping.set(sourceRootId, newRootId);

    // Collect all nodes in subtree
    const subtreeNodes: TreeNode[] = [];
    const collectNodes = async (nodeId: NodeId): Promise<void> => {
      const node = await this.nodes.get(nodeId);
      if (node) {
        subtreeNodes.push(node);
        const children = await this.listChildren(nodeId);
        for (const child of children) {
          await collectNodes(child.id);
        }
      }
    };

    await collectNodes(sourceRootId);

    // Generate new IDs for all nodes
    for (const node of subtreeNodes) {
      if (!idMapping.has(node.id)) {
        idMapping.set(node.id, crypto.randomUUID() as NodeId);
      }
    }

    // Create duplicated nodes with correct depths
    const duplicatedNodes: TreeNode[] = [];
    for (const originalNode of subtreeNodes) {
      const newNodeId = idMapping.get(originalNode.id);
      if (!newNodeId) {
        continue;
      }
      let newParentId: NodeId;
      let newDepth: number;

      if (originalNode.id === sourceRootId) {
        // Root of duplicated subtree
        newParentId = targetParentId;
        newDepth = targetParent.depth + 1;
      } else {
        // Child nodes
        const mappedParentId = idMapping.get(originalNode.parentId);
        if (!mappedParentId) {
          continue;
        }
        newParentId = mappedParentId;
        const newParent = duplicatedNodes.find((n) => n.id === newParentId);
        newDepth = newParent ? newParent.depth + 1 : 0;
      }

      const duplicatedNode: TreeNode = {
        ...originalNode,
        id: newNodeId,
        parentId: newParentId,
        depth: newDepth,
        metadata: {
          ...originalNode.metadata,
          name:
            originalNode.id === sourceRootId && options?.rootNameOverride
              ? options.rootNameOverride
              : originalNode.metadata.name,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      duplicatedNodes.push(duplicatedNode);
    }

    await this.bulkCreateNodes(duplicatedNodes);
    return { newRootId, idMap: idMapping };
  }

  // Legacy restoreFromTrash removed. Use CommandProcessor.restoreFromTrash with holder-based model.

  /**
   * Paste nodes with correct depth calculation
   */
  async pasteNodes(nodeIds: NodeId[], targetParentId: NodeId): Promise<NodeId[]> {
    const targetParent = await this.nodes.get(targetParentId);
    if (!targetParent) {
      throw new Error(`Target parent ${targetParentId} not found`);
    }

    const pastedNodeIds: NodeId[] = [];

    for (const nodeId of nodeIds) {
      const sourceNode = await this.nodes.get(nodeId);
      if (!sourceNode) continue;

      const newNodeId = crypto.randomUUID() as NodeId;
      const pastedNode: TreeNode = {
        ...sourceNode,
        id: newNodeId,
        parentId: targetParentId,
        depth: targetParent.depth + 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await this.createNode(pastedNode);
      pastedNodeIds.push(newNodeId);

      // If node has children, paste them recursively
      const children = await this.listChildren(nodeId);
      if (children.length > 0) {
        await this.pasteNodes(
          children.map((c) => c.id),
          newNodeId
        );
      }
    }

    // Recalculate depths for safety
    await this._recalcDepthsAfterPaste(targetParentId);
    return pastedNodeIds;
  }

  // Ensure depths stay consistent after paste operations
  // This also marks updateSubtreeDepthFromParent as used for TS noUnusedLocals
  private async _recalcDepthsAfterPaste(targetParentId: NodeId): Promise<void> {
    await this.updateSubtreeDepthFromParent(targetParentId);
  }

  /**
   * Update subtree depth based on parent's depth
   */
  private async updateSubtreeDepthFromParent(parentId: NodeId): Promise<void> {
    const parent = await this.nodes.get(parentId);
    if (!parent) return;

    const children = await this.listChildren(parentId);
    for (const child of children) {
      child.depth = parent.depth + 1;
      child.updatedAt = Date.now();
      child.version++;

      await this.nodes.put(child);

      // Recursively update descendants
      await this.updateSubtreeDepthFromParent(child.id);
    }
  }

  /**
   * Import nodes with depth validation and recalculation
   */
  async importNodesWithDepthValidation(nodes: TreeNode[]): Promise<void> {
    // Create all nodes first
    await this.bulkCreateNodes(nodes);

    // Then recalculate depths to ensure consistency
    const nodeIds = nodes.map((n) => n.id);
    for (const nodeId of nodeIds) {
      const node = await this.nodes.get(nodeId);
      if (node) {
        const correctDepth = await this.calculateCorrectDepth(nodeId);
        if (node.depth !== correctDepth) {
          node.depth = correctDepth;
          node.updatedAt = Date.now();
          node.version++;
          await this.nodes.put(node);
        }
      }
    }
  }

  /**
   * Calculate correct depth for a node based on its parent chain
   */
  private async calculateCorrectDepth(nodeId: NodeId): Promise<number> {
    const node = await this.nodes.get(nodeId);
    if (!node) return 0;

    if (!node.parentId || node.parentId === ('' as NodeId)) {
      return 0; // Root node
    }

    const parentDepth = await this.calculateCorrectDepth(node.parentId);
    return parentDepth + 1;
  }

  // ====================
  // Tag Management Methods
  // ====================

  /**
   * Create a new tag
   */
  async createTag(tag: TagEntity): Promise<void> {
    await this.tags.add(tag);
  }

  /**
   * Get a tag by ID
   */
  async getTag(tagId: TagEntity['id']): Promise<TagEntity | undefined> {
    return await this.tags.get(tagId);
  }

  /**
   * Update an existing tag
   */
  async updateTag(tag: TagEntity): Promise<void> {
    await this.tags.put(tag);
  }

  /**
   * Delete a tag
   */
  async deleteTag(tagId: TagEntity['id']): Promise<void> {
    await this.tags.delete(tagId);
  }

  /**
   * Get all tags
   */
  async getAllTags(): Promise<TagEntity[]> {
    return await this.tags.orderBy('name').toArray();
  }

  /**
   * Create a tag association
   */
  async createTagAssociation(association: NodeTagAssociation): Promise<void> {
    await this.tagAssociations.add(association);
  }

  /**
   * Get a specific tag association
   */
  async getTagAssociation(
    nodeId: NodeId,
    tagId: TagEntity['id']
  ): Promise<NodeTagAssociation | undefined> {
    return await this.tagAssociations.get([nodeId, tagId]);
  }

  /**
   * Remove a tag association
   */
  async removeTagAssociation(nodeId: NodeId, tagId: TagEntity['id']): Promise<boolean> {
    const count = await this.tagAssociations
      .where('[nodeId+tagId]')
      .equals([nodeId, tagId])
      .delete();
    return count > 0;
  }

  /**
   * Remove all associations for a tag
   */
  async removeAllTagAssociations(tagId: TagEntity['id']): Promise<number> {
    return await this.tagAssociations.where('tagId').equals(tagId).delete();
  }

  /**
   * Get all tag associations for a node
   */
  async getTagAssociationsForNode(nodeId: NodeId): Promise<NodeTagAssociation[]> {
    return await this.tagAssociations.where('nodeId').equals(nodeId).toArray();
  }

  /**
   * Get all tag associations for a tag
   */
  async getTagAssociationsForTag(tagId: TagEntity['id']): Promise<NodeTagAssociation[]> {
    return await this.tagAssociations.where('tagId').equals(tagId).toArray();
  }

  /**
   * Get total number of tag associations
   */
  async getTotalTagAssociations(): Promise<number> {
    return await this.tagAssociations.count();
  }

  /**
   * Check if a node exists in any console (helper method for TagService)
   */
  async nodeExistsInTree(treeId: TreeId, nodeId: NodeId): Promise<boolean> {
    // Check if the node exists and is part of the specified console
    const node = await this.nodes.get(nodeId);
    if (!node) return false;

    // Get console info to check if node belongs to this console
    const tree = await this.trees.get(treeId);
    if (!tree) return false;

    // Simple check: if the console exists and node exists, assume they're connected
    // In a more sophisticated implementation, you might want to traverse the console
    return true;
  }

  /**
   * Reset singleton instance for testing
   */
  static resetInstance(): void {
    SingletonMixin.terminate(CoreDB.name);
  }
}

function isBulkError(error: unknown): error is BulkError {
  return error instanceof Dexie.BulkError;
}
