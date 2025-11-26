import type { DraftData } from '@hierarchidb/plugin-ui-sdk';
import type { StepData as BaseStepData } from '@hierarchidb/plugin-base';

/**
 * Canonical dialog step payload used across plugin host.
 * Plugins may attach arbitrary fields; we keep it as a loose record.
 */
export type DialogStepData = BaseStepData;

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
  cfg: import('@hierarchidb/plugin-base').PluginStepConfig<DialogStepData>;
  mode: 'create' | 'edit';
  nodeId: string;
  parentId: string;
  workingData: DialogStepData | undefined;
  updateDraft: (patch: Partial<DraftData>) => void;
  onDataChange?: (data: DialogStepData) => void;
  dialogRef?: React.RefObject<HTMLElement | null>;
}
