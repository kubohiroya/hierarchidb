import type { NodeId } from '@hierarchidb/common-types';
import type { VectorTileTask } from '../../../common/types/index.js';
import { BatchTaskStage } from '../../../common/types/index.js';
import type { ShapeVectorTileTaskInputData } from '@hierarchidb/plugin-service-api';

export type VectorTileTaskInputRow = { key: string; z: number; x: number; y: number };

export type VectorTileTaskBuildConfig = {
  tileSize?: number;
  vectorTiles?: {
    tileSize?: number;
    bufferSize?: number;
    minZoom?: number;
    maxZoom?: number;
    concurrentProcesses?: number;
  };
};

export function buildVectorTileTasks(params: {
  nodeId: NodeId;
  tileRows: VectorTileTaskInputRow[];
  config: VectorTileTaskBuildConfig;
}): { tasks: VectorTileTask[]; inputsByTaskId: Map<string, ShapeVectorTileTaskInputData> } {
  const { nodeId, tileRows, config } = params;

  const tileSize = config.vectorTiles?.tileSize ?? config.tileSize ?? 256;
  const buffer = config.vectorTiles?.bufferSize ?? 256;
  const minZoom = config.vectorTiles?.minZoom ?? 0;
  const maxZoom = config.vectorTiles?.maxZoom ?? minZoom;
  const clampedRows = tileRows.filter((tile) => tile.z >= minZoom && tile.z <= maxZoom);

  if (clampedRows.length !== tileRows.length) {
    console.warn(`[Session ${String(nodeId)}] Dropped vector tile inputs outside zoom range`, {
      minZoom,
      maxZoom,
      dropped: tileRows.length - clampedRows.length,
    });
  }

  const metadataEnabled = false;
  const inputsByTaskId = new Map<string, ShapeVectorTileTaskInputData>();
  const tasks: VectorTileTask[] = clampedRows.map((tile, index) => {
    const taskId = `${String(nodeId)}-vectortile-${index}`;
    inputsByTaskId.set(taskId, {
      inputBufferId: tile.key,
      minZoom,
      maxZoom,
      tileZ: tile.z,
      tileX: tile.x,
      tileY: tile.y,
      extent: 4096,
      buffer,
      tileSize,
      layers: [],
      format: 'mvt',
      compression: true,
      metadataEnabled,
    });
    return {
      taskId,
      nodeId,
      taskType: 'vectortile' as const,
      stage: BatchTaskStage.WAIT,
      type: 'vectortile',
      status: 'waiting',
      index,
      progress: 0,
    };
  });

  return { tasks, inputsByTaskId };
}

