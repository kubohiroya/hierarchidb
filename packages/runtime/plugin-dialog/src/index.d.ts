/**
 * @packageDocumentation
 * Runtime plugin base-dialog components for HierarchiDB
 *
 * This package provides base-dialog components specifically designed for
 * plugin runtime operations, including creation, editing, and management
 * of plugin-based entities.
 */
export declare function dummy(): void;
/**
 * Runtime Plugin Dialog
 * Provides plugin dialog system with React Router integration
 */
export { PluginStepRegistry } from './registry/PluginStepRegistry.js';
export type { PluginStepProvider, PluginStepConfig, StepComponentProps, } from './registry/PluginStepRegistry.js';
export { HostProfileRegistry } from './registry/HostProfileRegistry.js';
export { composeStepConfigs } from './services/StepComposer.js';
export { PluginDialogShell } from './headless/PluginDialogShell.js';
export type { PluginDialogShellProps } from './headless/PluginDialogShell.js';
export type { PluginDialogFooterOptions, } from './headless/usePluginDialogController.js';
export type { PluginDialogFooterPrimaryButtonOptions, } from './headless/components/PluginDialogFooter.js';
export { PluginDialogRoute, createPluginDialogRoutes } from './components/PluginDialogRoute.js';
export { BasicInfoStep } from './components/steps/BasicInfoStep.js';
export type { BasicInfoStepProps, BasicInfoData } from './components/steps/BasicInfoStep.js';
export { useWorkingCopy } from './hooks/useWorkingCopy.js';
export type { UseWorkingCopyOptions, UseWorkingCopyResult, WorkingCopyData, } from './hooks/useWorkingCopy.js';
export { useDialogUrlSync } from './hooks/useDialogUrlSync.js';
export type { DialogMapState, DialogModeState } from './hooks/useDialogUrlSync.js';
export { getWorkerBridge } from './services/WorkerBridge.js';
export type { WorkerBridge } from './services/WorkerBridge.js';
//# sourceMappingURL=index.d.ts.map