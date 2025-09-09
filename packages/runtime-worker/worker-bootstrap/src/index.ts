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
