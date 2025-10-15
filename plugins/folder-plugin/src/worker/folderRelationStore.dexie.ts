import type { NodeId } from '@hierarchidb/common-types';
import type { RelationBase, RelationStore } from '@hierarchidb/runtime-worker';
import type { FolderEntitiesDB, FolderRelationRow } from './folderEntitiesDB.js';

type Rel = RelationBase<{ weight?: number }>;

export function createFolderRelationStoreDexie(db: FolderEntitiesDB): RelationStore<Rel> {
  return {
    async listByNode(nodeId: NodeId) {
      const rows = await db.relations.where('srcNodeId').equals(nodeId).toArray();
      return rows.map<Rel>((row) => {
        const meta = typeof row.meta === 'object' && row.meta !== null ? (row.meta as Rel['meta']) : undefined;
        return {
          srcNodeId: row.srcNodeId,
          dstNodeId: row.dstNodeId,
          type: row.type,
          meta,
          updatedAt: row.updatedAt,
        };
      });
    },
    async bulkUpsert(rels: Rel[]) {
      const rows: FolderRelationRow[] = rels.map((r) => ({ ...r, updatedAt: Date.now() }));
      await db.relations.bulkPut(rows);
    },
    async bulkDelete(rels: Rel[]) {
      await db.transaction('rw', db.relations, async () => {
        for (const r of rels) {
          const key: [NodeId, string, NodeId] = [r.srcNodeId, r.type, r.dstNodeId];
          await db.relations.delete(key);
        }
      });
    },
  };
}
