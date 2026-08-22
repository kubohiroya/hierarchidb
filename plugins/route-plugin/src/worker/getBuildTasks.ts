import type { BuildTaskSummary, TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { listTasks, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';

const mapTaskQueueRecord = (task: TaskQueueRecord): BuildTaskSummary => ({
  taskId: task.taskId,
  version: task.version,
  stage: task.stage,
  status: task.status as BuildTaskSummary['status'],
  progress: task.progress,
  sequence: task.sequence,
  display: task.display,
  metadata: task.metadata,
  errorMessage: task.errorMessage,
});

export async function getBuildTasks(nodeId: NodeId): Promise<BuildTaskSummary[]> {
  const taskQueue = new VtTaskQueueDb();
  const tasks = await listTasks(taskQueue, nodeId);
  return tasks.map(mapTaskQueueRecord);
}
