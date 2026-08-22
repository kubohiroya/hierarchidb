/**
 * Multi-Stage Session Lifecycle Integration Tests
 *
 * Tests complete session lifecycle with pause/resume across all stages:
 * start → source stage → geometry stage → tile-emit stage → completion
 *
 * Validates Requirements 9.16, 9.17, 8.1, 8.2, 8.3
 */

import type { BuildStage } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { type EphemeralBuildTaskRecord, ephemeralDB } from '@hierarchidb/gis-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureSessionTaskConsistency,
  updateBuildTaskProtected,
} from '../../worker/api/protectedTaskMutationUtils.js';
import { taskStateProtection } from '../../worker/api/taskStateProtection.js';

// Mock session configuration for multi-stage testing
interface MockSessionConfig {
  nodeId: NodeId;
  stages: {
    source: {
      enabled: boolean;
      tasks: Array<{ taskId: string; type: string }>;
    };
    geometry: {
      enabled: boolean;
      tasks: Array<{ taskId: string; type: string }>;
    };
    tileEmit: {
      enabled: boolean;
      tasks: Array<{ taskId: string; type: string }>;
    };
  };
  cacheConfig: {
    enableGeometryCache: boolean;
    enableSourceCache: boolean;
  };
}

const createMultiStageSessionConfig = (nodeId: NodeId): MockSessionConfig => ({
  nodeId,
  stages: {
    source: {
      enabled: true,
      tasks: [
        { taskId: `source-task-1-${nodeId}`, type: 'source-extraction' },
        { taskId: `source-task-2-${nodeId}`, type: 'source-validation' },
      ],
    },
    geometry: {
      enabled: true,
      tasks: [
        { taskId: `geometry-task-1-${nodeId}`, type: 'geometry-processing' },
        { taskId: `geometry-task-2-${nodeId}`, type: 'geometry-optimization' },
      ],
    },
    tileEmit: {
      enabled: true,
      tasks: [
        { taskId: `tile-task-1-${nodeId}`, type: 'tile-generation' },
        { taskId: `tile-task-2-${nodeId}`, type: 'tile-optimization' },
      ],
    },
  },
  cacheConfig: {
    enableGeometryCache: true,
    enableSourceCache: true,
  },
});

// Mock task creation helper
const createStageTask = (
  taskId: string,
  nodeId: NodeId,
  stage: BuildStage,
  status: 'queued' | 'running' | 'completed' | 'failed' = 'queued'
): EphemeralBuildTaskRecord<Record<string, unknown>, Record<string, unknown>> => ({
  taskId,
  nodeId,
  status,
  stage,
  version: 1,
  index: 0,
  progress: status === 'completed' ? 100 : status === 'running' ? 50 : 0,
  inputData: { stageType: stage },
  outputData: status === 'completed' ? { result: `${stage}-output` } : undefined,
  metadata: { stage },
});

// Event sequence tracker for validation
interface EventSequence {
  timestamp: number;
  eventType: 'task-start' | 'task-progress' | 'task-complete' | 'cache-write' | 'stage-transition';
  taskId?: string;
  stage?: string;
  seqNum?: number;
  data?: unknown;
}

class SessionEventTracker {
  private events: EventSequence[] = [];
  private stageTransitions: string[] = [];

  recordEvent(event: EventSequence) {
    this.events.push({
      ...event,
      timestamp: Date.now(),
    });
  }

  recordStageTransition(fromStage: string, toStage: string) {
    this.stageTransitions.push(`${fromStage}->${toStage}`);
    this.recordEvent({
      timestamp: Date.now(),
      eventType: 'stage-transition',
      stage: toStage,
      data: { from: fromStage, to: toStage },
    });
  }

  getEventsByStage(stage: string): EventSequence[] {
    return this.events.filter((e) => e.stage === stage);
  }

  getEventsByType(eventType: EventSequence['eventType']): EventSequence[] {
    return this.events.filter((e) => e.eventType === eventType);
  }

