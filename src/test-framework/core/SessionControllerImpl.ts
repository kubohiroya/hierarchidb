// SessionControllerImpl - Concrete implementation of SessionController interface

import type {
  SessionController,
  SessionValidationResult,
  SessionIssue
} from './SessionController.js';
import type {
  NodeId,
  SessionId,
  SessionHandle,
  BuildMetadata,
  BuildStage,
  SessionState,
  SessionResult,
  TaskProgress,
  TaskResult
} from '../types/SessionTypes.js';

/**
 * SessionControllerImpl - Concrete implementation of build session lifecycle management
 * 
 * Provides comprehensive control over build session creation, state management,
 * and monitoring. Integrates with existing build session infrastructure to
 * enable controlled testing scenarios.
 * 
 * Key features:
 * - Session lifecycle management (create, reset, cache clearing)
 * - Session state control (pause, resume, cancel)
 * - Session monitoring and validation
 * - Resource cleanup and management
 * - Contract violation immediate error handling
 */
export class SessionControllerImpl implements SessionController {
  private readonly activeSessions = new Map<SessionId, SessionState>();
  private readonly sessionHistory = new Map<NodeId, SessionResult[]>();
  private readonly sessionHandles = new Map<SessionId, SessionHandle>();
  private sessionIdCounter = 0;

  /**
   * Create a new build session with specified metadata
   * Contract: nodeId must be non-empty string, metadata must be valid
   */
  async createNewSession(nodeId: NodeId, metadata: BuildMetadata): Promise<SessionHandle> {
    // Contract validation - immediate error on violation
    if (!nodeId || typeof nodeId !== 'string' || nodeId.trim() === '') {
      throw new Error('Contract violation: nodeId must be non-empty string');
    }
    
    if (!metadata || typeof metadata !== 'object') {
      throw new Error('Contract violation: metadata must be valid BuildMetadata object');
    }

    if (metadata.nodeId !== nodeId) {
      throw new Error('Contract violation: metadata.nodeId must match provided nodeId');
    }

    if (!metadata.buildType || !['new', 'reset', 'cache-cleared'].includes(metadata.buildType)) {
      throw new Error('Contract violation: metadata.buildType must be "new", "reset", or "cache-cleared"');
    }

    if (!Array.isArray(metadata.stages) || metadata.stages.length === 0) {
      throw new Error('Contract violation: metadata.stages must be non-empty array');
    }

    // Generate unique session ID
    const sessionId = `session_${nodeId}_${++this.sessionIdCounter}_${Date.now()}`;
    const createdAt = Date.now();

    // Create session handle
    const handle: SessionHandle = {
      sessionId,
      nodeId,
      createdAt
    };

    // Initialize session state
    const sessionState: SessionState = {
      sessionId,
      nodeId,
      status: 'idle',
      currentStage: metadata.stages[0],
      taskProgress: {},
      startTime: createdAt,
      lastUpdateTime: createdAt
    };

    // Store session data
    this.sessionHandles.set(sessionId, handle);
    this.activeSessions.set(sessionId, sessionState);

    return handle;
  }

  /**
   * Reset existing session for specified node
   * Contract: nodeId must exist and be valid
   */
  async resetSession(nodeId: NodeId): Promise<void> {
    // Contract validation
    if (!nodeId || typeof nodeId !== 'string' || nodeId.trim() === '') {
      throw new Error('Contract violation: nodeId must be non-empty string');
    }

    // Find active session for node
    const activeSession = Array.from(this.activeSessions.values())
      .find(session => session.nodeId === nodeId);

    if (!activeSession) {
      throw new Error(`No active session found for nodeId: ${nodeId}`);
    }

    // Reset session state
    const resetTime = Date.now();
    activeSession.status = 'idle';
    activeSession.taskProgress = {};
    activeSession.startTime = resetTime;
    activeSession.lastUpdateTime = resetTime;

    // Update stored state
    this.activeSessions.set(activeSession.sessionId, activeSession);
  }

