/**
 * Bug Condition Exploration Test for Ephemeral Session Record Refactor
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 * 
 * This test encodes the EXPECTED behavior after the fix.
 * It MUST FAIL on unfixed code - failure confirms the bug exists.
 * 
 * After the refactor, this test verifies the fix is working correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { EphemeralDB } from '../EphemeralDB';
import type {
  BuildSessionRecord,
  BuildSessionHeartbeat,
  BuildSessionStatus,
  BuildStageStatus,
  BuildStatus,
  BuildStage,
  EphemeralBuildTaskRecord,
} from '../EphemeralDBRecordTypes';
import type { NodeId } from '@hierarchidb/core-types';
import { getSessionWithDetails } from '../sessionHelpers';

describe('Bug Condition Exploration: Normalized Session Schema', () => {
  let db: EphemeralDB;

  beforeEach(async () => {
    db = new EphemeralDB('test-ephemeral-bugfix');
    await db.open();
  });

  afterEach(async () => {
    await db.close();
    await db.delete();
  });

  /**
   * Property 1: Fault Condition - Normalized Session Schema Eliminates Redundancy
   * 
   * This test verifies that the session schema is normalized into four distinct tables:
   * 1. BuildSessionRecord (immutable config)
   * 2. BuildSessionHeartbeat (1-second updates)
   * 3. BuildSessionStatus (state transitions)
   * 4. BuildStageStatus (per-stage tracking with history)
   * 
   * EXPECTED OUTCOME AFTER FIX: PASS
   * - Schema uses four normalized tables
   * - Heartbeat updates only touch buildSessionHeartbeats table
   * - Stage transitions create new records preserving history
   * - Computed fields (progress, stages) are not stored
   * - Unused fields (expiresAt, canResume, resourceUsage) are absent
   */
  it('should pass after fix: session schema is normalized', async () => {
    // Generate a test session
    const nodeId: NodeId = 'test-node-1' as NodeId;
    const selectedArrayByCountries = { US: [true, false, true], CA: [false, true] };
    const now = Date.now();

    // Create session using normalized tables
    const config: BuildSessionRecord = {
      nodeId,
      domainType: 'shape',
      selectedArrayByCountries,
      startedAt: now,
    };

    const heartbeat: BuildSessionHeartbeat = {
      nodeId,
      lastHeartbeatAt: now,
    };

    const status: BuildSessionStatus = {
      nodeId,
      status: 'running',
    };

    const stageStatus: BuildStageStatus = {
      id: `${nodeId}:source`,
      nodeId,
      stage: 'source',
      status: 'running',
      startedAt: now,
    };

    // Insert into all four tables
    await db.buildSessionConfigs.add(config);
    await db.buildSessionHeartbeats.add(heartbeat);
    await db.buildSessionStatuses.add(status);
    await db.buildStageStatuses.add(stageStatus);

    // TEST 1: Verify schema has separate tables
    const hasNormalizedTables =
      db.tables.some(t => t.name === 'buildSessionConfigs') &&
      db.tables.some(t => t.name === 'buildSessionHeartbeats') &&
      db.tables.some(t => t.name === 'buildSessionStatuses') &&
      db.tables.some(t => t.name === 'buildStageStatuses');

    expect(hasNormalizedTables).toBe(true);

    // TEST 2: Verify heartbeat updates only touch heartbeat table
    const heartbeatTime = now + 1000;
    await db.buildSessionHeartbeats.update(nodeId, { lastHeartbeatAt: heartbeatTime });

    // Verify config table was not touched
    const configAfterHeartbeat = await db.buildSessionConfigs.get(nodeId);
    expect(configAfterHeartbeat).toEqual(config);

    // Verify heartbeat was updated
    const heartbeatAfterUpdate = await db.buildSessionHeartbeats.get(nodeId);
    expect(heartbeatAfterUpdate?.lastHeartbeatAt).toBe(heartbeatTime);

    // Verify heartbeat record is small (only nodeId + timestamp)
    const heartbeatSize = JSON.stringify(heartbeatAfterUpdate).length;
    expect(heartbeatSize).toBeLessThan(100); // Much smaller than 2KB+ monolithic record

    // TEST 3: Verify stage transitions preserve history
    const geometryStageTime = now + 5000;
    const geometryStageStatus: BuildStageStatus = {
      id: `${nodeId}:geometry`,
      nodeId,
      stage: 'geometry',
      status: 'running',
      startedAt: geometryStageTime,
    };

    // Complete source stage
    await db.buildStageStatuses.update(`${nodeId}:source`, {
      status: 'completed',
      completedAt: geometryStageTime,
    });

    // Add geometry stage
    await db.buildStageStatuses.add(geometryStageStatus);

    // Verify both stage records exist (history preserved)
    const stageHistory = await db.buildStageStatuses
      .where('nodeId')
      .equals(nodeId)
      .toArray();

    expect(stageHistory.length).toBe(2);
    expect(stageHistory.some(s => s.stage === 'source')).toBe(true);
    expect(stageHistory.some(s => s.stage === 'geometry')).toBe(true);

    // Verify source stage has completion time
    const sourceStage = stageHistory.find(s => s.stage === 'source');
    expect(sourceStage?.completedAt).toBe(geometryStageTime);

    // TEST 4: Verify computed fields are not stored in config table
    // Config table should only have immutable fields
    expect(configAfterHeartbeat).not.toHaveProperty('progress');
    expect(configAfterHeartbeat).not.toHaveProperty('stages');

    // TEST 5: Verify unused fields are absent from all tables
    expect(configAfterHeartbeat).not.toHaveProperty('expiresAt');
    expect(configAfterHeartbeat).not.toHaveProperty('canResume');
    expect(configAfterHeartbeat).not.toHaveProperty('resourceUsage');
    expect(heartbeatAfterUpdate).not.toHaveProperty('expiresAt');
    expect(heartbeatAfterUpdate).not.toHaveProperty('canResume');
  });

  /**
   * Property-Based Test: Session operations with normalized schema
   * 
   * This test generates random session operations and verifies that:
   * - Heartbeat updates are efficient (small serialization size)
   * - Stage transitions preserve history
   * - Computed fields are not stored in config table
   * - Unused fields are absent
   */
  it('should pass after fix: property-based test for session normalization', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random session data
        fc.record({
          nodeId: fc.string({ minLength: 5, maxLength: 20 }).map(s => `test-${s}` as NodeId),
          status: fc.constantFrom<BuildStatus>('idle', 'running', 'paused', 'completed', 'failed'),
          stage: fc.constantFrom<BuildStage>('source', 'geometry', 'tileEmit'),
          selectedArrayByCountries: fc.dictionary(
            fc.string({ minLength: 2, maxLength: 2 }),
            fc.array(fc.boolean(), { minLength: 1, maxLength: 5 })
          ),
        }),
        async (sessionData) => {
          const now = Date.now();

          // Create session using normalized tables
          const config: BuildSessionRecord = {
            nodeId: sessionData.nodeId,
            domainType: 'shape',
            selectedArrayByCountries: sessionData.selectedArrayByCountries,
            startedAt: now,
          };

          const heartbeat: BuildSessionHeartbeat = {
            nodeId: sessionData.nodeId,
            lastHeartbeatAt: now,
          };

          const status: BuildSessionStatus = {
            nodeId: sessionData.nodeId,
            status: sessionData.status,
          };

          const stageStatus: BuildStageStatus = {
            id: `${sessionData.nodeId}:${sessionData.stage}`,
            nodeId: sessionData.nodeId,
            stage: sessionData.stage,
            status: 'running',
            startedAt: now,
          };

          // Insert into all four tables
          await db.buildSessionConfigs.put(config);
          await db.buildSessionHeartbeats.put(heartbeat);
          await db.buildSessionStatuses.put(status);
          await db.buildStageStatuses.put(stageStatus);

          // Verify session was stored
          const storedConfig = await db.buildSessionConfigs.get(sessionData.nodeId);
          expect(storedConfig).toBeDefined();

          // Property 1: Heartbeat updates should be efficient
          const beforeSize = JSON.stringify(heartbeat).length;
          await db.buildSessionHeartbeats.update(sessionData.nodeId, { lastHeartbeatAt: now + 1000 });
          const afterHeartbeat = await db.buildSessionHeartbeats.get(sessionData.nodeId);
          const afterSize = JSON.stringify(afterHeartbeat).length;

          // Heartbeat record should be small (only nodeId + timestamp)
          expect(afterSize).toBeLessThan(100);
          expect(Math.abs(afterSize - beforeSize)).toBeLessThan(20); // Size should be similar

          // Property 2: Config table should not have computed fields
          expect(storedConfig).not.toHaveProperty('progress');
          expect(storedConfig).not.toHaveProperty('stages');

          // Property 3: No unused fields in any table
          expect(storedConfig).not.toHaveProperty('expiresAt');
          expect(storedConfig).not.toHaveProperty('canResume');
          expect(storedConfig).not.toHaveProperty('resourceUsage');
          expect(afterHeartbeat).not.toHaveProperty('expiresAt');

          // Cleanup
          await db.buildSessionConfigs.delete(sessionData.nodeId);
          await db.buildSessionHeartbeats.delete(sessionData.nodeId);
          await db.buildSessionStatuses.delete(sessionData.nodeId);
          await db.buildStageStatuses.delete(`${sessionData.nodeId}:${sessionData.stage}`);
        }
      ),
      {
        numRuns: 10, // Run 10 test cases
        endOnFailure: true, // Stop on first failure to see counterexample
      }
    );
  });

  /**
   * Counterexample Documentation Test
   * 
   * This test documents that the bug has been fixed by demonstrating:
   * 1. Heartbeat updates only serialize 16-byte record (nodeId + timestamp)
   * 2. Stage transitions preserve historical data in separate table
   * 3. Computed fields (progress, stages) are not stored in config table
   * 4. Unused fields (expiresAt, canResume, resourceUsage) are absent
   */
  it('should demonstrate the bug is fixed', async () => {
    const nodeId: NodeId = 'counterexample-node' as NodeId;
    const now = Date.now();

    // Create session using normalized tables
    const config: BuildSessionRecord = {
      nodeId,
      domainType: 'shape',
      selectedArrayByCountries: {
        US: [true, false, true, false, true],
        CA: [false, true, false, true],
        MX: [true, true, false, false],
      },
      startedAt: now,
    };

    const heartbeat: BuildSessionHeartbeat = {
      nodeId,
      lastHeartbeatAt: now,
    };

    const status: BuildSessionStatus = {
      nodeId,
      status: 'running',
    };

    const sourceStage: BuildStageStatus = {
      id: `${nodeId}:source`,
      nodeId,
      stage: 'source',
      status: 'running',
      startedAt: now,
    };

    await db.buildSessionConfigs.add(config);
    await db.buildSessionHeartbeats.add(heartbeat);
    await db.buildSessionStatuses.add(status);
    await db.buildStageStatuses.add(sourceStage);

    // Demonstration 1: Heartbeat update serialization is efficient
    const beforeHeartbeat = await db.buildSessionHeartbeats.get(nodeId);
    const beforeSize = JSON.stringify(beforeHeartbeat).length;

    // Update only heartbeat
    await db.buildSessionHeartbeats.update(nodeId, { lastHeartbeatAt: now + 1000 });

    const afterHeartbeat = await db.buildSessionHeartbeats.get(nodeId);
    const afterSize = JSON.stringify(afterHeartbeat).length;

    // Verify config table was not touched
    const configAfterHeartbeat = await db.buildSessionConfigs.get(nodeId);
    expect(configAfterHeartbeat).toEqual(config);

    console.log(`Demonstration 1: Heartbeat update serialization is efficient`);
    console.log(`  Before size: ${beforeSize} bytes`);
    console.log(`  After size: ${afterSize} bytes`);
    console.log(`  Expected: ~16-100 bytes for heartbeat-only update`);
    console.log(`  Actual: ${afterSize} bytes (only heartbeat record, not entire session)`);

    expect(afterSize).toBeLessThan(100); // Heartbeat record is small

    // Demonstration 2: Stage transition preserves history
    const sourceStageStart = sourceStage.startedAt;
    const geometryStageTime = now + 5000;

    // Complete source stage
    await db.buildStageStatuses.update(`${nodeId}:source`, {
      status: 'completed',
      completedAt: geometryStageTime,
    });

    // Transition to geometry stage
    const geometryStage: BuildStageStatus = {
      id: `${nodeId}:geometry`,
      nodeId,
      stage: 'geometry',
      status: 'running',
      startedAt: geometryStageTime,
    };
    await db.buildStageStatuses.add(geometryStage);

    const stageHistory = await db.buildStageStatuses
      .where('nodeId')
      .equals(nodeId)
      .toArray();

    console.log(`Demonstration 2: Stage transition preserves history`);
    console.log(`  Source stage started at: ${sourceStageStart}`);
    console.log(`  Source stage completed at: ${geometryStageTime}`);
    console.log(`  Current stage: geometry`);
    console.log(`  Stage history records: ${stageHistory.length}`);
    console.log(`  Source stage history: PRESERVED (separate stage history table)`);

    expect(stageHistory.length).toBe(2);
    expect(stageHistory.some(s => s.stage === 'source')).toBe(true);
    expect(stageHistory.some(s => s.stage === 'geometry')).toBe(true);

    // Demonstration 3: Computed fields not stored
    console.log(`Demonstration 3: Computed fields not stored in config table`);
    console.log(`  progress field present in config: ${configAfterHeartbeat.progress !== undefined}`);
    console.log(`  stages field present in config: ${(configAfterHeartbeat as any).stages !== undefined}`);
    console.log(`  Expected: These should be computed from tasks, not stored`);

    expect(configAfterHeartbeat).not.toHaveProperty('progress');
    expect(configAfterHeartbeat).not.toHaveProperty('stages');

    // Demonstration 4: Unused fields absent
    console.log(`Demonstration 4: Unused fields absent from all tables`);
    console.log(`  expiresAt present in config: ${(configAfterHeartbeat as any).expiresAt !== undefined}`);
    console.log(`  canResume present in config: ${(configAfterHeartbeat as any).canResume !== undefined}`);
    console.log(`  resourceUsage present in config: ${(configAfterHeartbeat as any).resourceUsage !== undefined}`);
    console.log(`  Expected: These fields should not exist in normalized schema`);

    expect(configAfterHeartbeat).not.toHaveProperty('expiresAt');
    expect(configAfterHeartbeat).not.toHaveProperty('canResume');
    expect(configAfterHeartbeat).not.toHaveProperty('resourceUsage');
  });

  /**
   * Unified Query Interface Test
   * 
   * This test verifies that the unified query interface (getSessionWithDetails)
   * correctly reconstructs the session record from the four normalized tables
   * and computes progress/stages from tasks.
   */
  it('should reconstruct session record from normalized tables', async () => {
    const nodeId: NodeId = 'unified-query-node' as NodeId;
    const now = Date.now();

    // Create session using normalized tables
    const config: BuildSessionRecord = {
      nodeId,
      domainType: 'shape',
      selectedArrayByCountries: { US: [true, false], CA: [true] },
      startedAt: now,
    };

    const heartbeat: BuildSessionHeartbeat = {
      nodeId,
      lastHeartbeatAt: now + 1000,
    };

    const status: BuildSessionStatus = {
      nodeId,
      status: 'running',
    };

    const sourceStage: BuildStageStatus = {
      id: `${nodeId}:source`,
      nodeId,
      stage: 'source',
      status: 'completed',
      startedAt: now,
      completedAt: now + 5000,
    };

    const geometryStage: BuildStageStatus = {
      id: `${nodeId}:geometry`,
      nodeId,
      stage: 'geometry',
      status: 'running',
      startedAt: now + 5000,
    };

    // Create some tasks for progress computation
    const tasks: EphemeralBuildTaskRecord[] = [
      {
        taskId: 'task-1',
        nodeId,
        stage: 'source',
        status: 'completed',
        index: 0,
        stagePriority: 0,
        sequence: 0,
      },
      {
        taskId: 'task-2',
        nodeId,
        stage: 'source',
        status: 'completed',
        index: 1,
        stagePriority: 0,
        sequence: 1,
      },
      {
        taskId: 'task-3',
        nodeId,
        stage: 'geometry',
        status: 'running',
        index: 0,
        stagePriority: 1,
        sequence: 2,
      },
      {
        taskId: 'task-4',
        nodeId,
        stage: 'geometry',
        status: 'queued',
        index: 1,
        stagePriority: 1,
        sequence: 3,
      },
    ];

    // Insert all data
    await db.buildSessionConfigs.add(config);
    await db.buildSessionHeartbeats.add(heartbeat);
    await db.buildSessionStatuses.add(status);
    await db.buildStageStatuses.add(sourceStage);
    await db.buildStageStatuses.add(geometryStage);
    for (const task of tasks) {
      await db.buildTasks.add(task);
    }

    // Query using unified interface
    const session = await getSessionWithDetails(nodeId, {
      getConfig: async (id) => db.buildSessionConfigs.get(id),
      getHeartbeat: async (id) => db.buildSessionHeartbeats.get(id),
      getStatus: async (id) => db.buildSessionStatuses.get(id),
      getStageStatuses: async (id) => db.buildStageStatuses.where('nodeId').equals(id).toArray(),
      getTasks: async (id) => db.buildTasks.where('nodeId').equals(id).toArray(),
    });

    // Verify session was reconstructed correctly
    expect(session).not.toBeNull();
    expect(session?.nodeId).toBe(nodeId);
    expect(session?.domainType).toBe('shape');
    expect(session?.status).toBe('running');
    expect(session?.stage).toBe('geometry'); // Current stage (latest by startedAt)
    expect(session?.startedAt).toBe(now);
    expect(session?.lastHeartbeatAt).toBe(now + 1000);
    expect(session?.stageStartedAt).toBe(now + 5000);
    expect(session?.selectedArrayByCountries).toEqual({ US: [true, false], CA: [true] });

    // Verify computed progress
    expect(session?.progress).toBeDefined();
    expect(session?.progress.total).toBe(4);
    expect(session?.progress.completed).toBe(2);
    expect(session?.progress.failed).toBe(0);
    expect(session?.progress.percentage).toBe(50);

    // Verify computed stages
    expect(session?.stages).toBeDefined();
    expect(session?.stages.source.status).toBe('completed');
    expect(session?.stages.source.tasksTotal).toBe(2);
    expect(session?.stages.source.tasksCompleted).toBe(2);
    expect(session?.stages.geometry.status).toBe('running');
    expect(session?.stages.geometry.tasksTotal).toBe(2);
    expect(session?.stages.geometry.tasksCompleted).toBe(0);
  });
});
