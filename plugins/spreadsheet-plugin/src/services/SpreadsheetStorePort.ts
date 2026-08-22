import type {
  TabularChunk,
  TabularIngestContext,
  TabularIngestResult,
  TabularIngestSession,
  TabularIngestSummary,
  TabularSchema,
  TabularStorePort,
} from '@hierarchidb/tabular-source';
import {
  type TabularColumnInfo,
  type TabularColumnType,
  type TabularTableMetadataLike,
  TabularWriter,
} from '@hierarchidb/tabular-store';
import type { SpreadsheetMetadataManager } from './SpreadsheetMetadataManager.js';

interface SpreadsheetStorePortOptions {
  pluginId: string;
  metadataManager: SpreadsheetMetadataManager;
  filename: string;
  fileSizeBytes: number;
  contentHash: string;
  rowStoreDatabaseName: string;
}

type ColumnStats = {
  name: string;
  index: number;
  numberCount: number;
  booleanCount: number;
  dateCount: number;
  stringCount: number;
  hasNullValues: boolean;
  sampleValues: Array<string | number>;
};

type SessionData = {
  writer: TabularWriter;
  tableId: string;
  columns: ColumnStats[];
  createdAt: number;
};

const SAMPLE_LIMIT = 5;

const isBooleanLike = (value: string): boolean => {
  const lower = value.toLowerCase();
  return lower === 'true' || lower === 'false';
};

const isNumberLike = (value: string): boolean => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value);

const isDateLike = (value: string): boolean => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
};

const trackSampleValue = (stats: ColumnStats, value: string | number): void => {
  if (stats.sampleValues.length >= SAMPLE_LIMIT) return;
  stats.sampleValues.push(value);
};

const resolveColumnType = (stats: ColumnStats): TabularColumnType => {
  if (
    stats.numberCount > 0 &&
    stats.stringCount === 0 &&
    stats.booleanCount === 0 &&
    stats.dateCount === 0
  ) {
    return 'number';
  }
  if (
    stats.booleanCount > 0 &&
    stats.numberCount === 0 &&
    stats.stringCount === 0 &&
    stats.dateCount === 0
  ) {
    return 'boolean';
  }
  if (
    stats.dateCount > 0 &&
    stats.numberCount === 0 &&
    stats.booleanCount === 0 &&
    stats.stringCount === 0
  ) {
    return 'date';
  }
  return 'string';
};

export class SpreadsheetStorePort implements TabularStorePort<TabularTableMetadataLike> {
  private readonly pluginId: string;
  private readonly metadataManager: SpreadsheetMetadataManager;
  private readonly filename: string;
  private readonly fileSizeBytes: number;
  private readonly contentHash: string;
  private readonly rowStoreDatabaseName: string;
  private readonly sessions = new Map<string, SessionData>();

  constructor(options: SpreadsheetStorePortOptions) {
    this.pluginId = options.pluginId;
    this.metadataManager = options.metadataManager;
    this.filename = options.filename;
    this.fileSizeBytes = options.fileSizeBytes;
    this.contentHash = options.contentHash;
    this.rowStoreDatabaseName = options.rowStoreDatabaseName;
  }

  async beginIngest(
    schema: TabularSchema,
    _ctx: TabularIngestContext
  ): Promise<TabularIngestSession> {
    if (!schema.columns || schema.columns.length === 0) {
      throw new Error('No columns found in uploaded file');
    }
    const writer = new TabularWriter(this.pluginId, {
      metadataDbName: this.metadataManager.databaseName,
      rowStoreDbName: this.rowStoreDatabaseName,
    });
    const tableId = await writer.begin({
      filename: this.filename,
      columns: schema.columns.map((column) => column.name),
    });

    const columns: ColumnStats[] = schema.columns.map((column, index) => ({
      name: column.name,
      index,
      numberCount: 0,
      booleanCount: 0,
      dateCount: 0,
      stringCount: 0,
      hasNullValues: false,
      sampleValues: [],
    }));

    this.sessions.set(tableId, {
      writer,
      tableId,
      columns,
      createdAt: Date.now(),
    });

    return { id: tableId };
  }

  async writeChunk(session: TabularIngestSession, chunk: TabularChunk): Promise<void> {
    const current = this.sessions.get(session.id);
    if (!current) return;
    const normalizedRows = chunk.rows.map((row) => this.normalizeRow(row, current.columns));
    await current.writer.writeRows(normalizedRows);
  }

  async commit(
    session: TabularIngestSession,
    summary: TabularIngestSummary
  ): Promise<TabularIngestResult<TabularTableMetadataLike>> {
    const current = this.sessions.get(session.id);
    if (!current) {
      throw new Error(`Unknown ingest session: ${session.id}`);
    }
    await current.writer.commit();

    const metadata: TabularTableMetadataLike = {
      id: current.tableId,
      filename: this.filename,
      contentHash: this.contentHash,
      fileSizeBytes: this.fileSizeBytes,
      totalRows: summary.totalRows,
      chunkCount: summary.chunkCount,
      isChunked: summary.chunkCount > 1,
      columns: current.columns.map<TabularColumnInfo>((stats, index) => ({
        name: stats.name,
        index,
        type: resolveColumnType(stats),
        hasNullValues: stats.hasNullValues,
        sampleValues: [...stats.sampleValues],
      })),
      createdAt: current.createdAt,
      referenceCount: 0,
      referencingPlugins: [],
    };

    const saved = await this.metadataManager.create(metadata, this.pluginId);
    this.sessions.delete(session.id);
    return {
      session,
      metadata: saved,
    };
  }

  async abort(session: TabularIngestSession): Promise<void> {
    const current = this.sessions.get(session.id);
    if (!current) return;
    this.sessions.delete(session.id);
  }

  private normalizeRow(
    row: Record<string, unknown>,
    columns: ColumnStats[]
  ): Record<string, string | number | boolean | null> {
    const normalized: Record<string, string | number | boolean | null> = {};
    for (const stats of columns) {
      const raw = row[stats.name];
      if (raw === undefined || raw === null || raw === '') {
        stats.hasNullValues = true;
        normalized[stats.name] = '';
        continue;
      }
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        stats.numberCount += 1;
        trackSampleValue(stats, raw);
        normalized[stats.name] = raw;
        continue;
      }
      if (typeof raw === 'boolean') {
        stats.booleanCount += 1;
        trackSampleValue(stats, raw ? 'true' : 'false');
        normalized[stats.name] = raw;
        continue;
      }
      const value = String(raw).trim();
      if (!value.length) {
        stats.hasNullValues = true;
        normalized[stats.name] = '';
        continue;
      }
      if (isBooleanLike(value)) {
        stats.booleanCount += 1;
        const boolValue = value.toLowerCase() === 'true';
        trackSampleValue(stats, boolValue ? 'true' : 'false');
        normalized[stats.name] = boolValue;
        continue;
      }
      if (isNumberLike(value)) {
        stats.numberCount += 1;
        const numeric = Number(value);
        trackSampleValue(stats, numeric);
        normalized[stats.name] = numeric;
        continue;
      }
      if (isDateLike(value)) {
        stats.dateCount += 1;
        const iso = new Date(value).toISOString();
        trackSampleValue(stats, iso);
        normalized[stats.name] = iso;
        continue;
      }
      stats.stringCount += 1;
      trackSampleValue(stats, value);
      normalized[stats.name] = value;
    }
    return normalized;
  }
}
