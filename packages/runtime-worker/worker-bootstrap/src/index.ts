/**
 * @hierarchidb/runtime-worker-worker-init-notifier
 *
 * Worker initialization notification system for reliable Worker-UI communication
 */

// Core types
export * from './types.js';

// UI-side channel
export { WorkerInitializationChannel } from './WorkerInitializationChannel.js';

// Worker-side reporter
export { WorkerInitializationReporter } from './WorkerInitializationReporter.js';

// React components
export { WorkerSingletonProvider, useWorker } from './provider/WorkerSingletonProvider.js';

// UI: App-provided Worker client hook registration (shared for plugins)
export { registerWorkerClientHook, getWorkerClientHook } from './ui/workerClientHook.js';
export type { WorkerClientHook } from './ui/workerClientHook.js';

// Wiring utilities (plugin capability bootstrap)
export { wirePluginsFromModules } from './wiring/wirePlugins.js';
export { getRuntimeExports, getAllRuntimeExports, registerRuntimeExports } from './wiring/runtime-export-registry.js';


// Re-export types for convenience
export type {
  WorkerInitMessageType,
  WorkerInitRequest,
  WorkerInitMessage,
  WorkerInitConfig,
  InitializationStep,
  WorkerInitState,
  InitializationResult,
} from './types.js';
