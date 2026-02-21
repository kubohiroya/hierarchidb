import type { StageHandlerResult } from '~/types/types';
import type { VtLayerBuildInput } from './vtStageTaskLayerBuilderTypes.js';
import type { VtDebugFocusConfig } from './vtStageDebug.js';
import type { PreparedLayerBuildContext } from './vtStageTaskLayerBuilderPrepare.js';

export type LayerBuildFlowInput = Omit<VtLayerBuildInput, 'completedWithParentInputSummary'> &
  Omit<PreparedLayerBuildContext, 'completedWithParentInputSummary'> & {
    completedWithParentInputSummary: (message: string) => StageHandlerResult;
    assertNotAborted: (signal?: AbortSignal) => void;
    debugFocusConfig: VtDebugFocusConfig;
  };
