/**
 * @fileoverview UI Dialog package exports
 */

// Components
export { StepperDialog } from './components/StepperDialog';
export { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
export { CommonPluginDialog } from './components/CommonPluginDialog';
export { CommonDialogTitle } from './components/CommonDialogTitle';
export { CommonDialogActions } from './components/CommonDialogActions';

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