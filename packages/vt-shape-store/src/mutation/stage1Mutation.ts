import type { NodeId } from '@hierarchidb/common-types';
import type { Stage1Buffer, Stage1BufferPayload } from '../types.js';
import { SHAPE_DOMAIN, buildStage1BufferId } from '../ids.js';
import type { VtShapeDb } from '../db/shapeDb.js';

export async function putStage1Buffer(
  db: VtShapeDb,
  nodeId: NodeId,
  payload: Stage1BufferPayload
): Promise<Stage1Buffer> {
  const buffer: Stage1Buffer = {
    id: buildStage1BufferId(nodeId, payload.sourceKey),
    nodeId,
    domainType: SHAPE_DOMAIN,
    sourceKey: payload.sourceKey,
    countryCode: payload.countryCode,
    adminLevel: payload.adminLevel,
    data: payload.data,
    featureCount: payload.featureCount,
    vertexCount: payload.vertexCount,
    polygonCount: payload.polygonCount,
    timestamp: payload.timestamp ?? Date.now(),
  };
  await db.stage1Buffers.put(buffer);
  return buffer;
}
