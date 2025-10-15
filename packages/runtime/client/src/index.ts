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

// UI: App-provided Worker client hook registration (shared for plugin-loader)
export { registerWorkerClientHook, getWorkerClientHook } from './ui/workerClientHook.js';
export type { WorkerClientHook, WorkerClientRef } from './ui/workerClientHook.js';

// Wiring utilities (plugin capability bootstrap)
export { wirePluginsFromModules } from './wiring/wirePlugins.js';
export { getRuntimeExports, getAllRuntimeExports, registerRuntimeExports } from './wiring/runtime-export-registry.js';

// Event bridging helpers (UI ↔ runtime worker ↔ stage worker)
export {
  createComlinkEventBridge,
} from './events/comlinkEventBridge.js';
export type {
  ComlinkEventBridge,
  ComlinkEventBridgeOptions,
  EventListener,
  EventTransformer,
  PhaseEvent,
  PhaseEventMap,
  RemoteEventListener,
} from './events/comlinkEventBridge.js';

// Command bridging helpers (UI ↔ runtime ↔ stage workers)
export {
  createComlinkCommandBridge,
} from './events/comlinkCommandBridge.js';
export type {
  ComlinkCommandBridge,
  CommandInvoker,
  CommandMap,
  CommandTransformerOptions,
  RemoteCommandInvoker,
} from './events/comlinkCommandBridge.js';


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
