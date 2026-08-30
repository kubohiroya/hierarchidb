import type {
  ProjectFileContentPage,
  ProjectFileContentPageInput,
  ProjectFileContentTransfer,
  ProjectFileContentTransferInput,
} from '@hierarchidb/ide-gsm-client';
import { assertProjectRelativePath } from '@hierarchidb/idegsm-project-api';

const CSV_TRANSFER_CHUNK_SIZE_BYTES = 16_384;
const CSV_PATH_PATTERN = /\.csv$/u;

export interface IdeGsmCsvContentTransferPort {
  beginProjectFileContentTransfer(
    input: ProjectFileContentTransferInput
  ): Promise<ProjectFileContentTransfer>;
  projectFileContentPage(input: ProjectFileContentPageInput): Promise<ProjectFileContentPage>;
  closeProjectFileContentTransfer(transferId: string): Promise<boolean>;
}

export interface IdeGsmTrackedCsvHasher {
  update(bytes: Uint8Array): void;
  digestHex(): Promise<string>;
}

export interface IdeGsmTrackedCsvWriter {
  begin(schema: {
    readonly tableId?: string;
    readonly filename?: string;
    readonly columns: readonly string[];
    readonly contentHash?: string;
  }): Promise<string>;
  writeRows(rows: ReadonlyArray<Record<string, string>>): Promise<void>;
  commit(): Promise<{
    readonly tableId: string;
    readonly totalRows: number;
    readonly chunkCount: number;
  }>;
}

export interface IdeGsmTrackedCsvPublicationPort {
  createHasher(): IdeGsmTrackedCsvHasher;
  createWriter(): IdeGsmTrackedCsvWriter;
  commitTrackedCsvSnapshot(input: {
    readonly projectNodeId: string;
    readonly projectRelativePath: string;
    readonly relativePath: string;
    readonly digest: string;
    readonly byteCount: number;
    readonly updatedAt: string;
    readonly tableId: string;
    readonly rowCount: number;
    readonly columnNames: readonly string[];
  }): Promise<{
    readonly snapshotId: string;
    readonly contentGenerationId: string;
  }>;
}

export interface AcquireTrackedIdeGsmCsvSnapshotInput {
  readonly projectNodeId: string;
  readonly projectRelativePath: string;
  readonly relativePath: string;
}

export interface AcquireTrackedIdeGsmCsvSnapshotResult {
  readonly snapshotId: string;
  readonly contentGenerationId: string;
  readonly digest: string;
  readonly byteCount: number;
  readonly updatedAt: string;
  readonly tableId: string;
  readonly rowCount: number;
  readonly columnNames: readonly string[];
}

export async function acquireTrackedIdeGsmCsvSnapshot(
  client: IdeGsmCsvContentTransferPort,
  publication: IdeGsmTrackedCsvPublicationPort,
  input: AcquireTrackedIdeGsmCsvSnapshotInput
): Promise<AcquireTrackedIdeGsmCsvSnapshotResult> {
  assertAcquisitionInput(input);
  let transfer: ProjectFileContentTransfer | null = null;
  try {
    transfer = await client.beginProjectFileContentTransfer(input);
    const hasher = publication.createHasher();
    const parser = new StreamingCsvParser();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let cursor: string | undefined;
    let receivedBytes = 0;
    let writer: IdeGsmTrackedCsvWriter | null = null;
    let tableId: string | null = null;

    for (;;) {
      const page = await client.projectFileContentPage({ transferId: transfer.transferId, cursor });
      if (page.rawByteCount > CSV_TRANSFER_CHUNK_SIZE_BYTES) {
        throw new Error('IDE-GSM CSV page exceeded the maximum decoded byte size');
      }

      const bytes = decodeBase64Bytes(page.contentChunkBase64);
      if (bytes.byteLength !== page.rawByteCount) {
        throw new Error('IDE-GSM CSV page byte count does not match decoded content');
      }
      hasher.update(bytes);
      receivedBytes += bytes.byteLength;

      const records = parser.push(decoder.decode(bytes, { stream: page.hasNext }));
      if (writer === null && parser.headers.length > 0) {
        writer = publication.createWriter();
        tableId = await writer.begin({
          filename: input.relativePath,
          columns: parser.headers,
          contentHash: transfer.contentDigest,
        });
      }
      if (writer !== null && records.length > 0) {
        await writer.writeRows(records);
      }

      if (!page.hasNext) break;
      if (page.nextCursor === null) {
        throw new Error('IDE-GSM CSV page cursor is required before the final page');
      }
      cursor = page.nextCursor;
    }

    const finalText = decoder.decode();
    const finalRecords = parser.finish(finalText);
    if (writer === null && parser.headers.length > 0) {
      writer = publication.createWriter();
      tableId = await writer.begin({
        filename: input.relativePath,
        columns: parser.headers,
        contentHash: transfer.contentDigest,
      });
    }
    if (writer === null || tableId === null) {
      throw new Error('IDE-GSM CSV content must include a header row');
    }
    if (finalRecords.length > 0) {
      await writer.writeRows(finalRecords);
    }

    const actualDigest = await hasher.digestHex();
    if (receivedBytes !== transfer.byteCount || actualDigest !== transfer.contentDigest) {
      throw new Error('IDE-GSM CSV transfer metadata does not match received content');
    }

    const commit = await writer.commit();
    const snapshot = await publication.commitTrackedCsvSnapshot({
      projectNodeId: input.projectNodeId,
      projectRelativePath: input.projectRelativePath,
      relativePath: input.relativePath,
      digest: transfer.contentDigest,
      byteCount: transfer.byteCount,
      updatedAt: transfer.updatedAt,
      tableId: commit.tableId,
      rowCount: commit.totalRows,
      columnNames: parser.headers,
    });

    return {
      snapshotId: snapshot.snapshotId,
      contentGenerationId: snapshot.contentGenerationId,
      digest: transfer.contentDigest,
      byteCount: transfer.byteCount,
      updatedAt: transfer.updatedAt,
      tableId: commit.tableId,
      rowCount: commit.totalRows,
      columnNames: parser.headers,
    };
  } finally {
    if (transfer !== null) {
      await client.closeProjectFileContentTransfer(transfer.transferId);
    }
  }
}

