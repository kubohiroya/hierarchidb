import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { registerSpreadsheetWorkerStores, type RegisterSpreadsheetWorkerStoresOptions } from '../factory/registerSpreadsheetWorkerStores.js';

type RegistryMaps = {
  peers: Map<string, unknown>;
  groups: Map<string, unknown>;
  relations: Map<string, unknown>;
};

type StoreRegistry = NonNullable<RegisterSpreadsheetWorkerStoresOptions['storeRegistry']>;

const createMockRegistry = (): { registry: StoreRegistry; maps: RegistryMaps } => {
  const peers = new Map<string, unknown>();
  const groups = new Map<string, unknown>();
  const relations = new Map<string, unknown>();

  return {
    maps: { peers, groups, relations },
    registry: {
      getPeer: (nodeType: string) => peers.get(nodeType),
      registerPeer: (nodeType: string, store: unknown) => {
        peers.set(nodeType, store);
      },
      getGroup: (nodeType: string) => groups.get(nodeType),
      registerGroup: (nodeType: string, store: unknown) => {
        groups.set(nodeType, store);
      },
      getRelations: (nodeType: string) => relations.get(nodeType),
      registerRelations: (nodeType: string, store: unknown) => {
        relations.set(nodeType, store);
      },
    },
  };
};

describe('registerSpreadsheetWorkerStores', () => {
  beforeEach(async () => {
    await new Promise((resolve) => {
      const deleteRequest = indexedDB.deleteDatabase('hidb-spreadsheet-entities-db');
      deleteRequest.onsuccess = () => resolve(undefined);
      deleteRequest.onerror = () => resolve(undefined);
      deleteRequest.onblocked = () => resolve(undefined);
    });
  });

  it('registers peer/group/relation stores when registry is provided', async () => {
    const { registry, maps } = createMockRegistry();

    await registerSpreadsheetWorkerStores({ storeRegistry: registry });

    expect(maps.peers.get('spreadsheet')).toBeDefined();
    expect(maps.groups.get('spreadsheet')).toBeDefined();
    expect(maps.relations.get('spreadsheet')).toBeDefined();
  });
});
