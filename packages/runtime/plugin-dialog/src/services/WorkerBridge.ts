/**
 * Worker Bridge Service
 * Manages communication between UI (Jotai) and Worker
 */

import * as Comlink from 'comlink';
import { NodeId } from '@hierarchidb/common-type';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { 
  WorkingCopyData, 
  ValidationResult, 
  StepCapabilities 
} from '../atoms/workingCopyAtoms';

/**
 * Worker validation request
 */
export interface ValidationRequest {
  nodeId: NodeId;
  stepId: string;
  stepIndex: number;
  data: any;
  nodeType: string;
}

/**
 * Worker capabilities evaluation request
 */
export interface CapabilitiesRequest {
  nodeId: NodeId;
  stepIndex: number;
  data: any;
  nodeType: string;
  totalSteps: number;
}

/**
 * Worker notification types
 */
export type WorkerNotification = 
  | { type: 'validation'; result: ValidationResult }
  | { type: 'capabilities'; stepIndex: number; capabilities: StepCapabilities }
  | { type: 'workingCopyUpdated'; data: WorkingCopyData }
  | { type: 'error'; error: string };

/**
 * Worker Bridge Service
 */
export class WorkerBridge {
  private worker: Worker | null = null;
  private api: WorkerAPI | null = null;
  private subscribers = new Set<(notification: WorkerNotification) => void>();
  private validationQueue = new Map<string, ValidationRequest>();
  private capabilitiesQueue = new Map<number, CapabilitiesRequest>();
  private processingTimeout: NodeJS.Timeout | null = null;

  /**
   * Initialize Worker connection
   */
  async initialize(): Promise<void> {
    if (this.api) return;

    try {
      // Create Worker
      this.worker = new Worker(
        new URL('../../../worker/src/index.ts', import.meta.url),
        { type: 'module' }
      );

      // Wrap with Comlink
      const WorkerClass = Comlink.wrap<{
        new(): WorkerAPI;
      }>(this.worker);

      this.api = await new WorkerClass();

      // Set up message channel for notifications
      const { port1, port2 } = new MessageChannel();
      
      // Send port2 to Worker
      await this.api.setNotificationPort(Comlink.transfer(port2, [port2]));
      
      // Listen for notifications on port1
      port1.onmessage = (event) => {
        this.handleWorkerNotification(event.data);
      };

      // Initialize Worker
      await this.api.initialize();
      
      console.log('Worker Bridge initialized');
    } catch (error) {
      console.error('Failed to initialize Worker Bridge:', error);
      throw error;
    }
  }

  /**
   * Handle notification from Worker
   */
  private handleWorkerNotification(notification: WorkerNotification) {
    // Notify all subscribers
    this.subscribers.forEach(subscriber => {
      try {
        subscriber(notification);
      } catch (error) {
        console.error('Subscriber error:', error);
      }
    });
  }

  /**
   * Subscribe to Worker notifications
   */
  subscribe(callback: (notification: WorkerNotification) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Queue validation request
   */
  queueValidation(request: ValidationRequest): void {
    this.validationQueue.set(request.stepId, request);
    this.scheduleProcessing();
  }

  /**
   * Queue capabilities evaluation request
   */
  queueCapabilitiesEvaluation(request: CapabilitiesRequest): void {
    this.capabilitiesQueue.set(request.stepIndex, request);
    this.scheduleProcessing();
  }

  /**
   * Schedule batch processing of queued requests
   */
  private scheduleProcessing(): void {
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }

    this.processingTimeout = setTimeout(() => {
      this.processQueues();
    }, 100); // 100ms debounce
  }

  /**
   * Process queued requests
   */
  private async processQueues(): Promise<void> {
    if (!this.api) {
      console.error('Worker API not initialized');
      return;
    }

    // Process validation queue
    if (this.validationQueue.size > 0) {
      const requests = Array.from(this.validationQueue.values());
      this.validationQueue.clear();

      try {
        const results = await this.api.batchValidate(requests);
        
        // Send results to subscribers
        results.forEach(result => {
          this.handleWorkerNotification({
            type: 'validation',
            result,
          });
        });
      } catch (error) {
        console.error('Batch validation failed:', error);
        this.handleWorkerNotification({
          type: 'error',
          error: 'Validation failed',
        });
      }
    }

    // Process capabilities queue
    if (this.capabilitiesQueue.size > 0) {
      const requests = Array.from(this.capabilitiesQueue.values());
      this.capabilitiesQueue.clear();

      try {
        const results = await this.api.batchEvaluateCapabilities(requests);
        
        // Send results to subscribers
        results.forEach((capabilities, index) => {
          const request = requests[index];
          this.handleWorkerNotification({
            type: 'capabilities',
            stepIndex: request.stepIndex,
            capabilities,
          });
        });
      } catch (error) {
        console.error('Batch capabilities evaluation failed:', error);
        this.handleWorkerNotification({
          type: 'error',
          error: 'Capabilities evaluation failed',
        });
      }
    }
  }

  /**
   * Load working copy from Worker
   */
  async loadWorkingCopy(nodeId: NodeId): Promise<WorkingCopyData> {
    if (!this.api) {
      throw new Error('Worker API not initialized');
    }

    try {
      const data = await this.api.getWorkingCopy(nodeId);
      
      if (!data) {
        throw new Error(`Working copy not found: ${nodeId}`);
      }

      return data as WorkingCopyData;
    } catch (error) {
      console.error('Failed to load working copy:', error);
      throw error;
    }
  }

  /**
   * Save working copy to Worker
   */
  async saveWorkingCopy(
    nodeId: NodeId,
    data: WorkingCopyData,
    asDraft: boolean = false
  ): Promise<NodeId> {
    if (!this.api) {
      throw new Error('Worker API not initialized');
    }

    try {
      const result = await this.api.saveWorkingCopy(nodeId, {
        ...data,
        isDraft: asDraft,
      });

      return result.nodeId;
    } catch (error) {
      console.error('Failed to save working copy:', error);
      throw error;
    }
  }

  /**
   * Update working copy on Worker
   */
  async updateWorkingCopy(
    nodeId: NodeId,
    updates: Partial<WorkingCopyData>
  ): Promise<void> {
    if (!this.api) {
      throw new Error('Worker API not initialized');
    }

    try {
      await this.api.updateWorkingCopy(nodeId, updates);
    } catch (error) {
      console.error('Failed to update working copy:', error);
      throw error;
    }
  }

  /**
   * Discard working copy
   */
  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    if (!this.api) {
      throw new Error('Worker API not initialized');
    }

    try {
      await this.api.discardWorkingCopy(nodeId);
    } catch (error) {
      console.error('Failed to discard working copy:', error);
      throw error;
    }
  }

  /**
   * Start batch processing
   */
  async startBatch(
    nodeId: NodeId,
    batchConfig: any
  ): Promise<void> {
    if (!this.api) {
      throw new Error('Worker API not initialized');
    }

    try {
      await this.api.startBatchProcessing(nodeId, batchConfig);
    } catch (error) {
      console.error('Failed to start batch:', error);
      throw error;
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.api = null;
    this.subscribers.clear();
    this.validationQueue.clear();
    this.capabilitiesQueue.clear();
  }
}

// Singleton instance
let workerBridge: WorkerBridge | null = null;

/**
 * Get Worker Bridge instance
 */
export function getWorkerBridge(): WorkerBridge {
  if (!workerBridge) {
    workerBridge = new WorkerBridge();
  }
  return workerBridge;
}