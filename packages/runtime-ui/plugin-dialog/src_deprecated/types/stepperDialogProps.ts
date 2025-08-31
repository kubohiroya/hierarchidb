import { DialogStep } from '~/types/dialogStep';
import { PluginDialogProps } from '~/types/pluginDialogProps';

/**
 * Props for stepper dialogs
 */
export interface StepperDialogProps<T = any> extends PluginDialogProps<T> {
  /**
   * Dialog variant (always 'stepper' for this component)
   */
  variant: 'stepper';

  /**
   * Steps configuration
   */
  steps: DialogStep[];

  /**
   * Current active step (0-indexed)
   */
  activeStep?: number;

  /**
   * Called when step changes
   */
  onStepChange?: (step: number) => void;

  /**
   * Whether to show step labels
   */
  showStepLabels?: boolean;

  /**
   * Whether to allow non-linear navigation
   */
  nonLinear?: boolean;
}
