import type { NodeId } from '@hierarchidb/common-type';
import type { ReactNode } from 'react';
import type { SxProps, Theme } from '@mui/material/esm/styles/index';

import { DialogMode } from '~/types/dialogMode';

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
  parentId?: NodeId;

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
