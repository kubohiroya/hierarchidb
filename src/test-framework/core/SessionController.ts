// SessionController - Build session generation, control, and monitoring layer

import type {
  NodeId,
  SessionId,
  SessionHandle,
  BuildMetadata,
  BuildStage,
  SessionState,
  SessionResult
} from '../types/SessionTypes.js';

/**
 * SessionController - Build session lifecycle management
 * 
 * Provides comprehensive control over build session creation, state management,
 * and monitoring. Integrates with existing build session infrastructure to
 * enable controlled testing scenarios.
 */
export interface SessionController {
  // Session lifecycle management
  createNewSession(nodeId: NodeId, metadata: BuildMetadata): Promise<SessionHandle>;
  resetSession(nodeId: NodeId): Promise<void>;
  clearCache(nodeId: NodeId, stage?: BuildStage): Promise<void>;
  
  // Session state control
  pauseSession(sessionId: SessionId): Promise<void>;
  resumeSession(sessionId: SessionId): Promise<void>;
  cancelSession(sessionId: SessionId): Promise<void>;
  
  // Session monitoring
  getSessionState(sessionId: SessionId): Promise<SessionState>;
  waitForSessionCompletion(sessionId: SessionId, timeout?: number): Promise<SessionResult>;
  
  // Session query and management
  listActiveSessions(): Promise<SessionHandle[]>;
  getSessionHistory(nodeId: NodeId, limit?: number): Promise<SessionResult[]>;
  
  // Session validation
  validateSessionState(sessionId: SessionId): Promise<SessionValidationResult>;
  
  // Cleanup and resource management
  cleanupCompletedSessions(): Promise<void>;
  forceCleanupSession(sessionId: SessionId): Promise<void>;
}

export interface SessionValidationResult {
  isValid: boolean;
  issues: SessionIssue[];
  recommendations: string[];
}

export interface SessionIssue {
  severity: 'warning' | 'error' | 'critical';
  code: string;
  message: string;
  context?: Record<string, unknown>;
}