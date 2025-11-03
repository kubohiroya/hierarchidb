/**
 * @hierarchidb/runtime-worker-worker-init-notifier
 *
 * Worker initialization notification system for reliable Worker-UI communication
 */

export type {
  ComlinkCommandBridge,
  CommandInvoker,
  CommandMap,
  CommandTransformerOptions,
  RemoteCommandInvoker,
} from './events/comlinkCommandBridge.js';
// Command bridging helpers (UI ↔ runtime ↔ stage workers)
export { createComlinkCommandBridge } from './events/comlinkCommandBridge.js';
export type {
  ComlinkEventBridge,
  ComlinkEventBridgeOptions,
  EventListener,
  EventTransformer,
  PhaseEvent,
  PhaseEventMap,
  RemoteEventListener,
} from './events/comlinkEventBridge.js';
// Event bridging helpers (UI ↔ runtime worker ↔ stage worker)
export { createComlinkEventBridge } from './events/comlinkEventBridge.js';
// React components
export { useWorker, WorkerSingletonProvider } from './provider/WorkerSingletonProvider.js';
// Re-export types for convenience
export type {
  InitializationResult,
  InitializationStep,
  WorkerInitConfig,
  WorkerInitMessage,
  WorkerInitMessageType,
  WorkerInitRequest,
  WorkerInitState,
} from './types.js';
// Core types
export * from './types.js';
export type { WorkerClientHook, WorkerClientRef } from './ui/workerClientHook.js';
// UI: App-provided Worker client hook registration (shared for plugin-loader)
export { getWorkerClientHook, registerWorkerClientHook } from './ui/workerClientHook.js';
// UI-side channel
export { WorkerInitializationChannel } from './WorkerInitializationChannel.js';
// Worker-side reporter
export { WorkerInitializationReporter } from './WorkerInitializationReporter.js';
export {
  getAllRuntimeExports,
  getRuntimeExports,
  registerRuntimeExports,
} from './wiring/runtime-export-registry.js';
// Wiring utilities (plugin capability bootstrap)
export { wirePluginsFromModules } from './wiring/wirePlugins.js';
