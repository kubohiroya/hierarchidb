// Validation-related type definitions

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: Record<string, unknown>;
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, unknown>;
}

export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
  context?: Record<string, unknown>;
}

export interface ExpectedUIState {
  emptyStateContent?: string;
  taskCount?: number;
  progressValues?: Record<string, number>;
  displayStatus?: 'running' | 'paused' | 'completed' | 'error';
}

export interface ExpectedProgress {
  taskId: TaskId;
  expectedValue: number;
  tolerance?: number;
  timestamp?: number;
}

export interface ExpectedSessionState {
  sessionId: SessionId;
  status: SessionStatus;
  currentStage: BuildStage;
  taskCount?: number;
  completedTasks?: number;
}

export interface ExpectedTask {
  taskId: TaskId;
  name: string;
  stage: BuildStage;
  status: TaskStatus;
  progress?: number;
}

import type { TaskId, SessionId, SessionStatus, BuildStage, TaskStatus } from './SessionTypes.js';