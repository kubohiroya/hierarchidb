export const EXTERNAL_CSV_TRANSFER_CHUNK_SIZE_BYTES = 16_384;

export interface ExternalContentTransfer {
  readonly transferId: string;
  readonly contentDigest: string;
  readonly updatedAt: string;
  readonly byteCount: number;
}

export interface ExternalContentPage {
  readonly contentChunkBase64: string;
  readonly rawByteCount: number;
  readonly nextCursor: string | null;
  readonly hasNext: boolean;
}

export interface ExternalContentPageInput {
  readonly transferId: string;
  readonly cursor?: string;
}

export interface ExternalCsvContentTransferPort<TTransferInput> {
  beginContentTransfer(input: TTransferInput): Promise<ExternalContentTransfer>;
  contentPage(input: ExternalContentPageInput): Promise<ExternalContentPage>;
  closeContentTransfer(transferId: string): Promise<boolean>;
}

export interface ExternalCsvHasher {
  update(bytes: Uint8Array): void;
  digestHex(): Promise<string>;
}

export interface ExternalCsvWriter {
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

export interface ExternalCsvSnapshotPublicationPort {
  createHasher(): ExternalCsvHasher;
  createWriter(): ExternalCsvWriter;
}

export interface AcquireExternalCsvContentTransferOptions<TTransferInput> {
  readonly transferInput: TTransferInput;
  readonly filename?: string;
  readonly warningPrefix?: string;
  readonly maxChunkSizeBytes?: number;
}

export interface AcquireExternalCsvContentTransferResult {
  readonly digest: string;
  readonly byteCount: number;
  readonly updatedAt: string;
  readonly tableId: string;
  readonly rowCount: number;
  readonly columnNames: readonly string[];
}

export async function acquireExternalCsvContentTransfer<TTransferInput>(
  port: ExternalCsvContentTransferPort<TTransferInput>,
  publication: ExternalCsvSnapshotPublicationPort,
  options: AcquireExternalCsvContentTransferOptions<TTransferInput>
): Promise<AcquireExternalCsvContentTransferResult> {
  const maxChunkSizeBytes = options.maxChunkSizeBytes ?? EXTERNAL_CSV_TRANSFER_CHUNK_SIZE_BYTES;
  let transfer: ExternalContentTransfer | null = null;
  let primaryError: unknown;
  try {
    transfer = await port.beginContentTransfer(options.transferInput);
    const hasher = publication.createHasher();
    const parser = new StreamingCsvParser();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let cursor: string | undefined;
    let receivedBytes = 0;
    let writer: ExternalCsvWriter | null = null;
    let tableId: string | null = null;

    for (;;) {
      const page = await port.contentPage({ transferId: transfer.transferId, cursor });
      if (page.rawByteCount > maxChunkSizeBytes) {
        throw new Error('CSV content page exceeded the maximum decoded byte size');
      }

      const bytes = decodeBase64Bytes(page.contentChunkBase64);
      if (bytes.byteLength !== page.rawByteCount) {
        throw new Error('CSV content page byte count does not match decoded content');
      }
      hasher.update(bytes);
      receivedBytes += bytes.byteLength;

      const records = parser.push(decoder.decode(bytes, { stream: page.hasNext }));
      if (writer === null && parser.headers.length > 0) {
        writer = publication.createWriter();
        tableId = await writer.begin({
          filename: options.filename,
          columns: parser.headers,
          contentHash: transfer.contentDigest,
        });
      }
      if (writer !== null && records.length > 0) {
        await writer.writeRows(records);
      }

      if (!page.hasNext) break;
      if (page.nextCursor === null) {
        throw new Error('CSV content page cursor is required before the final page');
      }
      cursor = page.nextCursor;
    }

    const finalText = decoder.decode();
    const finalRecords = parser.finish(finalText);
    if (writer === null && parser.headers.length > 0) {
      writer = publication.createWriter();
      tableId = await writer.begin({
        filename: options.filename,
        columns: parser.headers,
        contentHash: transfer.contentDigest,
      });
    }
    if (writer === null || tableId === null) {
      throw new Error('CSV content must include a header row');
    }
    if (finalRecords.length > 0) {
      await writer.writeRows(finalRecords);
    }

    const actualDigest = await hasher.digestHex();
    if (receivedBytes !== transfer.byteCount || actualDigest !== transfer.contentDigest) {
      throw new Error('CSV content transfer metadata does not match received content');
    }

    const commit = await writer.commit();
    return {
      digest: transfer.contentDigest,
      byteCount: transfer.byteCount,
      updatedAt: transfer.updatedAt,
      tableId: commit.tableId,
      rowCount: commit.totalRows,
      columnNames: parser.headers,
    };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (transfer !== null) {
      try {
        await port.closeContentTransfer(transfer.transferId);
      } catch {
        if (primaryError === undefined) {
          console.warn(
            `[${options.warningPrefix ?? 'external-content-transfer'}] failed to close CSV content transfer`
          );
        }
      }
    }
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
      throw new Error('CSV content has an unterminated quoted field');
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
        throw new Error('CSV content has characters after a closing quote');
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
          throw new Error('CSV content has an unexpected quote');
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
          throw new Error('CSV content row width does not match the header');
        }
        row[header] = value;
      }
      return row;
    });
  }

  private validateHeaders(headers: readonly string[]): void {
    if (headers.length === 0) {
      throw new Error('CSV content must include at least one column');
    }
    const seen = new Set<string>();
    for (const header of headers) {
      if (header.length === 0 || seen.has(header)) {
        throw new Error('CSV content has invalid headers');
      }
      seen.add(header);
    }
  }

  private validateRowWidth(row: readonly string[]): void {
    if (row.length !== this.headers.length) {
      throw new Error('CSV content row width does not match the header');
    }
  }
}

function decodeBase64Bytes(value: string): Uint8Array {
  if (typeof globalThis.atob !== 'function') {
    throw new Error('CSV content page could not be decoded');
  }
  try {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new Error('CSV content page could not be decoded');
  }
}
