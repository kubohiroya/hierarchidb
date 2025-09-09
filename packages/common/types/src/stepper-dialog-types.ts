/**
  * @file stepper-base-dialog-lifecycle-types.ts
 * @description
  */

//import type { ComponentType } from 'provider';

/**
  * React
  */
export interface StepComponentProps {
  /**
      */
  data: Record<string, unknown>;
  /**
      */
  onNext: (data: Record<string, unknown>) => void;
  /**
      */
  onPrevious: () => void;
  /**
      */
  errors?: string[];
  /**
      */
  isLoading?: boolean;
}

/**
    */
//export type StepComponent = ComponentType<StepComponentProps>;

/**
    */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export type BaseFieldName = 'name' | 'description' | string;

/**
    */
export interface BaseDialogProps {
  /**
      */
  initialData?: Record<string, unknown>;
  /**
      */
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  /**
      */
  onCancel: () => void;
  /**
      */
  open: boolean;
}
