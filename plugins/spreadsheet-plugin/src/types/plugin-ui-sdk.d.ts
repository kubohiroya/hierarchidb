declare module '@hierarchidb/plugin-ui-sdk' {
  import type { TreeNodeMetadata } from '@hierarchidb/common-types';
  import type { TreeNodeUpdaterState } from '@hierarchidb/plugin-ui-sdk';

  export const createTreeNodeUpdaterActions: <TPayload extends object = Record<string, unknown>>(
    updateDraft: (data: Partial<TreeNodeUpdaterState<TPayload>>) => void
  ) => {
    updatePayload: (patch: Partial<TPayload>, base?: TPayload) => void;
    updateMetadata: (patch: Partial<TreeNodeMetadata>, base?: TreeNodeMetadata) => void;
    updatePayloadAndMetadata: (
      payloadPatch: Partial<TPayload>,
      metadataPatch: Partial<TreeNodeMetadata>,
      base?: { payload?: TPayload; metadata?: TreeNodeMetadata }
    ) => void;
  };
}
