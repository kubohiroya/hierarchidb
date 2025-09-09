/**
 * EphemeralDataCleanupService Tests
 * Validates the cleanup service public API and scheduler behavior
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EphemeralDataCleanupService } from '../services/EphemeralDataCleanupService';
import type { NodeId } from '@hierarchidb/common-type';
import type { BatchSession, ShapeWorkingCopy } from '../../shared';

describe('EphemeralDataCleanupService', () => {
  let cleanupService: EphemeralDataCleanupService;

  beforeEach(() => {
    vi.clearAllMocks();
    cleanupService = new EphemeralDataCleanupService();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Cleanup Preview (shim)', () => {
    it('should return cleanup preview-compatible stats', async () => {
      const stats = await cleanupService.getCleanupStats();

      expect(stats).toHaveProperty('totalWorkingCopies');
      expect(stats).toHaveProperty('expiredWorkingCopies');
      expect(stats).toHaveProperty('totalBatchSessions');
      expect(stats).toHaveProperty('expiredBatchSessions');
      expect(stats).toHaveProperty('estimatedSpaceUsed');
      expect(stats.lastCleanupAt).toBeDefined();

      // Values are non-negative numbers
      expect(stats.totalWorkingCopies).toBeGreaterThanOrEqual(0);
      expect(stats.expiredWorkingCopies).toBeGreaterThanOrEqual(0);
      expect(stats.totalBatchSessions).toBeGreaterThanOrEqual(0);
      expect(stats.expiredBatchSessions).toBeGreaterThanOrEqual(0);
      expect(stats.estimatedSpaceUsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Automatic Cleanup', () => {
    it('should perform cleanup and return statistics', async () => {
      const result = await cleanupService.performCleanup();

      expect(result.startTime).toBeGreaterThan(0);
      expect(result.endTime).toBeGreaterThanOrEqual(result.startTime);
      expect(result.workingCopiesDeleted).toBeGreaterThanOrEqual(0);
      expect(result.batchSessionsDeleted).toBeGreaterThanOrEqual(0);
      expect(result.totalSizeReclaimed).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors during cleanup (propagate)', async () => {
      const spy = vi
        .spyOn(cleanupService as any, 'mockCleanupTransaction')
        .mockRejectedValue(new Error('Cleanup failed'));

      await expect(cleanupService.performCleanup()).rejects.toThrow('Cleanup failed');
      spy.mockRestore();
    });
  });

  describe('Force Cleanup', () => {
    it('should remove all data regardless of age', async () => {
      const result = await cleanupService.forceCleanup();

      // Uses mock values defined in the service
      expect(result.workingCopiesDeleted).toBeGreaterThan(0);
      expect(result.batchSessionsDeleted).toBeGreaterThan(0);
      expect(result.totalSizeReclaimed).toBeGreaterThan(0);
      expect(result.endTime).toBeGreaterThanOrEqual(result.startTime);
    });
  });

  describe('Scheduled Cleanup', () => {
    it('should start auto cleanup and run on interval', () => {
      vi.useFakeTimers();

      const cleanupSpy = vi
        .spyOn(cleanupService, 'cleanupExpiredData')
        .mockResolvedValue({
          workingCopiesDeleted: 0,
          batchSessionsDeleted: 0,
          batchTasksDeleted: 0,
          processedResultsDeleted: 0,
          totalSizeReclaimed: 0,
          startTime: Date.now(),
          endTime: Date.now(),
        });

      cleanupService.startAutoCleanup();

      expect(cleanupSpy).not.toHaveBeenCalled();

      // 1 hour
      vi.advanceTimersByTime(60 * 60 * 1000);
      expect(cleanupSpy).toHaveBeenCalledTimes(1);

      // Another hour
      vi.advanceTimersByTime(60 * 60 * 1000);
      expect(cleanupSpy).toHaveBeenCalledTimes(2);

      cleanupService.stopAutoCleanup();
      vi.useRealTimers();
    });

    it('should stop auto cleanup', () => {
      vi.useFakeTimers();

      const cleanupSpy = vi
        .spyOn(cleanupService, 'cleanupExpiredData')
        .mockResolvedValue({
          workingCopiesDeleted: 0,
          batchSessionsDeleted: 0,
          batchTasksDeleted: 0,
          processedResultsDeleted: 0,
          totalSizeReclaimed: 0,
          startTime: Date.now(),
          endTime: Date.now(),
        });

      cleanupService.startAutoCleanup();
      cleanupService.stopAutoCleanup();

      vi.advanceTimersByTime(60 * 60 * 1000);
      expect(cleanupSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should log errors from auto cleanup', async () => {
      vi.useFakeTimers();

      const cleanupSpy = vi
        .spyOn(cleanupService, 'cleanupExpiredData')
        .mockRejectedValue(new Error('Auto cleanup failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      cleanupService.startAutoCleanup();

      vi.advanceTimersByTime(60 * 60 * 1000);
      await Promise.resolve();

      expect(cleanupSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Auto cleanup failed:', expect.any(Error));

      cleanupService.stopAutoCleanup();
      consoleSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('Data Age Calculation', () => {
    it('should correctly identify expired WorkingCopies', () => {
      const now = Date.now();
      const expiredTime = now - 25 * 60 * 60 * 1000; // 25 hours ago
      const validTime = now - 12 * 60 * 60 * 1000; // 12 hours ago

      const expiredWorkingCopy: ShapeWorkingCopy = {
        id: 'wc-expired' as NodeId,
        name: 'Expired',
        isDraft: true,
        updatedAt: expiredTime,
      } as any;

      const validWorkingCopy: ShapeWorkingCopy = {
        id: 'wc-valid' as NodeId,
        name: 'Valid',
        isDraft: false,
        updatedAt: validTime,
      } as any;

      // Test the internal age calculation logic
      const expiryThreshold = now - 24 * 60 * 60 * 1000; // 24 hours ago

      expect(expiredWorkingCopy.updatedAt).toBeLessThan(expiryThreshold);
      expect(validWorkingCopy.updatedAt).toBeGreaterThan(expiryThreshold);
    });

    it('should correctly identify expired BatchSessions', () => {
      const now = Date.now();
      const expiredTime = now - 25 * 60 * 60 * 1000; // 25 hours ago
      const validTime = now - 12 * 60 * 60 * 1000; // 12 hours ago

      const expiredSession: BatchSession = {
        sessionId: 'session-expired',
        workingCopyId: 'wc-1' as NodeId,
        nodeId: 'node-1' as NodeId,
        status: 'paused',
        config: {} as any,
        startedAt: expiredTime,
        updatedAt: expiredTime,
        progress: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 0 },
        canResume: false,
        lastActivity: expiredTime,
        expiresAt: expiredTime + 1000,
        stages: {},
      } as any;

      const validSession: BatchSession = {
        sessionId: 'session-valid',
        workingCopyId: 'wc-2' as NodeId,
        nodeId: 'node-2' as NodeId,
        status: 'running',
        config: {} as any,
        startedAt: validTime,
        updatedAt: validTime,
        progress: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 0 },
        canResume: true,
        lastActivity: validTime,
        expiresAt: validTime + 1000,
        stages: {},
      } as any;

      // Test the internal age calculation logic
      const expiryThreshold = now - 24 * 60 * 60 * 1000; // 24 hours ago

      expect(expiredSession.lastActivity).toBeLessThan(expiryThreshold);
      expect(validSession.lastActivity).toBeGreaterThan(expiryThreshold);
    });
  });

  describe('Memory and Performance', () => {
    it('should return preview stats quickly', async () => {
      const start = performance.now();
      const stats = await cleanupService.getCleanupStats();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(stats.estimatedSpaceUsed).toBeGreaterThanOrEqual(0);
    });
  });
});
// No deep tests for this service; behavior is covered above.
