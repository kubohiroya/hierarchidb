import type { DialogStateAPI, DialogStateSubscriptionId } from '@hierarchidb/common-api';
import type { MultiStepDialogState } from '@hierarchidb/common-types';
import type { DialogStep } from '@hierarchidb/ui-dialog';
import type { PluginStepConfig, StepData } from '@hierarchidb/plugin-base';

export type {
  DialogStateAPI,
  DialogStateSubscriptionId,
  MultiStepDialogState,
  PluginStepConfig,
  DialogStep,
};

export type BasicInfoState = { name: string; description: string; tags: string[] };

export type StepGuardState = {
  enabledSteps: boolean[];
  canSave: boolean;
  canProceedNext: boolean;
  canGoBack: boolean;
  canStartBatch: boolean;
};

export interface DialogStateSubscriptionDeps {
  createCallback?: (
    handler: (state: MultiStepDialogState | null) => void
  ) => (state: MultiStepDialogState | null) => void;
  releaseCallback?: (callback: (state: MultiStepDialogState | null) => void) => void;
}

export type DialogStateApiSubset = Partial<
  Pick<DialogStateAPI, 'subscribeState' | 'unsubscribeState' | 'getState'>
>;

export type StepGuardDeps = {
  steps: DialogStep[];
  configs: ReadonlyArray<PluginStepConfig>;
  filled: boolean[];
  activeStepIndex: number;
  dialogData: StepData;
  hostCanSubmit?: (data: StepData) => boolean | Promise<boolean>;
};
