import type { NodeType } from '@hierarchidb/core-types';
import type { ProjectYamlWriteStatus } from '@hierarchidb/ide-gsm-client';
import {
  assertIdeGsmProjectChildMetadata,
  assertIdeGsmProjectRootNodeData,
  type IdeGsmProjectChildMetadata,
} from '@hierarchidb/idegsm-project-api';
import type { TreeNode } from '@hierarchidb/tree-api';
import type {
  ConnectedIdeGsmProjectYamlWriteErrorCode,
  ConnectedIdeGsmProjectYamlWriteInput,
  ConnectedIdeGsmProjectYamlWriteResult,
  IdeGsmProjectYamlClient,
  IdeGsmProjectYamlWriteCoreDbPort,
  IdeGsmProjectYamlWriteRuntimePort,
} from './conditionalIdeGsmProjectYamlWriteTypes.js';

const YAML_NODE_TYPE = 'yaml-file' as NodeType;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/u;

export async function writeConnectedIdeGsmProjectYaml(
  coreDb: IdeGsmProjectYamlWriteCoreDbPort,
  runtime: IdeGsmProjectYamlWriteRuntimePort,
  input: ConnectedIdeGsmProjectYamlWriteInput
): Promise<ConnectedIdeGsmProjectYamlWriteResult> {
  const guard = await readWriteGuard(coreDb, input);
  if (!guard.ok) return guard;

  const client = await runtime.resolveClient(guard.connectionName);
  if (client === null) {
    return failure('DISCONNECTED');
  }

  let writeResult: Awaited<ReturnType<IdeGsmProjectYamlClient['conditionalProjectYamlWrite']>>;
  try {
    writeResult = await client.conditionalProjectYamlWrite({
      projectRelativePath: guard.projectRelativePath,
      relativePath: guard.metadata.relativePath,
      expectedDigest: input.expectedDigest,
      content: input.draftData.content,
    });
  } catch {
    return failure('WRITE_FAILED');
  }

  if (writeResult.status !== 'UPDATED') {
    return failure(writeStatusToErrorCode(writeResult.status), {
      currentDigest: writeResult.contentDigest ?? undefined,
      updatedAt: writeResult.updatedAt ?? undefined,
    });
  }

  let reread: Awaited<ReturnType<IdeGsmProjectYamlClient['projectYamlFileContent']>>;
  try {
    reread = await client.projectYamlFileContent({
      projectRelativePath: guard.projectRelativePath,
      relativePath: guard.metadata.relativePath,
    });
  } catch {
    return failure('REREAD_FAILED');
  }

  if (
    reread.projectRelativePath !== guard.projectRelativePath ||
    reread.relativePath !== guard.metadata.relativePath ||
    reread.contentDigest !== writeResult.contentDigest ||
    reread.content !== input.draftData.content
  ) {
    return failure('REREAD_MISMATCH');
  }

  const reflected = await reflectRereadContent(coreDb, input, guard, reread);
  if (!reflected.ok) return reflected;
  return { ok: true, node: reflected.node };
}

type WriteGuardSuccess = Readonly<{
  readonly ok: true;
  readonly node: TreeNode;
  readonly metadata: IdeGsmProjectChildMetadata;
  readonly connectionName: string;
  readonly projectRelativePath: string;
}>;

type WriteFailure = Extract<ConnectedIdeGsmProjectYamlWriteResult, { readonly ok: false }>;

type WriteGuard = WriteGuardSuccess | WriteFailure;

