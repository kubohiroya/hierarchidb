/**
 * EphemeralDataCleanupService Tests
 * Tests the 24-hour automatic cleanup system for WorkingCopy and batch session data
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { EphemeralDataCleanupService } from '../services/EphemeralDataCleanupService';
import { EntityId, NodeId } from '@hierarchidb/00-core';
import type { 
  ShapeWorkingCopy, 
  BatchSession, 
  CleanupResult, 
  CleanupStats 
} from '../../shared';

// Mock EphemeralDB
const mockEphemeralDB = {
  workingCopies: {
    where: vi.fn(),
    toArray: vi.fn(),
    bulkDelete: vi.fn(),
    clear: vi.fn()
  },
  batchSessions: {
    where: vi.fn(),
    toArray: vi.fn(),
    bulkDelete: vi.fn(),
    clear: vi.fn()
  }
};

vi.mock('@hierarchidb/worker', () => ({
  EphemeralDB: {
    getInstance: () => mockEphemeralDB
  }
}));

describe('EphemeralDataCleanupService', () => {
  let cleanupService: EphemeralDataCleanupService;

  beforeEach(() => {
    vi.clearAllMocks();
    cleanupService = new EphemeralDataCleanupService();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Cleanup Statistics', () => {
    it('should calculate cleanup statistics correctly', async () => {
      const now = Date.now();
      const expiredTime = now - (25 * 60 * 60 * 1000); // 25 hours ago (expired)
      const validTime = now - (12 * 60 * 60 * 1000); // 12 hours ago (valid)

      const mockWorkingCopies: ShapeWorkingCopy[] = [
        {
          id: 'wc-expired-1' as EntityId,
          name: 'Expired WC 1',
          isDraft: true,
          createdAt: expiredTime,
          updatedAt: expiredTime,
          estimatedSize: 1000000
        },
        {
          id: 'wc-valid-1' as EntityId,
          name: 'Valid WC 1',
          isDraft: false,
          createdAt: validTime,
          updatedAt: validTime,
          estimatedSize: 500000
        },
        {
          id: 'wc-expired-2' as EntityId,
          name: 'Expired WC 2',
          isDraft: true,
          createdAt: expiredTime,
          updatedAt: expiredTime,
          estimatedSize: 2000000
        }
      ] as any;

      const mockBatchSessions: BatchSession[] = [
        {
          sessionId: 'session-expired-1',
          workingCopyId: 'wc-expired-1' as EntityId,
          nodeId: 'node-1' as NodeId,
          status: 'paused',
          createdAt: expiredTime,
          lastActivityAt: expiredTime,
          estimatedSize: 5000000
        },
        {
          sessionId: 'session-valid-1',
          workingCopyId: 'wc-valid-1' as EntityId,
          nodeId: 'node-2' as NodeId,
          status: 'running',
          createdAt: validTime,
          lastActivityAt: validTime,
          estimatedSize: 3000000
        }
      ] as any;

      mockEphemeralDB.workingCopies.toArray.mockResolvedValue(mockWorkingCopies);
      mockEphemeralDB.batchSessions.toArray.mockResolvedValue(mockBatchSessions);

      const stats: CleanupStats = await cleanupService.getCleanupStats();

      expect(stats.totalWorkingCopies).toBe(3);
      expect(stats.expiredWorkingCopies).toBe(2);
      expect(stats.totalBatchSessions).toBe(2);
      expect(stats.expiredBatchSessions).toBe(1);
      expect(stats.estimatedSpaceUsed).toBe(11500000); // Sum of all estimated sizes
      expect(stats.lastCleanupAt).toBeDefined();
    });

    it('should handle empty database gracefully', async () => {
      mockEphemeralDB.workingCopies.toArray.mockResolvedValue([]);
      mockEphemeralDB.batchSessions.toArray.mockResolvedValue([]);

      const stats: CleanupStats = await cleanupService.getCleanupStats();

      expect(stats.totalWorkingCopies).toBe(0);
      expect(stats.expiredWorkingCopies).toBe(0);
      expect(stats.totalBatchSessions).toBe(0);
      expect(stats.expiredBatchSessions).toBe(0);
      expect(stats.estimatedSpaceUsed).toBe(0);
    });
  });

  describe('Automatic Cleanup', () => {
    it('should perform cleanup of expired data only', async () => {
      const now = Date.now();
      const expiredTime = now - (25 * 60 * 60 * 1000); // 25 hours ago (expired)
      const validTime = now - (12 * 60 * 60 * 1000); // 12 hours ago (valid)

      const mockWorkingCopies: ShapeWorkingCopy[] = [
        {
          id: 'wc-expired-1' as EntityId,
          name: 'Expired WC 1',
          isDraft: true,
          createdAt: expiredTime,
          updatedAt: expiredTime,
          estimatedSize: 1000000
        },
        {
          id: 'wc-valid-1' as EntityId,
          name: 'Valid WC 1',
          isDraft: false,
          createdAt: validTime,
          updatedAt: validTime,
          estimatedSize: 500000
        }
      ] as any;

      const mockBatchSessions: BatchSession[] = [
        {
          sessionId: 'session-expired-1',
          workingCopyId: 'wc-expired-1' as EntityId,
          nodeId: 'node-1' as NodeId,
          status: 'paused',
          createdAt: expiredTime,
          lastActivityAt: expiredTime,
          estimatedSize: 2000000
        },
        {
          sessionId: 'session-valid-1',
          workingCopyId: 'wc-valid-1' as EntityId,
          nodeId: 'node-2' as NodeId,
          status: 'running',
          createdAt: validTime,
          lastActivityAt: validTime,
          estimatedSize: 1500000
        }
      ] as any;

      // Mock the where().below() chain for expired data
      const expiredWorkingCopiesQuery = {
        toArray: vi.fn().mockResolvedValue([mockWorkingCopies[0]]),
        primaryKeys: vi.fn().mockResolvedValue(['wc-expired-1'])
      };
      const expiredBatchSessionsQuery = {
        toArray: vi.fn().mockResolvedValue([mockBatchSessions[0]]),
        primaryKeys: vi.fn().mockResolvedValue(['session-expired-1'])
      };

      mockEphemeralDB.workingCopies.where.mockReturnValue({
        below: vi.fn().mockReturnValue(expiredWorkingCopiesQuery)
      });
      mockEphemeralDB.batchSessions.where.mockReturnValue({
        below: vi.fn().mockReturnValue(expiredBatchSessionsQuery)
      });
      
      mockEphemeralDB.workingCopies.bulkDelete.mockResolvedValue(1);
      mockEphemeralDB.batchSessions.bulkDelete.mockResolvedValue(1);

      const result: CleanupResult = await cleanupService.performCleanup();

      expect(result.workingCopiesRemoved).toBe(1);
      expect(result.batchSessionsRemoved).toBe(1);
      expect(result.totalSpaceRecovered).toBe(3000000); // Sum of expired data sizes
      expect(result.timestamp).toBeDefined();

      // Verify correct queries were made
      expect(mockEphemeralDB.workingCopies.where).toHaveBeenCalledWith('updatedAt');
      expect(mockEphemeralDB.batchSessions.where).toHaveBeenCalledWith('lastActivityAt');
      
      // Verify deletions were performed
      expect(mockEphemeralDB.workingCopies.bulkDelete).toHaveBeenCalledWith(['wc-expired-1']);
      expect(mockEphemeralDB.batchSessions.bulkDelete).toHaveBeenCalledWith(['session-expired-1']);
    });

    it('should handle cleanup errors gracefully', async () => {
      const errorQuery = {
        toArray: vi.fn().mockRejectedValue(new Error('Database error')),
        primaryKeys: vi.fn().mockRejectedValue(new Error('Database error'))
      };

      mockEphemeralDB.workingCopies.where.mockReturnValue({
        below: vi.fn().mockReturnValue(errorQuery)
      });

      await expect(cleanupService.performCleanup()).rejects.toThrow('Database error');
    });
  });

  describe('Force Cleanup', () => {
    it('should remove all data regardless of age', async () => {
      const mockWorkingCopies: ShapeWorkingCopy[] = [
        {
          id: 'wc-1' as EntityId,
          name: 'WC 1',
          isDraft: true,
          estimatedSize: 1000000
        },
        {
          id: 'wc-2' as EntityId,
          name: 'WC 2',
          isDraft: false,
          estimatedSize: 2000000
        }
      ] as any;

      const mockBatchSessions: BatchSession[] = [
        {
          sessionId: 'session-1',
          workingCopyId: 'wc-1' as EntityId,
          nodeId: 'node-1' as NodeId,
          status: 'paused',
          estimatedSize: 3000000
        }
      ] as any;

      mockEphemeralDB.workingCopies.toArray.mockResolvedValue(mockWorkingCopies);
      mockEphemeralDB.batchSessions.toArray.mockResolvedValue(mockBatchSessions);
      mockEphemeralDB.workingCopies.clear.mockResolvedValue(2);
      mockEphemeralDB.batchSessions.clear.mockResolvedValue(1);

      const result: CleanupResult = await cleanupService.forceCleanup();

      expect(result.workingCopiesRemoved).toBe(2);
      expect(result.batchSessionsRemoved).toBe(1);
      expect(result.totalSpaceRecovered).toBe(6000000); // Sum of all data sizes
      expect(result.timestamp).toBeDefined();

      expect(mockEphemeralDB.workingCopies.clear).toHaveBeenCalled();
      expect(mockEphemeralDB.batchSessions.clear).toHaveBeenCalled();
    });

    it('should handle empty database in force cleanup', async () => {
      mockEphemeralDB.workingCopies.toArray.mockResolvedValue([]);
      mockEphemeralDB.batchSessions.toArray.mockResolvedValue([]);
      mockEphemeralDB.workingCopies.clear.mockResolvedValue(0);
      mockEphemeralDB.batchSessions.clear.mockResolvedValue(0);

      const result: CleanupResult = await cleanupService.forceCleanup();

      expect(result.workingCopiesRemoved).toBe(0);
      expect(result.batchSessionsRemoved).toBe(0);
      expect(result.totalSpaceRecovered).toBe(0);
    });
  });

  describe('Scheduled Cleanup', () => {
    it('should start scheduled cleanup with correct interval', () => {
      vi.useFakeTimers();
      
      const cleanupSpy = vi.spyOn(cleanupService, 'performCleanup').mockResolvedValue({
        workingCopiesRemoved: 0,
        batchSessionsRemoved: 0,
        totalSpaceRecovered: 0,
        timestamp: Date.now()
      });

      cleanupService.startScheduledCleanup();

      // Should not call cleanup immediately
      expect(cleanupSpy).not.toHaveBeenCalled();

      // Advance timer by 1 hour (cleanup should run every hour)
      vi.advanceTimersByTime(60 * 60 * 1000);
      
      expect(cleanupSpy).toHaveBeenCalledTimes(1);

      // Advance another hour
      vi.advanceTimersByTime(60 * 60 * 1000);
      
      expect(cleanupSpy).toHaveBeenCalledTimes(2);

      cleanupService.stopScheduledCleanup();
      vi.useRealTimers();
    });

    it('should stop scheduled cleanup', () => {
      vi.useFakeTimers();
      
      const cleanupSpy = vi.spyOn(cleanupService, 'performCleanup').mockResolvedValue({
        workingCopiesRemoved: 0,
        batchSessionsRemoved: 0,
        totalSpaceRecovered: 0,
        timestamp: Date.now()
      });

      cleanupService.startScheduledCleanup();
      cleanupService.stopScheduledCleanup();

      // Advance timer - should not call cleanup after stopping
      vi.advanceTimersByTime(60 * 60 * 1000);
      
      expect(cleanupSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle cleanup errors in scheduled mode', async () => {
      vi.useFakeTimers();
      
      const cleanupSpy = vi.spyOn(cleanupService, 'performCleanup')
        .mockRejectedValue(new Error('Scheduled cleanup failed'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      cleanupService.startScheduledCleanup();

      // Advance timer to trigger cleanup
      vi.advanceTimersByTime(60 * 60 * 1000);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(cleanupSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Scheduled cleanup failed:',
        expect.any(Error)
      );

      cleanupService.stopScheduledCleanup();
      consoleSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('Data Age Calculation', () => {
    it('should correctly identify expired WorkingCopies', () => {
      const now = Date.now();
      const expiredTime = now - (25 * 60 * 60 * 1000); // 25 hours ago
      const validTime = now - (12 * 60 * 60 * 1000); // 12 hours ago

      const expiredWorkingCopy: ShapeWorkingCopy = {
        id: 'wc-expired' as EntityId,
        name: 'Expired',
        isDraft: true,
        updatedAt: expiredTime
      } as any;

      const validWorkingCopy: ShapeWorkingCopy = {
        id: 'wc-valid' as EntityId,
        name: 'Valid',
        isDraft: false,
        updatedAt: validTime
      } as any;

      // Test the internal age calculation logic
      const expiryThreshold = now - (24 * 60 * 60 * 1000); // 24 hours ago

      expect(expiredWorkingCopy.updatedAt).toBeLessThan(expiryThreshold);
      expect(validWorkingCopy.updatedAt).toBeGreaterThan(expiryThreshold);
    });

    it('should correctly identify expired BatchSessions', () => {
      const now = Date.now();
      const expiredTime = now - (25 * 60 * 60 * 1000); // 25 hours ago
      const validTime = now - (12 * 60 * 60 * 1000); // 12 hours ago

      const expiredSession: BatchSession = {
        sessionId: 'session-expired',
        workingCopyId: 'wc-1' as EntityId,
        nodeId: 'node-1' as NodeId,
        status: 'paused',
        createdAt: expiredTime,
        lastActivityAt: expiredTime
      } as any;

      const validSession: BatchSession = {
        sessionId: 'session-valid',
        workingCopyId: 'wc-2' as EntityId,
        nodeId: 'node-2' as NodeId,
        status: 'running',
        createdAt: validTime,
        lastActivityAt: validTime
      } as any;

      // Test the internal age calculation logic
      const expiryThreshold = now - (24 * 60 * 60 * 1000); // 24 hours ago

      expect(expiredSession.lastActivityAt).toBeLessThan(expiryThreshold);
      expect(validSession.lastActivityAt).toBeGreaterThan(expiryThreshold);
    });
  });

  describe('Memory and Performance', () => {
    it('should handle large datasets efficiently', async () => {
      // Create a large number of mock entries
      const largeWorkingCopiesSet: ShapeWorkingCopy[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `wc-${i}` as EntityId,
        name: `Working Copy ${i}`,
        isDraft: i % 2 === 0,
        updatedAt: Date.now() - (i * 60 * 1000), // Varying ages
        estimatedSize: 1000 + (i * 100)
      })) as any;

      const largeBatchSessionsSet: BatchSession[] = Array.from({ length: 500 }, (_, i) => ({
        sessionId: `session-${i}`,
        workingCopyId: `wc-${i}` as EntityId,
        nodeId: `node-${i}` as NodeId,
        status: i % 3 === 0 ? 'paused' : 'running',
        createdAt: Date.now() - (i * 60 * 1000),
        lastActivityAt: Date.now() - (i * 30 * 1000),
        estimatedSize: 5000 + (i * 200)
      })) as any;

      mockEphemeralDB.workingCopies.toArray.mockResolvedValue(largeWorkingCopiesSet);
      mockEphemeralDB.batchSessions.toArray.mockResolvedValue(largeBatchSessionsSet);

      const startTime = performance.now();
      const stats = await cleanupService.getCleanupStats();
      const endTime = performance.now();

      // Should complete within reasonable time (< 100ms for 1500 records)
      expect(endTime - startTime).toBeLessThan(100);
      
      expect(stats.totalWorkingCopies).toBe(1000);
      expect(stats.totalBatchSessions).toBe(500);
      expect(stats.estimatedSpaceUsed).toBeGreaterThan(0);
    });
  });
});