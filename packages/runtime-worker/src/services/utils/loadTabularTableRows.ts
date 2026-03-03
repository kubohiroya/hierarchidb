import { Dexie, type Table } from 'dexie';
import { readChunkRows, TabularDatabaseManager } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

type TabularRowRecord = Record<string, unknown>;
type RowChunkRecord = {
  id: string;
  pluginId: string;
  tableId: string;
  chunkIndex: number;
  startRowIndex: number;
  endRowIndex: number;
  binaryData: ArrayBuffer;
  createdAt: number;
  updatedAt: number;
};
type RowStoreLookupDB = Dexie & { rowChunks: Table<RowChunkRecord, string> };

const ROW_STORE_SUFFIX = 'tabular-source-rowstore-db';

const collectRowsFromChunks = (chunks: Array<{ binaryData: ArrayBuffer }>): TabularRowRecord[] => {
  const rows: TabularRowRecord[] = [];
  for (const chunk of chunks) {
    const decoded = readChunkRows(chunk as RowChunkRecord);
    for (const row of decoded) {
      if (!row || typeof row !== 'object') continue;
      rows.push(row as TabularRowRecord);
    }
  }
  return rows;
};

const loadRowsFromStore = async (
  dbName: string,
  pluginId: string,
  tableId: string,
): Promise<TabularRowRecord[]> => {
  const db = new Dexie(dbName) as RowStoreLookupDB;
  db.version(1).stores({
    rowChunks: '&id, [pluginId+tableId], [pluginId+tableId+startRowIndex], [pluginId+tableId+endRowIndex], tableId, pluginId, chunkIndex, createdAt',
    rowIndexes: '&id, [pluginId+tableId+column], [pluginId+tableId+column+value]',
  });
  try {
    await db.open();
    const chunks = await db.rowChunks
      .where('[pluginId+tableId]')
      .equals([pluginId, tableId])
      .sortBy('chunkIndex');
    return collectRowsFromChunks(chunks);
  } finally {
    db.close();
  }
};

const resolveMetadataHeaders = async (
  pluginId: string,
  tableId: string,
  dbPrefix?: string,
): Promise<string[]> => {
  const metadataDbName = getDBName(`${pluginId}-metadata`, dbPrefix);
  const metadataManager = new TabularDatabaseManager(metadataDbName);
  try {
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
    return headers;
  } finally {
    await metadataManager.close();
  }
};

export type TabularTableLoadResult = {
  headers: string[];
  rows: TabularRowRecord[];
};

export const loadTabularTableRows = async (
  pluginId: string,
  tableId: string,
  dbPrefix?: string,
): Promise<TabularTableLoadResult> => {
  const headers = await resolveMetadataHeaders(pluginId, tableId, dbPrefix);
  const rowStoreDbName = getDBName(ROW_STORE_SUFFIX, dbPrefix);
  const rows = await loadRowsFromStore(rowStoreDbName, pluginId, tableId);
  return { headers, rows };
};
