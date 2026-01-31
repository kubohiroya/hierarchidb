import type { BatchTaskSummary } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import { VtTaskQueueDb, listTasks } from '@hierarchidb/vt-orchestrator';
import type { TaskQueueRecord } from '@hierarchidb/batch-api';

const mapTaskQueueRecord = (task: TaskQueueRecord): BatchTaskSummary => ({
  taskId: task.taskId,
  stage: task.stage,
  status: task.status as BatchTaskSummary['status'],
  progress: task.progress,
  message: task.message ?? task.errorMessage,
});

export async function getBatchTasks(nodeId: NodeId): Promise<BatchTaskSummary[]> {
  const taskQueue = new VtTaskQueueDb();
  const tasks = await listTasks(taskQueue, nodeId);
  return tasks.map(mapTaskQueueRecord);
}
