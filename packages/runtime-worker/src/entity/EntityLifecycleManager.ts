import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type {
  CommitDraftPayload,
  DiscardDraftPayload,
  DuplicateNodesPayload,
  ImportNodesPayload,
  PasteNodesPayload,
  TreeNode,
} from '@hierarchidb/tree-api';
import type { LocationMutationAPI } from '@hierarchidb/location-api';
import type { RouteMutationAPI } from '@hierarchidb/route-api';
import type { ShapeMutationAPI } from '@hierarchidb/shape-api';
import { getLocationDB } from '@hierarchidb/location-store';
import { getRouteDB } from '@hierarchidb/route-store';
import { shapeDB } from '@hierarchidb/shape-store';
import type { CoreDB } from '../services/CoreDB.js';
import type { CommandEnvelope } from '../services/command-types.js';

type DiscardDraftEnvelope = CommandEnvelope<'discardDraft', DiscardDraftPayload>;
type CommitDraftEnvelope = CommandEnvelope<'commitDraft', CommitDraftPayload>;
type DuplicateNodesEnvelope = CommandEnvelope<'duplicateNodes', DuplicateNodesPayload>;
type PasteNodesEnvelope = CommandEnvelope<'pasteNodes', PasteNodesPayload>;
type ImportNodesEnvelope = CommandEnvelope<'importNodes', ImportNodesPayload>;