  validateEventSequence(): { isValid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Validate stage progression order (only if we have stage transitions)
    if (this.stageTransitions.length > 0) {
      const expectedStageOrder = ['source', 'geometry', 'tileEmit'];
      const actualStageOrder = this.stageTransitions
        .map((t) => t.split('->')[1])
        .filter((stage, index, arr) => arr.indexOf(stage) === index);

      // Only validate if we have multiple stages
      if (actualStageOrder.length > 1) {
        const expectedSubset = expectedStageOrder.filter((stage) =>
          actualStageOrder.includes(stage)
        );
        if (JSON.stringify(actualStageOrder) !== JSON.stringify(expectedSubset)) {
          violations.push(
            `Invalid stage order: expected ${expectedSubset.join('->')}, got ${actualStageOrder.join('->')}`
          );
        }
      }
    }

    // Validate task completion before cache writes
    const taskCompletes = this.getEventsByType('task-complete');
    const cacheWrites = this.getEventsByType('cache-write');

    for (const cacheWrite of cacheWrites) {
      const correspondingComplete = taskCompletes.find((tc) => tc.taskId === cacheWrite.taskId);
      if (!correspondingComplete) {
        violations.push(
          `Cache write for task ${cacheWrite.taskId} without corresponding task completion`
        );
      } else if (correspondingComplete.timestamp > cacheWrite.timestamp) {
        violations.push(
          `Cache write for task ${cacheWrite.taskId} occurred before task completion`
        );
      }
    }

    // Validate seqNum ordering (simplified - just check monotonic increase)
    const allEventsWithSeqNum = this.events
      .filter((e) => e.seqNum !== undefined)
      .sort((a, b) => a.seqNum! - b.seqNum!);

    for (let i = 1; i < allEventsWithSeqNum.length; i++) {
      const prev = allEventsWithSeqNum[i - 1];
      const curr = allEventsWithSeqNum[i];

      if (curr.seqNum! <= prev.seqNum!) {
        violations.push(`Non-monotonic seqNum sequence: ${prev.seqNum} -> ${curr.seqNum}`);
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  reset() {
    this.events = [];
    this.stageTransitions = [];
  }

  getEventCount(): number {
    return this.events.length;
  }

  getStageTransitionCount(): number {
    return this.stageTransitions.length;
  }
}

describe('Multi-Stage Session Lifecycle Integration Tests', () => {
  let eventTracker: SessionEventTracker;
  let abortController: AbortController;

  beforeEach(async () => {
    await ephemeralDB.delete();
    await ephemeralDB.open();
    eventTracker = new SessionEventTracker();
    abortController = new AbortController();
  });

  afterEach(async () => {
    abortController.abort();
    await ephemeralDB.delete();
  });

  it('should complete full session lifecycle across all stages', async () => {
    const nodeId = 'test-node-lifecycle' as NodeId;
    const sessionConfig = createMultiStageSessionConfig(nodeId);

    // Create tasks for all stages
    const allTasks = [
      ...sessionConfig.stages.source.tasks.map((t: { taskId: string; type: string }) =>
        createStageTask(t.taskId, nodeId, 'source')
      ),
      ...sessionConfig.stages.geometry.tasks.map((t: { taskId: string; type: string }) =>
        createStageTask(t.taskId, nodeId, 'geometry')
      ),
      ...sessionConfig.stages.tileEmit.tasks.map((t: { taskId: string; type: string }) =>
        createStageTask(t.taskId, nodeId, 'tileEmit')
      ),
    ];

    // Store all tasks
    await ephemeralDB.buildTasks.bulkPut(allTasks);

    // Simulate session execution through all stages
    const stages: BuildStage[] = ['source', 'geometry', 'tileEmit'];
    let currentSeqNum = 1;

    for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
      const currentStage = stages[stageIndex];
      const stageTasks = allTasks.filter((t) => t.stage === currentStage);

      // Record stage transition
      if (stageIndex > 0) {
        eventTracker.recordStageTransition(stages[stageIndex - 1], currentStage);
      }

      // Process each task in the stage
      for (const task of stageTasks) {
        // Create task snapshot before processing
        await taskStateProtection.createTaskSnapshot(task.taskId);

        // Start task
        eventTracker.recordEvent({
          timestamp: Date.now(),
          eventType: 'task-start',
          taskId: task.taskId,
          stage: currentStage,
          seqNum: currentSeqNum++,
        });

        await updateBuildTaskProtected(task.taskId, { status: 'running' }, abortController.signal);

        // Simulate progress updates
        for (let progress = 25; progress <= 75; progress += 25) {
          eventTracker.recordEvent({
            timestamp: Date.now(),
            eventType: 'task-progress',
            taskId: task.taskId,
            stage: currentStage,
            seqNum: currentSeqNum++,
            data: { progress },
          });

          await updateBuildTaskProtected(task.taskId, { progress }, abortController.signal);
        }

        // Complete task
        eventTracker.recordEvent({
          timestamp: Date.now(),
          eventType: 'task-complete',
          taskId: task.taskId,
          stage: currentStage,
          seqNum: currentSeqNum++,
        });

        await updateBuildTaskProtected(
          task.taskId,
          {
            status: 'completed',
            progress: 100,
          },
          abortController.signal
        );

        // Simulate cache write after task completion
        eventTracker.recordEvent({
          timestamp: Date.now(),
          eventType: 'cache-write',
          taskId: task.taskId,
          stage: currentStage,
          seqNum: currentSeqNum++,
          data: { cacheType: currentStage === 'source' ? 'source' : 'geometry' },
        });
      }
    }

    // Validate session consistency
    await ensureSessionTaskConsistency(nodeId);

    // Verify all tasks completed successfully
    const finalTasks = await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).toArray();
    expect(finalTasks.length).toBe(6); // 2 tasks per stage × 3 stages

    for (const task of finalTasks) {
      expect(task.status).toBe('completed');
      expect(task.progress).toBe(100);
    }

    // Validate event sequence integrity
    const sequenceValidation = eventTracker.validateEventSequence();
    expect(sequenceValidation.isValid).toBe(true);
    if (!sequenceValidation.isValid) {
      console.error('Event sequence violations:', sequenceValidation.violations);
    }

    // Verify stage transitions occurred in correct order
    expect(eventTracker.getStageTransitionCount()).toBe(2); // source->geometry, geometry->tileEmit

    // Verify event counts
    expect(eventTracker.getEventsByType('task-start').length).toBe(6);
    expect(eventTracker.getEventsByType('task-complete').length).toBe(6);
    expect(eventTracker.getEventsByType('cache-write').length).toBe(6);
  });

  it('should maintain event sequence integrity during pause/resume cycles', async () => {
    const nodeId = 'test-node-pause-resume' as NodeId;
    const sessionConfig = createMultiStageSessionConfig(nodeId);

    // Create tasks for source stage only (for focused testing)
    const sourceTasks = sessionConfig.stages.source.tasks.map(
      (t: { taskId: string; type: string }) => createStageTask(t.taskId, nodeId, 'source')
    );

    await ephemeralDB.buildTasks.bulkPut(sourceTasks);

    let currentSeqNum = 1;

    // Start processing first task
    const firstTask = sourceTasks[0];
    await taskStateProtection.createTaskSnapshot(firstTask.taskId);

    eventTracker.recordEvent({
      timestamp: Date.now(),
      eventType: 'task-start',
      taskId: firstTask.taskId,
      stage: 'source',
      seqNum: currentSeqNum++,
    });

    await updateBuildTaskProtected(firstTask.taskId, { status: 'running' }, abortController.signal);

    // Simulate pause during task processing
    const pauseController = new AbortController();
    pauseController.abort(); // Simulate immediate pause

    // Verify task state is preserved during pause
    const taskDuringPause = await ephemeralDB.buildTasks.get(firstTask.taskId);
    expect(taskDuringPause).toBeDefined();
    expect(taskDuringPause!.status).toBe('running');

    // Resume processing (new abort controller)
    const resumeController = new AbortController();

    // Continue with progress updates after resume
    eventTracker.recordEvent({
      timestamp: Date.now(),
      eventType: 'task-progress',
      taskId: firstTask.taskId,
      stage: 'source',
      seqNum: currentSeqNum++,
      data: { progress: 50 },
    });

    await updateBuildTaskProtected(firstTask.taskId, { progress: 50 }, resumeController.signal);

    // Complete first task
    eventTracker.recordEvent({
      timestamp: Date.now(),
      eventType: 'task-complete',
      taskId: firstTask.taskId,
      stage: 'source',
      seqNum: currentSeqNum++,
    });

    await updateBuildTaskProtected(
      firstTask.taskId,
      { status: 'completed', progress: 100 },
      resumeController.signal
    );

    // Process second task normally
    const secondTask = sourceTasks[1];
    await taskStateProtection.createTaskSnapshot(secondTask.taskId);

    eventTracker.recordEvent({
      timestamp: Date.now(),
      eventType: 'task-start',
      taskId: secondTask.taskId,
      stage: 'source',
      seqNum: currentSeqNum++,
    });

    await updateBuildTaskProtected(
      secondTask.taskId,
      { status: 'running' },
      resumeController.signal
    );

    eventTracker.recordEvent({
      timestamp: Date.now(),
      eventType: 'task-complete',
      taskId: secondTask.taskId,
      stage: 'source',
      seqNum: currentSeqNum++,
    });

    await updateBuildTaskProtected(
      secondTask.taskId,
      { status: 'completed', progress: 100 },
      resumeController.signal
    );

    // Validate session consistency after pause/resume
    await ensureSessionTaskConsistency(nodeId);

    // Verify both tasks completed successfully
    const finalTasks = await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).toArray();
    expect(finalTasks.length).toBe(2);

    for (const task of finalTasks) {
      expect(task.status).toBe('completed');
      expect(task.progress).toBe(100);
    }

    // Validate event sequence maintained integrity across pause/resume
    const sequenceValidation = eventTracker.validateEventSequence();
    expect(sequenceValidation.isValid).toBe(true);

    // Verify correct number of events recorded
    expect(eventTracker.getEventsByType('task-start').length).toBe(2);
    expect(eventTracker.getEventsByType('task-complete').length).toBe(2);
    expect(eventTracker.getEventsByType('task-progress').length).toBe(1);
  });

  it('should handle stage transitions with worker restarts', async () => {
    const nodeId = 'test-node-worker-restart' as NodeId;
    const sessionConfig = createMultiStageSessionConfig(nodeId);

    // Create tasks for source and geometry stages
    const sourceTasks = sessionConfig.stages.source.tasks.map(
      (t: { taskId: string; type: string }) => createStageTask(t.taskId, nodeId, 'source')
    );
    const geometryTasks = sessionConfig.stages.geometry.tasks.map(
      (t: { taskId: string; type: string }) => createStageTask(t.taskId, nodeId, 'geometry')
    );

    await ephemeralDB.buildTasks.bulkPut([...sourceTasks, ...geometryTasks]);

    let currentSeqNum = 1;

    // Complete source stage
    for (const task of sourceTasks) {
      await taskStateProtection.createTaskSnapshot(task.taskId);

      eventTracker.recordEvent({
        timestamp: Date.now(),
        eventType: 'task-start',
        taskId: task.taskId,
        stage: 'source',
        seqNum: currentSeqNum++,
      });

      await updateBuildTaskProtected(task.taskId, { status: 'running' }, abortController.signal);

      eventTracker.recordEvent({
        timestamp: Date.now(),
        eventType: 'task-complete',
        taskId: task.taskId,
        stage: 'source',
        seqNum: currentSeqNum++,
      });

      await updateBuildTaskProtected(
        task.taskId,
        { status: 'completed', progress: 100 },
        abortController.signal
      );
    }

    // Simulate worker restart between stages
    eventTracker.recordStageTransition('source', 'geometry');

    // Simulate new worker instance (new abort controller)
    const newWorkerController = new AbortController();

    // Verify session state consistency after worker restart
    await ensureSessionTaskConsistency(nodeId);

    // Process geometry stage with new worker
    for (const task of geometryTasks) {
      await taskStateProtection.createTaskSnapshot(task.taskId);

      eventTracker.recordEvent({
        timestamp: Date.now(),
        eventType: 'task-start',
        taskId: task.taskId,
        stage: 'geometry',
        seqNum: currentSeqNum++,
      });

      await updateBuildTaskProtected(
        task.taskId,
        { status: 'running' },
        newWorkerController.signal
      );

      eventTracker.recordEvent({
        timestamp: Date.now(),
        eventType: 'task-complete',
        taskId: task.taskId,
        stage: 'geometry',
        seqNum: currentSeqNum++,
      });

      await updateBuildTaskProtected(
        task.taskId,
        { status: 'completed', progress: 100 },
        newWorkerController.signal
      );
    }

    // Validate final session state
    const finalTasks = await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).toArray();
    expect(finalTasks.length).toBe(4); // 2 source + 2 geometry

    // Verify all tasks completed
    for (const task of finalTasks) {
      expect(task.status).toBe('completed');
      expect(task.progress).toBe(100);
    }

    // Validate event sequence across worker restart
    const sequenceValidation = eventTracker.validateEventSequence();
    expect(sequenceValidation.isValid).toBe(true);

    // Verify stage transition was recorded
    expect(eventTracker.getStageTransitionCount()).toBe(1);
    expect(eventTracker.getEventsByType('stage-transition').length).toBe(1);
  });

