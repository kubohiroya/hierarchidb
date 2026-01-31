/**
 * Base Dialog Type Definitions
 *
 * Provides standardized interfaces for base-dialog containers
 * to ensure consistency across the application.
 */

import type { NodeId } from '@hierarchidb/core-types';

/**
 * Base props for all base-dialog containers
 */
export interface BaseDialogProps<T = any> {
  /**
   * Controls the visibility of the base-dialog
   */
  readonly open: boolean;

  /**
   * Callback fired when the base-dialog should be closed
   */
  readonly onCancel: () => void;

  /**
   * Callback fired when the form is submitted
   * @param data - The form data to submit
   * @returns Promise that resolves when submission is complete
   */
  readonly onSubmit: (data: T) => Promise<void>;
}

/**
 * Extended base-dialog props for node-related console
 */
export interface NodeDialogProps<T = any> extends BaseDialogProps<T> {
  /**
   * The parent node ID where the new node will be created
   */
  readonly parentId?: NodeId;

  /**
   * The node being edited (for edit console)
   */
  readonly nodeId?: NodeId;
}

/**
 * Props for console with initial data
 */
export interface EditDialogProps<T = any> extends NodeDialogProps<T> {
  /**
   * Initial data to populate the form
   */
  readonly initialData?: Partial<T>;

  /**
   * Whether the base-dialog is in edit mode (vs create mode)
   */
  readonly isEdit?: boolean;
}

/**
 * Props for confirmation console
 */
export interface ConfirmDialogProps extends Omit<BaseDialogProps<void>, 'onSubmit'> {
  /**
   * The title of the confirmation base-dialog
   */
  readonly title: string;

  /**
   * The message to display in the confirmation base-dialog
   */
  readonly message: string;

  /**
   * Optional severity level for the confirmation
   */
  readonly severity?: 'info' | 'warning' | 'error';

  /**
   * Text for the confirm button
   */
  readonly confirmText?: string;

  /**
   * Text for the cancel button
   */
  readonly cancelText?: string;

  /**
   * Callback fired when confirmed
   */
  readonly onConfirm: () => void | Promise<void>;
}

/**
 * Common form data structure
 */
export interface BaseFormData {
  /**
   * Name of the item
   */
  name: string;

  /**
   * Optional description
   */
  description?: string;

  /**
   * Optional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Standard base-dialog result
 */
export interface DialogResult<T = any> {
  /**
   * Whether the base-dialog was confirmed (vs cancelled)
   */
  confirmed: boolean;

  /**
   * The data returned from the base-dialog (if confirmed)
   */
  data?: T;
}
