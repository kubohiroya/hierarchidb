import type { NodeId } from '@hierarchidb/core-types';
import {
  assertIdeGsmMountDescriptor,
  assertLogicalPath,
  decodeIdeGsmMountedNodeId,
  type IdeGsmFdmDirectoryRemoveInput,
  type IdeGsmFdmDirectoryRemoveReport,
  type IdeGsmMountDescriptor,
} from '@hierarchidb/ide-gsm-client';
import type { TreeNode } from '@hierarchidb/tree-api';

export interface IdeGsmMountedFilesystemActionClient {
  fdmDirectoryRemove(input: IdeGsmFdmDirectoryRemoveInput): Promise<IdeGsmFdmDirectoryRemoveReport>;
}

export interface IdeGsmMountedFilesystemRemoveInput {
  descriptor: IdeGsmMountDescriptor;
  path: string;
  apply: boolean;
}

export class IdeGsmMountedFilesystemActionPort {
  constructor(private readonly client: IdeGsmMountedFilesystemActionClient) {}

  async remove(input: IdeGsmMountedFilesystemRemoveInput): Promise<IdeGsmFdmDirectoryRemoveReport> {
    assertIdeGsmMountDescriptor(input.descriptor);
    assertLogicalPath(input.path, 'path', false);
    if (typeof input.apply !== 'boolean') {
      throw new Error('apply must be a boolean');
    }
    if (input.descriptor.sourceKind !== 'fdm-space-root') {
      throw new Error('IDE-GSM project-root mounts do not support remove');
    }
    if (input.descriptor.capabilities.remove !== true) {
      throw new Error('IDE-GSM mount does not allow remove');
    }
    return this.client.fdmDirectoryRemove({
      spaceId: input.descriptor.spaceId,
      path: toRemotePath(input.descriptor.rootPath, input.path),
      apply: input.apply,
    });
  }
}

export function assertNodeIsNotIdeGsmMountedForTreeMutation(node: TreeNode | NodeId): void {
  if (typeof node === 'string') {
    if (decodeIdeGsmMountedNodeId(node) !== null) {
      throw new Error('IDE-GSM mounted nodes must not use TreeMutationAPI');
    }
    return;
  }
  if (node.data === null || node.data === undefined) {
    return;
  }
  const data = node.data as Record<string, unknown>;
  if (data.mountKind === 'ide-gsm') {
    throw new Error('IDE-GSM mounted nodes must not use TreeMutationAPI');
  }
}

function toRemotePath(rootPath: string, relativePath: string): string {
  assertLogicalPath(rootPath, 'rootPath', true);
  assertLogicalPath(relativePath, 'path', false);
  if (rootPath.length === 0) {
    return relativePath;
  }
  return `${rootPath}/${relativePath}`;
}