async function readWriteGuard(
  coreDb: IdeGsmProjectYamlWriteCoreDbPort,
  input: ConnectedIdeGsmProjectYamlWriteInput
): Promise<WriteGuard> {
  if (!SHA256_HEX_PATTERN.test(input.expectedDigest)) {
    return failure('EXPECTED_DIGEST_REQUIRED');
  }

  const node = await coreDb.getNode(input.nodeId);
  if (node === undefined) {
    return failure('NODE_MISSING');
  }
  if (node.version !== input.expectedNodeVersion) {
    return failure('NODE_STALE');
  }
  if (node.nodeType !== YAML_NODE_TYPE) {
    return failure('NODE_NOT_SYNCED');
  }

  const metadata = readYamlIdeGsmMetadata(node);
  if (metadata === null || metadata.digest === null || metadata.digest !== input.expectedDigest) {
    return failure('NODE_STALE');
  }

  const root = await coreDb.getNode(metadata.projectNodeId);
  if (root === undefined) {
    return failure('NODE_NOT_SYNCED');
  }
  assertIdeGsmProjectRootNodeData(root.data);
  if (
    root.data.syncState !== 'synced' ||
    root.data.activeSyncGenerationId !== metadata.generationId
  ) {
    return failure('NODE_NOT_SYNCED');
  }

  return {
    ok: true,
    node,
    metadata,
    connectionName: root.data.connectionName,
    projectRelativePath: root.data.projectRelativePath,
  };
}

async function reflectRereadContent(
  coreDb: IdeGsmProjectYamlWriteCoreDbPort,
  input: ConnectedIdeGsmProjectYamlWriteInput,
  guard: WriteGuardSuccess,
  reread: Awaited<ReturnType<IdeGsmProjectYamlClient['projectYamlFileContent']>>
): Promise<ConnectedIdeGsmProjectYamlWriteResult> {
  return coreDb.runInTx('rw', ['nodes'], async () => {
    const current = await coreDb.getNode(input.nodeId);
    if (current === undefined) return failure('NODE_MISSING');
    if (current.version !== input.expectedNodeVersion) return failure('NODE_STALE');

    const currentMetadata = readYamlIdeGsmMetadata(current);
    if (currentMetadata === null || currentMetadata.digest !== input.expectedDigest) {
      return failure('NODE_STALE');
    }

    const updatedAt = Date.parse(reread.updatedAt);
    if (!Number.isFinite(updatedAt)) {
      return failure('REREAD_MISMATCH');
    }

    const nextMetadata: IdeGsmProjectChildMetadata = {
      ...guard.metadata,
      digest: reread.contentDigest,
      sizeBytes: reread.byteCount,
      updatedAt: reread.updatedAt,
    };
    assertIdeGsmProjectChildMetadata(nextMetadata);

    const nextNode: TreeNode = {
      ...current,
      version: current.version + 1,
      updatedAt,
      data: {
        ...input.draftData,
        ideGsm: nextMetadata,
      },
      draftData: undefined,
    };
    await coreDb.putNode(nextNode);
    return { ok: true, node: nextNode };
  });
}

function readYamlIdeGsmMetadata(node: TreeNode): IdeGsmProjectChildMetadata | null {
  if (node.data === null || typeof node.data !== 'object' || Array.isArray(node.data)) {
    return null;
  }
  const data = node.data as Record<string, unknown>;
  const metadata = data.ideGsm;
  try {
    assertIdeGsmProjectChildMetadata(metadata);
  } catch {
    return null;
  }
  if ((metadata as IdeGsmProjectChildMetadata).kind !== 'yaml-file') {
    return null;
  }
  return metadata as IdeGsmProjectChildMetadata;
}

function writeStatusToErrorCode(
  status: ProjectYamlWriteStatus
): ConnectedIdeGsmProjectYamlWriteErrorCode {
  switch (status) {
    case 'CONTENT_CONFLICT':
      return 'CONTENT_CONFLICT';
    case 'FILE_LOCK_UNAVAILABLE':
      return 'FILE_LOCK_UNAVAILABLE';
    case 'ATOMIC_REPLACE_UNAVAILABLE':
      return 'ATOMIC_REPLACE_UNAVAILABLE';
    case 'AUTHORIZATION_FAILED':
      return 'AUTHORIZATION_FAILED';
    case 'UPDATED':
      return 'WRITE_FAILED';
  }
}

function failure(
  code: ConnectedIdeGsmProjectYamlWriteErrorCode,
  details?: Readonly<{ readonly currentDigest?: string; readonly updatedAt?: string }>
): WriteFailure {
  return {
    ok: false,
    error: {
      code,
      ...details,
    },
  };
}
