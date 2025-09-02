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
  }

  async onPasteNodes(env: CommandEnvelope<'pasteNodes', { nodes: Record<string, any>; nodeIds: string[] }>): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    // Prefer nodeType from payload nodes map where available.
    await this.copyPeersByMapping(mapping, env.payload.nodes);
  }

  async onImportNodes(env: CommandEnvelope<'importNodes', { nodes: Record<string, any>; nodeIds: string[] }>): Promise<void> {
    const mapping = EntityLifecycleManager.takeIdMapping(env.commandId);
    if (!mapping) return;
    await this.copyPeersByMapping(mapping, env.payload.nodes);
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
}
