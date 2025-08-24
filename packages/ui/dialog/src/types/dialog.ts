/**
 * @file dialog.ts
 * @description Common dialog type definitions
 */

import type { ReactNode } from 'react';
// Import from core package
import type { NodeId } from '@hierarchidb/common-core';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Dialog mode
 */
export type DialogMode = 'create' | 'edit';

/**
 * Dialog variant
 */
export type DialogVariant = 'simple' | 'stepper';

/**
 * Base props for all plugin dialogs
 */
export interface PluginDialogProps<T = any> {
  /**
   * Dialog operation mode
   */
  mode: DialogMode;
  
  /**
   * Whether the dialog is open
   */
  open: boolean;
  
  /**
   * Node ID for edit mode
   */
  nodeId?: NodeId;
  
  /**
   * Parent node ID for create mode
   */
  parentNodeId?: NodeId;
  
  /**
   * Initial data for the form
   */
  initialData?: T;
  
  /**
   * Called when the form is submitted
   */
  onSubmit: (data: T) => Promise<void>;
  
  /**
   * Called when the dialog is cancelled
   */
  onCancel: () => void;
  
  /**
   * Whether the dialog has unsaved changes
   */
  hasUnsavedChanges?: boolean;
  
  /**
   * Whether draft saving is supported
   */
  supportsDraft?: boolean;
  
  /**
   * Called when saving as draft
   */
  onSaveDraft?: (data: T) => Promise<void>;
  
  /**
   * Custom dialog title
   */
  title?: string;
  
  /**
   * Dialog icon
   */
  icon?: ReactNode;
  
  /**
   * Dialog max width
   */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  
  /**
   * Whether dialog should be full width
   */
  fullWidth?: boolean;
  
  /**
   * Additional sx props
   */
  sx?: SxProps<Theme>;
}

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

/**
 * Working copy state
 */
export interface WorkingCopyState<T = any> {
  /**
   * Working copy ID
   */
  id: string;
  
  /**
   * Original node ID (for edit mode)
   */
  originalNodeId?: NodeId;
  
  /**
   * Working copy data
   */
  data: T;
  
  /**
   * Whether the working copy has unsaved changes
   */
  isDirty: boolean;
  
  /**
   * Whether this is a draft
   */
  isDraft?: boolean;
  
  /**
   * Version number for optimistic locking
   */
  version: number;
  
  /**
   * Creation timestamp
   */
  createdAt: number;
  
  /**
   * Last update timestamp
   */
  updatedAt: number;
}

/**
 * Common dialog context
 */
export interface DialogContextValue<T = any> {
  /**
   * Working copy state
   */
  workingCopy: WorkingCopyState<T> | null;
  
  /**
   * Update working copy data
   */
  updateWorkingCopy: (data: Partial<T>) => void;
  
  /**
   * Commit changes to permanent storage
   */
  commitChanges: () => Promise<void>;
  
  /**
   * Discard changes and delete working copy
   */
  discardWorkingCopy: () => Promise<void>;
  
  /**
   * Save as draft
   */
  saveAsDraft: () => Promise<void>;
  
  /**
   * Whether the dialog is in loading state
   */
  isLoading: boolean;
  
  /**
   * Current error if any
   */
  error: Error | null;
}

/**
 * Unsaved changes dialog props
 */
export interface UnsavedChangesDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;
  
  /**
   * Dialog title
   */
  title?: string;
  
  /**
   * Dialog message
   */
  message?: string;
  
  /**
   * Whether to show save as draft option
   */
  showSaveDraft?: boolean;
  
  /**
   * Called when user chooses to discard
   */
  onDiscard: () => void;
  
  /**
   * Called when user chooses to save as draft
   */
  onSaveDraft?: () => void;
  
  /**
   * Called when user cancels the dialog
   */
  onCancel: () => void;
}

/**
 * Common dialog title props
 */
export interface CommonDialogTitleProps {
  /**
   * Dialog title text
   */
  title: string;
  
  /**
   * Optional icon
   */
  icon?: ReactNode;
  
  /**
   * Optional subtitle/description
   */
  description?: string;
  
  /**
   * Whether to show draft indicator
   */
  showDraftChip?: boolean;
  
  /**
   * Called when close button is clicked
   */
  onClose?: () => void;
  
  /**
   * Additional sx props
   */
  sx?: SxProps<Theme>;
}

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