  /**
   * Clear cache for specified node and optional stage
   * Contract: nodeId must be valid, stage must be valid if provided
   */
  async clearCache(nodeId: NodeId, stage?: BuildStage): Promise<void> {
    // Contract validation
    if (!nodeId || typeof nodeId !== 'string' || nodeId.trim() === '') {
      throw new Error('Contract violation: nodeId must be non-empty string');
    }

    if (stage !== undefined) {
      const validStages: BuildStage[] = [
        'initialization', 'metadata-generation', 'task-creation',
        'parallel-execution', 'aggregation', 'completion'
      ];
      if (!validStages.includes(stage)) {
        throw new Error(`Contract violation: invalid stage "${stage}"`);
      }
    }

    // Find active session for node
    const activeSession = Array.from(this.activeSessions.values())
      .find(session => session.nodeId === nodeId);

    if (!activeSession) {
      throw new Error(`No active session found for nodeId: ${nodeId}`);
    }

    // Clear cache logic - cascade deletion for later stages
    if (stage) {
      const validStages: BuildStage[] = [
        'initialization', 'metadata-generation', 'task-creation',
        'parallel-execution', 'aggregation', 'completion'
      ];
      const stageIndex = validStages.indexOf(stage);
      
      // Clear current stage and all subsequent stages (cascade deletion)
      const stagesToClear = validStages.slice(stageIndex);
      
      // Remove task progress for affected stages
      for (const [taskId, _progress] of Object.entries(activeSession.taskProgress)) {
        // Simplified stage detection - in real implementation would need proper stage mapping
        if (stagesToClear.some(s => taskId.includes(s))) {
          delete activeSession.taskProgress[taskId];
        }
      }
    } else {
      // Clear all cache
      activeSession.taskProgress = {};
    }

    activeSession.lastUpdateTime = Date.now();
    this.activeSessions.set(activeSession.sessionId, activeSession);
  }
  /**
   * Pause active session
   * Contract: sessionId must exist and be in running state
   */
  async pauseSession(sessionId: SessionId): Promise<void> {
    // Contract validation
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('Contract violation: sessionId must be non-empty string');
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'running') {
      throw new Error(`Cannot pause session in ${session.status} state. Only running sessions can be paused.`);
    }

