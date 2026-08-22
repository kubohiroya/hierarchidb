import type { IdeGsmCommand } from '@hierarchidb/ide-gsm-client';
import {
  YAML_COMMAND_CAPABILITIES,
  type YamlCommandId,
  type YamlSubtype,
} from '@hierarchidb/yaml-api';
import { validateYamlCanonicalPayload } from '@hierarchidb/yaml-api/validation';
import { isMap, parseDocument } from 'yaml';
import type { YamlIdeGsmCredentials } from './yamlIdeGsmCredentialProvider.js';
import type {
  ExecuteYamlIdeGsmCommandInput,
  ParsedYamlIdeGsmCommand,
  YamlIdeGsmExecutionErrorCode,
  YamlIdeGsmExecutionResult,
  YamlIdeGsmExecutionStatus,
  YamlIdeGsmExecutor,
  YamlIdeGsmExecutorDependencies,
  YamlIdeGsmRuntimeInput,
} from './yamlIdeGsmExecutorTypes.js';

type RecordValue = Readonly<Record<string, unknown>>;

const PROJECT_COMMAND_IDS = new Set<YamlCommandId>([
  'check',
  'check-merge',
  'purge-cache',
  'start-container-remote',
  'stop-container-remote',
  'start-container-ec2',
  'stop-container-ec2',
]);

const REMOTE_SIMULATE_COMMAND_IDS = new Set<YamlCommandId>(['sim-remote', 'sim-ssh', 'sim-ec2']);

const REMOTE_CALIBRATE_COMMAND_IDS = new Set<YamlCommandId>([
  'calib-remote',
  'calib-ssh',
  'calib-ec2',
]);

const GITHUB_TOKEN_VALIDATION_PLACEHOLDER = '__validated-at-runtime__';

class YamlIdeGsmInputError extends Error {
  readonly code: YamlIdeGsmExecutionErrorCode;

  constructor(code: YamlIdeGsmExecutionErrorCode) {
    super(code);
    this.code = code;
  }
}

function fail(code: Exclude<YamlIdeGsmExecutionResult, { ok: true }>['code']) {
  return Object.freeze({ ok: false, code } as const);
}

function throwInputError(code: YamlIdeGsmExecutionErrorCode): never {
  throw new YamlIdeGsmInputError(code);
}

function isPlainRecord(value: unknown): value is RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(record: RecordValue, allowedKeys: readonly string[]): void {
  const allowed = new Set(allowedKeys);
  for (const key of Reflect.ownKeys(record)) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      throw new Error('unexpected runtime input field');
    }
  }
}