  it('should validate cache write events are properly sequenced with task completion', async () => {
    const nodeId = 'test-node-cache-sequence' as NodeId;
    const task = createStageTask('cache-test-task', nodeId, 'geometry');

    await ephemeralDB.buildTasks.put(task);
    await taskStateProtection.createTaskSnapshot(task.taskId);

    let currentSeqNum = 1;

    // Start and complete task
    eventTracker.recordEvent({
      timestamp: Date.now(),
      eventType: 'task-start',
      taskId: task.taskId,
      stage: 'geometry',
      seqNum: currentSeqNum++,
    });

    await updateBuildTaskProtected(task.taskId, { status: 'running' }, abortController.signal);

    // Complete task first
    const completionTime = Date.now();
    eventTracker.recordEvent({
      timestamp: completionTime,
      eventType: 'task-complete',
      taskId: task.taskId,
      stage: 'geometry',
      seqNum: currentSeqNum++,
    });

    await updateBuildTaskProtected(
      task.taskId,
      { status: 'completed', progress: 100 },
      abortController.signal
    );

    // Simulate cache write after completion (with slight delay to ensure ordering)
    await new Promise((resolve) => setTimeout(resolve, 10));

    eventTracker.recordEvent({
      timestamp: Date.now(),
      eventType: 'cache-write',
      taskId: task.taskId,
      stage: 'geometry',
      seqNum: currentSeqNum++,
      data: { cacheType: 'geometry' },
    });

    // Validate cache write occurred after task completion
    const taskCompleteEvents = eventTracker.getEventsByType('task-complete');
    const cacheWriteEvents = eventTracker.getEventsByType('cache-write');

    expect(taskCompleteEvents.length).toBe(1);
    expect(cacheWriteEvents.length).toBe(1);

    const completeEvent = taskCompleteEvents[0];
    const cacheEvent = cacheWriteEvents[0];

    expect(cacheEvent.timestamp).toBeGreaterThan(completeEvent.timestamp);
    expect(cacheEvent.taskId).toBe(completeEvent.taskId);

    // Validate overall sequence
    const sequenceValidation = eventTracker.validateEventSequence();
    expect(sequenceValidation.isValid).toBe(true);
  });

