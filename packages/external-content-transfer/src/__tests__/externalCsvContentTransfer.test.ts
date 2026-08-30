import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  acquireExternalCsvContentTransfer,
  type ExternalContentPage,
  type ExternalContentPageInput,
  type ExternalContentTransfer,
  type ExternalCsvContentTransferPort,
  type ExternalCsvHasher,
  type ExternalCsvSnapshotPublicationPort,
  type ExternalCsvWriter,
} from '../externalCsvContentTransfer.js';

const transferId = 'transfer-1';
const updatedAt = '2026-08-30T00:00:00Z';

interface TransferInput {
  readonly path: string;
}

class Sha256Hasher implements ExternalCsvHasher {
  private readonly hash = createHash('sha256');

  update(bytes: Uint8Array): void {
    this.hash.update(bytes);
  }

  async digestHex(): Promise<string> {
    return this.hash.digest('hex');
  }
}

class MemoryWriter implements ExternalCsvWriter {
  readonly rows: Record<string, string>[] = [];
  columns: readonly string[] = [];

  async begin(schema: {
    readonly columns: readonly string[];
    readonly filename?: string;
    readonly contentHash?: string;
  }): Promise<string> {
    this.columns = schema.columns;
    return 'table-1';
  }

  async writeRows(rows: ReadonlyArray<Record<string, string>>): Promise<void> {
    this.rows.push(...rows);
  }

  async commit(): Promise<{
    readonly tableId: string;
    readonly totalRows: number;
    readonly chunkCount: number;
  }> {
    return { tableId: 'table-1', totalRows: this.rows.length, chunkCount: 1 };
  }
}

function makePort(
  content: string,
  chunkLengths: readonly number[]
): ExternalCsvContentTransferPort<TransferInput> {
  const bytes = new TextEncoder().encode(content);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const chunks: Uint8Array[] = [];
  let offset = 0;
  for (const length of chunkLengths) {
    chunks.push(bytes.slice(offset, offset + length));
    offset += length;
  }
  if (offset < bytes.byteLength) {
    chunks.push(bytes.slice(offset));
  }
  return {
    beginContentTransfer: vi
      .fn()
      .mockImplementation(async (_input: TransferInput) => transfer(digest, bytes.byteLength)),
    contentPage: vi.fn().mockImplementation(async (input: ExternalContentPageInput) => {
      const index = input.cursor === undefined ? 0 : Number(input.cursor);
      const chunk = chunks[index];
      if (chunk === undefined) {
        throw new Error('unexpected page cursor');
      }
      const nextIndex = index + 1;
      return {
        contentChunkBase64: Buffer.from(chunk).toString('base64'),
        rawByteCount: chunk.byteLength,
        nextCursor: nextIndex < chunks.length ? String(nextIndex) : null,
        hasNext: nextIndex < chunks.length,
      };
    }),
    closeContentTransfer: vi.fn().mockResolvedValue(true),
  };
}

function transfer(digest: string, byteCount: number): ExternalContentTransfer {
  return {
    transferId,
    contentDigest: digest,
    updatedAt,
    byteCount,
  };
}

function makePublication(writer = new MemoryWriter()): ExternalCsvSnapshotPublicationPort & {
  readonly writer: MemoryWriter;
} {
  return {
    writer,
    createHasher: () => new Sha256Hasher(),
    createWriter: () => writer,
  };
}

function acquire(
  port: ExternalCsvContentTransferPort<TransferInput>,
  publication: ExternalCsvSnapshotPublicationPort
) {
  return acquireExternalCsvContentTransfer(port, publication, {
    transferInput: { path: 'outputs/table.csv' },
    filename: 'outputs/table.csv',
    warningPrefix: 'external-content-transfer-test',
  });
}

describe('acquireExternalCsvContentTransfer', () => {
  it('streams UTF-8 and CSV record boundaries into a committed table', async () => {
    const content = 'name,label\n1,"alpha,β"\n2,"line ""quoted"""\n';
    const port = makePort(content, [13, 2, 8]);
    const publication = makePublication();

    await expect(acquire(port, publication)).resolves.toEqual({
      digest: createHash('sha256').update(new TextEncoder().encode(content)).digest('hex'),
      byteCount: new TextEncoder().encode(content).byteLength,
      updatedAt,
      tableId: 'table-1',
      rowCount: 2,
      columnNames: ['name', 'label'],
    });

    expect(publication.writer.rows).toEqual([
      { name: '1', label: 'alpha,β' },
      { name: '2', label: 'line "quoted"' },
    ]);
    expect(port.closeContentTransfer).toHaveBeenCalledWith(transferId);
  });

  it('keeps a committed table successful when transfer close cleanup fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const port = makePort('name\nalpha\n', []);
    const close = port.closeContentTransfer as ReturnType<typeof vi.fn>;
    close.mockRejectedValueOnce(new Error('close failed'));
    const publication = makePublication();

    await expect(acquire(port, publication)).resolves.toMatchObject({
      tableId: 'table-1',
      rowCount: 1,
    });

    expect(close).toHaveBeenCalledWith(transferId);
    expect(warn).toHaveBeenCalledWith(
      '[external-content-transfer-test] failed to close CSV content transfer'
    );
    warn.mockRestore();
  });

  it('preserves the primary acquisition failure when transfer close also fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const port = makePort('a\nb\n', []);
    const begin = port.beginContentTransfer as ReturnType<typeof vi.fn>;
    begin.mockResolvedValueOnce(transfer('0'.repeat(64), 999));
    const close = port.closeContentTransfer as ReturnType<typeof vi.fn>;
    close.mockRejectedValueOnce(new Error('close failed'));
    const publication = makePublication();

    await expect(acquire(port, publication)).rejects.toThrow('metadata');

    expect(close).toHaveBeenCalledWith(transferId);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('rejects a page larger than the decoded limit', async () => {
    const port = makePort('a\n', []);
    const page = port.contentPage as ReturnType<typeof vi.fn>;
    page.mockResolvedValueOnce({
      contentChunkBase64: Buffer.from('a').toString('base64'),
      rawByteCount: 16_385,
      nextCursor: null,
      hasNext: false,
    } satisfies ExternalContentPage);
    const publication = makePublication();

    await expect(acquire(port, publication)).rejects.toThrow('maximum decoded byte size');

    expect(port.closeContentTransfer).toHaveBeenCalledWith(transferId);
  });

  it('rejects malformed CSV before committing the table', async () => {
    const port = makePort('a,b\n1\n', []);
    const publication = makePublication();

    await expect(acquire(port, publication)).rejects.toThrow('row width');

    expect(port.closeContentTransfer).toHaveBeenCalledWith(transferId);
  });
});
