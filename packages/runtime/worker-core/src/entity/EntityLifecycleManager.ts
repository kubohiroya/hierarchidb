import type { Dexie, Table } from 'dexie';
import type {
  CommitWorkingCopyPayload,
  DiscardWorkingCopyPayload,
  DuplicateNodesPayload,
  ImportNodesPayload,
  NodeId,
  NodeType,
  PasteNodesPayload,
  TreeNode,
} from '@hierarchidb/common-type';
import type { CommandEnvelope } from '../services/command-types.js';
import type { CoreDB } from '../services/CoreDB.js';
import { PeerEntityHandler } from './handlers/PeerEntityHandler.js';
import { decodeWorkingCopyHolderName } from '../services/utils/holder-encoding.js';
import { storeRegistry } from './store-registry.js';

type CreateWorkingCopyPayload = {
  originalId: NodeId;
  workingCopyId: NodeId;
};

type CreateWorkingCopyEnvelope = CommandEnvelope<'createWorkingCopy', CreateWorkingCopyPayload>;
type DiscardWorkingCopyEnvelope = CommandEnvelope<'discardWorkingCopy', DiscardWorkingCopyPayload>;
type CommitWorkingCopyEnvelope = CommandEnvelope<'commitWorkingCopy', CommitWorkingCopyPayload>;
type DuplicateNodesEnvelope = CommandEnvelope<'duplicateNodes', DuplicateNodesPayload>;
type PasteNodesEnvelope = CommandEnvelope<'pasteNodes', PasteNodesPayload>;
type ImportNodesEnvelope = CommandEnvelope<'importNodes', ImportNodesPayload>;

type NodeMapping = Map<NodeId, NodeId>;
type NodeMappingSource = Iterable<readonly [unknown, unknown]>;
type SourceNodeMap = Map<NodeId, TreeNode>;

type PeerEntitiesDb = Dexie & { peerEntities: Table<unknown, NodeId> };
type PeerDbLoader = () => Promise<PeerEntitiesDb | undefined>;

const toNodeId = (value: string): NodeId => value as NodeId;
const toNodeType = (value: string): NodeType => value as NodeType;
const maybeNodeId = (value: unknown): NodeId | undefined => (typeof value === 'string' && value.length > 0 ? (value as NodeId) : undefined);

const buildSourceNodeMap = (nodes?: Record<string, TreeNode | undefined>): SourceNodeMap | undefined => {
  if (!nodes) return undefined;
  const map = new Map<NodeId, TreeNode>();
  for (const [rawId, snapshot] of Object.entries(nodes)) {
    if (!snapshot) continue;
    map.set(toNodeId(rawId), snapshot);
  }
  return map;
};

// Plugin-specific EntitiesDB loaders are not wired in the worker package to avoid
// hard dependencies on app-selected plugins. The app build/runtime may register
// loaders via an extension point when bundling with Vite.
const peerDbLoaders = new Map<NodeType, PeerDbLoader>();

// Optional extension API for registering loaders at runtime (e.g., by the app)
export const registerPeerDbLoader = (nodeType: NodeType, loader: PeerDbLoader): void => {
  peerDbLoaders.set(nodeType, loader);
};
export const registerPeerDbLoaders = (
  entries: ReadonlyArray<[NodeType, PeerDbLoader]> | Record<string, PeerDbLoader>,
): void => {
  if (Array.isArray(entries)) {
    for (const [type, loader] of entries) peerDbLoaders.set(type, loader);
  } else {
    for (const [key, loader] of Object.entries(entries)) {
      peerDbLoaders.set(toNodeType(key as NodeType), loader);
    }
  }
};

const withPeerDb = async (nodeType: NodeType, fn: (db: PeerEntitiesDb) => Promise<void>): Promise<void> => {
  const loader = peerDbLoaders.get(nodeType);
  if (!loader) return;
  const db = await loader();
  if (!db) return;
  try {
    await fn(db);
  } finally {
    if (typeof db.close === 'function') {
      try {
        db.close();
      } catch {
        // ignore close errors (best-effort cleanup)
      }
    }
  }
};

const resolveFromSourceMap = (nodeId: NodeId, sourceNodes?: SourceNodeMap): TreeNode | undefined => {
  if (!sourceNodes) return undefined;
  return sourceNodes.get(nodeId);
};

