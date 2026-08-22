import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import type {
  BuildSessionHeartbeat,
  BuildSessionRecord,
  BuildSessionStatus,
  BuildStageStatus,
  EphemeralBuildTaskRecord,
} from '../EphemeralDBRecordTypes.js';
import { getSessionWithDetails } from '../sessionHelpers.js';

describe('getSessionWithDetails', () => {
  const mockNodeId = 'test-node-id' as NodeId;

  it('should reject a normalized session with a missing config row', async () => {
    await expect(
      getSessionWithDetails(mockNodeId, {
        getConfig: async () => undefined,
        getHeartbeat: async () => undefined,
        getStatus: async () => ({
          nodeId: mockNodeId,
          status: 'running',
        }),
        getStageStatuses: async () => [],
        getTasks: async () => [],
      })
    ).rejects.toThrow('normalized session is incomplete');
  });

  it('should return null when both required session rows are absent', async () => {
    const result = await getSessionWithDetails(mockNodeId, {
      getConfig: async () => undefined,
      getHeartbeat: async () => undefined,
      getStatus: async () => undefined,
      getStageStatuses: async () => [],
      getTasks: async () => [],
    });

    expect(result).toBeNull();
  });

  it('should reject an orphan heartbeat without required session rows', async () => {
    await expect(
      getSessionWithDetails(mockNodeId, {
        getConfig: async () => undefined,
        getHeartbeat: async () => ({
          nodeId: mockNodeId,
          lastHeartbeatAt: 1_000,
        }),
        getStatus: async () => undefined,
        getStageStatuses: async () => [],
        getTasks: async () => [],
      })
    ).rejects.toThrow('normalized session has orphan rows');
  });

  it('should reject an orphan stage without required session rows', async () => {
    await expect(
      getSessionWithDetails(mockNodeId, {
        getConfig: async () => undefined,
        getHeartbeat: async () => undefined,
        getStatus: async () => undefined,
        getStageStatuses: async () => [
          {
            id: `${mockNodeId}:source`,
            nodeId: mockNodeId,
            stage: 'source',
            status: 'running',
            startedAt: 1_000,
            inactiveMs: 0,
          },
        ],
        getTasks: async () => [],
      })
    ).rejects.toThrow('normalized session has orphan rows');
  });

  it('should reject a normalized session with a missing status row', async () => {
    await expect(
      getSessionWithDetails(mockNodeId, {
        getConfig: async () => ({
          nodeId: mockNodeId,
          startedAt: Date.now(),
        }),
        getHeartbeat: async () => undefined,
        getStatus: async () => undefined,
        getStageStatuses: async () => [],
        getTasks: async () => [],
      })
    ).rejects.toThrow('normalized session is incomplete');
  });

  it('should return unified record with minimal data', async () => {
    const startedAt = Date.now();
    const config: BuildSessionRecord = {
      nodeId: mockNodeId,
      startedAt,
    };
    const status: BuildSessionStatus = {
      nodeId: mockNodeId,
      status: 'running',
    };

    const result = await getSessionWithDetails(mockNodeId, {
      getConfig: async () => config,
      getHeartbeat: async () => undefined,
      getStatus: async () => status,
      getStageStatuses: async () => [],
      getTasks: async () => [],
    });

    expect(result).toEqual({
      nodeId: mockNodeId,
      domainType: undefined,
      status: 'running',
      stopReason: undefined,
      stage: undefined,
      progress: {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      },
      stages: {
        source: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
        geometry: {
          status: 'queued',
          progress: 0,
          tasksTotal: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
        },
        tileEmit: {
          status: 'queued',
          progress: 0,
          tasksTotal: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
        },
      },
      selectedArrayByCountries: undefined,
      selectedArrayVersion: undefined,
      startedAt,
      updatedAt: startedAt,
      completedAt: undefined,
      inactiveMs: undefined,
      canResume: undefined,
      lastHeartbeatAt: undefined,
      stageStartedAt: undefined,
      stageInactiveMs: undefined,
      stageId: undefined,
      sourceStageMaxima: undefined,
    });
  });

  it('should return unified record with complete data', async () => {
    const startedAt = Date.now();
    const lastHeartbeatAt = Date.now() + 1000;
    const completedAt = Date.now() + 2000;
    const stageStartedAt = Date.now() + 500;

    const config: BuildSessionRecord = {
      nodeId: mockNodeId,
      domainType: 'shape',
      startedAt,
      selectedArrayByCountries: { US: [true, false, true] },
      selectedArrayVersion: 'v1.0',
      sourceStageMaxima: { featureMax: 1000, polygonMax: 500 },
    };

    const heartbeat: BuildSessionHeartbeat = {
      nodeId: mockNodeId,
      lastHeartbeatAt,
    };

    const status: BuildSessionStatus = {
      nodeId: mockNodeId,
      status: 'completed',
      stopReason: 'completed',
      completedAt,
      inactiveMs: 50,
      canResume: false,
    };

    const stageStatuses: BuildStageStatus[] = [
      {
        id: `${mockNodeId}:source`,
        nodeId: mockNodeId,
        stage: 'source',
        status: 'completed',
        startedAt: stageStartedAt,
        completedAt: stageStartedAt + 1000,
        inactiveMs: 0,
      },
      {
        id: `${mockNodeId}:geometry`,
        nodeId: mockNodeId,
        stage: 'geometry',
        status: 'running',
        startedAt: stageStartedAt + 1000,
        inactiveMs: 100,
        stageId: 'stage-123',
      },
    ];

    const tasks: EphemeralBuildTaskRecord[] = [
      {
        taskId: '1',
        nodeId: mockNodeId,
        status: 'completed',
        index: 0,
        stage: 'source',
        progress: 100,
      },
      {
        taskId: '2',
        nodeId: mockNodeId,
        status: 'completed',
        index: 1,
        stage: 'source',
        progress: 100,
      },
      {
        taskId: '3',
        nodeId: mockNodeId,
        status: 'running',
        index: 2,
        stage: 'geometry',
        progress: 50,
      },
      {
        taskId: '4',
        nodeId: mockNodeId,
        status: 'queued',
        index: 3,
        stage: 'geometry',
        progress: 0,
      },
    ];

    const result = await getSessionWithDetails(mockNodeId, {
      getConfig: async () => config,
      getHeartbeat: async () => heartbeat,
      getStatus: async () => status,
      getStageStatuses: async () => stageStatuses,
      getTasks: async () => tasks,
    });

    expect(result).toEqual({
      nodeId: mockNodeId,
      domainType: 'shape',
      status: 'completed',
      stopReason: 'completed',
      stage: 'geometry', // Latest stage by startedAt
      progress: {
        total: 4,
        completed: 2,
        failed: 0,
        skipped: 0,
        percentage: 50,
      },
      stages: {
        source: {
          status: 'completed',
          progress: 100,
          tasksTotal: 2,
          tasksCompleted: 2,
          tasksFailed: 0,
        },
        geometry: {
          status: 'running',
          progress: 0,
          tasksTotal: 2,
          tasksCompleted: 0,
          tasksFailed: 0,
        },
        tileEmit: {
          status: 'queued',
          progress: 0,
          tasksTotal: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
        },
      },
      selectedArrayByCountries: { US: [true, false, true] },
      selectedArrayVersion: 'v1.0',
      startedAt,
      updatedAt: completedAt,
      completedAt,
      inactiveMs: 50,
      canResume: false,
      lastHeartbeatAt,
      stageStartedAt: stageStartedAt + 1000, // Latest stage's startedAt
      stageInactiveMs: 100,
      stageId: 'geometry',
      sourceStageMaxima: { featureMax: 1000, polygonMax: 500 },
    });
  });

  it('should compute progress correctly from tasks', async () => {
    const config: BuildSessionRecord = {
      nodeId: mockNodeId,
      startedAt: Date.now(),
    };
    const status: BuildSessionStatus = {
      nodeId: mockNodeId,
      status: 'running',
    };

    const tasks: EphemeralBuildTaskRecord[] = [
      {
        taskId: '1',
        nodeId: mockNodeId,
        status: 'completed',
        index: 0,
        stage: 'source',
        progress: 100,
      },
      {
        taskId: '2',
        nodeId: mockNodeId,
        status: 'completed',
        index: 1,
        stage: 'source',
        progress: 100,
      },
      {
        taskId: '3',
        nodeId: mockNodeId,
        status: 'failed',
        index: 2,
        stage: 'geometry',
        progress: 0,
      },
      {
        taskId: '4',
        nodeId: mockNodeId,
        status: 'running',
        index: 3,
        stage: 'geometry',
        progress: 50,
      },
      {
        taskId: '5',
        nodeId: mockNodeId,
        status: 'queued',
        index: 4,
        stage: 'tileEmit',
        progress: 0,
      },
    ];

    const result = await getSessionWithDetails(mockNodeId, {
      getConfig: async () => config,
      getHeartbeat: async () => undefined,
      getStatus: async () => status,
      getStageStatuses: async () => [],
      getTasks: async () => tasks,
    });

    expect(result?.progress).toEqual({
      total: 5,
      completed: 2,
      failed: 1,
      skipped: 0,
      percentage: 40, // 2/5 * 100
    });
  });

  it('should compute stages correctly from tasks', async () => {
    const config: BuildSessionRecord = {
      nodeId: mockNodeId,
      startedAt: Date.now(),
    };
    const status: BuildSessionStatus = {
      nodeId: mockNodeId,
      status: 'running',
    };

    const tasks: EphemeralBuildTaskRecord[] = [
      {
        taskId: '1',
        nodeId: mockNodeId,
        status: 'completed',
        index: 0,
        stage: 'source',
        progress: 100,
      },
      {
        taskId: '2',
        nodeId: mockNodeId,
        status: 'completed',
        index: 1,
        stage: 'source',
        progress: 100,
      },
      {
        taskId: '3',
        nodeId: mockNodeId,
        status: 'running',
        index: 2,
        stage: 'geometry',
        progress: 50,
      },
      {
        taskId: '4',
        nodeId: mockNodeId,
        status: 'queued',
        index: 3,
        stage: 'geometry',
        progress: 0,
      },
      {
        taskId: '5',
        nodeId: mockNodeId,
        status: 'queued',
        index: 4,
        stage: 'tileEmit',
        progress: 0,
      },
    ];

    const result = await getSessionWithDetails(mockNodeId, {
      getConfig: async () => config,
      getHeartbeat: async () => undefined,
      getStatus: async () => status,
      getStageStatuses: async () => [],
      getTasks: async () => tasks,
    });

    expect(result?.stages).toEqual({
      source: {
        status: 'completed',
        progress: 100,
        tasksTotal: 2,
        tasksCompleted: 2,
        tasksFailed: 0,
      },
      geometry: {
        status: 'running',
        progress: 0,
        tasksTotal: 2,
        tasksCompleted: 0,
        tasksFailed: 0,
      },
      tileEmit: {
        status: 'queued',
        progress: 0,
        tasksTotal: 1,
        tasksCompleted: 0,
        tasksFailed: 0,
      },
    });
  });

  it('should select current stage as latest by startedAt', async () => {
    const config: BuildSessionRecord = {
      nodeId: mockNodeId,
      startedAt: Date.now(),
    };
    const status: BuildSessionStatus = {
      nodeId: mockNodeId,
      status: 'running',
    };

    const stageStatuses: BuildStageStatus[] = [
      {
        id: `${mockNodeId}:source`,
        nodeId: mockNodeId,
        stage: 'source',
        status: 'completed',
        startedAt: 1000,
        completedAt: 2000,
        inactiveMs: 0,
      },
      {
        id: `${mockNodeId}:geometry`,
        nodeId: mockNodeId,
        stage: 'geometry',
        status: 'completed',
        startedAt: 2000,
        completedAt: 3000,
        inactiveMs: 0,
      },
      {
        id: `${mockNodeId}:tileEmit`,
        nodeId: mockNodeId,
        stage: 'tileEmit',
        status: 'running',
        startedAt: 3000,
        inactiveMs: 0,
      },
    ];

    const result = await getSessionWithDetails(mockNodeId, {
      getConfig: async () => config,
      getHeartbeat: async () => undefined,
      getStatus: async () => status,
      getStageStatuses: async () => stageStatuses,
      getTasks: async () => [],
    });

    expect(result?.stage).toBe('tileEmit');
    expect(result?.stageStartedAt).toBe(3000);
  });

  it('should reject ambiguous latest stage timestamps', async () => {
    const config: BuildSessionRecord = {
      nodeId: mockNodeId,
      startedAt: 1_000,
    };
    const status: BuildSessionStatus = {
      nodeId: mockNodeId,
      status: 'running',
    };
    const stageStatuses: BuildStageStatus[] = [
      {
        id: `${mockNodeId}:source`,
        nodeId: mockNodeId,
        stage: 'source',
        status: 'running',
        startedAt: 2_000,
        inactiveMs: 0,
      },
      {
        id: `${mockNodeId}:geometry`,
        nodeId: mockNodeId,
        stage: 'geometry',
        status: 'running',
        startedAt: 2_000,
        inactiveMs: 0,
      },
    ];

    await expect(
      getSessionWithDetails(mockNodeId, {
        getConfig: async () => config,
        getHeartbeat: async () => undefined,
        getStatus: async () => status,
        getStageStatuses: async () => stageStatuses,
        getTasks: async () => [],
      })
    ).rejects.toThrow('normalized session has ambiguous current stage');
  });

  it('should handle stage with failed tasks', async () => {
    const startedAt = Date.now();
    const config: BuildSessionRecord = {
      nodeId: mockNodeId,
      startedAt,
    };
    const status: BuildSessionStatus = {
      nodeId: mockNodeId,
      status: 'failed',
      stopReason: 'failed',
      completedAt: startedAt,
    };

    const tasks: EphemeralBuildTaskRecord[] = [
      {
        taskId: '1',
        nodeId: mockNodeId,
        status: 'completed',
        index: 0,
        stage: 'source',
        progress: 100,
      },
      { taskId: '2', nodeId: mockNodeId, status: 'failed', index: 1, stage: 'source', progress: 0 },
      { taskId: '3', nodeId: mockNodeId, status: 'failed', index: 2, stage: 'source', progress: 0 },
    ];

    const result = await getSessionWithDetails(mockNodeId, {
      getConfig: async () => config,
      getHeartbeat: async () => undefined,
      getStatus: async () => status,
      getStageStatuses: async () => [],
      getTasks: async () => tasks,
    });

    expect(result?.stages.source).toEqual({
      status: 'failed',
      progress: 33.33333333333333, // 1/3 * 100
      tasksTotal: 3,
      tasksCompleted: 1,
      tasksFailed: 2,
    });
  });

  it('should reject invalid session and stage timing', async () => {
    const config: BuildSessionRecord = {
      nodeId: mockNodeId,
      startedAt: 1_000,
    };
    const query = {
      getConfig: async () => config,
      getHeartbeat: async () => undefined,
      getTasks: async () => [],
    };

    await expect(
      getSessionWithDetails(mockNodeId, {
        ...query,
        getStatus: async () => ({
          nodeId: mockNodeId,
          status: 'failed' as const,
        }),
        getStageStatuses: async () => [],
      })
    ).rejects.toThrow('status.completedAt is required for terminal status failed');

    await expect(
      getSessionWithDetails(mockNodeId, {
        ...query,
        getStatus: async () => ({
          nodeId: mockNodeId,
          status: 'running' as const,
          inactiveMs: -1,
        }),
        getStageStatuses: async () => [],
      })
    ).rejects.toThrow('status.inactiveMs must be a finite non-negative number');

    await expect(
      getSessionWithDetails(mockNodeId, {
        ...query,
        getStatus: async () => ({
          nodeId: mockNodeId,
          status: 'running' as const,
        }),
        getStageStatuses: async () => [
          {
            id: `${mockNodeId}:source`,
            nodeId: mockNodeId,
            stage: 'source' as const,
            status: 'completed' as const,
            startedAt: 2_000,
            completedAt: 2_050,
            inactiveMs: 100,
          },
        ],
      })
    ).rejects.toThrow('stageStatuses[0] completed interval must be non-negative');
  });
});
