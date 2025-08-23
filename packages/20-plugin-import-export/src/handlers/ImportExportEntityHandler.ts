/**
 * Import/Export Plugin - Entity Handler
 * Handles database operations for ImportExportEntity
 */

import type { 
  EntityHandler, 
  NodeId
} from '@hierarchidb/00-core';
import { generateEntityId } from '@hierarchidb/00-core';

// Use core utility instead of local implementation
import { 
  ImportExportEntity, 
  CreateImportExportData, 
  UpdateImportExportData,
  DEFAULT_SOURCE_CONFIG,
  DEFAULT_TARGET_CONFIG,
  DEFAULT_TRANSFORM_CONFIG,
  DEFAULT_PROGRESS,
  OperationStatus
} from '../types/ImportExportEntity';

/**
 * Entity handler for ImportExportEntity
 * Manages CRUD operations for import/export configurations
 */
export class ImportExportEntityHandler implements EntityHandler<ImportExportEntity, never, ImportExportEntity & { workingCopyId: string; copiedAt: number }> {
  // Context injection will be implemented at runtime by worker

  /**
   * Create a new ImportExportEntity
   */
  async createEntity(nodeId: NodeId, data?: Partial<ImportExportEntity>): Promise<ImportExportEntity> {
    const createData = data as unknown as CreateImportExportData;
    
    if (!createData?.name) {
      throw new Error('Operation name is required');
    }

    if (!createData?.operationType) {
      throw new Error('Operation type is required');
    }

    const now = Date.now();
    const entity: ImportExportEntity = {
      id: generateEntityId(),
      nodeId,
      name: createData.name,
      description: createData.description || '',
      operationType: createData.operationType,
      
      // Configuration with defaults
      sourceConfig: {
        ...DEFAULT_SOURCE_CONFIG,
        ...createData.sourceConfig,
      } as any,
      targetConfig: {
        ...DEFAULT_TARGET_CONFIG,
        ...createData.targetConfig,
      } as any,
      transformConfig: {
        ...DEFAULT_TRANSFORM_CONFIG,
        ...createData.transformConfig,
      },
      
      // Status and execution
      status: 'draft' as OperationStatus,
      progress: { ...DEFAULT_PROGRESS },
      executionHistory: [],
      
      // Optional scheduling
      schedule: createData.schedule ? {
        enabled: createData.schedule.enabled ?? false,
        scheduleType: createData.schedule.scheduleType ?? 'manual',
        ...createData.schedule,
      } : undefined,
      
      // Lifecycle
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // Use context if available (injected at runtime)
    // Runtime implementation will be injected by worker
    console.log('Creating entity:', entity);
    
    // Fallback for testing
    return entity;
  }

  /**
   * Get an ImportExportEntity by nodeId
   */
  async getEntity(nodeId: NodeId): Promise<ImportExportEntity | undefined> {
    // Runtime implementation will be injected by worker
    console.log('Getting entity for nodeId:', nodeId);
    return undefined;
  }

  /**
   * Update an ImportExportEntity
   */
  async updateEntity(nodeId: NodeId, data: Partial<ImportExportEntity>): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error(`Import/Export operation not found: ${nodeId}`);
    }

    const updateData = data as unknown as UpdateImportExportData;
    const updated: ImportExportEntity = {
      ...existing,
      ...updateData,
      // Merge configurations properly
      sourceConfig: updateData.sourceConfig ? {
        ...existing.sourceConfig,
        ...updateData.sourceConfig,
      } : existing.sourceConfig,
      targetConfig: updateData.targetConfig ? {
        ...existing.targetConfig,
        ...updateData.targetConfig,
      } : existing.targetConfig,
      transformConfig: updateData.transformConfig ? {
        ...existing.transformConfig,
        ...updateData.transformConfig,
      } : existing.transformConfig,
      schedule: updateData.schedule as any,
      nodeId, // Ensure nodeId is not overwritten
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    // Runtime implementation will be injected by worker
    console.log('Updating entity:', nodeId, updated);
  }

  /**
   * Delete an ImportExportEntity
   */
  async deleteEntity(nodeId: NodeId): Promise<void> {
    // Runtime implementation will be injected by worker
    console.log('Deleting entity:', nodeId);
  }

  // Placeholder implementations for base class abstract methods


  // Import/Export specific methods

