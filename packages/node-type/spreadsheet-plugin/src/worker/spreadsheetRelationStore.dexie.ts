import type { NodeId } from '@hierarchidb/common-type';
import type { RelationBase, RelationStore } from '@hierarchidb/runtime-worker';
import type { SheetRelationRow, SpreadsheetEntitiesDB } from './spreadsheetEntitiesDB';
import type { SpreadsheetRelationMeta } from '../types/entities';

type Rel = RelationBase<SpreadsheetRelationMeta>;

export function createSpreadsheetRelationStoreDexie(db: SpreadsheetEntitiesDB): RelationStore<Rel> {
  return {
    async listByNode(nodeId: NodeId) {
      return (await db.relations.where('srcNodeId').equals(nodeId).toArray()) as any;
    },
    async bulkUpsert(rels: Rel[]) {
      await db.relations.bulkPut(rels.map((r) => ({ ...r, updatedAt: Date.now() })) as SheetRelationRow[]);
    },
    async bulkDelete(rels: Rel[]) {
      await db.transaction('rw', db.relations, async () => {
        for (const r of rels) await db.relations.delete([r.srcNodeId, r.type, r.dstNodeId] as any);
      });
    },
  };
}
