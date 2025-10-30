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

// Hooks
export { useDialogUrlSync } from './hooks/useDialogUrlSync.js';
export type { DialogMapState, DialogModeState } from './hooks/useDialogUrlSync.js';

// Utils
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
