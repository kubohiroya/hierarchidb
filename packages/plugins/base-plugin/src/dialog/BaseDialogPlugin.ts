import type { ComponentType } from 'react';
import type {
  DialogStepDefinition,
  PeerEntity,
  StepValidation,
  ValidationResult,
} from '@hierarchidb/common-type';
import { NodeDialogPlugin } from './NodeDialogPlugin.js';
import { wrapDialogStepComponent } from './wrapDialogStepComponent.js';

export interface DialogStepConfig<TProps extends object> {
  id: string;
  label: string;
  component: ComponentType<TProps>;
  validation?: {
    validate: (data: TProps) => Promise<{ isValid: boolean; errors?: string[] }>;
    canProceed?: (data: TProps) => boolean;
  };
  required?: boolean;
  order?: number;
}

export abstract class BaseDialogPlugin<TDialog extends PeerEntity = PeerEntity>
  extends NodeDialogPlugin<TDialog> {
  protected createDialogStep<TProps extends object>(config: DialogStepConfig<TProps>): DialogStepDefinition {
    const StepWrapper = wrapDialogStepComponent(config.component);

    return {
      stepNumber: config.order ?? 0,
      title: config.label,
      component: StepWrapper,
      validation: config.validation
        ? ({
            validate: async (data: unknown): Promise<ValidationResult> => {
              const result = await config.validation!.validate(data as TProps);
              return result.isValid
                ? { valid: true }
                : { valid: false, message: (result.errors || []).join(', ') };
            },
            canProceed: config.validation.canProceed
              ? (data: unknown) => config.validation!.canProceed!(data as TProps)
              : undefined,
          } as StepValidation<unknown>)
        : undefined,
    };
  }
}
