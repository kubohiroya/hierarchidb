import type { NodeId } from '@hierarchidb/common-type';
import type { RelationBase, RelationStore } from '@hierarchidb/runtime-worker';
import type { ShapeEntitiesDB, ShapeRelationRow } from './shapeEntitiesDB';

type Rel = RelationBase<{ weight?: number }>;

export function createShapeRelationStoreDexie(db: ShapeEntitiesDB): RelationStore<Rel> {
  return {
    async listByNode(nodeId: NodeId) {
      return (await db.relations.where('srcNodeId').equals(nodeId).toArray()) as any;
    },
    async bulkUpsert(rels: Rel[]) {
      await db.relations.bulkPut(rels.map((r) => ({ ...r, updatedAt: Date.now() })) as ShapeRelationRow[]);
    },
    async bulkDelete(rels: Rel[]) {
      await db.transaction('rw', db.relations, async () => {
        for (const r of rels) await db.relations.delete([r.srcNodeId, r.type, r.dstNodeId] as any);
      });
    },
  };
}
