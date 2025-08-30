import type { ReactNode } from 'react';
import type { SxProps, Theme } from '@mui/material/esm/styles/index';

/**
 * Common dialog actions props
 */
export interface CommonDialogActionsProps {
  /**
   * Dialog variant
   */
  variant?: 'simple' | 'stepper';

  /**
   * Current step (for stepper variant)
   */
  currentStep?: number;

  /**
   * Total steps (for stepper variant)
   */
  totalSteps?: number;

  /**
   * Whether the form can be submitted
   */
  canSubmit: boolean;

  /**
   * Submit button label
   */
  submitLabel?: string;

  /**
   * Cancel button label
   */
  cancelLabel?: string;

  /**
   * Whether submit is in progress
   */
  isSubmitting?: boolean;

  /**
   * Called when submit is clicked
   */
  onSubmit: () => void;

  /**
   * Called when cancel is clicked
   */
  onCancel: () => void;

  /**
   * Called when back is clicked (stepper only)
   */
  onBack?: () => void;

  /**
   * Called when next is clicked (stepper only)
   */
  onNext?: () => void;

  /**
   * Whether back button is disabled
   */
  disableBack?: boolean;

  /**
   * Whether next button is disabled
   */
  disableNext?: boolean;

  /**
   * Additional action components
   */
  additionalActions?: ReactNode;

  /**
   * Additional sx props
   */
  sx?: SxProps<Theme>;
}
