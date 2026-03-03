import type { PeerEntity } from '@hierarchidb/core-types';
import type { TreeNodeData, TreeNodeMetadata } from '@hierarchidb/tree-api';
import type { TreeNodeUpdaterState } from './useTreeNodeUpdater.js';

export const createTreeNodeUpdaterActions = <
  TPayload extends PeerEntity<TreeNodeData> = PeerEntity<TreeNodeData>
>(
  updateDraft: (data: Partial<TreeNodeUpdaterState<TPayload>>) => void
) => {
  const updatePayload = (patch: Partial<TPayload>, base?: TPayload) => {
    const next = { ...(base ?? ({} as TPayload)), ...patch } as TPayload;
    updateDraft({ draftData: next });
  };
  const updateMetadata = (patch: Partial<TreeNodeMetadata>, base?: TreeNodeMetadata) => {
    const fallback: TreeNodeMetadata = { name: '', description: '', tags: [] };
    updateDraft({ draftMetadata: { ...(base ?? fallback), ...patch } });
  };
  const updatePayloadAndMetadata = (
    payloadPatch: Partial<TPayload>,
    metadataPatch: Partial<TreeNodeMetadata>,
    base?: { payload?: TPayload; metadata?: TreeNodeMetadata }
  ) => {
    updatePayload(payloadPatch, base?.payload);
    updateMetadata(metadataPatch, base?.metadata);
  };

  return { updatePayload, updateMetadata, updatePayloadAndMetadata };
};
