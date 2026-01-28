import { normalizeProgressPhase, type BatchTaskSummary } from '@hierarchidb/common-api';
import type { NodeId } from '@hierarchidb/common-types';
import { VtTaskQueueDb, listTasks } from '@hierarchidb/vt-orchestrator';
import type { TaskQueueRecord } from '@hierarchidb/common-types';

const mapTaskQueueRecord = (task: TaskQueueRecord): BatchTaskSummary => ({
  taskId: task.taskId,
  stage: task.stage,
  status: normalizeProgressPhase(task.status),
  progress: task.progress,
  message: task.message ?? task.errorMessage,
});

export async function getBatchTasks(nodeId: NodeId): Promise<BatchTaskSummary[]> {
  const taskQueue = new VtTaskQueueDb();
  const tasks = await listTasks(taskQueue, nodeId);
  return tasks.map(mapTaskQueueRecord);
}
