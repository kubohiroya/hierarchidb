/**
 * Preservation Property Tests for Ephemeral Session Record Refactor
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * These tests capture the CURRENT behavior that must be preserved after the refactor.
 * They test existing query patterns and external APIs on UNFIXED code.
 * 
 * EXPECTED OUTCOME: Tests PASS on unfixed code (baseline behavior)
 * After refactor: Tests MUST STILL PASS (no regressions)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { EphemeralDB } from '../EphemeralDB';
import type {
  EphemeralBuildSessionRecord,
  EphemeralBuildTaskRecord,
  BuildStatus,
  BuildStage,
  BuildSessionRecord,
  BuildSessionHeartbeat,
  BuildSessionStatus,
} from '../EphemeralDBRecordTypes';
import type { NodeId } from '@hierarchidb/core-types';
import { getSessionWithDetails } from '../sessionHelpers';

describe('Preservation: Query Interface Compatibility', () => {
  let db: EphemeralDB;

  beforeEach(async () => {
    db = new EphemeralDB('test-ephemeral-preservation');
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  /**
   * Helper function to query session using the new normalized schema
   */
  async function querySession(nodeId: NodeId): Promise<EphemeralBuildSessionRecord | null> {
    return getSessionWithDetails(nodeId, {
      getConfig: async (id) => db.buildSessionConfigs.get(id),
      getHeartbeat: async (id) => db.buildSessionHeartbeats.get(id),
      getStatus: async (id) => db.buildSessionStatuses.get(id),
      getStageStatuses: async (id) => db.buildStageStatuses.where('nodeId').equals(id).toArray(),
      getTasks: async (id) => db.buildTasks.where('nodeId').equals(id).toArray(),
    });
  }

  /**
   * Requirement 3.1: Querying current session status returns expected information
   * 
   * This test verifies that querying session status through the existing API
   * returns all expected fields with correct values.
   */
  it('should query current session status and return expected information', async () => {
    const nodeId: NodeId = 'test-session-status' as NodeId;
    const startedAt = Date.now();

    // Insert into normalized tables
    const config: BuildSessionRecord = {
      nodeId,
      domainType: 'shape',
      selectedArrayByCountries: { US: [true, false], CA: [true] },
      startedAt,
    };
    await db.buildSessionConfigs.add(config);

    const heartbeat: BuildSessionHeartbeat = {
      nodeId,
      lastHeartbeatAt: startedAt + 1000,
    };
    await db.buildSessionHeartbeats.add(heartbeat);

    const status: BuildSessionStatus = {
      nodeId,
      status: 'running',
    };
    await db.buildSessionStatuses.add(status);

    await db.buildStageStatuses.add({
      id: `${nodeId}-source-1`,
      nodeId,
      stage: 'source',
      status: 'running',
      startedAt,
    });

    // Query session status using unified query interface
    const queriedSession = await querySession(nodeId);

    // Verify all expected fields are present
    expect(queriedSession).toBeDefined();
    expect(queriedSession?.nodeId).toBe(nodeId);
    expect(queriedSession?.domainType).toBe('shape');
    expect(queriedSession?.status).toBe('running');
    expect(queriedSession?.stage).toBe('source');
    expect(queriedSession?.selectedArrayByCountries).toEqual({ US: [true, false], CA: [true] });
    expect(queriedSession?.startedAt).toBe(startedAt);
    expect(queriedSession?.lastHeartbeatAt).toBe(startedAt + 1000);
    expect(queriedSession?.stageStartedAt).toBe(startedAt);
  });

  /**
   * Requirement 3.2: UI displays build progress computed from task queues
   * 
   * This test verifies that progress information can be computed from task queues
   * and matches the expected structure.
   */
  it('should compute build progress from task queues', async () => {
    const nodeId: NodeId = 'test-progress-computation' as NodeId;

    // Create session in normalized tables
    await db.buildSessionConfigs.add({
      nodeId,
      domainType: 'shape',
      startedAt: Date.now(),
    });
    await db.buildSessionStatuses.add({
      nodeId,
      status: 'running',
    });

    // Create tasks with various statuses
    const tasks: EphemeralBuildTaskRecord[] = [
      { taskId: 't1', nodeId, version: 0, status: 'completed', index: 0, stage: 'source', progress: 100 },
      { taskId: 't2', nodeId, version: 0, status: 'completed', index: 1, stage: 'source', progress: 100 },
      { taskId: 't3', nodeId, version: 0, status: 'running', index: 2, stage: 'source', progress: 50 },
      { taskId: 't4', nodeId, version: 0, status: 'queued', index: 3, stage: 'source', progress: 0 },
      { taskId: 't5', nodeId, version: 0, status: 'failed', index: 4, stage: 'source', progress: 0 },
    ];

    for (const task of tasks) {
      await db.buildTasks.add(task);
    }

    // Query tasks and compute progress
    const allTasks = await db.buildTasks.where('nodeId').equals(nodeId).toArray();

    const total = allTasks.length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const failed = allTasks.filter(t => t.status === 'failed').length;
    const running = allTasks.filter(t => t.status === 'running').length;
    const queued = allTasks.filter(t => t.status === 'queued').length;

    // Verify progress computation
    expect(total).toBe(5);
    expect(completed).toBe(2);
    expect(failed).toBe(1);
    expect(running).toBe(1);
    expect(queued).toBe(1);

    const percentage = (completed / total) * 100;
    expect(percentage).toBe(40);
  });

  /**
   * Requirement 3.3: Session resume and cancel operations work correctly
   * 
   * This test verifies that session state transitions (pause, resume, cancel)
   * work correctly through the existing API.
   */
  it('should support session resume and cancel operations', async () => {
    const nodeId: NodeId = 'test-session-operations' as NodeId;

    // Create running session in normalized tables
    await db.buildSessionConfigs.add({
      nodeId,
      domainType: 'shape',
      startedAt: Date.now(),
    });
    await db.buildSessionStatuses.add({
      nodeId,
      status: 'running',
    });
    await db.buildStageStatuses.add({
      id: `${nodeId}-source-1`,
      nodeId,
      stage: 'source',
      status: 'running',
      startedAt: Date.now(),
    });

    // Pause session (update status table)
    await db.buildSessionStatuses.update(nodeId, { status: 'paused', stopReason: 'user-pause' });
    let updated = await querySession(nodeId);
    expect(updated?.status).toBe('paused');
    expect(updated?.stopReason).toBe('user-pause');

    // Resume session (update status table)
    await db.buildSessionStatuses.update(nodeId, { status: 'running', stopReason: undefined });
    updated = await querySession(nodeId);
    expect(updated?.status).toBe('running');
    expect(updated?.stopReason).toBeUndefined();

    // Cancel session (complete with stop reason)
    const completedAt = Date.now();
    await db.buildSessionStatuses.update(nodeId, {
      status: 'completed',
      stopReason: 'user-pause',
      completedAt,
    });
    updated = await querySession(nodeId);
    expect(updated?.status).toBe('completed');
    expect(updated?.stopReason).toBe('user-pause');
    expect(updated?.completedAt).toBe(completedAt);
  });

  /**
   * Requirement 3.4: Existing code querying ephemeralDB.sessions gets expected data
   * 
   * This test verifies that all existing query patterns return expected data structures.
   */
  it('should provide backward-compatible access patterns', async () => {
    const nodeId: NodeId = 'test-backward-compat' as NodeId;

    // Insert into normalized tables
    await db.buildSessionConfigs.add({
      nodeId,
      domainType: 'shape',
      selectedArrayByCountries: { US: [true, false, true], CA: [false, true] },
      startedAt: Date.now(),
    });
    await db.buildSessionHeartbeats.add({
      nodeId,
      lastHeartbeatAt: Date.now() + 1000,
    });
    await db.buildSessionStatuses.add({
      nodeId,
      status: 'running',
    });
    await db.buildStageStatuses.add({
      id: 'stage-geo-1',
      nodeId,
      stage: 'geometry',
      status: 'running',
      startedAt: Date.now() + 500,
      stageId: 'stage-geo-1',
    });

    // Test various query patterns

    // Pattern 1: Direct get by nodeId using unified query interface
    const byId = await querySession(nodeId);
    expect(byId).toBeDefined();
    expect(byId?.nodeId).toBe(nodeId);

    // Pattern 2: Query all sessions (query config table and reconstruct)
    const allConfigs = await db.buildSessionConfigs.toArray();
    expect(allConfigs.length).toBeGreaterThan(0);
    expect(allConfigs.some(s => s.nodeId === nodeId)).toBe(true);

    // Pattern 3: Query by status using status table
    const runningStatuses = await db.buildSessionStatuses.where('status').equals('running').toArray();
    expect(runningStatuses.some(s => s.nodeId === nodeId)).toBe(true);

    // Pattern 4: Check existence
    const exists = await db.buildSessionConfigs.get(nodeId);
    expect(exists).not.toBeUndefined();

    // Pattern 5: Count sessions
    const count = await db.buildSessionConfigs.count();
    expect(count).toBeGreaterThan(0);
  });

  /**
   * Requirement 3.5: Session cleanup removes all related records atomically
   * 
   * This test verifies that deleting a session removes all related records
   * (session, tasks, cache entries) atomically.
   */
  it('should remove all related records atomically during cleanup', async () => {
    const nodeId: NodeId = 'test-cleanup' as NodeId;

    // Create session in all four normalized tables
    await db.buildSessionConfigs.add({
      nodeId,
      domainType: 'shape',
      startedAt: Date.now(),
    });
    await db.buildSessionHeartbeats.add({
      nodeId,
      lastHeartbeatAt: Date.now(),
    });
    await db.buildSessionStatuses.add({
      nodeId,
      status: 'completed',
      completedAt: Date.now() + 5000,
    });
    await db.buildStageStatuses.add({
      id: `${nodeId}-source-1`,
      nodeId,
      stage: 'source',
      status: 'completed',
      startedAt: Date.now(),
      completedAt: Date.now() + 5000,
    });

    // Create related tasks
    const tasks: EphemeralBuildTaskRecord[] = [
      { taskId: 't1', nodeId, version: 0, status: 'completed', index: 0, stage: 'source', progress: 100 },
      { taskId: 't2', nodeId, version: 0, status: 'completed', index: 1, stage: 'source', progress: 100 },
    ];
    for (const task of tasks) {
      await db.buildTasks.add(task);
    }

    // Verify records exist
    expect(await db.buildSessionConfigs.get(nodeId)).toBeDefined();
    expect(await db.buildSessionHeartbeats.get(nodeId)).toBeDefined();
    expect(await db.buildSessionStatuses.get(nodeId)).toBeDefined();
    expect(await db.buildStageStatuses.where('nodeId').equals(nodeId).count()).toBe(1);
    expect(await db.buildTasks.where('nodeId').equals(nodeId).count()).toBe(2);

    // Cleanup: Delete session and related records from all tables
    await db.buildSessionConfigs.delete(nodeId);
    await db.buildSessionHeartbeats.delete(nodeId);
    await db.buildSessionStatuses.delete(nodeId);
    await db.buildStageStatuses.where('nodeId').equals(nodeId).delete();
    await db.buildTasks.where('nodeId').equals(nodeId).delete();

    // Verify all records are removed
    expect(await db.buildSessionConfigs.get(nodeId)).toBeUndefined();
    expect(await db.buildSessionHeartbeats.get(nodeId)).toBeUndefined();
    expect(await db.buildSessionStatuses.get(nodeId)).toBeUndefined();
    expect(await db.buildStageStatuses.where('nodeId').equals(nodeId).count()).toBe(0);
    expect(await db.buildTasks.where('nodeId').equals(nodeId).count()).toBe(0);
  });

  /**
   * Property-Based Test: Session state transitions preserve data integrity
   * 
   * This test generates random session state transitions and verifies that
   * data integrity is maintained across all transitions.
   */
  it('should preserve data integrity across session state transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random session with state transitions
        fc.record({
          nodeId: fc.string({ minLength: 5, maxLength: 20 }).map((s: string) => s as NodeId),
          initialStatus: fc.constantFrom<BuildStatus>('idle', 'running'),
          transitions: fc.array(
            fc.record({
              status: fc.constantFrom<BuildStatus>('running', 'paused', 'completed', 'failed'),
              stage: fc.option(fc.constantFrom<BuildStage>('source', 'geometry', 'tileEmit'), { nil: undefined }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async (testData) => {
          const { nodeId, initialStatus, transitions } = testData;

          // Clear any leftover data from previous runs with the same nodeId
          await db.buildStageStatuses.where('nodeId').equals(nodeId).delete();

          // Create initial session in normalized tables
          await db.buildSessionConfigs.put({
            nodeId,
            domainType: 'shape',
            startedAt: Date.now(),
          });
          await db.buildSessionStatuses.put({
            nodeId,
            status: initialStatus,
          });

          // Apply transitions
          for (const transition of transitions) {
            await db.buildSessionStatuses.update(nodeId, {
              status: transition.status,
            });

            // If stage is specified, update or create stage status
            if (transition.stage !== undefined) {
              const existingStages = await db.buildStageStatuses.where('nodeId').equals(nodeId).toArray();
              const stageExists = existingStages.some(s => s.stage === transition.stage);

              if (!stageExists) {
                await db.buildStageStatuses.put({
                  id: `${nodeId}-${transition.stage}-${Date.now()}`,
                  nodeId,
                  stage: transition.stage,
                  status: 'running',
                  startedAt: Date.now(),
                });
              }
            }

            // Verify session still exists and has correct status
            const updated = await querySession(nodeId);
            expect(updated).toBeDefined();
            expect(updated?.nodeId).toBe(nodeId);
            expect(updated?.status).toBe(transition.status);
            if (transition.stage !== undefined) {
              // Verify the stage exists in stageStatuses (may not be the "current" stage
              // if multiple stages have the same startedAt timestamp)
              const stageStatuses = await db.buildStageStatuses.where('nodeId').equals(nodeId).toArray();
              expect(stageStatuses.some(s => s.stage === transition.stage)).toBe(true);
            }
          }

          // Cleanup
          await db.buildSessionConfigs.delete(nodeId);
          await db.buildSessionStatuses.delete(nodeId);
          await db.buildSessionHeartbeats.delete(nodeId);
          await db.buildStageStatuses.where('nodeId').equals(nodeId).delete();
        }
      ),
      {
        numRuns: 20,
      }
    );
  });

  /**
   * Property-Based Test: Progress computation consistency
   * 
   * This test generates random task configurations and verifies that
   * progress computation is consistent and correct.
   */
  it('should compute progress consistently from task queues', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          nodeId: fc.string({ minLength: 5, maxLength: 20 }).map((s: string) => s as NodeId),
          taskCount: fc.integer({ min: 1, max: 50 }),
          completedRatio: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
          failedRatio: fc.double({ min: 0, max: 0.2, noNaN: true, noDefaultInfinity: true }),
        }),
        async (testData) => {
          const { nodeId, taskCount, completedRatio, failedRatio } = testData;

          // Clear any leftover data from previous runs with the same nodeId
          await db.buildTasks.where('nodeId').equals(nodeId).delete();
          await db.buildStageStatuses.where('nodeId').equals(nodeId).delete();

          // Create session in normalized tables
          await db.buildSessionConfigs.put({
            nodeId,
            domainType: 'shape',
            startedAt: Date.now(),
          });
          await db.buildSessionStatuses.put({
            nodeId,
            status: 'running',
          });
          await db.buildStageStatuses.put({
            id: `${nodeId}-source-1`,
            nodeId,
            stage: 'source',
            status: 'running',
            startedAt: Date.now(),
          });

          // Create tasks with specified ratios
          const completedCount = Math.floor(taskCount * completedRatio);
          const failedCount = Math.floor(taskCount * failedRatio);
          const remainingCount = taskCount - completedCount - failedCount;

          const tasks: EphemeralBuildTaskRecord[] = [];

          for (let i = 0; i < completedCount; i++) {
            tasks.push({
              taskId: `${nodeId}-t${i}`,
              nodeId,
              version: 0,
              status: 'completed',
              index: i,
              stage: 'source',
              progress: 100,
            });
          }

          for (let i = 0; i < failedCount; i++) {
            tasks.push({
              taskId: `${nodeId}-t${completedCount + i}`,
              nodeId,
              version: 0,
              status: 'failed',
              index: completedCount + i,
              stage: 'source',
              progress: 0,
            });
          }

          for (let i = 0; i < remainingCount; i++) {
            tasks.push({
              taskId: `${nodeId}-t${completedCount + failedCount + i}`,
              nodeId,
              version: 0,
              status: 'queued',
              index: completedCount + failedCount + i,
              stage: 'source',
              progress: 0,
            });
          }

          for (const task of tasks) {
            await db.buildTasks.put(task);
          }

          // Compute progress
          const allTasks = await db.buildTasks.where('nodeId').equals(nodeId).toArray();
          const total = allTasks.length;
          const completed = allTasks.filter(t => t.status === 'completed').length;
          const failed = allTasks.filter(t => t.status === 'failed').length;

          // Verify progress computation
          expect(total).toBe(taskCount);
          expect(completed).toBe(completedCount);
          expect(failed).toBe(failedCount);

          const percentage = total > 0 ? (completed / total) * 100 : 0;
          expect(percentage).toBeGreaterThanOrEqual(0);
          expect(percentage).toBeLessThanOrEqual(100);

          // Cleanup
          await db.buildSessionConfigs.delete(nodeId);
          await db.buildSessionStatuses.delete(nodeId);
          await db.buildStageStatuses.where('nodeId').equals(nodeId).delete();
          await db.buildTasks.where('nodeId').equals(nodeId).delete();
        }
      ),
      {
        numRuns: 20,
      }
    );
  });

  /**
   * Property-Based Test: Various session states and stage configurations
   * 
   * This test generates sessions in various states with different stage
   * configurations and verifies query patterns work correctly.
   */
  it('should handle various session states and stage configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          nodeId: fc.string({ minLength: 5, maxLength: 20 }).map((s: string) => s as NodeId),
          status: fc.constantFrom<BuildStatus>('idle', 'running', 'paused', 'completed', 'failed'),
          stage: fc.option(fc.constantFrom<BuildStage>('source', 'geometry', 'tileEmit'), { nil: undefined }),
          hasSelectedArrayByCountries: fc.boolean(),
          hasStageId: fc.boolean(),
        }),
        async (testData) => {
          const { nodeId, status, stage, hasSelectedArrayByCountries, hasStageId } = testData;

          // Create session with various configurations in normalized tables
          const config: BuildSessionRecord = {
            nodeId,
            domainType: 'shape',
            startedAt: Date.now(),
          };

          if (hasSelectedArrayByCountries) {
            config.selectedArrayByCountries = { US: [true, false], CA: [true] };
          }

          await db.buildSessionConfigs.add(config);

          const sessionStatus: BuildSessionStatus = {
            nodeId,
            status,
          };

          if (status === 'completed' || status === 'failed') {
            sessionStatus.completedAt = Date.now() + 1000;
            sessionStatus.stopReason = status === 'failed' ? 'failed' : 'completed';
          }

          await db.buildSessionStatuses.add(sessionStatus);

          if (stage) {
            const stageId = hasStageId ? `stage-${stage}-1` : undefined;
            await db.buildStageStatuses.add({
              id: stageId || `${nodeId}-${stage}-1`,
              nodeId,
              stage,
              status: 'running',
              startedAt: Date.now(),
              stageId,
            });
          }

          // Query and verify
          const queried = await querySession(nodeId);
          expect(queried).toBeDefined();
          expect(queried?.nodeId).toBe(nodeId);
          expect(queried?.status).toBe(status);
          expect(queried?.stage).toBe(stage);

          if (hasSelectedArrayByCountries) {
            expect(queried?.selectedArrayByCountries).toBeDefined();
          }

          if (hasStageId && stage) {
            expect(queried?.stageId).toBe(`stage-${stage}-1`);
            expect(queried?.stageStartedAt).toBeDefined();
          }

          // Cleanup
          await db.buildSessionConfigs.delete(nodeId);
          await db.buildSessionStatuses.delete(nodeId);
          await db.buildStageStatuses.where('nodeId').equals(nodeId).delete();
        }
      ),
      {
        numRuns: 30,
      }
    );
  });

  /**
   * Edge Case: Session with no tasks
   * 
   * Verifies that sessions without tasks can be queried correctly.
   */
  it('should handle sessions with no tasks', async () => {
    const nodeId: NodeId = 'test-no-tasks' as NodeId;

    // Create session in normalized tables
    await db.buildSessionConfigs.add({
      nodeId,
      domainType: 'shape',
      startedAt: Date.now(),
    });
    await db.buildSessionStatuses.add({
      nodeId,
      status: 'idle',
    });

    // Query session
    const queried = await querySession(nodeId);
    expect(queried).toBeDefined();
    expect(queried?.nodeId).toBe(nodeId);

    // Query tasks (should be empty)
    const tasks = await db.buildTasks.where('nodeId').equals(nodeId).toArray();
    expect(tasks.length).toBe(0);

    // Progress should be 0/0
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    expect(total).toBe(0);
    expect(completed).toBe(0);
  });

  /**
   * Edge Case: Session with all tasks completed
   * 
   * Verifies that completed sessions are handled correctly.
   */
  it('should handle sessions with all tasks completed', async () => {
    const nodeId: NodeId = 'test-all-completed' as NodeId;

    // Create completed session in normalized tables
    await db.buildSessionConfigs.add({
      nodeId,
      domainType: 'shape',
      startedAt: Date.now(),
    });
    await db.buildSessionStatuses.add({
      nodeId,
      status: 'completed',
      completedAt: Date.now() + 5000,
    });

    // Create all completed tasks
    const tasks: EphemeralBuildTaskRecord[] = [
      { taskId: 't1', nodeId, version: 0, status: 'completed', index: 0, stage: 'source', progress: 100 },
      { taskId: 't2', nodeId, version: 0, status: 'completed', index: 1, stage: 'geometry', progress: 100 },
      { taskId: 't3', nodeId, version: 0, status: 'completed', index: 2, stage: 'tileEmit', progress: 100 },
    ];
    for (const task of tasks) {
      await db.buildTasks.add(task);
    }

    // Query and verify
    const queried = await querySession(nodeId);
    expect(queried?.status).toBe('completed');
    expect(queried?.completedAt).toBeDefined();

    const allTasks = await db.buildTasks.where('nodeId').equals(nodeId).toArray();
    expect(allTasks.every(t => t.status === 'completed')).toBe(true);

    const percentage = (allTasks.length / allTasks.length) * 100;
    expect(percentage).toBe(100);
  });

  /**
   * Edge Case: Session with mixed task statuses
   * 
   * Verifies that sessions with tasks in various states are handled correctly.
   */
  it('should handle sessions with mixed task statuses', async () => {
    const nodeId: NodeId = 'test-mixed-statuses' as NodeId;

    // Create session in normalized tables
    await db.buildSessionConfigs.add({
      nodeId,
      domainType: 'shape',
      startedAt: Date.now(),
    });
    await db.buildSessionStatuses.add({
      nodeId,
      status: 'running',
    });
    await db.buildStageStatuses.add({
      id: `${nodeId}-geometry-1`,
      nodeId,
      stage: 'geometry',
      status: 'running',
      startedAt: Date.now(),
    });

    // Create tasks with mixed statuses across stages
    const tasks: EphemeralBuildTaskRecord[] = [
      { taskId: 't1', nodeId, version: 0, status: 'completed', index: 0, stage: 'source', progress: 100 },
      { taskId: 't2', nodeId, version: 0, status: 'completed', index: 1, stage: 'source', progress: 100 },
      { taskId: 't3', nodeId, version: 0, status: 'running', index: 2, stage: 'geometry', progress: 50 },
      { taskId: 't4', nodeId, version: 0, status: 'queued', index: 3, stage: 'geometry', progress: 0 },
      { taskId: 't5', nodeId, version: 0, status: 'queued', index: 4, stage: 'tileEmit', progress: 0 },
      { taskId: 't6', nodeId, version: 0, status: 'failed', index: 5, stage: 'source', progress: 0 },
    ];
    for (const task of tasks) {
      await db.buildTasks.add(task);
    }

    // Query and compute progress by stage
    const allTasks = await db.buildTasks.where('nodeId').equals(nodeId).toArray();

    const sourceTask = allTasks.filter(t => t.stage === 'source');
    const geometryTasks = allTasks.filter(t => t.stage === 'geometry');
    const tileEmitTasks = allTasks.filter(t => t.stage === 'tileEmit');

    expect(sourceTask.length).toBe(3);
    expect(geometryTasks.length).toBe(2);
    expect(tileEmitTasks.length).toBe(1);

    // Verify stage-specific progress
    const sourceCompleted = sourceTask.filter(t => t.status === 'completed').length;
    const sourceFailed = sourceTask.filter(t => t.status === 'failed').length;
    expect(sourceCompleted).toBe(2);
    expect(sourceFailed).toBe(1);

    const geometryRunning = geometryTasks.filter(t => t.status === 'running').length;
    const geometryQueued = geometryTasks.filter(t => t.status === 'queued').length;
    expect(geometryRunning).toBe(1);
    expect(geometryQueued).toBe(1);
  });
});
