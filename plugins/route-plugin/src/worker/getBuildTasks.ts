import type { BuildTaskSummary } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { VtTaskQueueDb, listTasks } from '@hierarchidb/vt-orchestrator';
import type { TaskQueueRecord } from '@hierarchidb/build-api';

const mapTaskQueueRecord = (task: TaskQueueRecord): BuildTaskSummary => ({
  taskId: task.taskId,
  stage: task.stage,
  status: task.status as BuildTaskSummary['status'],
  progress: task.progress,
  message: task.message ?? task.errorMessage,
});

export async function getBuildTasks(nodeId: NodeId): Promise<BuildTaskSummary[]> {
  const taskQueue = new VtTaskQueueDb();
  const tasks = await listTasks(taskQueue, nodeId);
  return tasks.map(mapTaskQueueRecord);
}
