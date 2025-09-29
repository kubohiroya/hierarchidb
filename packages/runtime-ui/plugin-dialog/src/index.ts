/**
 * @packageDocumentation
 * Runtime plugin base-dialog components for HierarchiDB
 *
 * This package provides base-dialog components specifically designed for
 * plugin runtime operations, including creation, editing, and management
 * of plugin-based entities.
 */
export function dummy() {
}

/**
 * Runtime Plugin Dialog
 * Provides plugin dialog system with React Router integration
 */

// Registry
export { PluginStepRegistry } from './registry/PluginStepRegistry.js';
export type {
  PluginStepProvider,
  PluginStepConfig,
  StepComponentProps,
} from './registry/PluginStepRegistry.js';
export { HostProfileRegistry } from './registry/HostProfileRegistry.js';
export { composeStepConfigs } from './services/StepComposer.js';

// Components (headless shell)
export { PluginDialogShell } from './headless/PluginDialogShell.js';
export type { PluginDialogShellProps } from './headless/PluginDialogShell.js';
export type { PluginDialogFooterOptions } from './headless/usePluginDialogController.js';
export type { PluginDialogFooterPrimaryButtonOptions } from './headless/components/PluginDialogFooter.js';

// Legacy exports retained temporarily (will be removed after migration)
export { PluginDialogRoute, createPluginDialogRoutes } from './components/PluginDialogRoute.js';

export { BasicInfoStep } from './components/steps/BasicInfoStep.js';
export type { BasicInfoStepProps, BasicInfoData } from './components/steps/BasicInfoStep.js';

// Hooks
export { useWorkingCopy } from './hooks/useWorkingCopy.js';
export type {
  UseWorkingCopyOptions,
  UseWorkingCopyResult,
  WorkingCopyData,
} from './hooks/useWorkingCopy.js';

// URL synchronization hook (lightweight)
export { useDialogUrlSync } from './hooks/useDialogUrlSync.js';
export type { DialogMapState, DialogModeState } from './hooks/useDialogUrlSync.js';

// Services
export { WorkerBridge, getWorkerBridge } from './services/WorkerBridge.js';
