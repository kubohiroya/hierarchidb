import type { NodeId } from '@hierarchidb/common-type';
import type { RelationBase, RelationStore } from '@hierarchidb/runtime-worker';
import type { FolderEntitiesDB, FolderRelationRow } from './folderEntitiesDB';

type Rel = RelationBase<{ weight?: number }>;

export function createFolderRelationStoreDexie(db: FolderEntitiesDB): RelationStore<Rel> {
  return {
    async listByNode(nodeId: NodeId) {
      return (await db.relations.where('srcNodeId').equals(nodeId).toArray()) as any;
    },
    async bulkUpsert(rels: Rel[]) {
      const rows: FolderRelationRow[] = rels.map((r) => ({ ...r, updatedAt: Date.now() }));
      await db.relations.bulkPut(rows);
    },
    async bulkDelete(rels: Rel[]) {
      await db.transaction('rw', db.relations, async () => {
        for (const r of rels) await db.relations.delete([r.srcNodeId, r.type, r.dstNodeId] as any);
      });
    },
  };
}
