import type { NodeId } from '@hierarchidb/common-type';
import type { RelationBase, RelationStore } from '@hierarchidb/runtime-worker';

// Development-only in-memory RelationStore for the folder plugin.
// Replace with Dexie-backed implementation in production.
type Rel = RelationBase<{ weight?: number }>;

// key: composite `${src}\t${type}\t${dst}`
const SEP = "\t";
const mem = new Map<string, Rel>();

function key(r: Rel) {
  return `${r.srcNodeId}${SEP}${r.type}${SEP}${r.dstNodeId}` as string;
}

export const folderRelationStore: RelationStore<Rel> = {
  async listByNode(nodeId: NodeId) {
    return Array.from(mem.values()).filter((r) => r.srcNodeId === nodeId);
  },
  async bulkUpsert(rels: Rel[]) {
    const now = Date.now();
    for (const r of rels) mem.set(key(r), { ...r, updatedAt: now });
  },
  async bulkDelete(rels: Rel[]) {
    for (const r of rels) mem.delete(key(r));
  },
};

export function __clearFolderRelationStore() {
  mem.clear();
}