type NodeMapping = Map<NodeId, NodeId>;
type NodeMappingSource = Iterable<readonly [unknown, unknown]>;
type SourceNodeMap = Map<NodeId, TreeNode>;
type MutationServices = {
  shapeMutation?: ShapeMutationAPI;
  locationMutation?: LocationMutationAPI;
  routeMutation?: RouteMutationAPI;
};

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

  private mutationServices: MutationServices = {};

  private constructor(private readonly coreDB: CoreDB) {}

  private static idMappingByCommand = new Map<string, NodeMapping>();

  static getSingleton(coreDB: CoreDB, mutationServices?: MutationServices): EntityLifecycleManager {
    if (!EntityLifecycleManager.instance)
      EntityLifecycleManager.instance = new EntityLifecycleManager(coreDB);
    if (mutationServices) {
      EntityLifecycleManager.instance.setMutationServices(mutationServices);
    }
    return EntityLifecycleManager.instance;
  }

  setMutationServices(services: MutationServices): void {
    this.mutationServices = { ...this.mutationServices, ...services };
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

  async onDiscardDraft(_env: DiscardDraftEnvelope): Promise<void> {}

  async onCommitDraft(_env: CommitDraftEnvelope): Promise<void> {}

  async onDuplicateNodes(env: DuplicateNodesEnvelope): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    await this.copyFeaturesByMapping(mapping);
    await this.copyRelationsByMapping(mapping);
    await this.copyVectorTilesByMapping(mapping);
  }

  async onPasteNodes(env: PasteNodesEnvelope): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    const sourceNodes = buildSourceNodeMap(env.payload.nodes);
    await this.copyFeaturesByMapping(mapping, sourceNodes);
    await this.copyRelationsByMapping(mapping, sourceNodes);
    await this.copyVectorTilesByMapping(mapping, sourceNodes);
  }

  async onImportNodes(env: ImportNodesEnvelope): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    const sourceNodes = buildSourceNodeMap(env.payload.nodes);
    await this.copyFeaturesByMapping(mapping, sourceNodes);
    await this.copyRelationsByMapping(mapping, sourceNodes);
    await this.copyVectorTilesByMapping(mapping, sourceNodes);
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
      await this.deleteFeatures(nodeType, nodeIds);
      await this.deleteRelations(nodeType, nodeIds);
      await this.deleteVectorTiles(nodeType, nodeIds);
      await this.deletePluginArtifacts(nodeType, nodeIds);
    }
  }

  private async copyFeaturesByMapping(
    mapping: NodeMapping,
    sourceNodes?: SourceNodeMap
  ): Promise<void> {
    for (const [src, dst] of mapping.entries()) {
      const snapshot = await resolveNode(this.coreDB, src, sourceNodes);
      const nodeType = snapshot?.nodeType;
      if (!nodeType) continue;
      if (nodeType === 'shape') {
        await shapeDB.open?.();
        const rows = await shapeDB.features.where('nodeId').equals(src).toArray();
        if (!rows.length) continue;
        const now = Date.now();
        const copies = rows.map(({ id, createdAt, updatedAt, ...rest }) => ({
          ...rest,
          nodeId: dst,
          createdAt: now,
          updatedAt: now,
        }));
        await shapeDB.storeFeatures(copies);
        continue;
      }
      if (nodeType === 'location') {
        const db = getLocationDB();
        await db.open?.();
        const rows = await db.features.where('nodeId').equals(src).toArray();
        if (!rows.length) continue;
        const copies = rows.map((row) => ({
          ...row,
          nodeId: dst,
        }));
        await db.features.bulkPut(copies);
        continue;
      }
      if (nodeType === 'route') {
        const db = getRouteDB();
        await db.open?.();
        const rows = await db.features.where('nodeId').equals(src).toArray();
        if (!rows.length) continue;
        const now = Date.now();
        const copies = rows.map((row) => ({
          ...row,
          id: crypto.randomUUID() as NodeId,
          nodeId: dst,
          createdAt: now,
          updatedAt: now,
        }));
        await db.features.bulkPut(copies);
        continue;
      }
    }
  }

  private async copyRelationsByMapping(
    mapping: NodeMapping,
    sourceNodes?: SourceNodeMap
  ): Promise<void> {
    void mapping;
    void sourceNodes;
  }

  private async copyVectorTilesByMapping(
    mapping: NodeMapping,
    sourceNodes?: SourceNodeMap
  ): Promise<void> {
    for (const [src, dst] of mapping.entries()) {
      const snapshot = await resolveNode(this.coreDB, src, sourceNodes);
      const nodeType = snapshot?.nodeType;
      if (!nodeType) continue;
      if (nodeType === 'shape') {
        await shapeDB.open?.();
        const rows = await shapeDB.vectorTiles.where('nodeId').equals(src).toArray();
        if (!rows.length) continue;
        const copies = rows.map((row) => ({
          ...row,
          nodeId: dst,
          tileId: `${dst}-${row.z}-${row.x}-${row.y}`,
        }));
        await shapeDB.vectorTiles.bulkPut(copies);
        await shapeDB.rebuildVectorTileSummary(dst);
        continue;
      }
      if (nodeType === 'route') {
        const db = getRouteDB();
        await db.open?.();
        const rows = await db.vectorTiles.where('nodeId').equals(src).toArray();
        if (!rows.length) continue;
        const copies = rows.map((row) => ({
          ...row,
          nodeId: dst,
          tileId: `${dst}-${row.z}-${row.x}-${row.y}`,
        }));
        await db.vectorTiles.bulkPut(copies);
        continue;
      }
    }
  }

  private async deleteFeatures(nodeType: NodeType, nodeIds: NodeId[]): Promise<void> {
    if (nodeType === 'shape') {
      await shapeDB.open?.();
      await shapeDB.features.where('nodeId').anyOf(nodeIds).delete();
      return;
    }
    if (nodeType === 'location') {
      const db = getLocationDB();
      await db.open?.();
      await db.features.where('nodeId').anyOf(nodeIds).delete();
      return;
    }
    if (nodeType === 'route') {
      const db = getRouteDB();
      await db.open?.();
      await db.features.where('nodeId').anyOf(nodeIds).delete();
    }
  }

  private async deleteRelations(nodeType: NodeType, nodeIds: NodeId[]): Promise<void> {
    void nodeType;
    void nodeIds;
  }

  private async deleteVectorTiles(nodeType: NodeType, nodeIds: NodeId[]): Promise<void> {
    if (nodeType === 'shape') {
      await shapeDB.open?.();
      await shapeDB.deleteVectorTilesByNodeIds(nodeIds);
      return;
    }
    if (nodeType === 'route') {
      const db = getRouteDB();
      await db.open?.();
      await db.vectorTiles.where('nodeId').anyOf(nodeIds).delete();
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
      const mutation = this.mutationServices.shapeMutation;
      if (!mutation) {
        console.warn('[EntityLifecycleManager] shape mutation API unavailable');
        return;
      }
      for (const nodeId of nodeIds) {
        await mutation.clearShapeArtifacts(nodeId);
      }
    } catch (error) {
      console.warn('[EntityLifecycleManager] shape cleanup failed', error);
    }
  }

  private async deleteLocationArtifacts(nodeIds: NodeId[]): Promise<void> {
    try {
      const mutation = this.mutationServices.locationMutation;
      if (!mutation) {
        console.warn('[EntityLifecycleManager] location mutation API unavailable');
        return;
      }
      for (const nodeId of nodeIds) {
        await mutation.clearLocationArtifacts(nodeId);
      }
    } catch (error) {
      console.warn('[EntityLifecycleManager] location cleanup failed', error);
    }
  }

  private async deleteRouteArtifacts(nodeIds: NodeId[]): Promise<void> {
    try {
      const mutation = this.mutationServices.routeMutation;
      if (!mutation) {
        console.warn('[EntityLifecycleManager] route mutation API unavailable');
        return;
      }
      for (const nodeId of nodeIds) {
        await mutation.clearRouteArtifacts(nodeId);
      }
    } catch (error) {
      console.warn('[EntityLifecycleManager] route cleanup failed', error);
    }
  }
}
