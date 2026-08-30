import {
  acquireExternalCsvContentTransfer,
  type ExternalContentPage,
  type ExternalContentPageInput,
  type ExternalContentTransfer,
  type ExternalCsvContentTransferPort,
  type ExternalCsvHasher,
  type ExternalCsvSnapshotPublicationPort,
  type ExternalCsvWriter,
} from '@hierarchidb/external-content-transfer';
import type {
  ProjectFileContentPage,
  ProjectFileContentPageInput,
  ProjectFileContentTransfer,
  ProjectFileContentTransferInput,
} from '@hierarchidb/ide-gsm-client';
import { assertProjectRelativePath } from '@hierarchidb/idegsm-project-api';

const CSV_PATH_PATTERN = /\.csv$/u;

export interface IdeGsmCsvContentTransferPort {
  beginProjectFileContentTransfer(
    input: ProjectFileContentTransferInput
  ): Promise<ProjectFileContentTransfer>;
  projectFileContentPage(input: ProjectFileContentPageInput): Promise<ProjectFileContentPage>;
  closeProjectFileContentTransfer(transferId: string): Promise<boolean>;
}

export type IdeGsmTrackedCsvHasher = ExternalCsvHasher;
export type IdeGsmTrackedCsvWriter = ExternalCsvWriter;

export interface IdeGsmTrackedCsvPublicationPort extends ExternalCsvSnapshotPublicationPort {
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
  const transferPort = createExternalTransferPort(client);
  const table = await acquireExternalCsvContentTransfer(transferPort, publication, {
    transferInput: input,
    filename: input.relativePath,
    warningPrefix: 'idegsm-project',
  });
  const snapshot = await publication.commitTrackedCsvSnapshot({
    projectNodeId: input.projectNodeId,
    projectRelativePath: input.projectRelativePath,
    relativePath: input.relativePath,
    digest: table.digest,
    byteCount: table.byteCount,
    updatedAt: table.updatedAt,
    tableId: table.tableId,
    rowCount: table.rowCount,
    columnNames: table.columnNames,
  });

  return {
    snapshotId: snapshot.snapshotId,
    contentGenerationId: snapshot.contentGenerationId,
    digest: table.digest,
    byteCount: table.byteCount,
    updatedAt: table.updatedAt,
    tableId: table.tableId,
    rowCount: table.rowCount,
    columnNames: table.columnNames,
  };
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

function createExternalTransferPort(
  client: IdeGsmCsvContentTransferPort
): ExternalCsvContentTransferPort<ProjectFileContentTransferInput> {
  return {
    beginContentTransfer: async (transferInput) =>
      toExternalTransfer(await client.beginProjectFileContentTransfer(transferInput)),
    contentPage: async (pageInput) =>
      toExternalPage(await client.projectFileContentPage(toProjectPageInput(pageInput))),
    closeContentTransfer: (transferId) => client.closeProjectFileContentTransfer(transferId),
  };
}

function toExternalTransfer(transfer: ProjectFileContentTransfer): ExternalContentTransfer {
  return {
    transferId: transfer.transferId,
    contentDigest: transfer.contentDigest,
    updatedAt: transfer.updatedAt,
    byteCount: transfer.byteCount,
  };
}

function toExternalPage(page: ProjectFileContentPage): ExternalContentPage {
  return {
    contentChunkBase64: page.contentChunkBase64,
    rawByteCount: page.rawByteCount,
    nextCursor: page.nextCursor,
    hasNext: page.hasNext,
  };
}

function toProjectPageInput(input: ExternalContentPageInput): ProjectFileContentPageInput {
  return input.cursor === undefined
    ? { transferId: input.transferId }
    : { transferId: input.transferId, cursor: input.cursor };
}
