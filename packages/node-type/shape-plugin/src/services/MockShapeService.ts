import type { NodeId, EntityId } from '@hierarchidb/common-core';
import type { 
  ShapeEntity, 
  ShapeWorkingCopy,
  ProcessingConfig,
  BatchTask,
  BatchTaskStage,
  SimplifyTask,
  ValidationResult,
  SelectionStats
} from '~/types';
import { DEFAULT_PROCESSING_CONFIG } from '~/types';
import { 
  generateMockDownloadTasks,
  generateMockSimplifyTasks,
  generateMockVectorTileTasks,
  calculateEstimatedSize,
  calculateEstimatedFeatures,
  calculateEstimatedProcessingTime,
  SAMPLE_COUNTRIES
} from '~/mock/data';

/**
 * Mock service for Shape plugin development
 * Provides simulated data and operations without actual backend
 */
export class MockShapeService {
  private workingCopies: Map<NodeId, ShapeWorkingCopy> = new Map();
  private entities: Map<EntityId, ShapeEntity> = new Map();
  private batchTasks: Map<string, BatchTask[]> = new Map();

  // ================================
  // Entity Operations
  // ================================

  async createEntity(nodeId: NodeId, data: Partial<ShapeEntity>): Promise<ShapeEntity> {
    const entityId = `shape-entity-${Date.now()}` as EntityId;
    const entity: ShapeEntity = {
      id: entityId,
      nodeId,
      name: data.name || 'New Shape Configuration',
      description: data.description,
      dataSourceName: data.dataSourceName || 'naturalearth',
      licenseAgreement: data.licenseAgreement || false,
      licenseAgreedAt: data.licenseAgreedAt,
      processingConfig: data.processingConfig || DEFAULT_PROCESSING_CONFIG,
      checkboxState: data.checkboxState || [],
      selectedCountries: data.selectedCountries || [],
      adminLevels: data.adminLevels || [],
      urlMetadata: data.urlMetadata || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    this.entities.set(entityId, entity);
    return entity;
  }

  async getEntity(entityId: EntityId): Promise<ShapeEntity | undefined> {
    return this.entities.get(entityId);
  }

  async updateEntity(entityId: EntityId, updates: Partial<ShapeEntity>): Promise<ShapeEntity> {
    const entity = this.entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity ${entityId} not found`);
    }

    const updated = {
      ...entity,
      ...updates,
      updatedAt: Date.now(),
      version: entity.version + 1,
    };

    this.entities.set(entityId, updated);
    return updated;
  }

  async deleteEntity(entityId: EntityId): Promise<void> {
    this.entities.delete(entityId);
  }

  // ================================
  // Working Copy Operations
  // ================================

  async createWorkingCopy(nodeId: NodeId, initialData?: Partial<ShapeWorkingCopy>): Promise<ShapeWorkingCopy> {
    const workingCopy: ShapeWorkingCopy = {
      id: `wc-${Date.now()}` as EntityId,
      nodeId,
      name: initialData?.name || '',
      description: initialData?.description,
      dataSourceName: initialData?.dataSourceName || 'naturalearth',
      licenseAgreement: initialData?.licenseAgreement || false,
      licenseAgreedAt: initialData?.licenseAgreedAt,
      processingConfig: initialData?.processingConfig || DEFAULT_PROCESSING_CONFIG,
      checkboxState: initialData?.checkboxState || [],
      selectedCountries: initialData?.selectedCountries || [],
      adminLevels: initialData?.adminLevels || [],
      urlMetadata: initialData?.urlMetadata || [],
      isDraft: true,
      downloadedMatrix: initialData?.downloadedMatrix,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    this.workingCopies.set(nodeId, workingCopy);
    return workingCopy;
  }

  async getWorkingCopy(nodeId: NodeId): Promise<ShapeWorkingCopy | undefined> {
    return this.workingCopies.get(nodeId);
  }

  async updateWorkingCopy(nodeId: NodeId, updates: Partial<ShapeWorkingCopy>): Promise<ShapeWorkingCopy> {
    const workingCopy = this.workingCopies.get(nodeId);
    if (!workingCopy) {
      throw new Error(`Working copy for node ${nodeId} not found`);
    }

    const updated = {
      ...workingCopy,
      ...updates,
      updatedAt: Date.now(),
    };

    this.workingCopies.set(nodeId, updated);
    return updated;
  }

  async commitWorkingCopy(nodeId: NodeId): Promise<ShapeEntity> {
    const workingCopy = this.workingCopies.get(nodeId);
    if (!workingCopy) {
      throw new Error(`Working copy for node ${nodeId} not found`);
    }

    const entity = await this.createEntity(nodeId, workingCopy);
    this.workingCopies.delete(nodeId);
    return entity;
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    this.workingCopies.delete(nodeId);
  }

  // ================================
  // Batch Processing Operations
  // ================================

  async startBatchProcessing(
    _nodeId: NodeId,
    _config: ProcessingConfig,
    urlMetadata: any[]
  ): Promise<{ batchId: string }> {
    const batchId = `batch-${Date.now()}`;
    
    // Generate mock tasks
    const downloadTasks = generateMockDownloadTasks(urlMetadata);
    const simplify1Tasks = generateMockSimplifyTasks(
      urlMetadata.map(m => m.countryCode),
      urlMetadata.map(m => m.adminLevel)
    );
    const simplify2Tasks: SimplifyTask[] = simplify1Tasks.map(task => ({
      ...task,
      taskId: task.taskId.replace('simplify1', 'simplify2'),
      taskType: 'simplify2' as const,
    }));
    const vectorTileTasks = generateMockVectorTileTasks(
      urlMetadata.map(m => m.countryCode),
      urlMetadata.map(m => m.adminLevel)
    );

    this.batchTasks.set(batchId, [
      ...downloadTasks,
      ...simplify1Tasks,
      ...simplify2Tasks,
      ...vectorTileTasks,
    ]);

    // Simulate processing progress
    this.simulateBatchProgress(batchId);

    return { batchId };
  }

  async getBatchTasks(batchId: string): Promise<BatchTask[]> {
    return this.batchTasks.get(batchId) || [];
  }

  async cancelBatchTask(batchId: string, taskId: string): Promise<void> {
    const tasks = this.batchTasks.get(batchId);
    if (!tasks) return;

    const task = tasks.find(t => t.taskId === taskId);
    if (task) {
      task.stage = 'pause' as BatchTaskStage;
    }
  }

  async resumeBatchTask(batchId: string, taskId: string): Promise<void> {
    const tasks = this.batchTasks.get(batchId);
    if (!tasks) return;

    const task = tasks.find(t => t.taskId === taskId);
    if (task && task.stage === 'pause') {
      task.stage = 'process' as BatchTaskStage;
    }
  }

  async stopAllBatchTasks(batchId: string): Promise<void> {
    const tasks = this.batchTasks.get(batchId);
    if (!tasks) return;

    tasks.forEach(task => {
      if (task.stage === 'process' || task.stage === 'wait') {
        task.stage = 'cancel' as BatchTaskStage;
      }
    });
  }

  // ================================
  // Validation Operations
  // ================================

  validateProcessingConfig(config: ProcessingConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.concurrentDownloads < 1 || config.concurrentDownloads > 8) {
      errors.push('Concurrent downloads must be between 1 and 8');
    }

    if (config.concurrentProcesses < 1 || config.concurrentProcesses > 8) {
      errors.push('Concurrent processes must be between 1 and 8');
    }

    if (config.maxZoomLevel < 8 || config.maxZoomLevel > 18) {
      errors.push('Max zoom level must be between 8 and 18');
    }

    if (config.featureAreaThreshold < 0.001 || config.featureAreaThreshold > 10) {
      warnings.push('Feature area threshold seems unusual');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  calculateSelectionStats(checkboxMatrix: boolean[][], _countries: any[]): SelectionStats {
    let totalSelected = 0;
    let countriesWithSelection = 0;
    const levelCounts = Array(6).fill(0);

    checkboxMatrix.forEach((row) => {
      let hasAnySelection = false;
      row.forEach((selected, levelIndex) => {
        if (selected) {
          totalSelected++;
          levelCounts[levelIndex]++;
          hasAnySelection = true;
        }
      });
      if (hasAnySelection) {
        countriesWithSelection++;
      }
    });

    return {
      totalSelected,
      countriesWithSelection,
      levelCounts,
      estimatedSize: calculateEstimatedSize(totalSelected),
      estimatedFeatures: calculateEstimatedFeatures(totalSelected, SAMPLE_COUNTRIES),
      estimatedProcessingTime: parseInt(calculateEstimatedProcessingTime(totalSelected)),
    };
  }

  // ================================
  // Private Helper Methods
  // ================================

  private simulateBatchProgress(batchId: string): void {
    const interval = setInterval(() => {
      const tasks = this.batchTasks.get(batchId);
      if (!tasks) {
        clearInterval(interval);
        return;
      }

      let allCompleted = true;
      tasks.forEach(task => {
        if (task.stage === 'wait') {
          // Start some waiting tasks
          if (Math.random() < 0.1) {
            task.stage = 'process' as BatchTaskStage;
            task.progress = 0;
          }
          allCompleted = false;
        } else if (task.stage === 'process') {
          // Progress running tasks
          task.progress = Math.min((task.progress || 0) + Math.random() * 10, 100);
          if (task.progress >= 100) {
            task.stage = 'success' as BatchTaskStage;
            task.completedAt = Date.now();
          } else {
            allCompleted = false;
          }
        } else if (task.stage === 'pause') {
          allCompleted = false;
        }
      });

      if (allCompleted) {
        clearInterval(interval);
      }
    }, 1000);
  }
}

// Singleton instance for development
export const mockShapeService = new MockShapeService();