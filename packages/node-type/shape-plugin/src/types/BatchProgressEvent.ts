/**
 * @file BatchProgressEvent.ts
 * @description ERIA-Cartograph移植: バッチ進捗イベント型定義
 */

import type { TreeNodeId } from '@hierarchidb/core';
import type { BatchStage, BatchTaskStatus } from './BatchTaskLike';

/**
 * Batch progress event
 */
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
  
  /** Authentication context for auth-related events */
  authContext?: {
    /** Request ID for tracking authentication requests */
    requestId?: string;
    /** URL that required authentication */
    url?: string;
    /** Error message from authentication failure */
    errorMessage?: string;
    /** User information after successful authentication */
    userInfo?: {
      email?: string;
      name?: string;
      provider?: string;
    };
    /** Reason for authentication cancellation */
    reason?: string;
  };
  
  /** Event type for enhanced UI handling */
  type?: 'progress' | 'auth-required' | 'resumed' | 'cancelled';
}