/**
 * @file BatchProgressEvent.ts
 * @description ERIA-Cartograph移植: バッチ進捗イベント型定義
 */

import type { TreeNodeId } from '@hierarchidb/core';
import type { BatchStage, BatchTaskStatus } from './BatchTaskLike';

/**
 * Batch progress event
 */
export interface BatchProgressEvent {
  sessionId: string;
  treeNodeId: TreeNodeId;
  stage: BatchStage;
  status?: BatchTaskStatus;
  progress: number;
  completedTasks: number;
  totalTasks: number;
  currentTask: string;
  error?: string;
  timestamp: number;
}