import { describe, it, expect } from 'vitest';
import { computeProgressFromTasks, computeStagesFromTasks } from '../sessionHelpers.js';
import type { EphemeralBuildTaskRecord } from '../EphemeralBuildState.js';

describe('sessionHelpers', () => {
  describe('computeProgressFromTasks', () => {
    it('should return zero progress for empty task array', () => {
      const result = computeProgressFromTasks([]);
      
      expect(result).toEqual({
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      });
    });

    it('should calculate progress for tasks with various statuses', () => {
      const tasks: EphemeralBuildTaskRecord[] = [
        { taskId: '1', nodeId: 'node1', status: 'completed', index: 0, stage: 'source', progress: 100 },
        { taskId: '2', nodeId: 'node1', status: 'completed', index: 1, stage: 'source', progress: 100 },
        { taskId: '3', nodeId: 'node1', status: 'failed', index: 2, stage: 'source', progress: 0 },
        { taskId: '4', nodeId: 'node1', status: 'running', index: 3, stage: 'geometry', progress: 50 },
        { taskId: '5', nodeId: 'node1', status: 'queued', index: 4, stage: 'geometry', progress: 0 },
      ];
      
      const result = computeProgressFromTasks(tasks);
      
      expect(result).toEqual({
        total: 5,
        completed: 2,
        failed: 1,
        skipped: 0,
        percentage: 40, // 2/5 * 100
      });
    });

    it('should calculate 100% progress when all tasks are completed', () => {
      const tasks: EphemeralBuildTaskRecord[] = [
        { taskId: '1', nodeId: 'node1', status: 'completed', index: 0, stage: 'source', progress: 100 },
        { taskId: '2', nodeId: 'node1', status: 'completed', index: 1, stage: 'geometry', progress: 100 },
        { taskId: '3', nodeId: 'node1', status: 'completed', index: 2, stage: 'tileEmit', progress: 100 },
      ];
      
      const result = computeProgressFromTasks(tasks);
      
      expect(result).toEqual({
        total: 3,
        completed: 3,
        failed: 0,
        skipped: 0,
        percentage: 100,
      });
    });

    it('should handle tasks with only failures', () => {
      const tasks: EphemeralBuildTaskRecord[] = [
        { taskId: '1', nodeId: 'node1', status: 'failed', index: 0, stage: 'source', progress: 0 },
        { taskId: '2', nodeId: 'node1', status: 'failed', index: 1, stage: 'source', progress: 0 },
      ];
      
      const result = computeProgressFromTasks(tasks);
      
      expect(result).toEqual({
        total: 2,
        completed: 0,
        failed: 2,
        skipped: 0,
        percentage: 0,
      });
    });
  });

  describe('computeStagesFromTasks', () => {
    it('should return all stages as queued with zero progress for empty task array', () => {
      const result = computeStagesFromTasks([]);
      
      expect(result).toEqual({
        source: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
        geometry: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
        tileEmit: { status: 'queued', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
      });
    });

    it('should aggregate tasks by stage and calculate per-stage progress', () => {
      const tasks: EphemeralBuildTaskRecord[] = [
        { taskId: '1', nodeId: 'node1', status: 'completed', index: 0, stage: 'source', progress: 100 },
        { taskId: '2', nodeId: 'node1', status: 'completed', index: 1, stage: 'source', progress: 100 },
        { taskId: '3', nodeId: 'node1', status: 'running', index: 2, stage: 'geometry', progress: 50 },
        { taskId: '4', nodeId: 'node1', status: 'queued', index: 3, stage: 'geometry', progress: 0 },
        { taskId: '5', nodeId: 'node1', status: 'queued', index: 4, stage: 'tileEmit', progress: 0 },
      ];
      
      const result = computeStagesFromTasks(tasks);
      
      expect(result.source).toEqual({
        status: 'completed',
        progress: 100,
        tasksTotal: 2,
        tasksCompleted: 2,
        tasksFailed: 0,
      });
      
      expect(result.geometry).toEqual({
        status: 'running',
        progress: 0,
        tasksTotal: 2,
        tasksCompleted: 0,
        tasksFailed: 0,
      });
      
      expect(result.tileEmit).toEqual({
        status: 'queued',
        progress: 0,
        tasksTotal: 1,
        tasksCompleted: 0,
        tasksFailed: 0,
      });
    });

    it('should mark stage as failed if any task failed', () => {
      const tasks: EphemeralBuildTaskRecord[] = [
        { taskId: '1', nodeId: 'node1', status: 'completed', index: 0, stage: 'source', progress: 100 },
        { taskId: '2', nodeId: 'node1', status: 'failed', index: 1, stage: 'source', progress: 0 },
        { taskId: '3', nodeId: 'node1', status: 'completed', index: 2, stage: 'source', progress: 100 },
      ];
      
      const result = computeStagesFromTasks(tasks);
      
      expect(result.source).toEqual({
        status: 'failed',
        progress: 66.66666666666666, // 2/3 * 100
        tasksTotal: 3,
        tasksCompleted: 2,
        tasksFailed: 1,
      });
    });

    it('should calculate correct progress percentage for partial completion', () => {
      const tasks: EphemeralBuildTaskRecord[] = [
        { taskId: '1', nodeId: 'node1', status: 'completed', index: 0, stage: 'geometry', progress: 100 },
        { taskId: '2', nodeId: 'node1', status: 'completed', index: 1, stage: 'geometry', progress: 100 },
        { taskId: '3', nodeId: 'node1', status: 'completed', index: 2, stage: 'geometry', progress: 100 },
        { taskId: '4', nodeId: 'node1', status: 'queued', index: 3, stage: 'geometry', progress: 0 },
      ];
      
      const result = computeStagesFromTasks(tasks);
      
      expect(result.geometry).toEqual({
        status: 'queued',
        progress: 75, // 3/4 * 100
        tasksTotal: 4,
        tasksCompleted: 3,
        tasksFailed: 0,
      });
    });

    it('should handle all three stages with different statuses', () => {
      const tasks: EphemeralBuildTaskRecord[] = [
        // Source stage: completed
        { taskId: '1', nodeId: 'node1', status: 'completed', index: 0, stage: 'source', progress: 100 },
        { taskId: '2', nodeId: 'node1', status: 'completed', index: 1, stage: 'source', progress: 100 },
        // Geometry stage: running
        { taskId: '3', nodeId: 'node1', status: 'completed', index: 2, stage: 'geometry', progress: 100 },
        { taskId: '4', nodeId: 'node1', status: 'running', index: 3, stage: 'geometry', progress: 50 },
        { taskId: '5', nodeId: 'node1', status: 'queued', index: 4, stage: 'geometry', progress: 0 },
        // TileEmit stage: queued
        { taskId: '6', nodeId: 'node1', status: 'queued', index: 5, stage: 'tileEmit', progress: 0 },
      ];
      
      const result = computeStagesFromTasks(tasks);
      
      expect(result.source).toEqual({
        status: 'completed',
        progress: 100,
        tasksTotal: 2,
        tasksCompleted: 2,
        tasksFailed: 0,
      });
      
      expect(result.geometry).toEqual({
        status: 'running',
        progress: 33.33333333333333, // 1/3 * 100
        tasksTotal: 3,
        tasksCompleted: 1,
        tasksFailed: 0,
      });
      
      expect(result.tileEmit).toEqual({
        status: 'queued',
        progress: 0,
        tasksTotal: 1,
        tasksCompleted: 0,
        tasksFailed: 0,
      });
    });

    it('should handle recycled task status', () => {
      const tasks: EphemeralBuildTaskRecord[] = [
        { taskId: '1', nodeId: 'node1', status: 'completed', index: 0, stage: 'source', progress: 100 },
        { taskId: '2', nodeId: 'node1', status: 'recycled', index: 1, stage: 'source', progress: 0 },
      ];
      
      const result = computeStagesFromTasks(tasks);
      
      expect(result.source).toEqual({
        status: 'queued',
        progress: 50, // 1/2 * 100
        tasksTotal: 2,
        tasksCompleted: 1,
        tasksFailed: 0,
      });
    });
  });
});
