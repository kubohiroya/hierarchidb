import { afterEach, describe, expect, it } from 'vitest';
import {
  closeRowStoreDB,
  getRowStoreDB,
  readChunkRows,
  TabularWriter,
} from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';
import { loadTabularTableRows } from '../loadTabularTableRows';

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
    for (const prefix of ['test-default', 'test-source']) {
      await deleteDatabase(getDBName(prefix, 'location-metadata'));
      await deleteDatabase(getDBName(prefix, 'tabular-source-rowstore-db'));
    }
  });

  it('uses the explicitly provided db prefix', async () => {
    const sourcePrefix = 'test-source';
    const workerDefaultPrefix = 'test-default';

    const writer = new TabularWriter('location', {
      metadataDbName: getDBName(sourcePrefix, 'location-metadata'),
      rowStoreDbName: getDBName(sourcePrefix, 'tabular-source-rowstore-db'),
    });
    const tableId = await writer.begin({
      filename: 'locations.csv',
      columns: ['name', 'latitude', 'longitude'],
    });
    await writer.writeRows([{ name: 'Tokyo', latitude: 35.6764, longitude: 139.65 }]);
    await writer.commit();
    await closeRowStoreDB();
    const reopenedRowStore = getRowStoreDB(
      getDBName(sourcePrefix, 'tabular-source-rowstore-db')
    );
    const chunks = await reopenedRowStore.rowChunks
      .where('[pluginId+tableId]')
      .equals(['location', tableId])
      .toArray();
    expect(chunks).toHaveLength(1);
    expect(readChunkRows(chunks[0] as (typeof chunks)[number])).toHaveLength(1);
    await closeRowStoreDB();
    expect(
      await getRowStoreDB(getDBName(sourcePrefix, 'tabular-source-rowstore-db')).rowChunks.count()
    ).toBe(1);

    await expect(loadTabularTableRows('location', tableId, workerDefaultPrefix)).rejects.toThrow(
      'Tabular table not found',
    );

    const result = await loadTabularTableRows('location', tableId, sourcePrefix);
    expect(result.headers).toEqual(['name', 'latitude', 'longitude']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.name).toBe('Tokyo');
  });
});
