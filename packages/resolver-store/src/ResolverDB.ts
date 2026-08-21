import { Dexie, type Table } from 'dexie';
import type { NodeId, PeerEntity } from '@hierarchidb/core-types';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';

export interface ResolverEntityPayload {
  nodeId: NodeId;
  name?: string;
  [key: string]: unknown;
}

export type ResolverEntity = PeerEntity<ResolverEntityPayload>;

export class ResolverDB extends Dexie {
  resolvers!: Table<ResolverEntity, string>;

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      resolvers: '&id, nodeId, name',
    });
    this.resolvers = this.table('resolvers');
  }
}

let singleton: ResolverDB | null = null;

export function getResolverDB(): ResolverDB {
  if (!singleton) {
    singleton = new ResolverDB(getDBName(getBuildDatabasePrefix(), 'resolver-db'));
  }
  return singleton;
}

export async function closeResolverDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

export async function clearResolverDatabases(): Promise<void> {
  await Dexie.delete(getDBName(getBuildDatabasePrefix(), 'resolver-db'));
}
