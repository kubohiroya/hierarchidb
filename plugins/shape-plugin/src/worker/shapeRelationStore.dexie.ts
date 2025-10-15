import type { NodeId } from '@hierarchidb/common-types';
import type { RelationBase, RelationStore } from '@hierarchidb/runtime-worker';
import type { ShapeEntitiesDB, ShapeRelationRow } from './shapeEntitiesDB.js';

type Rel = RelationBase<{ weight?: number }>;

export function createShapeRelationStoreDexie(db: ShapeEntitiesDB): RelationStore<Rel> {
  return {
    async listByNode(nodeId: NodeId) {
      const rows = await db.relations.where('srcNodeId').equals(nodeId).toArray();
      return rows.map(toRelation);
    },
    async bulkUpsert(rels: Rel[]) {
      const now = Date.now();
      const rows: ShapeRelationRow[] = rels.map((rel) => ({
        srcNodeId: rel.srcNodeId,
        dstNodeId: rel.dstNodeId,
        type: rel.type,
        meta: rel.meta,
        updatedAt: now,
      }));
      await db.relations.bulkPut(rows);
    },
    async bulkDelete(rels: Rel[]) {
      await db.transaction('rw', db.relations, async () => {
        for (const rel of rels) await db.relations.delete([rel.srcNodeId, rel.type, rel.dstNodeId]);
      });
    },
  };
}

function toRelation(row: ShapeRelationRow): Rel {
  return {
    srcNodeId: row.srcNodeId,
    dstNodeId: row.dstNodeId,
    type: row.type,
    meta: row.meta as Rel['meta'],
    updatedAt: row.updatedAt,
  };
}
