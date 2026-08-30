import type { NodeId } from '@hierarchidb/core-types';
import type {
  ConditionalProjectYamlWriteInput,
  ConditionalProjectYamlWriteResult,
  ProjectYamlFileContent,
} from '@hierarchidb/ide-gsm-client';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { ValidatedYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';

export interface IdeGsmProjectYamlClient {
  readonly conditionalProjectYamlWrite: (
    input: ConditionalProjectYamlWriteInput
  ) => Promise<ConditionalProjectYamlWriteResult>;
  readonly projectYamlFileContent: (
    input: Pick<ConditionalProjectYamlWriteInput, 'projectRelativePath' | 'relativePath'>
  ) => Promise<ProjectYamlFileContent>;
}

export interface IdeGsmProjectYamlWriteCoreDbPort {
  readonly runInTx: <T>(
    mode: 'r' | 'rw',
    tables: readonly ['nodes'],
    fn: () => Promise<T>
  ) => Promise<T>;
  readonly getNode: (nodeId: NodeId) => Promise<TreeNode | undefined>;
  readonly putNode: (node: TreeNode) => Promise<void>;
}

export interface IdeGsmProjectYamlWriteRuntimePort {
  readonly resolveClient: (connectionName: string) => Promise<IdeGsmProjectYamlClient | null>;
}

export interface ConnectedIdeGsmProjectYamlWriteInput {
  readonly nodeId: NodeId;
  readonly expectedNodeVersion: number;
  readonly expectedDigest: string;
  readonly draftData: ValidatedYamlCanonicalPayload;
}

export type ConnectedIdeGsmProjectYamlWriteErrorCode =
  | 'NODE_MISSING'
  | 'NODE_STALE'
  | 'NODE_NOT_SYNCED'
  | 'EXPECTED_DIGEST_REQUIRED'
  | 'DISCONNECTED'
  | 'CONTENT_CONFLICT'
  | 'FILE_LOCK_UNAVAILABLE'
  | 'ATOMIC_REPLACE_UNAVAILABLE'
  | 'AUTHORIZATION_FAILED'
  | 'WRITE_FAILED'
  | 'REREAD_FAILED'
  | 'REREAD_MISMATCH';

export type ConnectedIdeGsmProjectYamlWriteResult =
  | Readonly<{ readonly ok: true; readonly node: TreeNode }>
  | Readonly<{
      readonly ok: false;
      readonly error: Readonly<{
        readonly code: ConnectedIdeGsmProjectYamlWriteErrorCode;
        readonly currentDigest?: string;
        readonly updatedAt?: string;
      }>;
    }>;
