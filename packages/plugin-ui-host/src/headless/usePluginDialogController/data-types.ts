import type { NodeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import type { StepData as BaseStepData } from '@hierarchidb/plugin-base';

/**
 * Canonical dialog step payload used across plugin host.
 * Plugins may attach arbitrary fields; we keep it as a loose record.
 */
export type DialogStepData = BaseStepData;

export type DialogUiState = unknown;

/**
 * Minimal working-copy envelope exchanged between Host UI and Worker.
 * Basic infoは draftMetadata、ステップデータは draftData に保持し、永続化対象はこの2つのみ。
 */
export interface TreeNodeUpdater<TData> {
  id: NodeId;
  draftMetadata: TreeNodeMetadata | null;
  draftData: Partial<TData> | null;
}

/**
 * Update payload for working copy (metadata + step data).
 * id は既存 tree/draft から補完する前提でオプショナルにはしない。
 */
export interface TreeNodeUpdatePayload<TData> {
  draftMetadata?: TreeNodeMetadata | null;
  draftData?: Partial<TData> | null;
}

export type BasicInfoMeta = BaseStepData & {
  error: string | null;
  hasConflict: boolean;
};

export interface StepCompositionResult {
  steps: import('@hierarchidb/ui-dialog').DialogStep[];
  stepDescriptors: ReadonlyArray<import('@hierarchidb/ui-dialog').StepComponentDescriptor<DialogStepData>>;
  currentStepData: DialogStepData;
  basicInfoValidationPayload: DialogStepData;
  dialogData: DialogStepData;
}

export interface BasicInfoState {
  name: string;
  description: string;
  tags: string[];
}

export interface StepAdapterProps {
  cfg: import('@hierarchidb/plugin-base').PluginStepConfig<DialogStepData, DialogUiState>;
  mode: 'create' | 'edit';
  nodeId: string;
  parentId: string;
  workingData: DialogStepData | undefined;
  updateDraft: (patch: Partial<TreeNodeUpdater<DialogStepData>>) => void;
  onDataChange?: (data: DialogStepData) => void;
  dialogRef?: React.RefObject<HTMLElement | null>;
}