  /**
   * Update operation status
   */
  async updateStatus(nodeId: NodeId, status: OperationStatus, message?: string): Promise<void> {
    const operation = await this.getEntity(nodeId);
    if (!operation) {
      throw new Error(`Operation not found: ${nodeId}`);
    }

    operation.status = status;
    operation.progress.status = status;
    if (message) {
      operation.progress.message = message;
    }
    operation.updatedAt = Date.now();

    await this.updateEntity(nodeId, operation);
  }

  /**
   * Update operation progress
   */
  async updateProgress(
    nodeId: NodeId, 
    processedRecords: number, 
    totalRecords?: number,
    currentStep?: string
  ): Promise<void> {
    const operation = await this.getEntity(nodeId);
    if (!operation) {
      throw new Error(`Operation not found: ${nodeId}`);
    }

    operation.progress.processedRecords = processedRecords;
    if (totalRecords !== undefined) {
      operation.progress.totalRecords = totalRecords;
      operation.progress.percentage = totalRecords > 0 ? (processedRecords / totalRecords) * 100 : 0;
    }
    if (currentStep) {
      operation.progress.currentStep = currentStep;
    }
    operation.updatedAt = Date.now();

    await this.updateEntity(nodeId, operation);
  }

  /**
   * Add execution record
   */
  async addExecutionRecord(nodeId: NodeId, record: any): Promise<void> {
    const operation = await this.getEntity(nodeId);
    if (!operation) {
      throw new Error(`Operation not found: ${nodeId}`);
    }

    operation.executionHistory.push(record as any);
    // Keep only last 10 execution records
    if (operation.executionHistory.length > 10) {
      operation.executionHistory = operation.executionHistory.slice(-10);
    }
    operation.updatedAt = Date.now();

    await this.updateEntity(nodeId, operation);
  }

  /**
   * Get operations by status
   */
  async getOperationsByStatus(status: OperationStatus): Promise<ImportExportEntity[]> {
    // Implementation would query database for operations with specific status
    console.log(`Getting operations with status: ${status}`);
    return [];
  }

  /**
   * Get operations by type
   */
  async getOperationsByType(operationType: string): Promise<ImportExportEntity[]> {
    // Implementation would query database for operations with specific type
    console.log(`Getting operations with type: ${operationType}`);
    return [];
  }

  /**
   * Get scheduled operations
   */
  async getScheduledOperations(): Promise<ImportExportEntity[]> {
    // Implementation would query database for operations with schedules
    console.log('Getting scheduled operations');
    return [];
  }

  /**
   * Get operation statistics
   */
  async getOperationStatistics(nodeId: NodeId): Promise<any> {
    const operation = await this.getEntity(nodeId);
    if (!operation) {
      throw new Error(`Operation not found: ${nodeId}`);
    }

    const executionHistory = operation.executionHistory;
    const completedExecutions = executionHistory.filter(exec => exec.status === 'completed');
    const failedExecutions = executionHistory.filter(exec => exec.status === 'failed');

    return {
      totalExecutions: executionHistory.length,
      completedExecutions: completedExecutions.length,
      failedExecutions: failedExecutions.length,
      totalRecordsProcessed: completedExecutions.reduce((sum, exec) => sum + exec.processedRecords, 0),
      averageExecutionTime: completedExecutions.length > 0 
        ? completedExecutions.reduce((sum, exec) => {
            const duration = exec.endTime ? exec.endTime - exec.startTime : 0;
            return sum + duration;
          }, 0) / completedExecutions.length
        : 0,
      lastExecutionTime: executionHistory.length > 0 
        ? executionHistory[executionHistory.length - 1]?.startTime || 0
        : 0,
      currentStatus: operation.status,
      lastUpdated: operation.updatedAt,
    };
  }

  // Working Copy Operations (required by EntityHandler interface)
  async createWorkingCopy(nodeId: NodeId): Promise<ImportExportEntity & { workingCopyId: string; copiedAt: number }> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Entity not found: ${nodeId}`);
    }
    
    // Create working copy with additional workingCopyId and copiedAt fields
    const workingCopy = {
      ...entity,
      workingCopyId: `wc-${nodeId}-${Date.now()}`,
      copiedAt: Date.now(),
    };
    
    return workingCopy;
  }

  async commitWorkingCopy(nodeId: NodeId, workingCopy: ImportExportEntity & { workingCopyId: string; copiedAt: number }): Promise<void> {
    // Remove working copy fields and update the entity
    const { workingCopyId, copiedAt, ...entityData } = workingCopy;
    await this.updateEntity(nodeId, entityData);
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    // Working copy discarded, no action needed for import/export entities
    console.log(`Working copy discarded for import/export entity: ${nodeId}`);
  }
}