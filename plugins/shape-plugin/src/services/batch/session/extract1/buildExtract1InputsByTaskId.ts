import type { ShapeExtract1TaskInputData } from '@hierarchidb/plugin-service-api';
import type { Extract1Task } from '../../../../common/types/index.js';
import type { OriginMetadata } from '../SessionTypes.js';

export function buildExtract1InputsByTaskId(params: {
  tasks: Extract1Task[];
  originByInputBufferId: Map<string, OriginMetadata>;
  buildFallbackFeatureId: (task: Extract1Task) => string;
}): Map<string, ShapeExtract1TaskInputData> {
  const { tasks, originByInputBufferId, buildFallbackFeatureId } = params;

  const inputsByTaskId = new Map<string, ShapeExtract1TaskInputData>();

  for (const task of tasks) {
    const bufferId = task.inputBufferId ?? '';
    const origin = originByInputBufferId.get(bufferId);

    const featureLabel = origin?.featureLabel ?? origin?.featureGroupId;
    const featureId = featureLabel
      ?? origin?.featureGroupId
      ?? buildFallbackFeatureId(task);

    inputsByTaskId.set(task.taskId, {
      inputBufferId: task.inputBufferId,
      sourceUrl: origin?.sourceUrl,
      featureId,
      featureLabel,
      featureGroupId: origin?.featureGroupId,
      featureIndex: origin?.featureIndex,
      originKey: origin?.originKey,
      originLabel: origin?.originLabel,
      adminCode: origin?.featureGroupId,
      dataSource: origin?.dataSource,
      countryCode: origin?.countryCode ?? task.countryCode,
      adminLevel: origin?.adminLevel ?? task.adminLevel,
      continent: origin?.continent,
      countryName: origin?.countryName,
    });
  }

  return inputsByTaskId;
}
