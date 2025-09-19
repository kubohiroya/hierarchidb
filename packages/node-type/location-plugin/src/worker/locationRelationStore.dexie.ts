import type { NodeId } from '@hierarchidb/common-type';
import type { RelationBase, RelationStore } from '@hierarchidb/runtime-worker';
import type { LocationEntitiesDB, LocationRelationRow } from './locationEntitiesDB.js';
import type { LocationRelationMeta } from '../types/entities.js';

type Rel = RelationBase<LocationRelationMeta>;

export function createLocationRelationStoreDexie(db: LocationEntitiesDB): RelationStore<Rel> {
  return {
    async listByNode(nodeId: NodeId) {
      return (await db.relations.where('srcNodeId').equals(nodeId).toArray()) as any;
    },
    async bulkUpsert(rels: Rel[]) {
      await db.relations.bulkPut(rels.map((r) => ({ ...r, updatedAt: Date.now() })) as LocationRelationRow[]);
    },
    async bulkDelete(rels: Rel[]) {
      await db.transaction('rw', db.relations, async () => {
        for (const r of rels) await db.relations.delete([r.srcNodeId, r.type, r.dstNodeId] as any);
      });
    },
  };
}
