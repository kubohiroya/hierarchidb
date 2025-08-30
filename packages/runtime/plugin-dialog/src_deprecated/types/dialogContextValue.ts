import { WorkingCopyState } from '~/types/workingCopyState';

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
