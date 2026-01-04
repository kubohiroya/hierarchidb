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
  zoomRanges: Array<{
    minZoom: number;
    maxZoom: number;
    zoomLevels: number[];
    label: string;
  }>;
  scaleTolerance: (zoomMax: number) => number;
  buildTaskId: (
    stage: 'extract2',
    details: { countryCode?: string; adminLevel?: number; featureLabel?: string; featureGroupId?: string; zoomRangeLabel?: string },
  ) => string;
  getOriginKeyFromInput: (input?: { originKey?: string } | null) => string | undefined;
  resolveTaskIdDetails: (
    task: { countryCode?: string; adminLevel?: number },
    input?: { countryCode?: string; adminLevel?: number; featureLabel?: string; featureGroupId?: string },
  ) => { countryCode?: string; adminLevel?: number; featureLabel?: string; featureGroupId?: string; zoomRangeLabel?: string };
}): Extract2BuildResult {
  const {
    nodeId,
    extract1Tasks,
    extract1InputsByTaskId,
    zoomRanges,
    scaleTolerance,
    buildTaskId,
    getOriginKeyFromInput,
    resolveTaskIdDetails,
  } = params;

  const inputsByTaskId = new Map<string, ShapeExtract2TaskInputData>();

  const tasks: Extract2Task[] = [];
  let nextTaskIndex = 0;

  extract1Tasks.forEach((task, index) => {
    const input = extract1InputsByTaskId.get(task.taskId);

    const featureId = input?.featureId ?? `${task.countryCode ?? 'UNK'}:ADM${task.adminLevel ?? 'X'}`;
    const adminCode = input?.adminCode ?? input?.featureGroupId;
    const originKey = getOriginKeyFromInput(input);
    const originLabel = input?.originLabel;

    const inputBufferId = `${String(nodeId)}-extract1-${index}`;
    const baseTaskDetails = resolveTaskIdDetails(task, input);

    zoomRanges.forEach((range) => {
      const zoomRangeLabel = range.label;
      const taskId = buildTaskId('extract2', {
        ...baseTaskDetails,
        zoomRangeLabel,
      });
      const tolerance = scaleTolerance(range.maxZoom);

      inputsByTaskId.set(taskId, {
        inputBufferId,
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
        zoomLevels: range.zoomLevels,
        zoomRange: [range.minZoom, range.maxZoom],
        zoomRangeLabel,
        tolerance,
      });

      tasks.push({
        taskId,
        nodeId,
        taskType: 'extract2' as const,
        stage: BatchTaskStage.WAIT,
        type: 'extract2',
        status: 'waiting',
        index: nextTaskIndex,
        progress: 0,
        inputBufferId,
        countryCode: input?.countryCode ?? task.countryCode,
        countryName: input?.countryName,
        continent: input?.continent,
        adminLevel: input?.adminLevel ?? task.adminLevel,
        adminCode,
      });

      nextTaskIndex += 1;
    });
  });

  return { tasks, inputsByTaskId };
}
