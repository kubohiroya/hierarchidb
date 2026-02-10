import { afterEach, describe, expect, it } from 'vitest';
import { TabularWriter, closeRowStoreDB } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';
import { loadTabularTableRows } from '../tabular.js';

type PrefixGlobal = typeof globalThis & { APP_PREFIX?: string };
const globalWithPrefix = globalThis as PrefixGlobal;
const originalPrefix = globalWithPrefix.APP_PREFIX;

const deleteDatabase = async (name: string): Promise<void> => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
};

describe('loadTabularTableRows', () => {
  afterEach(async () => {
    await closeRowStoreDB();
    for (const prefix of ['hidb', 'cart']) {
      await deleteDatabase(getDBName('location-metadata', prefix));
      await deleteDatabase(getDBName('tabular-source-rowstore-db', prefix));
    }
    if (typeof originalPrefix === 'string') {
      globalWithPrefix.APP_PREFIX = originalPrefix;
    } else {
      delete globalWithPrefix.APP_PREFIX;
    }
  });

  it('uses the explicitly provided db prefix', async () => {
    const sourcePrefix = 'cart';
    const workerDefaultPrefix = 'hidb';
    globalWithPrefix.APP_PREFIX = sourcePrefix;

    const writer = new TabularWriter('location', {
      metadataDbName: getDBName('location-metadata', sourcePrefix),
    });
    const tableId = await writer.begin({
      filename: 'locations.csv',
      columns: ['name', 'latitude', 'longitude'],
    });
    await writer.writeRows([{ name: 'Tokyo', latitude: 35.6764, longitude: 139.65 }]);
    await writer.commit();
    await closeRowStoreDB();
    globalWithPrefix.APP_PREFIX = workerDefaultPrefix;

    await expect(loadTabularTableRows('location', tableId, workerDefaultPrefix)).rejects.toThrow(
      'Tabular table not found',
    );

    const result = await loadTabularTableRows('location', tableId, sourcePrefix);
    expect(result.headers).toEqual(['name', 'latitude', 'longitude']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.name).toBe('Tokyo');
  });
});
