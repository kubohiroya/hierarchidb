import type {
  CommitDraftPayload,
  DiscardDraftPayload,
  DuplicateNodesPayload,
  ImportNodesPayload,
  NodeId,
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
}
