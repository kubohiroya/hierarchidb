/**
 * @file useDialogContext.tsx
 * @description Context for sharing dialog state between components
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { NodeId } from '@hierarchidb/common-core';

export interface DialogContextData<T = any> {
  /**
   * Dialog mode
   */
  mode: 'create' | 'edit';
  
  /**
   * Node ID (for edit mode)
   */
  nodeId?: NodeId;
  
  /**
   * Parent node ID (for create mode)
   */
  parentNodeId?: NodeId;
  
  /**
   * Current form data
   */
  formData?: T;
  
  /**
   * Update form data
   */
  updateFormData: (data: T) => void;
  
  /**
   * Whether there are unsaved changes
   */
  hasUnsavedChanges: boolean;
  
  /**
   * Whether submit is in progress
   */
  isSubmitting: boolean;
}

const DialogContext = createContext<DialogContextData | null>(null);

/**
 * Dialog context provider
 */
export const DialogProvider = <T extends any>({
  children,
  value,
}: {
  children: ReactNode;
  value: DialogContextData<T>;
}) => {
  return (
    <DialogContext.Provider value={value}>
      {children}
    </DialogContext.Provider>
  );
};

/**
 * Hook to use dialog context
 */
export const useDialogContext = <T extends any>(): DialogContextData<T> => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialogContext must be used within DialogProvider');
  }
  return context as DialogContextData<T>;
};

export default useDialogContext;