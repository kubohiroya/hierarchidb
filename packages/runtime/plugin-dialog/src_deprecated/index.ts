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

export type { CommonDialogActionsProps } from '~/types/commonDialogActionsProps';
export type { CommonDialogTitleProps } from '~/types/commonDialogTitleProps';
export type { UnsavedChangesDialogProps } from '~/types/unsavedChangesDialogProps';
export type { DialogContextValue } from '~/types/dialogContextValue';
export type { WorkingCopyState } from '~/types/workingCopyState';
export type { StepperDialogProps } from '~/types/stepperDialogProps';
export type { DialogStep } from '~/types/dialogStep';
export type { PluginDialogProps } from '~/types/pluginDialogProps';
export type { DialogMode } from '~/types/dialogMode';
export type { DialogVariant } from '~/types/dialogVariant';
export * from './dialog';

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
