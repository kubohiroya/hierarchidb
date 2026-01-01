import type { VectorTileEntity } from './VectorTileEntity.js';

/**
 * Peer data stored for shape nodes in peerEntities.
 */
export interface ShapePeerData {
  schemaVersion: 1;
  lastProcessedTile?: Pick<VectorTileEntity, 'z' | 'x' | 'y' | 'generatedAt'>;
  metadata?: Record<string, unknown>;
}

