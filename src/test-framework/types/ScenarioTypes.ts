// Test scenario type definitions

export interface Step5TestScenario {
  scenarioId: string;
  description: string;
  initialSessionState: 'none' | 'existing' | 'completed' | 'error';
  expectedUIState: ExpectedUIState;
  progressEvents?: ProgressEvent[];
}

export interface LifecycleTestScenario {
  scenarioId: string;
  description: string;
  sessionType: 'new' | 'reset' | 'cache-cleared';
  buildMetadata: BuildMetadata;
  expectedStages: BuildStage[];
  expectedTaskCount: number;
  parallelTasksPerStage: number;
}

export interface EventStreamTestScenario {
  scenarioId: string;
  description: string;
  eventTypes: NotificationType[];
  eventCount: number;
  emissionRate: number; // events per second
  subscriberCount: number;
  expectedDeliveryRate: number; // percentage
}

export interface StateSyncTestScenario {
  scenarioId: string;
  description: string;
  sessionCount: number;
  stageTransitions: StageTransition[];
  expectedSyncLatency: number; // milliseconds
}

export interface StageTransition {
  fromStage: BuildStage;
  toStage: BuildStage;
  triggerCondition: string;
  expectedDuration: number; // milliseconds
}

export interface BufferingTestScenario {
  scenarioId: string;
  description: string;
  eventRate: number; // events per second
  bufferSize: number;
  disconnectionDuration: number; // milliseconds
  expectedEventLoss: number; // percentage
}

export interface ErrorHandlingTestScenario {
  scenarioId: string;
  description: string;
  errorType: ErrorType;
  errorTrigger: string;
  expectedRecovery: boolean;
  recoveryTimeLimit: number; // milliseconds
}

export type ErrorType = 
  | 'worker-crash'
  | 'communication-timeout'
  | 'invalid-metadata'
  | 'session-timeout'
  | 'subscriber-callback-failure';

export interface PerformanceTestScenario {
  scenarioId: string;
  description: string;
  loadParameters: LoadParameters;
  performanceConstraints: PerformanceConstraints;
}

export interface LoadParameters {
  taskCount: number;
  eventRate: number; // events per second
  subscriberCount: number;
  sessionCount: number;
  duration: number; // milliseconds
}

import type { 
  ExpectedUIState
} from './ValidationTypes.js';
import type { 
  BuildMetadata, 
  BuildStage 
} from './SessionTypes.js';
import type { 
  NotificationType, 
  ProgressEvent 
} from './EventTypes.js';
import type {
  PerformanceConstraints
} from './PerformanceTypes.js';