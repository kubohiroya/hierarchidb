import type { NodeId } from '@hierarchidb/common-types';
import type { Stage1Buffer } from '../types.js';
import { SHAPE_DOMAIN, buildStage1BufferId } from '../ids.js';
import type { VtShapeDb } from '../db/shapeDb.js';

export async function getStage1Buffer(
  db: VtShapeDb,
  nodeId: NodeId,
  sourceKey: string
): Promise<Stage1Buffer | null> {
  const id = buildStage1BufferId(nodeId, sourceKey);
  return (await db.stage1Buffers.get(id)) ?? null;
}

export async function listStage1Buffers(
  db: VtShapeDb,
  nodeId: NodeId
): Promise<Stage1Buffer[]> {
  return db.stage1Buffers.where('[nodeId+domainType]').equals([nodeId, SHAPE_DOMAIN]).toArray();
}
