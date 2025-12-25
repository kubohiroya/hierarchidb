import type {
  CommitDraftPayload,
  DiscardDraftPayload,
  DuplicateNodesPayload,
  ImportNodesPayload,
  NodeId,
  NodeType,
  PasteNodesPayload,
  TreeNode,
} from '@hierarchidb/common-types';
import type { CoreDB } from '../services/CoreDB.js';
import type { CommandEnvelope } from '../services/command-types.js';
import { storeRegistry } from './store-registry.js';

type DiscardDraftEnvelope = CommandEnvelope<'discardDraft', DiscardDraftPayload>;
type CommitDraftEnvelope = CommandEnvelope<'commitDraft', CommitDraftPayload>;
type DuplicateNodesEnvelope = CommandEnvelope<'duplicateNodes', DuplicateNodesPayload>;
type PasteNodesEnvelope = CommandEnvelope<'pasteNodes', PasteNodesPayload>;
type ImportNodesEnvelope = CommandEnvelope<'importNodes', ImportNodesPayload>;

type NodeMapping = Map<NodeId, NodeId>;
type NodeMappingSource = Iterable<readonly [unknown, unknown]>;
type SourceNodeMap = Map<NodeId, TreeNode>;

const toNodeId = (value: string): NodeId => value as NodeId;
const maybeNodeId = (value: unknown): NodeId | undefined =>
  typeof value === 'string' && value.length > 0 ? (value as NodeId) : undefined;

const buildSourceNodeMap = (
  nodes?: Record<string, TreeNode | undefined>
): SourceNodeMap | undefined => {
  if (!nodes) return undefined;
  const map = new Map<NodeId, TreeNode>();
  for (const [rawId, snapshot] of Object.entries(nodes)) {
    if (!snapshot) continue;
    map.set(toNodeId(rawId), snapshot);
  }
  return map;
};

const resolveFromSourceMap = (
  nodeId: NodeId,
  sourceNodes?: SourceNodeMap
): TreeNode | undefined => {
  if (!sourceNodes) return undefined;
  return sourceNodes.get(nodeId);
};

const resolveNode = async (
  coreDB: CoreDB,
  nodeId: NodeId,
  sourceNodes?: SourceNodeMap
): Promise<TreeNode | undefined> => {
  const fromMap = resolveFromSourceMap(nodeId, sourceNodes);
  if (fromMap) return fromMap;
  try {
    return await coreDB.getNode(nodeId);
  } catch {
    return undefined;
  }
};

export class EntityLifecycleManager {
  private static instance: EntityLifecycleManager | undefined;

  private constructor(private readonly coreDB: CoreDB) {}

  private static idMappingByCommand = new Map<string, NodeMapping>();

  static getSingleton(coreDB: CoreDB): EntityLifecycleManager {
    if (!EntityLifecycleManager.instance)
      EntityLifecycleManager.instance = new EntityLifecycleManager(coreDB);
    return EntityLifecycleManager.instance;
  }

  static setIdMapping(commandId: string, mapping: NodeMappingSource): void {
    const normalized = new Map<NodeId, NodeId>();
    for (const [src, dst] of mapping) {
      const sourceId = maybeNodeId(src);
      const targetId = maybeNodeId(dst);
      if (!sourceId || !targetId) continue;
      normalized.set(sourceId, targetId);
    }
    if (normalized.size === 0) return;
    EntityLifecycleManager.idMappingByCommand.set(commandId, normalized);
  }

  private static takeIdMapping(commandId: string): NodeMapping | undefined {
    const mapping = EntityLifecycleManager.idMappingByCommand.get(commandId);
    if (mapping) EntityLifecycleManager.idMappingByCommand.delete(commandId);
    return mapping;
  }

  async handleCommand(envelope: CommandEnvelope<string, unknown>): Promise<void> {
    switch (envelope.kind) {
      case 'discardDraft':
        return this.onDiscardDraft(envelope as DiscardDraftEnvelope);
      case 'commitDraft':
        return this.onCommitDraft(envelope as CommitDraftEnvelope);
      case 'duplicateNodes':
        return this.onDuplicateNodes(envelope as DuplicateNodesEnvelope);
      case 'pasteNodes':
        return this.onPasteNodes(envelope as PasteNodesEnvelope);
      case 'importNodes':
        return this.onImportNodes(envelope as ImportNodesEnvelope);
      default:
        return;
    }
  }

  async onDiscardDraft(_env: DiscardDraftEnvelope): Promise<void> {
  }

