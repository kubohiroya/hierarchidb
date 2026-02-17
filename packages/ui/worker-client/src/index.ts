// Public API for UI worker client utilities (non-React)
export type {
  ComlinkCommandBridge,
  CommandInvoker,
  CommandMap,
  CommandTransformerOptions,
  RemoteCommandInvoker,
} from './events/comlinkCommandBridge.js';
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
export { createComlinkEventBridge } from './events/comlinkEventBridge.js';
export type {
  InitializationResult,
  InitializationStep,
  WorkerInitConfig,
  WorkerInitMessage,
  WorkerInitMessageType,
  WorkerInitRequest,
  WorkerInitState,
} from './types.js';
export * from './types.js';
export * from './utils.js';
export { WorkerInitializationChannel } from './WorkerInitializationChannel.js';
export { WorkerInitializationReporter } from './WorkerInitializationReporter.js';
export {
  getAllRuntimeExports,
  getRuntimeExports,
  registerRuntimeExports,
} from './wiring/runtime-export-registry.js';
export { wirePluginsFromModules } from './wiring/wirePlugins.js';
export type { BuildWorkerBridge } from './workerBridge.js';
export {
  __getWorkerBridgeClientRef,
  __setWorkerBridgeClientRef,
  ensureWorkerAPI,
  getBuildWorkerBridge,
} from './workerBridge.js';
