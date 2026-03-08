/**
 * Integration Types
 * 
 * Type definitions for integrated test framework components and configuration.
 */

import type {
  TestManager,
  SessionController,
  EventCapture,
  ValidationManager,
  ErrorHandler,
  EventBuffer
} from './index.js';

/**
 * External dependencies required by the integrated test framework
 */
export interface IntegratedTestFrameworkDependencies {
  /** UnconditionalEventStreamer instance for Worker-UI communication */
  unconditionalEventStreamer: UnconditionalEventStreamerInterface;
  
  /** Build session runtime for session management */
  buildSessionRuntime: BuildSessionRuntimeInterface;
  
  /** SharedWorker manager for worker coordination */
  sharedWorkerManager: SharedWorkerManagerInterface;
  
  /** UI state manager for UI validation */
  uiStateManager: UIStateManagerInterface;
  
  /** Performance monitor for performance validation */
  performanceMonitor: PerformanceMonitorInterface;
}

/**
 * All framework components grouped together
 */
export interface TestFrameworkComponents {
  testManager: TestManager;
  sessionController: SessionController;
  eventCapture: EventCapture;
  validationManager: ValidationManager;
  errorHandler: ErrorHandler;
  eventBuffer: EventBuffer;
}

/**
 * Integrated test framework configuration
 */
export interface IntegratedTestFrameworkConfig {
  testManager: TestManagerConfig;
  sessionController: SessionControllerConfig;
  eventCapture: EventCaptureConfig;
  validationManager: ValidationManagerConfig;
  errorHandling: ErrorHandlingConfig;
  eventBuffering: EventBufferingConfig;
}

/**
 * Test manager configuration
 */
export interface TestManagerConfig {
  defaultTimeout: number;
  maxConcurrentTests: number;
  retryAttempts: number;
}

/**
 * Session controller configuration
 */
export interface SessionControllerConfig {
  sessionTimeout: number;
  heartbeatInterval: number;
  maxConcurrentSessions: number;
}

/**
 * Event capture configuration
 */
export interface EventCaptureConfig {
  captureTimeout: number;
  maxEventsPerCapture: number;
  sequenceValidationEnabled: boolean;
}

/**
 * Validation manager configuration
 */
export interface ValidationManagerConfig {
  validationTimeout: number;
  performanceThresholds: PerformanceThresholds;
}

/**
 * Performance thresholds for validation
 */
export interface PerformanceThresholds {
  maxMemoryUsageMB: number;
  maxEventDeliveryLatencyMs: number;
  maxUIUpdateResponseTimeMs: number;
}

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  maxRetryAttempts: number;
  retryDelayMs: number;
  enableDetailedLogging: boolean;
}

/**
 * Event buffering configuration
 */
export interface EventBufferingConfig {
  maxBufferSize: number;
  flushIntervalMs: number;
  enableSequenceNumbers: boolean;
}

// External interface definitions (to be implemented by existing system components)

/**
 * UnconditionalEventStreamer interface for Worker-UI communication
 */
export interface UnconditionalEventStreamerInterface {
  subscribe(eventType: string, callback: (event: unknown) => void): () => void;
  emit(eventType: string, payload: unknown): void;
  getSubscriberCount(eventType: string): number;
}

/**
 * Build session runtime interface for session management
 */
export interface BuildSessionRuntimeInterface {
  createSession(nodeId: string, metadata: unknown): Promise<string>;
  resetSession(nodeId: string): Promise<void>;
  clearCache(nodeId: string, stage?: string): Promise<void>;
  getSessionState(sessionId: string): Promise<unknown>;
  pauseSession(sessionId: string): Promise<void>;
  resumeSession(sessionId: string): Promise<void>;
  cancelSession(sessionId: string): Promise<void>;
}

/**
 * SharedWorker manager interface for worker coordination
 */
export interface SharedWorkerManagerInterface {
  getWorker(nodeId: string): Promise<Worker>;
  terminateWorker(nodeId: string): Promise<void>;
  getWorkerStatus(nodeId: string): Promise<string>;
}

/**
 * UI state manager interface for UI validation
 */
export interface UIStateManagerInterface {
  getUIState(nodeId: string): Promise<unknown>;
  validateUIState(nodeId: string, expectedState: unknown): Promise<boolean>;
  captureUISnapshot(nodeId: string): Promise<unknown>;
}

/**
 * Performance monitor interface for performance validation
 */
export interface PerformanceMonitorInterface {
  startMonitoring(sessionId: string): void;
  stopMonitoring(sessionId: string): Promise<unknown>;
  getMetrics(sessionId: string): Promise<unknown>;
  validatePerformance(metrics: unknown, thresholds: unknown): boolean;
}