import type { NodeId } from '@hierarchidb/common-types';

export type ExtractedBufferHandle = { id: string };

export type VectorTileTaskInputRow = { key: string; z: number; x: number; y: number };

/**
 * Minimal implementation (legacy stub compatibility):
 * vectortile stage inputs are derived from extract2 buffers (1 tile row per buffer).
 *
 * This is intentionally deterministic and avoids re-introducing heavier tile-indexing.
 */
export function buildMinimalVectorTileRowsFromExtract2(params: {
  nodeId: NodeId;
  zoomLevels: number[];
  extract2Buffers: ExtractedBufferHandle[];
}): VectorTileTaskInputRow[] {
  const { nodeId, zoomLevels, extract2Buffers } = params;
  void nodeId; // kept for future logging/ID generation

  const z = zoomLevels[0] ?? 0;
  return extract2Buffers.map((buf, index) => ({
    key: buf.id,
    z,
    x: 0,
    y: index,
  }));
}

