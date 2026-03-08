/**
 * Integrated Test Framework
 * 
 * Provides integrated 4-layer architecture with UnconditionalEventStreamer integration
 * for comprehensive build session testing.
 */

import { TestManagerImpl } from '../core/TestManagerImpl.js';
import { SessionControllerImpl } from '../core/SessionControllerImpl.js';
import { EventCaptureImpl } from '../core/EventCaptureImpl.js';
import { ValidationManagerImpl } from '../core/ValidationManagerImpl.js';
import { ErrorHandlerImpl } from '../core/ErrorHandlerImpl.js';
import { EventBufferImpl } from '../core/EventBufferImpl.js';

import type {
  TestManager,
  SessionController,
  EventCapture,
  ValidationManager,
  ErrorHandler,
  EventBuffer
} from '../types/index.js';

import type {
  IntegratedTestFrameworkConfig,
  IntegratedTestFrameworkDependencies,
  TestFrameworkComponents
} from '../types/IntegrationTypes.js';

/**
 * Integrated Test Framework
 * 
 * Orchestrates the 4-layer architecture components with proper dependency injection
 * and UnconditionalEventStreamer integration.
 */
export class IntegratedTestFramework {
  private readonly components: TestFrameworkComponents;
  private readonly config: IntegratedTestFrameworkConfig;
  private readonly dependencies: IntegratedTestFrameworkDependencies;

  constructor(
    config: IntegratedTestFrameworkConfig,
    dependencies: IntegratedTestFrameworkDependencies
  ) {
    this.config = config;
    this.dependencies = dependencies;
    this.components = this.initializeComponents();
  }

  /**
   * Initialize all framework components with proper dependency injection
   */
  private initializeComponents(): TestFrameworkComponents {
    // Initialize core infrastructure components
    const errorHandler: ErrorHandler = new ErrorHandlerImpl(this.config.errorHandling);
    const eventBuffer: EventBuffer = new EventBufferImpl(this.config.eventBuffering);

    // Initialize 4-layer architecture components
    const eventCapture: EventCapture = new EventCaptureImpl(
      this.dependencies.unconditionalEventStreamer,
      eventBuffer,
      errorHandler,
      this.config.eventCapture
    );

    const sessionController: SessionController = new SessionControllerImpl(
      this.dependencies.buildSessionRuntime,
      this.dependencies.sharedWorkerManager,
      errorHandler,
      this.config.sessionController
    );

    const validationManager: ValidationManager = new ValidationManagerImpl(
      this.dependencies.uiStateManager,
      this.dependencies.performanceMonitor,
      errorHandler,
      this.config.validationManager
    );

    const testManager: TestManager = new TestManagerImpl(
      sessionController,
      eventCapture,
      validationManager,
      errorHandler,
      this.config.testManager
    );

    return {
      testManager,
      sessionController,
      eventCapture,
      validationManager,
      errorHandler,
      eventBuffer
    };
  }

  /**
   * Get the main test manager for test execution
   */
  public getTestManager(): TestManager {
    return this.components.testManager;
  }

  /**
   * Get individual components for advanced usage
   */
  public getComponents(): TestFrameworkComponents {
    return { ...this.components };
  }

  /**
   * Initialize framework with default configuration
   */
  public static createDefault(
    dependencies: IntegratedTestFrameworkDependencies
  ): IntegratedTestFramework {
    const defaultConfig: IntegratedTestFrameworkConfig = {
      testManager: {
        defaultTimeout: 30000,
        maxConcurrentTests: 5,
        retryAttempts: 3
      },
      sessionController: {
        sessionTimeout: 60000,
        heartbeatInterval: 5000,
        maxConcurrentSessions: 10
      },
      eventCapture: {
        captureTimeout: 10000,
        maxEventsPerCapture: 10000,
        sequenceValidationEnabled: true
      },
      validationManager: {
        validationTimeout: 5000,
        performanceThresholds: {
          maxMemoryUsageMB: 512,
          maxEventDeliveryLatencyMs: 100,
          maxUIUpdateResponseTimeMs: 50
        }
      },
      errorHandling: {
        maxRetryAttempts: 3,
        retryDelayMs: 1000,
        enableDetailedLogging: true
      },
      eventBuffering: {
        maxBufferSize: 10000,
        flushIntervalMs: 100,
        enableSequenceNumbers: true
      }
    };

    return new IntegratedTestFramework(defaultConfig, dependencies);
  }

  /**
   * Shutdown framework and cleanup resources
   */
  public async shutdown(): Promise<void> {
    // Cleanup components in reverse dependency order
    await this.components.eventCapture.cleanup?.();
    await this.components.sessionController.cleanup?.();
    await this.components.validationManager.cleanup?.();
    await this.components.testManager.cleanup?.();
  }
}