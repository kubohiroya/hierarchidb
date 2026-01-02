import type { NodeId } from '@hierarchidb/common-types';
import type { BatchProcessConfig } from '../../../types.js';
import { buildMinimalVectorTileRowsFromExtract2 } from '../../tiles/buildMinimalVectorTileRowsFromExtract2.js';
import { buildVectorTileTasks } from '../../tiles/vectorTileTasks.js';

export type VectorTileStageTileInputSource = {
  listExtract2Buffers: () => Promise<Array<{ id: string }>>;
};

export function buildVectorTileStageInputs(params: {
  nodeId: NodeId;
  zoomLevels: number[];
  config: BatchProcessConfig;
  tileInputSource: VectorTileStageTileInputSource;
}): Promise<{
  tasks: ReturnType<typeof buildVectorTileTasks>['tasks'];
  inputsByTaskId: ReturnType<typeof buildVectorTileTasks>['inputsByTaskId'];
}> {
  const { nodeId, zoomLevels, config, tileInputSource } = params;

  return (async () => {
    const extract2Buffers = await tileInputSource.listExtract2Buffers();
    const tileRows = buildMinimalVectorTileRowsFromExtract2({
      nodeId,
      zoomLevels,
      extract2Buffers,
    });

    return buildVectorTileTasks({ nodeId, tileRows, config });
  })();
}