function readRequiredString(record: RecordValue, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function readOptionalString(record: RecordValue, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function readOptionalBoolean(record: RecordValue, key: string): boolean | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean`);
  return value;
}

function readOptionalNumber(record: RecordValue, key: string): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`${key} must be finite`);
  return value;
}

function readProjectRelativePath(runtimeInput: YamlIdeGsmRuntimeInput): string {
  return readRequiredString(runtimeInput, 'projectRelativePath');
}

function assertRsyncConnectionType(value: string): asserts value is 'remote' | 'ssh' | 'ec2' {
  if (value !== 'remote' && value !== 'ssh' && value !== 'ec2') {
    throw new Error('connectionType must be remote, ssh, or ec2');
  }
}

function readStringArrayFromYamlRecord(
  record: Readonly<Record<string, unknown>>,
  key: 'include' | 'exclude'
): string[] | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    !value.every((entry): entry is string => typeof entry === 'string')
  ) {
    throw new Error(`${key} must be a string array`);
  }
  return [...value];
}

function parseYamlRecord(content: string): Readonly<Record<string, unknown>> {
  const document = parseDocument(content, { schema: 'core', uniqueKeys: true });
  if (document.errors.length > 0 || document.warnings.length > 0 || !isMap(document.contents)) {
    throw new Error('YAML content must be a mapping');
  }
  const value: unknown = document.toJS({ maxAliasCount: 100 });
  if (!isPlainRecord(value)) throw new Error('YAML content must be a plain mapping');
  return value;
}

function readGitUrl(content: string): string {
  const record = parseYamlRecord(content);
  const value = record.url;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('git url must be a non-empty string');
  }
  return value;
}

function readRsyncFilter(content: string): { include?: string[]; exclude?: string[] } {
  const record = parseYamlRecord(content);
  return Object.freeze({
    include: readStringArrayFromYamlRecord(record, 'include'),
    exclude: readStringArrayFromYamlRecord(record, 'exclude'),
  });
}

function commandAllowedForSubtype(subtype: YamlSubtype, commandId: YamlCommandId): boolean {
  const capabilities = YAML_COMMAND_CAPABILITIES[subtype] as readonly {
    readonly commandId: YamlCommandId;
  }[];
  return capabilities.some((capability) => capability.commandId === commandId);
}

function simulateOptions(input: RecordValue) {
  return Object.freeze({
    profile: readOptionalString(input, 'profile'),
    compute: readOptionalString(input, 'compute'),
    apsp: readOptionalString(input, 'apsp'),
    purgeCache: readOptionalBoolean(input, 'purgeCache'),
    reset: readOptionalBoolean(input, 'reset'),
  });
}

function remoteSimulateOptions(input: RecordValue) {
  return Object.freeze({
    compute: readOptionalString(input, 'compute'),
    apsp: readOptionalString(input, 'apsp'),
    purgeCache: readOptionalBoolean(input, 'purgeCache'),
    reset: readOptionalBoolean(input, 'reset'),
    downloadCache: readOptionalBoolean(input, 'downloadCache'),
  });
}

function buildCommand(
  commandId: YamlCommandId,
  projectRelativePath: string,
  runtimeInput: YamlIdeGsmRuntimeInput,
  content: string,
  githubToken: string | undefined
): IdeGsmCommand {
  if (!isPlainRecord(runtimeInput)) throw new Error('runtimeInput must be a plain object');
  switch (commandId) {
    case 'install':
      assertExactKeys(runtimeInput, ['projectRelativePath', 'force']);
      return {
        id: commandId,
        input: { projectRelativePath, force: readOptionalBoolean(runtimeInput, 'force') },
      };
    case 'check':
    case 'check-merge':
    case 'purge-cache':
    case 'start-container-remote':
    case 'stop-container-remote':
    case 'start-container-ec2':
    case 'stop-container-ec2':
      if (!PROJECT_COMMAND_IDS.has(commandId)) throw new Error('invalid project command');
      assertExactKeys(runtimeInput, ['projectRelativePath']);
      return { id: commandId, input: { projectRelativePath } };
    case 'preview-events':
      assertExactKeys(runtimeInput, ['projectRelativePath', 'profile', 'yearFilter']);
      return {
        id: commandId,
        input: {
          projectRelativePath,
          profile: readOptionalString(runtimeInput, 'profile'),
          yearFilter: readOptionalNumber(runtimeInput, 'yearFilter'),
        },
      };
    case 'calib':
      assertExactKeys(runtimeInput, [
        'projectRelativePath',
        'profile',
        'compute',
        'apsp',
        'purgeCache',
        'purgeCalib',
        'reset',
      ]);
      return {
        id: commandId,
        input: {
          projectRelativePath,
          ...simulateOptions(runtimeInput),
          purgeCalib: readOptionalBoolean(runtimeInput, 'purgeCalib'),
        },
      };
    case 'sim':
      assertExactKeys(runtimeInput, [
        'projectRelativePath',
        'profile',
        'compute',
        'apsp',
        'purgeCache',
        'reset',
      ]);
      return { id: commandId, input: { projectRelativePath, ...simulateOptions(runtimeInput) } };
    case 'calib-remote':
    case 'calib-ssh':
    case 'calib-ec2':
      if (!REMOTE_CALIBRATE_COMMAND_IDS.has(commandId))
        throw new Error('invalid remote calibrate command');
      assertExactKeys(runtimeInput, [
        'projectRelativePath',
        'compute',
        'apsp',
        'purgeCache',
        'purgeCalib',
        'reset',
        'downloadCache',
      ]);
      return {
        id: commandId,
        input: {
          projectRelativePath,
          ...remoteSimulateOptions(runtimeInput),
          purgeCalib: readOptionalBoolean(runtimeInput, 'purgeCalib'),
        },
      };
    case 'sim-remote':
    case 'sim-ssh':
    case 'sim-ec2':
      if (!REMOTE_SIMULATE_COMMAND_IDS.has(commandId))
        throw new Error('invalid remote simulate command');
      assertExactKeys(runtimeInput, [
        'projectRelativePath',
        'compute',
        'apsp',
        'purgeCache',
        'reset',
        'downloadCache',
      ]);
      return {
        id: commandId,
        input: { projectRelativePath, ...remoteSimulateOptions(runtimeInput) },
      };
    case 'rsync-push':
    case 'rsync-pull': {
      assertExactKeys(runtimeInput, ['projectRelativePath', 'connectionType']);
      const connectionType = readRequiredString(runtimeInput, 'connectionType');
      assertRsyncConnectionType(connectionType);
      const filter = readRsyncFilter(content);
      return { id: commandId, input: { projectRelativePath, connectionType, ...filter } };
    }
    case 'init': {
      assertExactKeys(runtimeInput, ['projectRelativePath']);
      if (githubToken === undefined) throw new Error('githubToken is required');
      return {
        id: commandId,
        input: { projectRelativePath, githubToken, url: readGitUrl(content) },
      };
    }
  }
}

async function getCredentialsForCommand(
  dependencies: YamlIdeGsmExecutorDependencies,
  commandId: YamlCommandId
): Promise<Readonly<{ credentials: YamlIdeGsmCredentials; githubToken?: string }>> {
  const credentials = await dependencies.credentialProvider.getIdeGsmCredentials();
  if (commandId !== 'init') return Object.freeze({ credentials });
  return Object.freeze({
    credentials,
    githubToken: await dependencies.credentialProvider.getGitHubToken(),
  });
}

function parseCommandInput(
  input: ExecuteYamlIdeGsmCommandInput,
  githubToken?: string
): ParsedYamlIdeGsmCommand {
  if (!isPlainRecord(input.runtimeInput)) throw new Error('runtimeInput must be a plain object');
  const validation = validateYamlCanonicalPayload(input.filename, input.payload);
  if (!validation.ok) throwInputError('CANONICAL_VALIDATION_FAILED');
  if (!commandAllowedForSubtype(validation.value.subtype, input.commandId)) {
    throwInputError('UNAUTHORIZED_COMMAND');
  }
  const projectRelativePath = readProjectRelativePath(input.runtimeInput);
  return Object.freeze({
    projectRelativePath,
    command: buildCommand(
      input.commandId,
      projectRelativePath,
      input.runtimeInput,
      validation.value.content,
      githubToken
    ),
    validatedPayload: validation.value,
  });
}

function duplicateKey(input: ExecuteYamlIdeGsmCommandInput): string {
  return `${input.parentId}\u0000${input.commandId}`;
}

export function createYamlIdeGsmExecutor(
  dependencies: YamlIdeGsmExecutorDependencies
): YamlIdeGsmExecutor {
  const runningKeys = new Set<string>();
  return Object.freeze({
    async execute(
      input: ExecuteYamlIdeGsmCommandInput,
      onStatus?: (status: YamlIdeGsmExecutionStatus) => void
    ): Promise<YamlIdeGsmExecutionResult> {
      if (!dependencies.config.yamlIdeGsmStep4Enabled) return fail('FEATURE_DISABLED');
      const key = duplicateKey(input);
      if (runningKeys.has(key)) return fail('DUPLICATE_COMMAND');
      runningKeys.add(key);
      try {
        let parsed: ParsedYamlIdeGsmCommand;
        try {
          parsed = parseCommandInput(
            input,
            input.commandId === 'init' ? GITHUB_TOKEN_VALIDATION_PLACEHOLDER : undefined
          );
        } catch (error) {
          if (error instanceof YamlIdeGsmInputError) return fail(error.code);
          return fail('INVALID_INPUT');
        }
        const credentialResult = await getCredentialsForCommand(
          dependencies,
          input.commandId
        ).catch(() => null);
        if (credentialResult === null) return fail('CREDENTIALS_UNAVAILABLE');
        const client = dependencies.createClient(credentialResult.credentials);
        const command =
          input.commandId === 'init'
            ? buildCommand(
                input.commandId,
                parsed.projectRelativePath,
                input.runtimeInput,
                parsed.validatedPayload.content,
                credentialResult.githubToken
              )
            : parsed.command;
        if (input.commandId === 'init') {
          const taskId = await client.executeCommand(command).catch(() => null);
          if (taskId === null) return fail('COMMAND_FAILED');
          const commandResult = await client
            .awaitTask(taskId, (task) => onStatus?.(Object.freeze({ phase: 'command', task })))
            .catch(() => null);
          if (commandResult === null) return fail('COMMAND_FAILED');
          return Object.freeze({ ok: true, commandTaskId: taskId });
        }

        const zipApi = await dependencies.getYamlCanonicalZipAPI().catch(() => null);
        if (zipApi === null) return fail('YAML_SYNC_FAILED');
        const exportResult = await zipApi
          .exportYamlCanonicalZip({ parentId: input.parentId, slot: 'draft' })
          .catch(() => null);
        if (exportResult === null || !exportResult.ok) return fail('YAML_SYNC_FAILED');
        const importTaskId = await client
          .importProject(exportResult.archiveBase64, parsed.projectRelativePath)
          .catch(() => null);
        if (importTaskId === null) return fail('YAML_SYNC_FAILED');
        const syncResult = await client
          .awaitTask(importTaskId, (task) => onStatus?.(Object.freeze({ phase: 'sync', task })))
          .catch(() => null);
        if (syncResult === null) return fail('YAML_SYNC_FAILED');

        const commandTaskId = await client.executeCommand(command).catch(() => null);
        if (commandTaskId === null) return fail('COMMAND_FAILED');
        const commandResult = await client
          .awaitTask(commandTaskId, (task) => onStatus?.(Object.freeze({ phase: 'command', task })))
          .catch(() => null);
        if (commandResult === null) return fail('COMMAND_FAILED');
        return Object.freeze({ ok: true, importTaskId, commandTaskId });
      } finally {
        runningKeys.delete(key);
      }
    },
  });
}
