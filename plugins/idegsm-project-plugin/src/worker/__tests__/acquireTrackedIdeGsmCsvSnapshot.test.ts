import { createHash } from 'node:crypto';
import type {
  ProjectFileContentPage,
  ProjectFileContentPageInput,
  ProjectFileContentTransfer,
  ProjectFileContentTransferInput,
} from '@hierarchidb/ide-gsm-client';
import { describe, expect, it, vi } from 'vitest';
import {
  acquireTrackedIdeGsmCsvSnapshot,
  type IdeGsmCsvContentTransferPort,
  type IdeGsmTrackedCsvHasher,
  type IdeGsmTrackedCsvPublicationPort,
  type IdeGsmTrackedCsvWriter,
} from '../acquireTrackedIdeGsmCsvSnapshot.js';

const transferId = 'transfer-1';
const projectRelativePath = 'projects/sample';
const relativePath = 'outputs/table.csv';
const updatedAt = '2026-08-30T00:00:00Z';

class Sha256Hasher implements IdeGsmTrackedCsvHasher {
  private readonly hash = createHash('sha256');

  update(bytes: Uint8Array): void {
    this.hash.update(bytes);
  }

  async digestHex(): Promise<string> {
    return this.hash.digest('hex');
  }
}

class MemoryWriter implements IdeGsmTrackedCsvWriter {
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

function makeClient(
  content: string,
  chunkLengths: readonly number[]
): IdeGsmCsvContentTransferPort {
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
    beginProjectFileContentTransfer: vi
      .fn()
      .mockImplementation(async (_input: ProjectFileContentTransferInput) =>
        transfer(digest, bytes.byteLength)
      ),
    projectFileContentPage: vi
      .fn()
      .mockImplementation(async (input: ProjectFileContentPageInput) => {
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
    closeProjectFileContentTransfer: vi.fn().mockResolvedValue(true),
  };
}

function transfer(digest: string, byteCount: number): ProjectFileContentTransfer {
  return {
    transferId,
    contentDigest: digest,
    updatedAt,
    byteCount,
    chunkSizeBytes: 16_384,
    expiresAt: '2026-08-30T00:05:00Z',
  };
}

function makePublication(writer = new MemoryWriter()): IdeGsmTrackedCsvPublicationPort & {
  readonly writer: MemoryWriter;
  readonly commitTrackedCsvSnapshot: ReturnType<typeof vi.fn>;
} {
  const commitTrackedCsvSnapshot = vi.fn().mockResolvedValue({
    snapshotId: 'snapshot-1',
    contentGenerationId: 'content-gen-1',
  });
  return {
    writer,
    createHasher: () => new Sha256Hasher(),
    createWriter: () => writer,
    commitTrackedCsvSnapshot,
  };
}

function acquire(
  client: IdeGsmCsvContentTransferPort,
  publication: IdeGsmTrackedCsvPublicationPort
) {
  return acquireTrackedIdeGsmCsvSnapshot(client, publication, {
    projectNodeId: 'project-node',
    projectRelativePath,
    relativePath,
  });
}

describe('acquireTrackedIdeGsmCsvSnapshot', () => {
  it('streams UTF-8 and CSV record boundaries into a committed tracked snapshot', async () => {
    const content = 'name,label\n1,"alpha,β"\n2,"line ""quoted"""\n';
    const client = makeClient(content, [13, 2, 8]);
    const publication = makePublication();

    await expect(acquire(client, publication)).resolves.toEqual({
      snapshotId: 'snapshot-1',
      contentGenerationId: 'content-gen-1',
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
    expect(publication.commitTrackedCsvSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        relativePath,
        digest: createHash('sha256').update(new TextEncoder().encode(content)).digest('hex'),
        tableId: 'table-1',
        rowCount: 2,
        columnNames: ['name', 'label'],
      })
    );
    expect(client.closeProjectFileContentTransfer).toHaveBeenCalledWith(transferId);
  });

  it('closes the transfer and skips publication when received bytes do not match metadata', async () => {
    const client = makeClient('a\nb\n', []);
    const begin = client.beginProjectFileContentTransfer as ReturnType<typeof vi.fn>;
    begin.mockResolvedValueOnce(transfer('0'.repeat(64), 999));
    const publication = makePublication();

    await expect(acquire(client, publication)).rejects.toThrow('metadata');

    expect(publication.commitTrackedCsvSnapshot).not.toHaveBeenCalled();
    expect(client.closeProjectFileContentTransfer).toHaveBeenCalledWith(transferId);
  });

  it('closes the transfer when CSV parsing fails before publication', async () => {
    const client = makeClient('a,b\n1\n', []);
    const publication = makePublication();

    await expect(acquire(client, publication)).rejects.toThrow('row width');

    expect(publication.commitTrackedCsvSnapshot).not.toHaveBeenCalled();
    expect(client.closeProjectFileContentTransfer).toHaveBeenCalledWith(transferId);
  });

  it('rejects a page larger than the decoded limit', async () => {
    const client = makeClient('a\n', []);
    const page = client.projectFileContentPage as ReturnType<typeof vi.fn>;
    page.mockResolvedValueOnce({
      contentChunkBase64: Buffer.from('a').toString('base64'),
      rawByteCount: 16_385,
      nextCursor: null,
      hasNext: false,
    } satisfies ProjectFileContentPage);
    const publication = makePublication();

    await expect(acquire(client, publication)).rejects.toThrow('maximum decoded byte size');

    expect(publication.commitTrackedCsvSnapshot).not.toHaveBeenCalled();
    expect(client.closeProjectFileContentTransfer).toHaveBeenCalledWith(transferId);
  });

  it('rejects invalid CSV paths before opening a transfer', async () => {
    const client = makeClient('a\n', []);
    const publication = makePublication();

    await expect(
      acquireTrackedIdeGsmCsvSnapshot(client, publication, {
        projectNodeId: 'project-node',
        projectRelativePath,
        relativePath: '../table.csv',
      })
    ).rejects.toThrow('relativePath');

    expect(client.beginProjectFileContentTransfer).not.toHaveBeenCalled();
    expect(client.closeProjectFileContentTransfer).not.toHaveBeenCalled();
  });
});
