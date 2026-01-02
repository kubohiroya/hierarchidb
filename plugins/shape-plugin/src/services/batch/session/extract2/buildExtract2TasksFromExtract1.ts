import type { NodeId } from '@hierarchidb/common-types';
import type { Extract1Task, Extract2Task } from '../../../../common/types/index.js';
import { BatchTaskStage } from '../../../../common/types/index.js';
import type { ShapeExtract1TaskInputData, ShapeExtract2TaskInputData } from '@hierarchidb/plugin-service-api';

export type Extract2BuildResult = {
  tasks: Extract2Task[];
  inputsByTaskId: Map<string, ShapeExtract2TaskInputData>;
};

export function buildExtract2TasksFromExtract1(params: {
  nodeId: NodeId;
  extract1Tasks: Extract1Task[];
  extract1InputsByTaskId: Map<string, ShapeExtract1TaskInputData>;
  buildTaskId: (
    stage: 'extract2',
    details: { countryCode?: string; adminLevel?: number; featureLabel?: string; featureGroupId?: string },
  ) => string;
  getOriginKeyFromInput: (input?: { originKey?: string } | null) => string | undefined;
  resolveTaskIdDetails: (
    task: { countryCode?: string; adminLevel?: number },
    input?: { countryCode?: string; adminLevel?: number; featureLabel?: string; featureGroupId?: string },
  ) => { countryCode?: string; adminLevel?: number; featureLabel?: string; featureGroupId?: string };
}): Extract2BuildResult {
  const {
    nodeId,
    extract1Tasks,
    extract1InputsByTaskId,
    buildTaskId,
    getOriginKeyFromInput,
    resolveTaskIdDetails,
  } = params;

  const inputsByTaskId = new Map<string, ShapeExtract2TaskInputData>();

  const tasks: Extract2Task[] = extract1Tasks.map((task, index) => {
    const input = extract1InputsByTaskId.get(task.taskId);

    const featureId = input?.featureId ?? `${task.countryCode ?? 'UNK'}:ADM${task.adminLevel ?? 'X'}`;
    const adminCode = input?.adminCode ?? input?.featureGroupId;
    const originKey = getOriginKeyFromInput(input);
    const originLabel = input?.originLabel;

    const taskId = buildTaskId('extract2', resolveTaskIdDetails(task, input));

    inputsByTaskId.set(taskId, {
      inputBufferId: `${String(nodeId)}-extract1-${index}`,
      sourceTaskId: task.taskId,
      sourceUrl: input?.sourceUrl,
      featureId,
      featureLabel: input?.featureLabel,
      featureGroupId: input?.featureGroupId,
      featureIndex: input?.featureIndex,
      originKey,
      originLabel,
      adminCode,
      dataSource: input?.dataSource,
      countryCode: input?.countryCode ?? task.countryCode,
      adminLevel: input?.adminLevel ?? task.adminLevel,
      continent: input?.continent,
      countryName: input?.countryName,
    });

    return {
      taskId,
      nodeId,
      taskType: 'extract2' as const,
      stage: BatchTaskStage.WAIT,
      type: 'extract2',
      status: 'waiting',
      index,
      progress: 0,
      inputBufferId: `${String(nodeId)}-extract1-${index}`,
      countryCode: input?.countryCode ?? task.countryCode,
      countryName: input?.countryName,
      continent: input?.continent,
      adminLevel: input?.adminLevel ?? task.adminLevel,
      adminCode,
    };
  });

  return { tasks, inputsByTaskId };
}
