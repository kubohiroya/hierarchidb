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
export { useDialogUrlParams } from './hooks/useDialogUrlParams';
export type { UseDialogUrlParamsReturn } from './hooks/useDialogUrlParams';
export { useDialogMode } from './hooks/useDialogMode';
export type { UseDialogModeReturn, MapParams } from './hooks/useDialogMode';

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
  StepValidation,
  StepRegistration,
  StepDependency,
  RegistryOptions,
} from './services/DialogStepRegistry';