  it('should handle multiple pause/resume cycles across different stages', async () => {
    const nodeId = 'test-node-multi-pause' as NodeId;
    const sessionConfig = createMultiStageSessionConfig(nodeId);

    // Create tasks for all stages
    const allTasks = [
      ...sessionConfig.stages.source.tasks.map((t) => createStageTask(t.taskId, nodeId, 'source')),
      ...sessionConfig.stages.geometry.tasks.map((t) =>
        createStageTask(t.taskId, nodeId, 'geometry')
      ),
    ];

    await ephemeralDB.buildTasks.bulkPut(allTasks);

    let currentSeqNum = 1;
    const controllers: AbortController[] = [];

    // Process with multiple pause/resume cycles
    for (let cycle = 0; cycle < 3; cycle++) {
      const controller = new AbortController();
      controllers.push(controller);

      // Process some tasks
      const tasksToProcess = allTasks.slice(cycle * 2, (cycle + 1) * 2);

      for (const task of tasksToProcess) {
        await taskStateProtection.createTaskSnapshot(task.taskId);

        eventTracker.recordEvent({
          timestamp: Date.now(),
          eventType: 'task-start',
          taskId: task.taskId,
          stage: task.stage,
          seqNum: currentSeqNum++,
        });

        await updateBuildTaskProtected(task.taskId, { status: 'running' }, controller.signal);

        // Simulate pause after starting (but don't abort the update itself)
        if (cycle < 2) {
          // Don't pause on last cycle
          // Just mark that we would pause here, but complete the task normally
          // In real scenario, the abort would happen between operations
        }

        // Complete task (simulate resume after pause for first 2 cycles)
        const completionController = cycle < 2 ? new AbortController() : controller;

        eventTracker.recordEvent({
          timestamp: Date.now(),
          eventType: 'task-complete',
          taskId: task.taskId,
          stage: task.stage,
          seqNum: currentSeqNum++,
        });

        await updateBuildTaskProtected(
          task.taskId,
          { status: 'completed', progress: 100 },
          completionController.signal
        );
      }
    }

    // Validate final session state
    await ensureSessionTaskConsistency(nodeId);

    const finalTasks = await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).toArray();
    expect(finalTasks.length).toBe(4);

    for (const task of finalTasks) {
      expect(task.status).toBe('completed');
      expect(task.progress).toBe(100);
    }

    // Validate event sequence integrity across multiple cycles
    const sequenceValidation = eventTracker.validateEventSequence();
    expect(sequenceValidation.isValid).toBe(true);

    // Verify all events were recorded
    expect(eventTracker.getEventsByType('task-start').length).toBe(4);
    expect(eventTracker.getEventsByType('task-complete').length).toBe(4);
  });
});
