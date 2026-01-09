import type { NodeId } from '@hierarchidb/common-types';
import type { TransformBuffer } from '../types.js';
import { SHAPE_DOMAIN, buildTransformBufferId } from '../ids.js';
import type { VtShapeDb } from '../db/shapeDb.js';

export async function getTransformBuffer(
  db: VtShapeDb,
  nodeId: NodeId,
  bandId: number,
  sourceKey: string
): Promise<TransformBuffer | null> {
  const id = buildTransformBufferId(nodeId, bandId, sourceKey);
  return (await db.transformBandBuffers.get(id)) ?? null;
}

export async function listTransformBuffers(
  db: VtShapeDb,
  nodeId: NodeId,
  bandId: number
): Promise<TransformBuffer[]> {
  return db.transformBandBuffers
    .where('[nodeId+bandId]')
    .equals([nodeId, bandId])
    .filter((row) => row.domainType === SHAPE_DOMAIN)
    .toArray();
}
