import 'fake-indexeddb/auto';
import type { NodeId, TreeId } from '@hierarchidb/common-types';
import { Dexie, type Table } from 'dexie';
import type { FulltextIndexRecord, FulltextNodeRecord } from '../fulltext-types.js';

class FulltextTestDB extends Dexie {
  fulltextNodes!: Table<FulltextNodeRecord, [TreeId, NodeId]>;
  fulltextIndexes!: Table<FulltextIndexRecord, [TreeId, string]>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      fulltextNodes: '&[treeId+nodeId], treeId, nodeId, updatedAt',
      fulltextIndexes: '&[treeId+locale], treeId, locale, dirty',
    });
    this.fulltextNodes = this.table('fulltextNodes');
    this.fulltextIndexes = this.table('fulltextIndexes');
  }
}

export type FulltextTables = {
  fulltextNodes: Table<FulltextNodeRecord, [TreeId, NodeId]>;
  fulltextIndexes: Table<FulltextIndexRecord, [TreeId, string]>;
};

export async function createFulltextTestDB(label: string): Promise<FulltextTestDB> {
  const db = new FulltextTestDB(
    `fulltext-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await db.open();
  return db;
}

export async function destroyFulltextTestDB(db?: FulltextTestDB): Promise<void> {
  if (!db) return;
  await db.delete();
  db.close();
}

export function attachFulltextTables<T extends object>(
  target: T,
  db: FulltextTestDB
): T & FulltextTables {
  Object.assign(target, {
    fulltextNodes: db.fulltextNodes,
    fulltextIndexes: db.fulltextIndexes,
  });
  return target as T & FulltextTables;
}
