/**
 * Base Dialog Type Definitions
 *
 * Provides standardized interfaces for dialog containers
 * to ensure consistency across the application.
 */

import type { NodeId } from '@hierarchidb/common-core';

/**
 * Base props for all dialog containers
 */
export interface BaseDialogProps<T = any> {
  /**
   * Controls the visibility of the dialog
   */
  readonly open: boolean;

  /**
   * Callback fired when the dialog should be closed
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
 * Extended dialog props for node-related dialogs
 */
export interface NodeDialogProps<T = any> extends BaseDialogProps<T> {
  /**
   * The parent node ID where the new node will be created
   */
  readonly parentId?: NodeId;

  /**
   * The node being edited (for edit dialogs)
   */
  readonly nodeId?: NodeId;
}

/**
 * Props for dialogs with initial data
 */
export interface EditDialogProps<T = any> extends NodeDialogProps<T> {
  /**
   * Initial data to populate the form
   */
  readonly initialData?: Partial<T>;

  /**
   * Whether the dialog is in edit mode (vs create mode)
   */
  readonly isEdit?: boolean;
}

/**
 * Props for confirmation dialogs
 */
export interface ConfirmDialogProps extends Omit<BaseDialogProps<void>, 'onSubmit'> {
  /**
   * The title of the confirmation dialog
   */
  readonly title: string;

  /**
   * The message to display in the confirmation dialog
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
 * Standard dialog result
 */
export interface DialogResult<T = any> {
  /**
   * Whether the dialog was confirmed (vs cancelled)
   */
  confirmed: boolean;

  /**
   * The data returned from the dialog (if confirmed)
   */
  data?: T;
}
