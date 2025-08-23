/**
 * Ephemeral Data Cleanup Service
 * Manages automatic cleanup of expired WorkingCopies and batch processing data
 */

import { EntityId, NodeId } from '@hierarchidb/00-core';
import { BatchSession, ShapeWorkingCopy } from '../../shared';

export interface CleanupStatistics {
  workingCopiesDeleted: number;
  batchSessionsDeleted: number;
  batchTasksDeleted: number;
  processedResultsDeleted: number;
  totalSizeReclaimed: number;
  startTime: number;
  endTime: number;
}

/**
 * Service for managing ephemeral data lifecycle and cleanup
 */
export class EphemeralDataCleanupService {
  private readonly EXPIRY_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start automatic cleanup process
   */
  startAutoCleanup(): void {
    if (this.intervalId) {
      return; // Already running
    }

    this.intervalId = setInterval(() => {
      this.cleanupExpiredData().catch(error => {
        console.error('Auto cleanup failed:', error);
      });
    }, this.CLEANUP_INTERVAL_MS);

    console.log('EphemeralDataCleanupService: Auto cleanup started');
  }

  /**
   * Stop automatic cleanup process
   */
  stopAutoCleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('EphemeralDataCleanupService: Auto cleanup stopped');
    }
  }

  /**
   * Perform cleanup of all expired ephemeral data
   */
  async cleanupExpiredData(): Promise<CleanupStatistics> {
    const startTime = Date.now();
    const expiredThreshold = startTime - this.EXPIRY_THRESHOLD_MS;

    console.log(`Starting ephemeral data cleanup for data older than ${new Date(expiredThreshold).toISOString()}`);

    const stats: CleanupStatistics = {
      workingCopiesDeleted: 0,
      batchSessionsDeleted: 0,
      batchTasksDeleted: 0,
      processedResultsDeleted: 0,
      totalSizeReclaimed: 0,
      startTime,
      endTime: 0
    };

    try {
      // Mock implementation - in real version would use actual EphemeralDB
      await this.mockCleanupTransaction(expiredThreshold, stats);
    } catch (error) {
      console.error('Cleanup transaction failed:', error);
      throw error;
    }

    stats.endTime = Date.now();
    
    console.log(`Cleanup completed in ${stats.endTime - stats.startTime}ms:`, {
      workingCopiesDeleted: stats.workingCopiesDeleted,
      batchSessionsDeleted: stats.batchSessionsDeleted,
      batchTasksDeleted: stats.batchTasksDeleted,
      totalSizeReclaimed: this.formatBytes(stats.totalSizeReclaimed)
    });

    return stats;
  }

  /**
   * Cleanup specific working copy and related data
   */
  async cleanupWorkingCopy(workingCopyId: EntityId): Promise<void> {
    console.log(`Cleaning up working copy: ${workingCopyId}`);
    
    try {
      // Mock implementation - would perform actual cleanup
      await this.mockCleanupWorkingCopyTransaction(workingCopyId);
      
      console.log(`Working copy ${workingCopyId} and related data cleaned up successfully`);
    } catch (error) {
      console.error(`Failed to cleanup working copy ${workingCopyId}:`, error);
      throw error;
    }
  }

  /**
   * Cleanup specific batch session and related data
   */
  async cleanupBatchSession(sessionId: string): Promise<void> {
    console.log(`Cleaning up batch session: ${sessionId}`);
    
    try {
      // Mock implementation - would perform actual cleanup
      await this.mockCleanupBatchSessionTransaction(sessionId);
      
      console.log(`Batch session ${sessionId} and related data cleaned up successfully`);
    } catch (error) {
      console.error(`Failed to cleanup batch session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get cleanup statistics without performing cleanup
   */
  async getCleanupPreview(): Promise<{
    expiredWorkingCopies: number;
    expiredBatchSessions: number;
    estimatedSizeToReclaim: number;
  }> {
    const expiredThreshold = Date.now() - this.EXPIRY_THRESHOLD_MS;
    
    // Mock implementation - would query actual databases
    return {
      expiredWorkingCopies: 5,
      expiredBatchSessions: 3,
      estimatedSizeToReclaim: 1024 * 1024 * 50 // 50MB
    };
  }

  /**
   * Force cleanup of all ephemeral data (emergency cleanup)
   */
  async forceCleanupAll(): Promise<CleanupStatistics> {
    console.warn('FORCE CLEANUP: Removing all ephemeral data regardless of age');
    
    const startTime = Date.now();
    const stats: CleanupStatistics = {
      workingCopiesDeleted: 0,
      batchSessionsDeleted: 0,
      batchTasksDeleted: 0,
      processedResultsDeleted: 0,
      totalSizeReclaimed: 0,
      startTime,
      endTime: 0
    };

    try {
      // Mock implementation - would clear all ephemeral databases
      await this.mockForceCleanupTransaction(stats);
    } catch (error) {
      console.error('Force cleanup failed:', error);
      throw error;
    }

    stats.endTime = Date.now();
    
    console.warn(`Force cleanup completed in ${stats.endTime - stats.startTime}ms:`, stats);
    
    return stats;
  }

  /**
   * Private helper methods - Mock implementations
   */

  private async mockCleanupTransaction(expiredThreshold: number, stats: CleanupStatistics): Promise<void> {
    // Simulate database transaction
    console.log('Mock: Starting cleanup transaction');
    
    // Mock working copies cleanup
    const expiredWorkingCopies = this.mockFindExpiredWorkingCopies(expiredThreshold);
    stats.workingCopiesDeleted = expiredWorkingCopies.length;
    
    // Mock batch sessions cleanup
    const expiredBatchSessions = this.mockFindExpiredBatchSessions(expiredThreshold);
    stats.batchSessionsDeleted = expiredBatchSessions.length;
    
    // Mock batch tasks cleanup
    stats.batchTasksDeleted = expiredBatchSessions.length * 5; // Average 5 tasks per session
    
    // Mock processed results cleanup
    stats.processedResultsDeleted = expiredWorkingCopies.length * 2; // Average 2 results per working copy
    
    // Mock size calculation
    stats.totalSizeReclaimed = (stats.workingCopiesDeleted * 1024 * 1024) + // 1MB per working copy
                              (stats.batchTasksDeleted * 512 * 1024); // 512KB per task
    
    // Simulate cleanup delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Mock: Cleanup transaction completed');
  }

  private async mockCleanupWorkingCopyTransaction(workingCopyId: EntityId): Promise<void> {
    console.log(`Mock: Cleaning up working copy ${workingCopyId} and related data`);
    
    // Simulate removal of:
    // - Working copy record
    // - Associated batch sessions
    // - Batch tasks
    // - Processed results
    // - Cached data
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async mockCleanupBatchSessionTransaction(sessionId: string): Promise<void> {
    console.log(`Mock: Cleaning up batch session ${sessionId} and related data`);
    
    // Simulate removal of:
    // - Batch session record
    // - Associated batch tasks
    // - Temporary processed data
    // - Download cache entries
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async mockForceCleanupTransaction(stats: CleanupStatistics): Promise<void> {
    // Simulate clearing all tables
    stats.workingCopiesDeleted = 25;
    stats.batchSessionsDeleted = 15;
    stats.batchTasksDeleted = 75;
    stats.processedResultsDeleted = 50;
    stats.totalSizeReclaimed = 100 * 1024 * 1024; // 100MB
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  private mockFindExpiredWorkingCopies(expiredThreshold: number): ShapeWorkingCopy[] {
    // Mock expired working copies
    return [
      { updatedAt: expiredThreshold - 1000 } as ShapeWorkingCopy,
      { updatedAt: expiredThreshold - 2000 } as ShapeWorkingCopy,
    ];
  }

  private mockFindExpiredBatchSessions(expiredThreshold: number): BatchSession[] {
    // Mock expired batch sessions
    return [
      { updatedAt: expiredThreshold - 1000 } as BatchSession,
    ];
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Global instance for automatic cleanup
export const ephemeralDataCleanupService = new EphemeralDataCleanupService();

// Auto-start cleanup service in worker environment
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  ephemeralDataCleanupService.startAutoCleanup();
}