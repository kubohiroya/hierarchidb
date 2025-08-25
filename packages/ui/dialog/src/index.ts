/**
 * @fileoverview UI Dialog package exports
 * 
 * This package provides generic, reusable dialog components.
 * Plugin-specific components are located in @hierarchidb/runtime-plugin-dialog
 */

// Generic dialog components
export { StepperDialog } from './components/StepperDialog';
export { FullScreenDialog } from './components/FullScreenDialog';
export { UnsavedChangesDialog } from './components/UnsavedChangesDialog';

// Hooks
export { useWorkingCopy } from './hooks/useWorkingCopy';
export { useDialogContext, DialogProvider } from './hooks/useDialogContext';

// Providers
export { NotificationProvider } from './providers/NotificationProvider';

// Types
export type { 
  StepperDialogProps, 
  StepConfiguration, 
  CustomFooterProps 
} from './components/StepperDialog';

export type { 
  UnsavedChangesDialogProps 
} from './components/UnsavedChangesDialog';

export type {
  WorkingCopyOptions,
  WorkingCopyState,
} from './hooks/useWorkingCopy';

export type {
  DialogContextData,
} from './hooks/useDialogContext';

export type {
  NotificationProviderProps,
} from './providers/NotificationProvider';

export type {
  FullScreenDialogProps,
} from './components/FullScreenDialog';