import { getRowStoreDB, readChunkRows, TabularDatabaseManager } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

type TabularRowRecord = Record<string, unknown>;

export type TabularTableLoadResult = {
  headers: string[];
  rows: TabularRowRecord[];
};

export const loadTabularTableRows = async (
  pluginId: string,
  tableId: string,
): Promise<TabularTableLoadResult> => {
  const metadataDbName = getDBName(`${pluginId}-metadata`);
  const metadataManager = new TabularDatabaseManager(metadataDbName);
  const metadata = await metadataManager.get(tableId);
  if (!metadata) {
    throw new Error('Tabular table not found');
  }
  const headers = Array.isArray(metadata.columns)
    ? metadata.columns.map((column) => column.name).filter((name) => typeof name === 'string' && name.length > 0)
    : [];
  if (headers.length === 0) {
    throw new Error('Tabular table has no columns');
  }

  const db = getRowStoreDB();
  const chunks = await db.rowChunks
    .where('[pluginId+tableId]')
    .equals([pluginId, tableId])
    .sortBy('chunkIndex');
  const rows: TabularRowRecord[] = [];
  for (const chunk of chunks) {
    const decoded = readChunkRows(chunk);
    for (const row of decoded) {
      if (!row || typeof row !== 'object') continue;
      rows.push(row as TabularRowRecord);
    }
  }
  return { headers, rows };
};
