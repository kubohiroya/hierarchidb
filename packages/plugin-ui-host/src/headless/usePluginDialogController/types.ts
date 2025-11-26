import type { DialogStep, StepComponentDescriptor } from '@hierarchidb/ui-dialog';
import type { StepData } from '@hierarchidb/plugin-base';

export interface BasicInfoState {
  name: string;
  description: string;
  tags: string[];
}

export interface BasicInfoMeta extends StepData {
  error: string | null;
  hasConflict: boolean;
}

export interface StepCompositionResult {
  steps: DialogStep[];
  stepDescriptors: ReadonlyArray<StepComponentDescriptor<StepData>>;
  currentStepData: StepData;
  basicInfoValidationPayload: StepData;
  dialogData: StepData;
}

export type { StepData };
