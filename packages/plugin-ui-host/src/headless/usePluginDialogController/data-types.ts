import type { NodeId, PeerEntity } from '@hierarchidb/core-types';
import type { TreeNodeData, TreeNodeMetadata } from '@hierarchidb/tree-api';

export type DialogUiState = object;

// Draft container: basic info goes to draftMetadata, plugin data goes to draftData (Partial of plugin entity).
export interface TreeNodeUpdaterPayload<
  T extends PeerEntity<TreeNodeData> = PeerEntity<TreeNodeData>,
> {
  treeNodeId: NodeId;
  draftMetadata: TreeNodeMetadata | null;
  draftData?: Partial<T>;
}

export interface TreeNodeUpdaterPatch<
  T extends PeerEntity<TreeNodeData> = PeerEntity<TreeNodeData>,
> {
  draftMetadata?: TreeNodeMetadata | null;
  draftData?: Partial<T>;
}

export type BasicInfoMeta = {
  error: string | null;
  hasConflict: boolean;
};

// Alias for basic info atoms
export type BasicInfoState = TreeNodeMetadata;

export interface StepCompositionResult<
  T extends PeerEntity<TreeNodeData> = PeerEntity<TreeNodeData>,
> {
  steps: import('@hierarchidb/ui-dialog').DialogStep[];
  stepDescriptors: ReadonlyArray<
    import('@hierarchidb/ui-dialog').StepComponentDescriptor<Partial<T>>
  >;
  currentStepData: Partial<T>;
  basicInfoValidationPayload: TreeNodeMetadata;
  dialogData: Partial<T>;
}

export interface StepAdapterProps<T extends PeerEntity<TreeNodeData> = PeerEntity<TreeNodeData>> {
  cfg: import('@hierarchidb/plugin-base').PluginStepConfig<Partial<T>, DialogUiState>;
  mode: 'create' | 'edit';
  nodeId: string;
  parentId: string;
  workingData: Partial<T> | undefined;
  basicInfo: TreeNodeMetadata;
  updateDraft: (patch: Partial<TreeNodeUpdaterPayload<T>>) => void;
  onDataChange?: (data: Partial<T>) => void;
  dialogRef?: React.RefObject<HTMLElement | null>;
}
