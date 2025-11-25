import type { DialogStateAPI, DialogStateSubscriptionId } from '@hierarchidb/common-api';
import type { MultiStepDialogState } from '@hierarchidb/common-types';
import type {
  PluginStepConfig,
  PluginDialogFooterOptions,
  PluginDialogControllerState,
} from '../usePluginDialogController.js';
import type { DialogStep } from '@hierarchidb/ui-dialog';

export type { DialogStateAPI, DialogStateSubscriptionId, MultiStepDialogState, PluginStepConfig, DialogStep };

export type BasicInfoState = { name: string; description: string; tags: string[] };

export type StepGuardState = {
  enabledSteps: boolean[];
  canSave: boolean;
  canProceedNext: boolean;
  canGoBack: boolean;
  canStartBatch: boolean;
};

export interface DialogStateSubscriptionDeps {
  createCallback?: (handler: (state: MultiStepDialogState | null) => void) => unknown;
  releaseCallback?: (callback: unknown) => void;
}

export interface SubscribeDialogStateOptions {
  dialogStateApi: Pick<DialogStateAPI, 'subscribeState'>;
  onStateChange: (state: MultiStepDialogState | null) => void;
  logger?: Pick<Console, 'warn'>;
  deps?: DialogStateSubscriptionDeps;
}

export interface SubscribeDialogStateResult {
  id: DialogStateSubscriptionId | null;
  release: () => void;
}

export type DialogStateApiSubset = Partial<
  Pick<DialogStateAPI, 'subscribeState' | 'unsubscribeState' | 'getState'>
>;

export type StepGuardDeps = {
  steps: DialogStep[];
  configs: ReadonlyArray<PluginStepConfig>;
  filled: boolean[];
  activeStepIndex: number;
  dialogData: Record<string, unknown>;
  hostCanSubmit?: (data: unknown) => boolean | Promise<boolean>;
};
