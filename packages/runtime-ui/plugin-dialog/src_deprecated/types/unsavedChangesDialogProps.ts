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