    session.status = 'paused';
    session.lastUpdateTime = Date.now();
    this.activeSessions.set(sessionId, session);
  }

  /**
   * Resume paused session
   * Contract: sessionId must exist and be in paused state
   */
  async resumeSession(sessionId: SessionId): Promise<void> {
    // Contract validation
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('Contract violation: sessionId must be non-empty string');
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'paused') {
      throw new Error(`Cannot resume session in ${session.status} state. Only paused sessions can be resumed.`);
    }

    session.status = 'running';
    session.lastUpdateTime = Date.now();
    this.activeSessions.set(sessionId, session);
  }

  /**
   * Cancel active session
   * Contract: sessionId must exist and be in active state (running or paused)
   */
  async cancelSession(sessionId: SessionId): Promise<void> {
    // Contract validation
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('Contract violation: sessionId must be non-empty string');
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!['running', 'paused'].includes(session.status)) {
      throw new Error(`Cannot cancel session in ${session.status} state. Only running or paused sessions can be cancelled.`);
    }

    // Move to history before removing from active sessions
    const completedAt = Date.now();
    const sessionResult: SessionResult = {
      sessionId,
      status: 'error', // Cancelled sessions are marked as error
      completedAt,
      duration: completedAt - session.startTime,
      taskResults: this.convertTaskProgressToResults(session.taskProgress),
      error: 'Session cancelled by user'
    };

    this.addToHistory(session.nodeId, sessionResult);
    this.activeSessions.delete(sessionId);
    this.sessionHandles.delete(sessionId);
  }

  /**
   * Get current session state
   * Contract: sessionId must exist
   */
  async getSessionState(sessionId: SessionId): Promise<SessionState> {
    // Contract validation
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('Contract violation: sessionId must be non-empty string');
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Return deep copy to prevent external mutation
    return {
      ...session,
      taskProgress: { ...session.taskProgress }
    };
  }

  /**
   * Wait for session completion with optional timeout
   * Contract: sessionId must exist, timeout must be positive if provided
   */
  async waitForSessionCompletion(sessionId: SessionId, timeout?: number): Promise<SessionResult> {
    // Contract validation
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('Contract violation: sessionId must be non-empty string');
    }

    if (timeout !== undefined) {
      if (!Number.isFinite(timeout) || timeout <= 0) {
        throw new Error('Contract violation: timeout must be positive finite number');
      }
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // If session is already completed, return result from history
    if (['completed', 'error'].includes(session.status)) {
      const history = this.sessionHistory.get(session.nodeId) || [];
      const result = history.find(r => r.sessionId === sessionId);
      if (result) {
        return result;
      }
    }

    // Polling-based waiting (in real implementation would use event-based approach)
    const startTime = Date.now();
    const pollInterval = 100; // 100ms polling interval
    const maxTimeout = timeout || 30000; // Default 30 second timeout

    return new Promise((resolve, reject) => {
      const poll = () => {
        const currentSession = this.activeSessions.get(sessionId);
        
        if (!currentSession) {
          // Session was removed, check history
          const history = this.sessionHistory.get(session.nodeId) || [];
          const result = history.find(r => r.sessionId === sessionId);
          if (result) {
            resolve(result);
            return;
          }
        }

        if (currentSession && ['completed', 'error'].includes(currentSession.status)) {
          // Session completed, create result
          const completedAt = Date.now();
          const result: SessionResult = {
            sessionId,
            status: currentSession.status as 'completed' | 'error',
            completedAt,
            duration: completedAt - currentSession.startTime,
            taskResults: this.convertTaskProgressToResults(currentSession.taskProgress)
          };
          resolve(result);
          return;
        }

        // Check timeout
        if (Date.now() - startTime > maxTimeout) {
          reject(new Error(`Session completion timeout after ${maxTimeout}ms`));
          return;
        }

        // Continue polling
        setTimeout(poll, pollInterval);
      };

      poll();
    });
  }

  /**
   * List all active sessions
   */
  async listActiveSessions(): Promise<SessionHandle[]> {
    return Array.from(this.sessionHandles.values());
  }

  /**
   * Get session history for specified node
   * Contract: nodeId must be valid, limit must be positive if provided
   */
  async getSessionHistory(nodeId: NodeId, limit?: number): Promise<SessionResult[]> {
    // Contract validation
    if (!nodeId || typeof nodeId !== 'string' || nodeId.trim() === '') {
      throw new Error('Contract violation: nodeId must be non-empty string');
    }

    if (limit !== undefined) {
      if (!Number.isFinite(limit) || limit <= 0) {
        throw new Error('Contract violation: limit must be positive finite number');
      }
    }

    const history = this.sessionHistory.get(nodeId) || [];
    
    if (limit) {
      return history.slice(-limit); // Return most recent entries
    }
    
    return [...history]; // Return copy to prevent external mutation
  }

  /**
   * Validate session state consistency
   * Contract: sessionId must exist
   */
  async validateSessionState(sessionId: SessionId): Promise<SessionValidationResult> {
    // Contract validation
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('Contract violation: sessionId must be non-empty string');
    }

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const issues: SessionIssue[] = [];
    const recommendations: string[] = [];

    // Validate session state consistency
    if (session.lastUpdateTime < session.startTime) {
      issues.push({
        severity: 'error',
        code: 'INVALID_TIMESTAMPS',
        message: 'lastUpdateTime cannot be before startTime',
        context: { startTime: session.startTime, lastUpdateTime: session.lastUpdateTime }
      });
    }

    // Validate task progress values
    for (const [taskId, progress] of Object.entries(session.taskProgress)) {
      if (!Number.isFinite(progress.progress) || progress.progress < 0 || progress.progress > 100) {
        issues.push({
          severity: 'error',
          code: 'INVALID_PROGRESS_VALUE',
          message: `Task progress must be finite number between 0-100, got ${progress.progress}`,
          context: { taskId, progress: progress.progress }
        });
      }

      if (progress.completionTime && progress.startTime && progress.completionTime < progress.startTime) {
        issues.push({
          severity: 'error',
          code: 'INVALID_TASK_TIMESTAMPS',
          message: 'Task completionTime cannot be before startTime',
          context: { taskId, startTime: progress.startTime, completionTime: progress.completionTime }
        });
      }
    }

    // Generate recommendations
    if (session.status === 'running' && Object.keys(session.taskProgress).length === 0) {
      recommendations.push('Running session has no task progress - consider adding tasks or updating status');
    }

    if (Date.now() - session.lastUpdateTime > 300000) { // 5 minutes
      recommendations.push('Session has not been updated for over 5 minutes - consider checking for stale state');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Clean up completed sessions older than specified age
   */
  async cleanupCompletedSessions(): Promise<void> {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [nodeId, history] of this.sessionHistory.entries()) {
      const filteredHistory = history.filter(result => result.completedAt > cutoffTime);
      if (filteredHistory.length !== history.length) {
        this.sessionHistory.set(nodeId, filteredHistory);
      }
    }
  }

  /**
   * Force cleanup of specific session (emergency cleanup)
   * Contract: sessionId must be valid
   */
  async forceCleanupSession(sessionId: SessionId): Promise<void> {
    // Contract validation
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new Error('Contract violation: sessionId must be non-empty string');
    }

    // Remove from active sessions
    const session = this.activeSessions.get(sessionId);
    if (session) {
      // Move to history if not already there
      const completedAt = Date.now();
      const sessionResult: SessionResult = {
        sessionId,
        status: 'error',
        completedAt,
        duration: completedAt - session.startTime,
        taskResults: this.convertTaskProgressToResults(session.taskProgress),
        error: 'Session force cleaned up'
      };
      
      this.addToHistory(session.nodeId, sessionResult);
    }

    this.activeSessions.delete(sessionId);
    this.sessionHandles.delete(sessionId);
  }

  // Private helper methods

  private convertTaskProgressToResults(taskProgress: Record<string, TaskProgress>): TaskResult[] {
    return Object.entries(taskProgress).map(([taskId, progress]) => ({
      taskId,
      status: progress.status,
      duration: progress.completionTime && progress.startTime 
        ? progress.completionTime - progress.startTime 
        : 0,
      error: progress.error
    }));
  }

  private addToHistory(nodeId: NodeId, result: SessionResult): void {
    const history = this.sessionHistory.get(nodeId) || [];
    history.push(result);
    
    // Keep only last 100 results per node
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    this.sessionHistory.set(nodeId, history);
  }
}