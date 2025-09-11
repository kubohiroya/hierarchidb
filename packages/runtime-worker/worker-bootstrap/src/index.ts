/**
 * @hierarchidb/runtime-worker-worker-init-notifier
 *
 * Worker initialization notification system for reliable Worker-UI communication
 */

// Core types
export * from './types';

// UI-side channel
export { WorkerInitializationChannel } from './WorkerInitializationChannel';

// Worker-side reporter
export { WorkerInitializationReporter } from './WorkerInitializationReporter';

// React components
export { WorkerSingletonProvider, useWorker } from './provider/WorkerSingletonProvider';

// UI: App-provided Worker client hook registration (shared for plugins)
export { registerWorkerClientHook, getWorkerClientHook } from './ui/workerClientHook';
export type { WorkerClientHook } from './ui/workerClientHook';

// Wiring utilities (plugin capability bootstrap)
export { wirePluginsFromModules } from './wiring/wirePlugins';


// Re-export types for convenience
export type {
  WorkerInitMessageType,
  WorkerInitRequest,
  WorkerInitMessage,
  WorkerInitConfig,
  InitializationStep,
  WorkerInitState,
  InitializationResult,
} from './types';
