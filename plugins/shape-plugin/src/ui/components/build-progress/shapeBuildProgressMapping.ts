import type { TaskDisplayPayload } from '@hierarchidb/build-api';

export interface BuildProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  stage?: string;
  timestamp?: number;
  message?: string | null;
  progressTaskId?: string;
  progressTaskStatus?: string;
  progressTaskStage?: string;
  progressTaskProgress?: number;
  progressTaskTitle?: string;
  progressTaskDisplay?: TaskDisplayPayload;
  stageTotals?: Partial<
    Record<
      'source' | 'geometry' | 'tileEmit',
      {
        total: number;
        completed: number;
        failed: number;
        skipped: number;
      }
    >
  >;
}

export interface BuildSessionDisplayStatus {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused' | 'queued';
  stage?: string;
  progress?: number;
  hasErrors?: boolean;
  error?: string | null;
  lastUpdated?: number;
}
