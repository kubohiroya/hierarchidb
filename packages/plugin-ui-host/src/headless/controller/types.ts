import type { DialogStep } from '@hierarchidb/ui-dialog';
import type { PluginStepConfig, StepData } from '@hierarchidb/plugin-base';

export type BasicInfoState = { name: string; description: string; tags: string[] };

export type StepGuardState = {
  enabledSteps: boolean[];
  canSave: boolean;
  canProceedNext: boolean;
  canGoBack: boolean;
  canStartBatch: boolean;
};

export type StepGuardDeps = {
  steps: DialogStep[];
  configs: ReadonlyArray<PluginStepConfig>;
  filled: boolean[];
  activeStepIndex: number;
  dialogData: StepData;
  hostCanSubmit?: (data: StepData) => boolean | Promise<boolean>;
};
