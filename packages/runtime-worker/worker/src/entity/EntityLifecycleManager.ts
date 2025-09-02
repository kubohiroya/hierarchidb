import type { CommandEnvelope } from '../services/command-types';
import type { CoreDB } from '../services/CoreDB';
import { PeerEntityHandler } from './handlers/PeerEntityHandler';
import { decodeWorkingCopyHolderName } from '../services/utils/holder-encoding';
import { storeRegistry } from './store-registry';

export class EntityLifecycleManager {
  private static instance: EntityLifecycleManager | undefined;
  private constructor(private coreDB: CoreDB) {}
  // Temporary registry to pass source→target ID mappings from services to lifecycle.
  private static idMappingByCommand = new Map<string, Map<string, string>>();

  static getSingleton(coreDB: CoreDB): EntityLifecycleManager {
    if (!this.instance) this.instance = new EntityLifecycleManager(coreDB);
    return this.instance;
  }

  // Register a source→target ID mapping for a specific command.
  static setIdMapping(commandId: string, mapping: Map<string, string>): void {
    this.idMappingByCommand.set(commandId, mapping);
  }

  private static takeIdMapping(commandId: string): Map<string, string> | undefined {
    const m = this.idMappingByCommand.get(commandId);
    if (m) this.idMappingByCommand.delete(commandId);
    return m;
  }

  // Dispatch by command kind (base skeleton)
  async handleCommand(envelope: CommandEnvelope<string, unknown>): Promise<void> {
    switch (envelope.kind) {
      case 'createWorkingCopy':
        return this.onCreateWorkingCopy(envelope as any);
      case 'discardWorkingCopy':
        return this.onDiscardWorkingCopy(envelope as any);
      case 'commitWorkingCopy':
        return this.onCommitWorkingCopy(envelope as any);
      case 'duplicateNodes':
        return this.onDuplicateNodes(envelope as any);
      case 'pasteNodes':
        return this.onPasteNodes(envelope as any);
      case 'importNodes':
        return this.onImportNodes(envelope as any);
      default:
        // Other commands will be added incrementally
        return;
    }
  }

  // Below are no-op placeholders to be implemented in later phases.
  // They intentionally do not mutate state yet.
  async onCreateWorkingCopy(env: CommandEnvelope<'createWorkingCopy', { originalId: any; workingCopyId: any }>): Promise<void> {
    try {
      const originalId = env.payload?.originalId as any;
      const wcId = env.payload?.workingCopyId as any;
      if (!originalId || !wcId) return;
      const node = await (this.coreDB as any).getNode?.(originalId);
      const nodeType = (node as any)?.nodeType as string | undefined;
      if (!nodeType) return;
      const store = storeRegistry.getPeer(nodeType);
      if (!store) return;
      const peer = new PeerEntityHandler(store);
      await peer.copyPeer(originalId, wcId);
    } catch {}
  }

  async onDiscardWorkingCopy(env: CommandEnvelope<'discardWorkingCopy', { workingCopyId: any }>): Promise<void> {
    try {
      const wcId = env.payload?.workingCopyId as any;
      if (!wcId) return;
      const wcNode = await (this.coreDB as any).getNode?.(wcId);
      const nodeType = (wcNode as any)?.nodeType as string | undefined;
      if (!nodeType) return;
      const store = storeRegistry.getPeer(nodeType);
      if (!store) return;
      const peer = new PeerEntityHandler(store);
      await peer.deletePeer(wcId);
    } catch {}
  }
  async onCommitWorkingCopy(env: CommandEnvelope<'commitWorkingCopy', { workingCopyId: any }>): Promise<void> {
    try {
      // Resolve WC node and its holder to discover targetId
      const wcId = env.payload?.workingCopyId as any;
      if (!wcId) return;
      const wcNode = await (this.coreDB as any).nodes?.get?.(wcId);
      if (!wcNode) return; // nothing to do
      const holder = await (this.coreDB as any).nodes?.get?.(wcNode.parentId);
      if (!holder) return;

      // Prefer explicit holder metadata; fallback to decoding holder.name
      let targetId = (holder as any)?.holderTargetId as any;
      if (!targetId && holder?.name) {
        const decoded = decodeWorkingCopyHolderName(holder.name as any);
        targetId = decoded?.targetNodeId as any;
      }
      if (!targetId) return;

      // Resolve nodeType to choose plugin store
      const nodeType = (wcNode as any)?.nodeType as string | undefined;
      if (!nodeType) return;
      const store = storeRegistry.getPeer(nodeType);
      if (!store) return; // No registered store for this nodeType
      const peer = new PeerEntityHandler(store);
      await peer.upsertPeer(targetId, wcId);
      await peer.deletePeer(wcId);
    } catch {
      // Best-effort; never throw from lifecycle in base implementation
    }
  }
  async onDuplicateNodes(env: CommandEnvelope<'duplicateNodes', { nodeIds: any[] }>): Promise<void> {
    // Use registered mapping (source root → new root). Subtree mapping is a later enhancement.
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    await this.copyPeersByMapping(mapping);
    await this.copyGroupsByMapping(mapping);
    await this.copyRelationsByMapping(mapping);
  }

