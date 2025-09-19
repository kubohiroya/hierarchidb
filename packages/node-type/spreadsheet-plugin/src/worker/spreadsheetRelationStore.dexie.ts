import type { NodeId } from '@hierarchidb/common-type';
import type { RelationBase, RelationStore } from '@hierarchidb/runtime-worker';
import type { SheetRelationRow, SpreadsheetEntitiesDB } from './spreadsheetEntitiesDB.js';
import type { SpreadsheetRelationMeta } from '../types/entities.js';

type Rel = RelationBase<SpreadsheetRelationMeta>;

export function createSpreadsheetRelationStoreDexie(db: SpreadsheetEntitiesDB): RelationStore<Rel> {
  return {
    async listByNode(nodeId: NodeId) {
      const rows = await db.relations.where('srcNodeId').equals(nodeId).toArray();
      return rows.map((row) => ({
        srcNodeId: row.srcNodeId,
        dstNodeId: row.dstNodeId,
        type: row.type,
        meta: row.meta,
        updatedAt: row.updatedAt,
      }));
    },
    async bulkUpsert(rels: Rel[]) {
      const rows: SheetRelationRow[] = rels.map((rel) => ({
        srcNodeId: rel.srcNodeId,
        dstNodeId: rel.dstNodeId,
        type: rel.type,
        meta: rel.meta,
        updatedAt: rel.updatedAt ?? Date.now(),
      }));
      await db.relations.bulkPut(rows);
    },
    async bulkDelete(rels: Rel[]) {
      await db.transaction('rw', db.relations, async () => {
        for (const rel of rels) {
          const key: [NodeId, string, NodeId] = [rel.srcNodeId, rel.type, rel.dstNodeId];
          await db.relations.delete(key);
        }
      });
    },
  };
}
