import type { BatchTaskSummary } from '@hierarchidb/common-api';
import { shapeDB, type BatchTaskRecord } from '../services/database/ShapeDB.js';

const toSummaryStatus = (status: BatchTaskRecord['status']): BatchTaskSummary['status'] => {
  if (status === 'waiting') return 'waiting';
  return status;
};

export async function getBatchTaskSummaries(sessionId: string): Promise<BatchTaskSummary[]> {
  const tasks = await shapeDB.getBatchTasks(sessionId);
  return tasks.map((task) => ({
    taskId: task.taskId,
    stage: task.taskType,
    status: toSummaryStatus(task.status),
    progress: task.progress ?? 0,
    message: task.message ?? task.errorMessage,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
  }));
}
