import type { NodeId } from '@hierarchidb/common-types';
import type { BatchProcessConfig } from '../../../types.js';
import { buildMinimalVectorTileRowsFromExtract2 } from '../../tiles/buildMinimalVectorTileRowsFromExtract2.js';
import { buildVectorTileTasks } from '../../tiles/vectorTileTasks.js';

export type VectorTileStageTileInputSource = {
  listExtract2Buffers: () => Promise<Array<{ id: string }>>;
  listTileIdRelations?: () => Promise<Array<{ tileId: string }>>;
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
    const parseTileId = (tileId: string): { key: string; z: number; x: number; y: number } | null => {
      const prefix = `${String(nodeId)}-`;
      if (!tileId.startsWith(prefix)) return null;
      const rest = tileId.slice(prefix.length);
      const parts = rest.split('-');
      if (parts.length !== 3) return null;
      const zRaw = parts[0];
      const xRaw = parts[1];
      const yRaw = parts[2];
      if (zRaw == null || xRaw == null || yRaw == null) return null;
      const z = Number.parseInt(zRaw, 10);
      const x = Number.parseInt(xRaw, 10);
      const y = Number.parseInt(yRaw, 10);
      if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { key: tileId, z, x, y };
    };

    const relationRows = await tileInputSource.listTileIdRelations?.();
    const tileRows = relationRows && relationRows.length > 0
      ? Array.from(new Map(
        relationRows
          .map((row) => parseTileId(row.tileId))
          .filter((row): row is { key: string; z: number; x: number; y: number } => Boolean(row))
          .map((row) => [row.key, row]),
      ).values())
      : buildMinimalVectorTileRowsFromExtract2({
        nodeId,
        zoomLevels,
        extract2Buffers: await tileInputSource.listExtract2Buffers(),
      });

    return buildVectorTileTasks({ nodeId, tileRows, config });
  })();
}
