import type { NodeId } from '@hierarchidb/common-type';
import type { RelationBase, RelationStore } from '@hierarchidb/runtime-worker';
import type { LocationEntitiesDB } from './locationEntitiesDB.js';
import type { LocationRelationMeta } from '../types/entities.js';
import { fromRelationRows, toRelationRow } from './normalizers.js';

type Rel = RelationBase<LocationRelationMeta>;

export function createLocationRelationStoreDexie(db: LocationEntitiesDB): RelationStore<Rel> {
  return {
    async listByNode(nodeId: NodeId) {
      const rows = await db.relations.where('srcNodeId').equals(nodeId).toArray();
      return fromRelationRows(rows);
    },
    async bulkUpsert(rels: Rel[]) {
      const now = Date.now();
      await db.relations.bulkPut(rels.map((rel) => toRelationRow(rel, now)));
    },
    async bulkDelete(rels: Rel[]) {
      await db.transaction('rw', db.relations, async () => {
        for (const r of rels) await db.relations.delete([r.srcNodeId, r.type, r.dstNodeId]);
      });
    },
  };
}
