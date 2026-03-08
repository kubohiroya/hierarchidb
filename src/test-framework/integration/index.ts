/**
 * Integration Module
 * 
 * Exports for integrated test framework components and utilities.
 */

export { IntegratedTestFramework } from './IntegratedTestFramework.js';
export { UnconditionalEventStreamerAdapter } from './UnconditionalEventStreamerAdapter.js';

export type {
  IntegratedTestFrameworkConfig,
  IntegratedTestFrameworkDependencies,
  TestFrameworkComponents,
  TestManagerConfig,
  SessionControllerConfig,
  EventCaptureConfig,
  ValidationManagerConfig,
  PerformanceThresholds,
  ErrorHandlingConfig,
  EventBufferingConfig,
  UnconditionalEventStreamerInterface,
  BuildSessionRuntimeInterface,
  SharedWorkerManagerInterface,
  UIStateManagerInterface,
  PerformanceMonitorInterface
} from '../types/IntegrationTypes.js';