/**
 * @file BatchTaskLike.ts
 * @description ERIA-Cartograph移植: バッチタスク型定義
 */

import type { TreeNodeId } from '@hierarchidb/core';

export type BatchStage = 'download' | 'simplify1' | 'simplify2' | 'vectorTiles';
export type BatchTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'aborted';

/**
 * Batch task entity
 */
export interface BatchTaskLike {
  taskId: string;
  treeNodeId: TreeNodeId;
  sessionId: string;
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
}