function assertAcquisitionInput(input: AcquireTrackedIdeGsmCsvSnapshotInput): void {
  if (input.projectNodeId.length === 0 || input.projectNodeId.trim() !== input.projectNodeId) {
    throw new Error('projectNodeId must be a trimmed non-empty string');
  }
  assertProjectRelativePath(input.projectRelativePath, 'projectRelativePath');
  assertProjectRelativePath(input.relativePath, 'relativePath');
  if (!CSV_PATH_PATTERN.test(input.relativePath)) {
    throw new Error('relativePath must point to a CSV file');
  }
}

class StreamingCsvParser {
  readonly headers: string[] = [];
  private readonly records: string[][] = [];
  private readonly field: string[] = [];
  private readonly row: string[] = [];
  private inQuotedField = false;
  private pendingQuote = false;
  private pendingCarriageReturn = false;

  push(text: string): Record<string, string>[] {
    this.parse(text);
    return this.drainRows();
  }

  finish(text = ''): Record<string, string>[] {
    this.parse(text);
    if (this.pendingCarriageReturn) {
      this.endRecord();
      this.pendingCarriageReturn = false;
    }
    if (this.inQuotedField || this.pendingQuote) {
      throw new Error('IDE-GSM CSV content has an unterminated quoted field');
    }
    if (this.field.length > 0 || this.row.length > 0) {
      this.endField();
      this.endRecord();
    }
    return this.drainRows();
  }

  private parse(text: string): void {
    for (const char of text) {
      if (this.pendingCarriageReturn) {
        if (char === '\n') {
          this.endRecord();
          this.pendingCarriageReturn = false;
          continue;
        }
        this.endRecord();
        this.pendingCarriageReturn = false;
      }

      if (this.pendingQuote) {
        if (char === '"') {
          this.field.push('"');
          this.pendingQuote = false;
          this.inQuotedField = true;
          continue;
        }
        this.pendingQuote = false;
        this.inQuotedField = false;
        if (char === ',') {
          this.endField();
          continue;
        }
        if (char === '\n') {
          this.endRecord();
          continue;
        }
        if (char === '\r') {
          this.pendingCarriageReturn = true;
          continue;
        }
        throw new Error('IDE-GSM CSV content has characters after a closing quote');
      }

      if (this.inQuotedField) {
        if (char === '"') {
          this.pendingQuote = true;
          continue;
        }
        this.field.push(char);
        continue;
      }

      if (char === '"') {
        if (this.field.length > 0) {
          throw new Error('IDE-GSM CSV content has an unexpected quote');
        }
        this.inQuotedField = true;
        continue;
      }
      if (char === ',') {
        this.endField();
        continue;
      }
      if (char === '\n') {
        this.endRecord();
        continue;
      }
      if (char === '\r') {
        this.pendingCarriageReturn = true;
        continue;
      }
      this.field.push(char);
    }
  }

  private endField(): void {
    this.row.push(this.field.join(''));
    this.field.length = 0;
  }

  private endRecord(): void {
    this.endField();
    if (this.headers.length === 0) {
      const header = [...this.row];
      this.validateHeaders(header);
      this.headers.push(...header);
    } else {
      this.validateRowWidth(this.row);
      this.records.push([...this.row]);
    }
    this.row.length = 0;
  }

  private drainRows(): Record<string, string>[] {
    const rows = this.records.splice(0);
    return rows.map((record) => {
      const row: Record<string, string> = {};
      for (let index = 0; index < this.headers.length; index += 1) {
        const header = this.headers[index];
        const value = record[index];
        if (header === undefined || value === undefined) {
          throw new Error('IDE-GSM CSV content row width does not match the header');
        }
        row[header] = value;
      }
      return row;
    });
  }

  private validateHeaders(headers: readonly string[]): void {
    if (headers.length === 0) {
      throw new Error('IDE-GSM CSV content must include at least one column');
    }
    const seen = new Set<string>();
    for (const header of headers) {
      if (header.length === 0 || seen.has(header)) {
        throw new Error('IDE-GSM CSV content has invalid headers');
      }
      seen.add(header);
    }
  }

  private validateRowWidth(row: readonly string[]): void {
    if (row.length !== this.headers.length) {
      throw new Error('IDE-GSM CSV content row width does not match the header');
    }
  }
}

function decodeBase64Bytes(value: string): Uint8Array {
  if (typeof globalThis.atob !== 'function') {
    throw new Error('IDE-GSM CSV page could not be decoded');
  }
  try {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new Error('IDE-GSM CSV page could not be decoded');
  }
}
