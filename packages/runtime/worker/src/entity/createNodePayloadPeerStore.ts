import type { DialogProgressState, DialogUIState, DialogWindowState, NodeId, TreeNode } from '@hierarchidb/common-types';
import { CoreDB } from '../services/CoreDB.js';
import type { PeerEntity, PeerStore } from './store.js';

const resolveNodeState = <TData>(node: TreeNode | undefined): ({
  targetField: 'data' | 'draftData';
  dialogUIState?: DialogUIState;
  updatedAt?: number;
} & { data: TData | undefined; dialogWindow?: DialogWindowState | null; dialogProgress?: DialogProgressState | null }) | null => {
  if (!node) return null;
  const targetField: 'data' | 'draftData' =
    (node as { draftData?: unknown }).draftData !== undefined &&
    (node as { draftData?: unknown }).draftData !== null
      ? 'draftData'
      : 'data';
  const dialogUIState = (node as { dialogUIState?: DialogUIState }).dialogUIState;
  const dialogWindow = dialogUIState?.dialogWindow;
  const dialogProgress = dialogUIState?.dialogProgress;
  const updatedAt = (node as { updatedAt?: number }).updatedAt;

  return {
    targetField,
    data: node[targetField] as TData | undefined,
    dialogWindow,
    dialogProgress,
    dialogUIState,
    updatedAt,
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
      const resolved = resolveNodeState<TData>(node);
      if (!resolved) return undefined;
      const data = normalize ? normalize(resolved.data) : resolved.data;
      return {
        nodeId,
        data,
        dialogWindow: resolved.dialogWindow ?? undefined,
        dialogProgress: resolved.dialogProgress ?? undefined,
        updatedAt: resolved.updatedAt,
      };
    },

    async put(entity: PeerEntity<TData>): Promise<void> {
      const coreDB = await ensureCoreDB();
      const node = await coreDB.getNode(entity.nodeId);
      if (!node) {
        throw new Error(`Node not found for peer store put: ${String(entity.nodeId)}`);
      }
      const resolved = resolveNodeState<TData>(node);
      const targetField = resolved?.targetField ?? 'data';

      const dialogUIState: DialogUIState | undefined =
        entity.dialogWindow !== undefined || entity.dialogProgress !== undefined
          ? {
              dialogWindow: entity.dialogWindow ?? null,
              dialogProgress: entity.dialogProgress ?? null,
            }
          : undefined;

      const update: Pick<TreeNode, 'id'> & Partial<TreeNode> = {
        id: entity.nodeId,
        [targetField]: normalize ? normalize(entity.data) ?? null : entity.data ?? null,
      };
      if (dialogUIState) {
        update.dialogUIState = dialogUIState;
      }

      await coreDB.updateNode(update);
    },

    async delete(nodeId: NodeId): Promise<void> {
      const coreDB = await ensureCoreDB();
      const node = await coreDB.getNode(nodeId);
      if (!node) return;
      const resolved = resolveNodeState<TData>(node);
      const targetField = resolved?.targetField ?? 'data';
      await coreDB.updateNode({
        id: nodeId,
        [targetField]: null,
      });
    },

    async bulkUpsert(entities: PeerEntity<TData>[]): Promise<void> {
      for (const entity of entities) {
        await this.put(entity);
      }
    },
  } satisfies PeerStore<TData>;
}
