import type { ReactNode } from 'react';

/**
 * Step definition for stepper dialogs
 */
export interface DialogStep {
  /**
   * Step label
   */
  label: string;

  /**
   * Step description
   */
  description?: string;

  /**
   * Step content component
   */
  content: ReactNode;

  /**
   * Whether the step is optional
   */
  optional?: boolean;

  /**
   * Validation function for the step
   */
  validate?: () => boolean | Promise<boolean>;
}
