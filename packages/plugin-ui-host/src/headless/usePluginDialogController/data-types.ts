import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeMetadata } from '@hierarchidb/tree-api';

export type DialogUiState = unknown;

// Draft container: basic info goes to draftMetadata, plugin data goes to draftData (Partial of plugin entity).
export interface TreeNodeUpdaterPayload<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  treeNodeId: NodeId;
  draftMetadata: TreeNodeMetadata | null;
  draftData: Partial<T> | null;
}

export interface TreeNodeUpdaterPatch<T extends Record<string, unknown> = Record<string, unknown>> {
  draftMetadata?: TreeNodeMetadata | null;
  draftData?: Partial<T> | null;
}

export type BasicInfoMeta = {
  error: string | null;
  hasConflict: boolean;
};

// Alias for basic info atoms
export type BasicInfoState = TreeNodeMetadata;

export interface StepCompositionResult<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  steps: import('@hierarchidb/ui-dialog').DialogStep[];
  stepDescriptors: ReadonlyArray<
    import('@hierarchidb/ui-dialog').StepComponentDescriptor<Partial<T>>
  >;
  currentStepData: Partial<T>;
  basicInfoValidationPayload: TreeNodeMetadata;
  dialogData: Partial<T>;
}

export interface StepAdapterProps<T extends Record<string, unknown> = Record<string, unknown>> {
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
