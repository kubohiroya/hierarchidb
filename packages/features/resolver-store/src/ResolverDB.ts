import { Dexie, type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/common-types';
import { getDBName } from '@hierarchidb/util';

export type ResolverEntity = {
  id: string;
  nodeId: NodeId;
  name?: string;
  [key: string]: unknown;
};

export class ResolverDB extends Dexie {
  resolvers!: Table<ResolverEntity, string>;

  constructor() {
    super(getDBName('resolver-db'));
    this.version(1).stores({
      resolvers: '&id, nodeId, name',
    });
    this.resolvers = this.table('resolvers');
  }
}

let singleton: ResolverDB | null = null;

export function getResolverDB(): ResolverDB {
  if (!singleton) singleton = new ResolverDB();
  return singleton;
}

export async function closeResolverDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

export async function clearResolverDatabases(): Promise<void> {
  await Dexie.delete(getDBName('resolver-db'));
}
