// Registry exports

// Re-export atoms for advanced consumers (mainly host integration/tests)
export * from './atoms/draftAtoms.js';
export type { DialogMapState, DialogModeState } from './hooks/useDialogUrlSync.js';
// Hooks
export { useDialogUrlSync } from './hooks/useDialogUrlSync.js';
export { useDialogViewState } from './hooks/useDialogViewState.js';
export type { UseDialogViewStateOptions, UseDialogViewStateResult } from './hooks/useDialogViewState.js';
export { HostProfileRegistry } from './registry/HostProfileRegistry.js';
export type {
  PluginStepConfig,
  PluginStepProvider,
  StepComponentProps,
  StartBatchContext,
  StepData,
} from './registry/PluginStepRegistry.js';
export { PluginStepRegistry } from './registry/PluginStepRegistry.js';
// Services
export { composeStepConfigs } from './services/StepComposer.js';
export type { PeerDisplayMode } from './utils/peerDialogPersistence.js';
// Utils
export {
  getPeerDialogPosition,
  getPeerDialogSize,
  getPeerDisplayMode,
  setPeerDialogPosition,
  setPeerDialogSize,
  setPeerDisplayMode,
} from './utils/peerDialogPersistence.js';
