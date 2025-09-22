import type { VectorTileEntity } from '../shared/types.js';

/**
 * Peer data stored for shape nodes in peerEntities. Always include
 * schemaVersion so that migrations can be performed deterministically.
 */
export interface ShapePeerData {
  schemaVersion: 1;
  lastProcessedTile?: Pick<VectorTileEntity, 'z' | 'x' | 'y' | 'generatedAt'>;
  metadata?: Record<string, unknown>;
}