  async onPasteNodes(env: CommandEnvelope<'pasteNodes', { nodes: Record<string, any>; nodeIds: string[] }>): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    // Prefer nodeType from payload nodes map where available.
    await this.copyPeersByMapping(mapping, env.payload.nodes);
    await this.copyGroupsByMapping(mapping, env.payload.nodes);
    await this.copyRelationsByMapping(mapping, env.payload.nodes);
  }

  async onImportNodes(env: CommandEnvelope<'importNodes', { nodes: Record<string, any>; nodeIds: string[] }>): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    await this.copyPeersByMapping(mapping, env.payload.nodes);
    await this.copyGroupsByMapping(mapping, env.payload.nodes);
    await this.copyRelationsByMapping(mapping, env.payload.nodes);
  }

  private async copyPeersByMapping(
    mapping: Map<string, string>,
    sourceNodes?: Record<string, { nodeType?: string }>
  ): Promise<void> {
    // Group pairs by nodeType to leverage bulk upsert if available
    const byType = new Map<string, Array<{ src: string; dst: string }>>();
    for (const [src, dst] of mapping.entries()) {
      let nodeType: string | undefined = sourceNodes?.[src]?.nodeType as string | undefined;
      if (!nodeType) {
        const node = await (this.coreDB as any).getNode?.(src);
        nodeType = (node as any)?.nodeType;
      }
      if (!nodeType) continue;
      const arr = byType.get(nodeType) || [];
      arr.push({ src, dst });
      byType.set(nodeType, arr);
    }

    for (const [nodeType, pairs] of byType.entries()) {
      try {
        const store = storeRegistry.getPeer(nodeType);
        if (!store) continue;
        const handler = new PeerEntityHandler(store);
        // Try bulk path
        await handler.bulkUpsertFromIds(
          pairs.map((p) => ({ targetId: p.dst as any, fromId: p.src as any }))
        );
      } catch {
        // ignore and continue other types
      }
    }
  }

  private async copyGroupsByMapping(
    mapping: Map<string, string>,
    sourceNodes?: Record<string, { nodeType?: string }>
  ): Promise<void> {
    try {
      for (const [src, dst] of mapping.entries()) {
        const srcNode = sourceNodes?.[src] || (await (this.coreDB as any).getNode?.(src));
        const nodeType = (srcNode as any)?.nodeType as string | undefined;
        if (!nodeType) continue;
        const store = (await import('./store-registry')).storeRegistry.getGroup(nodeType);
        if (!store) continue;
        const items = await store.list(src as any);
        if (!items?.length) continue;
        await store.bulkUpsert(dst as any, items as any);
      }
    } catch {
      // ignore per best-effort policy
    }
  }

  private async copyRelationsByMapping(
    mapping: Map<string, string>,
    sourceNodes?: Record<string, { nodeType?: string }>
  ): Promise<void> {
    try {
      // Build quick lookup for subtree membership
      const inSubtree = new Set<string>(Array.from(mapping.keys()));
      const storeReg = (await import('./store-registry')).storeRegistry;
      for (const [src, dst] of mapping.entries()) {
        const srcNode = sourceNodes?.[src] || (await (this.coreDB as any).getNode?.(src));
        const nodeType = (srcNode as any)?.nodeType as string | undefined;
        if (!nodeType) continue;
        const relStore = storeReg.getRelations(nodeType);
        if (!relStore) continue;
        const rels = await relStore.listByNode(src as any);
        if (!rels?.length) continue;
        const transformed = rels
          .map((r: any) => {
            const newSrc = mapping.get(r.srcNodeId as string);
            const newDst = mapping.get(r.dstNodeId as string);
            // copy only relations whose both ends are inside the mapping
            if (!newSrc || !newDst) return null;
            return { ...r, srcNodeId: newSrc as any, dstNodeId: newDst as any, updatedAt: Date.now() };
          })
          .filter(Boolean) as any[];
        if (transformed.length) await relStore.bulkUpsert(transformed as any);
      }
    } catch {
      // ignore per best-effort policy
    }
  }
}
