/**
 * @fileoverview UI Dialog package exports
 *
 * This package provides generic, reusable dialog components.
 * Plugin-specific components are located in @hierarchidb/runtime-plugin-dialog
 */

// Generic dialog components

// Hooks
export { useWorkingCopy } from './hooks/useWorkingCopy';
export { useDialogContext, DialogProvider } from './hooks/useDialogContext';
export { useDialogUrlParams } from './hooks/useDialogUrlParams.ts.bak';
export type { UseDialogUrlParamsReturn } from './hooks/useDialogUrlParams.ts.bak';
export { useDialogMode } from './hooks/useDialogMode.ts.bak';
export type { UseDialogModeReturn, MapParams } from './hooks/useDialogMode.ts.bak';

// Providers
export { NotificationProvider } from './providers/NotificationProvider';

// Types
export * from './components';

// Utils
export {
  parseDialogUrlParams,
  dialogParamsToUrlSearchParams,
  getDialogUrlParams,
  updateDialogUrlParams,
} from './utils/dialogUrlParams';
export type { DialogUrlParams } from './utils/dialogUrlParams';

// Services
export { DialogStepRegistry } from './services/DialogStepRegistry';
export type {
  DialogStepDefinition,
  ValidationResult,
  StepRegistration,
  StepDependency,
  RegistryOptions,
} from './services/DialogStepRegistry';