  async onCommitDraft(_env: CommitDraftEnvelope): Promise<void> {
  }

  async onDuplicateNodes(env: DuplicateNodesEnvelope): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    await this.copyGroupsByMapping(mapping);
    await this.copyRelationsByMapping(mapping);
  }

  async onPasteNodes(env: PasteNodesEnvelope): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    const sourceNodes = buildSourceNodeMap(env.payload.nodes);
    await this.copyGroupsByMapping(mapping, sourceNodes);
    await this.copyRelationsByMapping(mapping, sourceNodes);
  }

  async onImportNodes(env: ImportNodesEnvelope): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    const sourceNodes = buildSourceNodeMap(env.payload.nodes);
    await this.copyGroupsByMapping(mapping, sourceNodes);
    await this.copyRelationsByMapping(mapping, sourceNodes);
  }

  async handleRemovedNodes(nodes: TreeNode[]): Promise<void> {
    if (!nodes || nodes.length === 0) return;
    const byType = new Map<NodeType, NodeId[]>();
    for (const node of nodes) {
      const nodeType = node.nodeType as NodeType | undefined;
      const nodeId = node.id as NodeId | undefined;
      if (!nodeType || !nodeId) continue;
      const list = byType.get(nodeType);
      if (list) {
        list.push(nodeId);
      } else {
        byType.set(nodeType, [nodeId]);
      }
    }

    for (const [nodeType, nodeIds] of byType) {
      await this.deleteGroupEntities(nodeType, nodeIds);
      await this.deleteRelations(nodeType, nodeIds);
      await this.deletePluginArtifacts(nodeType, nodeIds);
    }
  }

  private async copyGroupsByMapping(
    mapping: NodeMapping,
    sourceNodes?: SourceNodeMap
  ): Promise<void> {
      for (const [src, dst] of mapping.entries()) {
        const snapshot = await resolveNode(this.coreDB, src, sourceNodes);
        const nodeType = snapshot?.nodeType;
        if (!nodeType) continue;
        const store = storeRegistry.getGroup(nodeType);
        if (!store) continue;
        const items = await store.list(src);
        if (!items || items.length === 0) continue;
        await store.bulkUpsert(dst, items);
      }
  }

  private async copyRelationsByMapping(
    mapping: NodeMapping,
    sourceNodes?: SourceNodeMap
  ): Promise<void> {
      for (const [src] of mapping.entries()) {
        const snapshot = await resolveNode(this.coreDB, src, sourceNodes);
        const nodeType = snapshot?.nodeType;
        if (!nodeType) continue;
        const relStore = storeRegistry.getRelations(nodeType);
        if (!relStore) continue;
        const relations = await relStore.listByNode(src);
        if (!relations || relations.length === 0) continue;
        const transformed: typeof relations = [];
        for (const rel of relations) {
          const newSrc = mapping.get(rel.srcNodeId);
          const newDst = mapping.get(rel.dstNodeId);
          if (!newSrc || !newDst) continue;
          transformed.push({ ...rel, srcNodeId: newSrc, dstNodeId: newDst, updatedAt: Date.now() });
        }
        if (transformed.length > 0) await relStore.bulkUpsert(transformed);
      }
  }

  private async deleteGroupEntities(nodeType: NodeType, nodeIds: NodeId[]): Promise<void> {
    const store = storeRegistry.getGroup(nodeType);
    if (!store) return;
    for (const nodeId of nodeIds) {
      const items = await store.list(nodeId);
      if (!items || items.length === 0) continue;
      const ids = items.map((item) => item.id);
      await store.bulkDelete(nodeId, ids);
    }
  }

  private async deleteRelations(nodeType: NodeType, nodeIds: NodeId[]): Promise<void> {
    const relStore = storeRegistry.getRelations(nodeType);
    if (!relStore) return;
    for (const nodeId of nodeIds) {
      const rels = await relStore.listByNode(nodeId);
      if (!rels || rels.length === 0) continue;
      await relStore.bulkDelete(rels);
    }
  }

  private async deletePluginArtifacts(nodeType: NodeType, nodeIds: NodeId[]): Promise<void> {
    switch (nodeType) {
      case 'shape':
        await this.deleteShapeArtifacts(nodeIds);
        return;
      case 'location':
        await this.deleteLocationArtifacts(nodeIds);
        return;
      case 'route':
        await this.deleteRouteArtifacts(nodeIds);
        return;
      default:
        return;
    }
  }

  private async deleteShapeArtifacts(nodeIds: NodeId[]): Promise<void> {
    try {
      const { ShapeDB, EphemeralShapeDB } = await import('@hierarchidb/shape-plugin');
      const db = new ShapeDB();
      await db.open?.();
      const ephemeral = new EphemeralShapeDB();
      await ephemeral.open?.();
      for (const nodeId of nodeIds) {
        const sessionIds = await db.batchSessions.where('nodeId').equals(nodeId).primaryKeys();
        const featureIds = await db.features.where('nodeId').equals(nodeId).primaryKeys();
        await db.transaction('rw', [
          db.batchSessions,
          db.batchTasks,
          db.features,
          db.featureIndices,
          db.featureBuffers,
          db.vectorTiles,
          db.tileBuffers,
          db.cache,
        ], async () => {
          if (sessionIds.length > 0) {
            await db.batchTasks.where('sessionId').anyOf(sessionIds as string[]).delete();
          }
          await db.batchSessions.where('nodeId').equals(nodeId).delete();
          await db.features.where('nodeId').equals(nodeId).delete();
          if (featureIds.length > 0) {
            const featureKeys = (featureIds as Array<number | string>).map((id) => id.toString());
            await db.featureIndices.where('featureId').anyOf(featureKeys).delete();
          }
          await db.featureBuffers.where('nodeId').equals(nodeId).delete();
          await db.vectorTiles.where('nodeId').equals(nodeId).delete();
          await db.tileBuffers.where('nodeId').equals(nodeId).delete();
          await db.cache.where('nodeId').equals(nodeId).delete();
        });
        const clear = (ephemeral as { clearNodeData?: (id: NodeId) => Promise<void> }).clearNodeData;
        if (clear) {
          await clear.call(ephemeral, nodeId);
        }
      }
      db.close?.();
      ephemeral.close();
    } catch (error) {
      console.warn('[EntityLifecycleManager] shape cleanup failed', error);
    }
  }

  private async deleteLocationArtifacts(nodeIds: NodeId[]): Promise<void> {
    try {
      const { getEphemeralLocationDB } = await import('@hierarchidb/location-plugin');
      const db = getEphemeralLocationDB();
      for (const nodeId of nodeIds) {
        const clear = (db as { clearNodeData?: (id: NodeId) => Promise<void> }).clearNodeData;
        if (clear) {
          await clear.call(db, nodeId);
        }
      }
    } catch (error) {
      console.warn('[EntityLifecycleManager] location cleanup failed', error);
    }
  }

  private async deleteRouteArtifacts(nodeIds: NodeId[]): Promise<void> {
    try {
      const { RouteDatabase } = await import('@hierarchidb/route-plugin/database') as {
        RouteDatabase: new () => {
          open?: () => Promise<unknown>;
          close?: () => void;
          routes: { where: (key: string) => { equals: (value: NodeId) => { delete(): Promise<void> } } };
          workingCopies: { where: (key: string) => { equals: (value: NodeId) => { delete(): Promise<void> } } };
          routeCache: { where: (key: string) => { equals: (value: NodeId) => { delete(): Promise<void> } } };
          routeResults: { where: (key: string) => { equals: (value: NodeId) => { delete(): Promise<void> } } };
          routeCursors: { where: (key: string) => { equals: (value: NodeId) => { delete(): Promise<void> } } };
          pendingSessions: { where: (key: string) => { equals: (value: NodeId) => { delete(): Promise<void> } } };
          transaction: (
            mode: 'rw',
            tables: unknown[],
            executor: () => Promise<void>
          ) => Promise<void>;
        };
      };
      const db = new RouteDatabase();
      await db.open?.();
      for (const nodeId of nodeIds) {
        await db.transaction('rw', [
          db.routes,
          db.workingCopies,
          db.routeCache,
          db.routeResults,
          db.routeCursors,
          db.pendingSessions,
        ], async () => {
          await db.routes.where('nodeId').equals(nodeId).delete();
          await db.workingCopies.where('nodeId').equals(nodeId).delete();
          await db.routeCache.where('routeId').equals(nodeId).delete();
          await db.routeResults.where('routeId').equals(nodeId).delete();
          await db.routeCursors.where('nodeId').equals(nodeId).delete();
          await db.pendingSessions.where('nodeId').equals(nodeId).delete();
        });
      }
      db.close?.();
    } catch (error) {
      console.warn('[EntityLifecycleManager] route cleanup failed', error);
    }
  }
}
