import type { NodeId } from '@hierarchidb/core-types';
import type { IdeGsmCommand, TaskResult } from '@hierarchidb/ide-gsm-client';
import type { YamlCanonicalZipAPI } from '@hierarchidb/worker-api';
import type { YamlCanonicalFilename, YamlCommandId } from '@hierarchidb/yaml-api';
import type { ValidatedYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';
import type { YamlIdeGsmAppConfig } from './yamlIdeGsmConfig.js';
import type {
  YamlIdeGsmCredentialProvider,
  YamlIdeGsmCredentials,
} from './yamlIdeGsmCredentialProvider.js';

export type YamlIdeGsmExecutionErrorCode =
  | 'FEATURE_DISABLED'
  | 'INVALID_INPUT'
  | 'CANONICAL_VALIDATION_FAILED'
  | 'UNAUTHORIZED_COMMAND'
  | 'DUPLICATE_COMMAND'
  | 'CREDENTIALS_UNAVAILABLE'
  | 'YAML_SYNC_FAILED'
  | 'COMMAND_FAILED';

export type YamlIdeGsmRuntimeInput = Readonly<Record<string, unknown>>;

export interface ExecuteYamlIdeGsmCommandInput {
  readonly parentId: NodeId;
  readonly filename: YamlCanonicalFilename;
  readonly payload: unknown;
  readonly commandId: YamlCommandId;
  readonly runtimeInput: YamlIdeGsmRuntimeInput;
}

export interface YamlIdeGsmClientPort {
  importProject(projectSnapshot: string, projectRelativePath: string): Promise<string>;
  executeCommand(command: IdeGsmCommand): Promise<string>;
  awaitTask(taskId: string, onStatus?: (result: TaskResult) => void): Promise<TaskResult>;
}

export interface YamlIdeGsmExecutorDependencies {
  readonly config: YamlIdeGsmAppConfig;
  readonly credentialProvider: YamlIdeGsmCredentialProvider;
  readonly createClient: (credentials: YamlIdeGsmCredentials) => YamlIdeGsmClientPort;
  readonly getYamlCanonicalZipAPI: () => Promise<YamlCanonicalZipAPI>;
}

export type YamlIdeGsmExecutionStatus =
  | Readonly<{ readonly phase: 'sync'; readonly task: TaskResult }>
  | Readonly<{ readonly phase: 'command'; readonly task: TaskResult }>;

export type YamlIdeGsmExecutionResult =
  | Readonly<{
      readonly ok: true;
      readonly importTaskId?: string;
      readonly commandTaskId: string;
    }>
  | Readonly<{
      readonly ok: false;
      readonly code: YamlIdeGsmExecutionErrorCode;
    }>;

export interface YamlIdeGsmExecutor {
  execute(
    input: ExecuteYamlIdeGsmCommandInput,
    onStatus?: (status: YamlIdeGsmExecutionStatus) => void
  ): Promise<YamlIdeGsmExecutionResult>;
}

export interface ParsedYamlIdeGsmCommand {
  readonly projectRelativePath: string;
  readonly command: IdeGsmCommand;
  readonly validatedPayload: ValidatedYamlCanonicalPayload;
}
