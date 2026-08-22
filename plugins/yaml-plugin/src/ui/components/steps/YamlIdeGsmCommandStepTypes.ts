import type { NodeId } from '@hierarchidb/core-types';
import type { YamlCanonicalFilename, YamlCommandId } from '@hierarchidb/yaml-api';

export type YamlIdeGsmTaskStatus =
  | 'REGISTERED'
  | 'READY'
  | 'LEASED'
  | 'FINISHED'
  | 'FAILED'
  | 'CANCELED'
  | 'DELETED';

export interface YamlIdeGsmTaskResult {
  readonly id: string;
  readonly status: YamlIdeGsmTaskStatus;
}

export type YamlIdeGsmExecutionStatus =
  | Readonly<{ readonly phase: 'sync'; readonly task: YamlIdeGsmTaskResult }>
  | Readonly<{ readonly phase: 'command'; readonly task: YamlIdeGsmTaskResult }>;

export type YamlIdeGsmExecutionResult =
  | Readonly<{ readonly ok: true; readonly importTaskId?: string; readonly commandTaskId: string }>
  | Readonly<{ readonly ok: false; readonly code: string }>;

export interface YamlIdeGsmExecutorLike {
  execute(
    input: Readonly<{
      readonly parentId: NodeId;
      readonly filename: YamlCanonicalFilename;
      readonly payload: unknown;
      readonly commandId: YamlCommandId;
      readonly runtimeInput: Readonly<Record<string, unknown>>;
    }>,
    onStatus?: (status: YamlIdeGsmExecutionStatus) => void
  ): Promise<YamlIdeGsmExecutionResult>;
}

export interface YamlIdeGsmStep4Runtime {
  readonly enabled: boolean;
  readonly executor?: YamlIdeGsmExecutorLike;
  readonly defaultProjectRelativePath?: string;
}

export type YamlIdeGsmStep4Global = typeof globalThis & {
  __HDB_YAML_IDE_GSM_STEP4__?: YamlIdeGsmStep4Runtime;
};
