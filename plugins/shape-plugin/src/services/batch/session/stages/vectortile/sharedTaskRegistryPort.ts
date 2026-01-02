import type { ShapeVectorTileTaskInputData } from '@hierarchidb/plugin-service-api';

import type { SessionTaskRegistry } from '../../../SessionTaskRegistry.js';
import type { VectorTileTask } from '../../../../../common/types/index.js';

import type { VectorTileStageTaskRegistryPort } from './orchestrator.shared.js';

/**
 * shared vectortile-orchestrator が要求する最小 TaskRegistryPort に、
 * shape-plugin の SessionTaskRegistry を適合させる薄いアダプタ。
 *
 * - inputsByTaskId の実体型は ShapeBatchTaskInputData（plugin-service-api）として扱う
 * - orchestrator は inputs の中身を読まないため、この変換は安全
 */
export function asSharedVectorTileTaskRegistryPort(taskRegistry: SessionTaskRegistry): VectorTileStageTaskRegistryPort<VectorTileTask> {
  return {
    registerTasks: async (stage, tasks, existingTaskIds, inputsByTaskId) => {
      await taskRegistry.registerTasks(
        stage,
        tasks,
        existingTaskIds,
        inputsByTaskId as Map<string, ShapeVectorTileTaskInputData>,
      );
    },
    resolveStageTasks: async (stage, tasks) => {
      return await taskRegistry.resolveStageTasks(stage, tasks);
    },
  };
}
