// SessionControllerImpl unit tests

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionControllerImpl } from '../SessionControllerImpl.js';
import type { BuildMetadata, BuildStage } from '../../types/SessionTypes.js';

describe('SessionControllerImpl', () => {
  let controller: SessionControllerImpl;

  beforeEach(() => {
    controller = new SessionControllerImpl();
  });

  describe('createNewSession', () => {
    it('should create new session with valid metadata', async () => {
      const nodeId = 'test-node-1';
      const metadata: BuildMetadata = {
        nodeId,
        buildType: 'new',
        stages: ['initialization', 'task-creation', 'completion'],
        metadata: { version: '1.0.0' }
      };

      const handle = await controller.createNewSession(nodeId, metadata);

      expect(handle.nodeId).toBe(nodeId);
      expect(handle.sessionId).toMatch(/^session_test-node-1_\d+_\d+$/);
      expect(handle.createdAt).toBeGreaterThan(0);
    });

    it('should reject empty nodeId', async () => {
      const metadata: BuildMetadata = {
        nodeId: '',
        buildType: 'new',
        stages: ['initialization']
      };

      await expect(controller.createNewSession('', metadata))
        .rejects.toThrow('Contract violation: nodeId must be non-empty string');
    });

    it('should reject null metadata', async () => {
      await expect(controller.createNewSession('test-node', null as any))
        .rejects.toThrow('Contract violation: metadata must be valid BuildMetadata object');
    });

    it('should reject mismatched nodeId in metadata', async () => {
      const metadata: BuildMetadata = {
        nodeId: 'different-node',
        buildType: 'new',
        stages: ['initialization']
      };

      await expect(controller.createNewSession('test-node', metadata))
        .rejects.toThrow('Contract violation: metadata.nodeId must match provided nodeId');
    });

    it('should reject invalid buildType', async () => {
      const metadata: BuildMetadata = {
        nodeId: 'test-node',
        buildType: 'invalid' as any,
        stages: ['initialization']
      };

      await expect(controller.createNewSession('test-node', metadata))
        .rejects.toThrow('Contract violation: metadata.buildType must be "new", "reset", or "cache-cleared"');
    });

    it('should reject empty stages array', async () => {
      const metadata: BuildMetadata = {
        nodeId: 'test-node',
        buildType: 'new',
        stages: []
      };

      await expect(controller.createNewSession('test-node', metadata))
        .rejects.toThrow('Contract violation: metadata.stages must be non-empty array');
    });
  });

  describe('resetSession', () => {
    it('should reset existing session', async () => {
      const nodeId = 'test-node-1';
      const metadata: BuildMetadata = {
        nodeId,
        buildType: 'new',
        stages: ['initialization', 'completion']
      };

      const handle = await controller.createNewSession(nodeId, metadata);
      
      // Simulate some progress
      const _state = await controller.getSessionState(handle.sessionId);
      expect(_state.status).toBe('idle');

      await controller.resetSession(nodeId);
      
      const resetState = await controller.getSessionState(handle.sessionId);
      expect(resetState.status).toBe('idle');
      expect(resetState.taskProgress).toEqual({});
    });

    it('should reject empty nodeId', async () => {
      await expect(controller.resetSession(''))
        .rejects.toThrow('Contract violation: nodeId must be non-empty string');
    });

    it('should reject non-existent nodeId', async () => {
      await expect(controller.resetSession('non-existent'))
        .rejects.toThrow('No active session found for nodeId: non-existent');
    });
  });

  describe('clearCache', () => {
    it('should clear all cache when no stage specified', async () => {
      const nodeId = 'test-node-1';
      const metadata: BuildMetadata = {
        nodeId,
        buildType: 'new',
        stages: ['initialization', 'completion']
      };

      const handle = await controller.createNewSession(nodeId, metadata);
      await controller.clearCache(nodeId);
      
      const state = await controller.getSessionState(handle.sessionId);
      expect(state.taskProgress).toEqual({});
    });

    it('should reject invalid stage', async () => {
      const nodeId = 'test-node-1';
      const metadata: BuildMetadata = {
        nodeId,
        buildType: 'new',
        stages: ['initialization']
      };

      await controller.createNewSession(nodeId, metadata);
      
      await expect(controller.clearCache(nodeId, 'invalid-stage' as BuildStage))
        .rejects.toThrow('Contract violation: invalid stage "invalid-stage"');
    });
  });

  describe('session state control', () => {
    let sessionId: string;

    beforeEach(async () => {
      const nodeId = 'test-node-1';
      const metadata: BuildMetadata = {
        nodeId,
        buildType: 'new',
        stages: ['initialization', 'completion']
      };

      const handle = await controller.createNewSession(nodeId, metadata);
      sessionId = handle.sessionId;
      
      // Set to running state for testing pause/resume
      const state = await controller.getSessionState(sessionId);
      state.status = 'running';
      // Note: In real implementation, would need proper state transition method
    });

    it('should pause running session', async () => {
      // First set session to running state (simplified for test)
      const _state = await controller.getSessionState(sessionId);
      // Manually set to running for test - in real implementation would have proper state transitions
      (controller as any).activeSessions.get(sessionId).status = 'running';

      await controller.pauseSession(sessionId);
      
      const pausedState = await controller.getSessionState(sessionId);
      expect(pausedState.status).toBe('paused');
    });

    it('should resume paused session', async () => {
      // Set to paused state
      (controller as any).activeSessions.get(sessionId).status = 'paused';

      await controller.resumeSession(sessionId);
      
      const resumedState = await controller.getSessionState(sessionId);
      expect(resumedState.status).toBe('running');
    });

    it('should cancel active session', async () => {
      // Set to running state
      (controller as any).activeSessions.get(sessionId).status = 'running';

      await controller.cancelSession(sessionId);
      
      // Session should be removed from active sessions
      await expect(controller.getSessionState(sessionId))
        .rejects.toThrow(`Session not found: ${sessionId}`);
    });

    it('should reject pause on non-running session', async () => {
      await expect(controller.pauseSession(sessionId))
        .rejects.toThrow('Cannot pause session in idle state. Only running sessions can be paused.');
    });

    it('should reject resume on non-paused session', async () => {
      await expect(controller.resumeSession(sessionId))
        .rejects.toThrow('Cannot resume session in idle state. Only paused sessions can be resumed.');
    });
  });

  describe('session monitoring', () => {
    it('should get session state', async () => {
      const nodeId = 'test-node-1';
      const metadata: BuildMetadata = {
        nodeId,
        buildType: 'new',
        stages: ['initialization', 'completion']
      };

      const handle = await controller.createNewSession(nodeId, metadata);
      const state = await controller.getSessionState(handle.sessionId);

      expect(state.sessionId).toBe(handle.sessionId);
      expect(state.nodeId).toBe(nodeId);
      expect(state.status).toBe('idle');
      expect(state.currentStage).toBe('initialization');
    });

    it('should list active sessions', async () => {
      const nodeId1 = 'test-node-1';
      const nodeId2 = 'test-node-2';
      const metadata1: BuildMetadata = {
        nodeId: nodeId1,
        buildType: 'new',
        stages: ['initialization']
      };
      const metadata2: BuildMetadata = {
        nodeId: nodeId2,
        buildType: 'reset',
        stages: ['completion']
      };

      const handle1 = await controller.createNewSession(nodeId1, metadata1);
      const handle2 = await controller.createNewSession(nodeId2, metadata2);

      const activeSessions = await controller.listActiveSessions();
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.map(h => h.sessionId)).toContain(handle1.sessionId);
      expect(activeSessions.map(h => h.sessionId)).toContain(handle2.sessionId);
    });

    it('should get session history', async () => {
      const nodeId = 'test-node-1';
      const metadata: BuildMetadata = {
        nodeId,
        buildType: 'new',
        stages: ['initialization']
      };

      const handle = await controller.createNewSession(nodeId, metadata);
      
      // Cancel session to add to history
      (controller as any).activeSessions.get(handle.sessionId).status = 'running';
      await controller.cancelSession(handle.sessionId);

      const history = await controller.getSessionHistory(nodeId);
      expect(history).toHaveLength(1);
      expect(history[0].sessionId).toBe(handle.sessionId);
      expect(history[0].status).toBe('error');
      expect(history[0].error).toBe('Session cancelled by user');
    });
  });

  describe('session validation', () => {
    it('should validate valid session state', async () => {
      const nodeId = 'test-node-1';
      const metadata: BuildMetadata = {
        nodeId,
        buildType: 'new',
        stages: ['initialization']
      };

      const handle = await controller.createNewSession(nodeId, metadata);
      const validation = await controller.validateSessionState(handle.sessionId);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect invalid progress values', async () => {
      const nodeId = 'test-node-1';
      const metadata: BuildMetadata = {
        nodeId,
        buildType: 'new',
        stages: ['initialization']
      };

      const handle = await controller.createNewSession(nodeId, metadata);
      
      // Manually inject invalid progress value
      const session = (controller as any).activeSessions.get(handle.sessionId);
      session.taskProgress['invalid-task'] = {
        taskId: 'invalid-task',
        status: 'running',
        progress: 150 // Invalid: > 100
      };

      const validation = await controller.validateSessionState(handle.sessionId);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toHaveLength(1);
      expect(validation.issues[0].code).toBe('INVALID_PROGRESS_VALUE');
      expect(validation.issues[0].severity).toBe('error');
    });
  });

  describe('contract violation handling', () => {
    it('should reject invalid sessionId in all methods', async () => {
      const invalidSessionIds = ['', '   ', null as any, undefined as any];

      for (const invalidId of invalidSessionIds) {
        await expect(controller.getSessionState(invalidId))
          .rejects.toThrow('Contract violation: sessionId must be non-empty string');
        
        await expect(controller.pauseSession(invalidId))
          .rejects.toThrow('Contract violation: sessionId must be non-empty string');
        
        await expect(controller.resumeSession(invalidId))
          .rejects.toThrow('Contract violation: sessionId must be non-empty string');
        
        await expect(controller.cancelSession(invalidId))
          .rejects.toThrow('Contract violation: sessionId must be non-empty string');
      }
    });

    it('should reject invalid timeout values', async () => {
      const nodeId = 'test-node-1';
      const metadata: BuildMetadata = {
        nodeId,
        buildType: 'new',
        stages: ['initialization']
      };

      const handle = await controller.createNewSession(nodeId, metadata);

      await expect(controller.waitForSessionCompletion(handle.sessionId, -1))
        .rejects.toThrow('Contract violation: timeout must be positive finite number');
      
      await expect(controller.waitForSessionCompletion(handle.sessionId, 0))
        .rejects.toThrow('Contract violation: timeout must be positive finite number');
      
      await expect(controller.waitForSessionCompletion(handle.sessionId, Infinity))
        .rejects.toThrow('Contract violation: timeout must be positive finite number');
      
      await expect(controller.waitForSessionCompletion(handle.sessionId, NaN))
        .rejects.toThrow('Contract violation: timeout must be positive finite number');
    });

    it('should reject invalid limit values in getSessionHistory', async () => {
      await expect(controller.getSessionHistory('test-node', -1))
        .rejects.toThrow('Contract violation: limit must be positive finite number');
      
      await expect(controller.getSessionHistory('test-node', 0))
        .rejects.toThrow('Contract violation: limit must be positive finite number');
      
      await expect(controller.getSessionHistory('test-node', Infinity))
        .rejects.toThrow('Contract violation: limit must be positive finite number');
    });
  });

  describe('cleanup operations', () => {
    it('should force cleanup session', async () => {
      const nodeId = 'test-node-1';
      const metadata: BuildMetadata = {
        nodeId,
        buildType: 'new',
        stages: ['initialization']
      };

      const handle = await controller.createNewSession(nodeId, metadata);
      
      await controller.forceCleanupSession(handle.sessionId);
      
      // Session should be removed from active sessions
      await expect(controller.getSessionState(handle.sessionId))
        .rejects.toThrow(`Session not found: ${handle.sessionId}`);
      
      // Should be added to history
      const history = await controller.getSessionHistory(nodeId);
      expect(history).toHaveLength(1);
      expect(history[0].error).toBe('Session force cleaned up');
    });

    it('should clean up completed sessions', async () => {
      // This test would require more complex setup to test time-based cleanup
      // For now, just verify the method doesn't throw
      await expect(controller.cleanupCompletedSessions()).resolves.not.toThrow();
    });
  });
});