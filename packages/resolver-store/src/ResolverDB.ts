import type { NodeId, PeerEntity } from '@hierarchidb/core-types';
import { Dexie, type Table } from 'dexie';

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

const requireResolverDatabaseName = (databaseName: unknown): string => {
  if (typeof databaseName !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(databaseName)) {
    throw new Error('resolver-database-name-invalid');
  }
  return databaseName;
};

export function initializeResolverDB(databaseName: string): ResolverDB {
  const exactDatabaseName = requireResolverDatabaseName(databaseName);
  if (!singleton) singleton = new ResolverDB(exactDatabaseName);
  if (singleton.name !== exactDatabaseName) {
    throw new Error('resolver-database-name-mismatch');
  }
  return singleton;
}

export function getResolverDB(): ResolverDB {
  if (!singleton) throw new Error('resolver-database-not-initialized');
  return singleton;
}

export async function closeResolverDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

export async function clearResolverDatabases(databaseName: string): Promise<void> {
  await Dexie.delete(requireResolverDatabaseName(databaseName));
}