const resolveNode = async (coreDB: CoreDB, nodeId: NodeId, sourceNodes?: SourceNodeMap): Promise<TreeNode | undefined> => {
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
    if (!this.instance) this.instance = new EntityLifecycleManager(coreDB);
    return this.instance;
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
    this.idMappingByCommand.set(commandId, normalized);
  }

  private static takeIdMapping(commandId: string): NodeMapping | undefined {
    const mapping = this.idMappingByCommand.get(commandId);
    if (mapping) this.idMappingByCommand.delete(commandId);
    return mapping;
  }

  async handleCommand(envelope: CommandEnvelope<string, unknown>): Promise<void> {
    switch (envelope.kind) {
      case 'createWorkingCopy':
        return this.onCreateWorkingCopy(envelope as CreateWorkingCopyEnvelope);
      case 'discardWorkingCopy':
        return this.onDiscardWorkingCopy(envelope as DiscardWorkingCopyEnvelope);
      case 'commitWorkingCopy':
        return this.onCommitWorkingCopy(envelope as CommitWorkingCopyEnvelope);
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

  async onCreateWorkingCopy(env: CreateWorkingCopyEnvelope): Promise<void> {
    try {
      const { originalId, workingCopyId } = env.payload;
      if (!originalId || !workingCopyId) return;
      const node = await this.coreDB.getNode(originalId);
      const nodeType = node?.nodeType;
      if (!nodeType) return;
      const store = storeRegistry.getPeer(nodeType);
      if (!store) return;
      const peer = new PeerEntityHandler(store);
      await peer.copyPeer(originalId, workingCopyId);
    } catch {
      // Lifecycle runs best-effort; swallow errors to avoid breaking callers.
    }
  }

  async onDiscardWorkingCopy(env: DiscardWorkingCopyEnvelope): Promise<void> {
    try {
      const wcId = env.payload.workingCopyId;
      const wcNode = await this.coreDB.getNode(wcId);
      const nodeType = wcNode?.nodeType;
      if (!nodeType) return;
      const store = storeRegistry.getPeer(nodeType);
      if (store) {
        const peer = new PeerEntityHandler(store);
        await peer.deletePeer(wcId);
        return;
      }
      await withPeerDb(nodeType, async (db) => {
        await db.peerEntities.delete(wcId);
      });
    } catch {
    }
  }

  async onCommitWorkingCopy(env: CommitWorkingCopyEnvelope): Promise<void> {
    try {
      const wcId = env.payload.workingCopyId;
      const wcNode = await this.coreDB.getNode(wcId);
      if (!wcNode) return;
      const holder = wcNode.parentId ? await this.coreDB.getNode(wcNode.parentId) : undefined;
      if (!holder) return;

      let targetId: NodeId | undefined = holder.holderTargetId;
      if (!targetId && holder.name) {
        const decoded = decodeWorkingCopyHolderName(holder.name);
        targetId = decoded.targetNodeId;
      }
      if (!targetId) return;

      const nodeType = wcNode.nodeType;
      if (!nodeType) return;

      const store = storeRegistry.getPeer(nodeType);
      if (!store) return;
      const peer = new PeerEntityHandler(store);
      await peer.upsertPeer(targetId, wcId);
      await peer.deletePeer(wcId);
    } catch {
    }
  }

  async onDuplicateNodes(env: DuplicateNodesEnvelope): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    await this.copyPeersByMapping(mapping);
    await this.copyGroupsByMapping(mapping);
    await this.copyRelationsByMapping(mapping);
  }

  async onPasteNodes(env: PasteNodesEnvelope): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    const sourceNodes = buildSourceNodeMap(env.payload.nodes);
    await this.copyPeersByMapping(mapping, sourceNodes);
    await this.copyGroupsByMapping(mapping, sourceNodes);
    await this.copyRelationsByMapping(mapping, sourceNodes);
  }

  async onImportNodes(env: ImportNodesEnvelope): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    const sourceNodes = buildSourceNodeMap(env.payload.nodes);
    await this.copyPeersByMapping(mapping, sourceNodes);
    await this.copyGroupsByMapping(mapping, sourceNodes);
    await this.copyRelationsByMapping(mapping, sourceNodes);
  }

  private async copyPeersByMapping(mapping: NodeMapping, sourceNodes?: SourceNodeMap): Promise<void> {
    const byType = new Map<NodeType, Array<{ src: NodeId; dst: NodeId }>>();
    for (const [src, dst] of mapping.entries()) {
      try {
        const snapshot = await resolveNode(this.coreDB, src, sourceNodes);
        const nodeType = snapshot?.nodeType;
        if (!nodeType) continue;
        const list = byType.get(nodeType) ?? [];
        list.push({ src, dst });
        byType.set(nodeType, list);
      } catch {
        continue;
      }
    }

    for (const [nodeType, pairs] of byType.entries()) {
      try {
        const store = storeRegistry.getPeer(nodeType);
        if (!store) continue;
        const handler = new PeerEntityHandler(store);
        await handler.bulkUpsertFromIds(pairs.map(({ src, dst }) => ({ fromId: src, targetId: dst })));
      } catch {
      }
    }
  }

  private async copyGroupsByMapping(mapping: NodeMapping, sourceNodes?: SourceNodeMap): Promise<void> {
    try {
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
    } catch {
    }
  }

  private async copyRelationsByMapping(mapping: NodeMapping, sourceNodes?: SourceNodeMap): Promise<void> {
    try {
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
    } catch {
    }
  }
}
