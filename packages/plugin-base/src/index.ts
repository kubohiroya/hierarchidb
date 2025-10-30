// Registry exports
export { PluginStepRegistry } from './registry/PluginStepRegistry.js';
export type {
  PluginStepConfig,
  PluginStepProvider,
  StepComponentProps,
} from './registry/PluginStepRegistry.js';
export { HostProfileRegistry } from './registry/HostProfileRegistry.js';

// Services
export { composeStepConfigs } from './services/StepComposer.js';
export { getWorkerBridge } from './services/WorkerBridge.js';
export type { WorkerBridge } from './services/WorkerBridge.js';

// Hooks
export { useWorkingCopy } from './hooks/useWorkingCopy.js';
export type { UseWorkingCopyResult, UseWorkingCopyOptions } from './hooks/useWorkingCopy.js';
export { useDialogWorkingCopy } from './hooks/useDialogWorkingCopy.js';
export type {
  UseDialogWorkingCopyOptions,
  UseDialogWorkingCopyResult,
  WorkingCopyData,
} from './hooks/useDialogWorkingCopy.js';
export { useDialogUrlSync } from './hooks/useDialogUrlSync.js';
export type { DialogMapState, DialogModeState } from './hooks/useDialogUrlSync.js';
export { useStepCapabilities } from './hooks/useStepCapabilities.js';
export type { StepCapabilitiesState } from './services/WorkingCopyService.js';
export type { UseStepCapabilitiesResult } from './hooks/useStepCapabilities.js';
export { useWorkerAPI } from './hooks/useWorkerAPI.js';

// Utils
export { resetPluginPresentationCache, getPresentation, getIconComponent, prefetchAllIcons } from './utils/pluginPresentation.js';
export {
  getPeerDisplayMode,
  setPeerDisplayMode,
  getPeerDialogPosition,
  setPeerDialogPosition,
  getPeerDialogSize,
  setPeerDialogSize,
} from './utils/peerDialogPersistence.js';
export type { PeerDisplayMode } from './utils/peerDialogPersistence.js';

// Re-export atoms for advanced consumers (mainly host integration/tests)
export * from './atoms/workingCopyAtoms.js';
