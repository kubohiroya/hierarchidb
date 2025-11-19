import type { NodeId, NodePayloadBase, TreeNode } from '@hierarchidb/common-types';
import type {
  DialogProgressState,
  DialogWindowState,
} from '@hierarchidb/plugin-service-api';
import { CoreDB } from '../services/CoreDB.js';
import type { PeerEntity, PeerStore } from './store.js';

type NodePayloadEnvelope<TData> = NodePayloadBase & {
  data?: TData;
  dialogWindow?: DialogWindowState | null;
  dialogProgress?: DialogProgressState | null;
  updatedAt?: number;
};

const readEnvelope = <TData>(node: TreeNode | undefined): {
  envelope: NodePayloadEnvelope<TData> | null | undefined;
  field: 'payload' | 'draft';
} | null => {
  if (!node) return null;
  const field: 'payload' | 'draft' = node.holderType === 'workingCopy' ? 'draft' : 'payload';
  const envelope = (node as TreeNode<NodePayloadEnvelope<TData>>)[field];
  return { envelope, field };
};

const normalizeEnvelope = <TData>(
  envelope: NodePayloadEnvelope<TData> | null | undefined,
  normalize?: (data: TData | undefined) => TData | undefined
): NodePayloadEnvelope<TData> | undefined => {
  if (!envelope) return undefined;
  const data = normalize ? normalize(envelope.data) : envelope.data;
  return {
    ...envelope,
    data,
  };
};

export function createNodePayloadPeerStore<TData>(options?: {
  normalize?: (data: TData | undefined) => TData | undefined;
}): PeerStore<TData> {
  const normalize = options?.normalize;

  const ensureCoreDB = () => CoreDB.getSingleton();

  return {
    async get(nodeId: NodeId): Promise<PeerEntity<TData> | undefined> {
      const coreDB = await ensureCoreDB();
      const node = await coreDB.getNode(nodeId);
      const resolved = readEnvelope<TData>(node);
      if (!resolved) return undefined;
      const envelope = normalizeEnvelope(resolved.envelope, normalize);
      if (!envelope) return undefined;
      return {
        nodeId,
        data: envelope.data,
        dialogWindow: envelope.dialogWindow ?? undefined,
        dialogProgress: envelope.dialogProgress ?? undefined,
        updatedAt: envelope.updatedAt,
      };
    },

    async put(entity: PeerEntity<TData>): Promise<void> {
      const coreDB = await ensureCoreDB();
      const node = await coreDB.getNode(entity.nodeId);
      const resolved = readEnvelope<TData>(node);
      const field = resolved?.field ?? 'payload';
      const envelope: NodePayloadEnvelope<TData> = {
        data: normalize ? normalize(entity.data) : entity.data,
        dialogWindow: entity.dialogWindow ?? null,
        dialogProgress: entity.dialogProgress ?? null,
        updatedAt: entity.updatedAt ?? Date.now(),
      };
      await coreDB.updateNode({
        id: entity.nodeId,
        [field]: envelope,
      });
    },

    async delete(nodeId: NodeId): Promise<void> {
      const coreDB = await ensureCoreDB();
      const node = await coreDB.getNode(nodeId);
      const resolved = readEnvelope<TData>(node);
      const field = resolved?.field ?? 'payload';
      await coreDB.updateNode({
        id: nodeId,
        [field]: null,
      });
    },

    async bulkUpsert(entities: PeerEntity<TData>[]): Promise<void> {
      for (const entity of entities) {
        await this.put(entity);
      }
    },
  } satisfies PeerStore<TData>;
}
