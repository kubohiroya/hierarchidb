/**
  * @file BatchTaskLike.ts
 * @description ERIA-Cartograph:
  */

import type { TreeNodeId } from '@hierarchidb/common-types';

export type BatchStage = 'download' | 'extract1' | 'extract2' | 'vectorTiles' | 'fetch' | 'transform' | 'vt';
export type BatchTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'aborted';

/**
 * Batch task entity
 */
export interface BatchTaskLike {
  taskId: string;
  treeNodeId: TreeNodeId;
  nodeId: string;
  type: string; // Task type identifier
  stage: BatchStage;
  status: BatchTaskStatus;
  country: string;
  adminLevel: number;
  continent?: string;
  progress: number;
  startTime?: number;
  endTime?: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
  url?: string;
  config?: {
    dataSource?: string;
    country?: string;
    adminLevel?: number;
    expectedFormat?: string;
    validateSSL?: boolean;
    timeout?: number;
    retryDelay?: number;
    [key: string]: unknown;
  };
}
