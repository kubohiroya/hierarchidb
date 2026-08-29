import {
  assertProjectRelativePath,
  type IdeGsmCommand,
  type IdeGsmCommandId,
  type IdeGsmMountDescriptor,
  type IdeGsmMountedNodeReference,
} from '@hierarchidb/ide-gsm-client';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { YamlIdeGsmAppConfig } from '~/yaml-ide-gsm/YamlIdeGsmAppConfig.js';

export const MOUNTED_IDE_GSM_SIM_ACTION = 'ide-gsm:sim' as const;
export const MOUNTED_IDE_GSM_CALIB_ACTION = 'ide-gsm:calib' as const;
export const MOUNTED_IDE_GSM_CHECK_ACTION = 'ide-gsm:check' as const;
export const MOUNTED_IDE_GSM_COMMAND_ACTIONS = [
  MOUNTED_IDE_GSM_SIM_ACTION,
  MOUNTED_IDE_GSM_CALIB_ACTION,
  MOUNTED_IDE_GSM_CHECK_ACTION,
] as const;

export type MountedIdeGsmCommandActionId = (typeof MOUNTED_IDE_GSM_COMMAND_ACTIONS)[number];

type MountedIdeGsmCommandDefinition = Readonly<{
  readonly actionId: MountedIdeGsmCommandActionId;
  readonly commandId: Extract<IdeGsmCommandId, 'sim' | 'calib' | 'check'>;
  readonly label: string;
}>;

export const MOUNTED_IDE_GSM_COMMAND_DEFINITIONS = [
  {
    actionId: MOUNTED_IDE_GSM_SIM_ACTION,
    commandId: 'sim',
    label: 'Run local sim',
  },
  {
    actionId: MOUNTED_IDE_GSM_CALIB_ACTION,
    commandId: 'calib',
    label: 'Run local calib',
  },
  {
    actionId: MOUNTED_IDE_GSM_CHECK_ACTION,
    commandId: 'check',
    label: 'Run local check',
  },
] as const satisfies readonly MountedIdeGsmCommandDefinition[];

type RecordValue = Readonly<Record<string, unknown>>;

export type MountedIdeGsmCommandAction = Readonly<{
  readonly id: MountedIdeGsmCommandActionId;
  readonly label: string;
  readonly disabled?: boolean;
  readonly tooltip?: string;
}>;

export type MountedIdeGsmCommandErrorCode =
  | 'FEATURE_DISABLED'
  | 'UNSUPPORTED_TARGET'
  | 'INVALID_INPUT'
  | 'CREDENTIALS_UNAVAILABLE'
  | 'COMMAND_FAILED';

export type MountedIdeGsmCommandResult =
  | Readonly<{ readonly ok: true; readonly commandTaskId: string }>
  | Readonly<{ readonly ok: false; readonly code: MountedIdeGsmCommandErrorCode }>;

export interface MountedIdeGsmCommandClientPort {
  executeCommand(command: IdeGsmCommand): Promise<string>;
}

export interface MountedIdeGsmCommandExecutorDependencies {
  readonly config: Pick<YamlIdeGsmAppConfig, 'mountedIdeGsmCommandUiEnabled'>;
  readonly credentialProvider: {
    getIdeGsmCredentials(): Promise<{
      readonly endpointUrl: string;
      readonly authToken: string;
    }>;
  };
  readonly createClient: (credentials: {
    readonly endpointUrl: string;
    readonly authToken: string;
  }) => MountedIdeGsmCommandClientPort;
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readData(node: Pick<TreeNode, 'data'>): RecordValue | null {
  return isRecord(node.data) ? node.data : null;
}

function hasForbiddenPublicField(data: RecordValue): boolean {
  return [
    'endpoint',
    'endpointUrl',
    'graphqlUrl',
    'token',
    'jwt',
    'authToken',
    'absolutePath',
    'content',
  ].some((key) => Object.hasOwn(data, key));
}

export function isMountedIdeGsmCommandActionId(
  actionId: string
): actionId is MountedIdeGsmCommandActionId {
  return MOUNTED_IDE_GSM_COMMAND_ACTIONS.includes(actionId as MountedIdeGsmCommandActionId);
}

function getMountedIdeGsmCommandDefinition(
  actionId: MountedIdeGsmCommandActionId
): MountedIdeGsmCommandDefinition | null {
  return (
    MOUNTED_IDE_GSM_COMMAND_DEFINITIONS.find((definition) => definition.actionId === actionId) ??
    null
  );
}

export function resolveMountedIdeGsmProjectRelativePath(
  node: Pick<TreeNode, 'data'>
): string | null {
  const data = readData(node);
  if (!data || hasForbiddenPublicField(data)) return null;
  if (data.mountKind !== 'ide-gsm' || data.sourceKind !== 'project-root') return null;
  if (typeof data.projectId !== 'string' || data.projectId.trim().length === 0) return null;
  try {
    assertProjectRelativePath(data.projectId);
  } catch {
    return null;
  }
  return data.projectId;
}

export function isMountedIdeGsmProjectCommandTarget(
  node: Pick<TreeNode, 'data'>
): node is TreeNode & {
  data: IdeGsmMountDescriptor | IdeGsmMountedNodeReference;
} {
  return resolveMountedIdeGsmProjectRelativePath(node) !== null;
}

function createProjectCommand(
  commandId: MountedIdeGsmCommandDefinition['commandId'],
  projectRelativePath: string
): IdeGsmCommand {
  switch (commandId) {
    case 'sim':
      return { id: 'sim', input: { projectRelativePath } };
    case 'calib':
      return { id: 'calib', input: { projectRelativePath } };
    case 'check':
      return { id: 'check', input: { projectRelativePath } };
  }
}

export function buildMountedIdeGsmCommand(
  actionId: MountedIdeGsmCommandActionId,
  node: Pick<TreeNode, 'data'>
): IdeGsmCommand | null {
  const projectRelativePath = resolveMountedIdeGsmProjectRelativePath(node);
  if (!projectRelativePath) return null;
  const definition = getMountedIdeGsmCommandDefinition(actionId);
  if (!definition) return null;
  return createProjectCommand(definition.commandId, projectRelativePath);
}

export function buildMountedIdeGsmSimCommand(node: Pick<TreeNode, 'data'>): IdeGsmCommand | null {
  return buildMountedIdeGsmCommand(MOUNTED_IDE_GSM_SIM_ACTION, node);
}

export function resolveMountedIdeGsmCommandActions(
  node: Pick<TreeNode, 'data'>,
  config: Pick<YamlIdeGsmAppConfig, 'mountedIdeGsmCommandUiEnabled'>
): readonly MountedIdeGsmCommandAction[] {
  if (!resolveMountedIdeGsmProjectRelativePath(node)) return [];
  return MOUNTED_IDE_GSM_COMMAND_DEFINITIONS.map((definition) => ({
    id: definition.actionId,
    label: definition.label,
    disabled: !config.mountedIdeGsmCommandUiEnabled,
    tooltip: config.mountedIdeGsmCommandUiEnabled
      ? undefined
      : 'Mounted IDE-GSM command UI is disabled',
  }));
}

export function createMountedIdeGsmCommandExecutor(
  dependencies: MountedIdeGsmCommandExecutorDependencies
) {
  const execute = async (
    actionId: MountedIdeGsmCommandActionId,
    node: Pick<TreeNode, 'data'>
  ): Promise<MountedIdeGsmCommandResult> => {
    if (!dependencies.config.mountedIdeGsmCommandUiEnabled) {
      return { ok: false, code: 'FEATURE_DISABLED' };
    }
    const command = buildMountedIdeGsmCommand(actionId, node);
    if (!command) {
      return { ok: false, code: 'UNSUPPORTED_TARGET' };
    }
    let credentials: {
      readonly endpointUrl: string;
      readonly authToken: string;
    };
    try {
      credentials = await dependencies.credentialProvider.getIdeGsmCredentials();
    } catch {
      return { ok: false, code: 'CREDENTIALS_UNAVAILABLE' };
    }
    try {
      const taskId = await dependencies.createClient(credentials).executeCommand(command);
      return { ok: true, commandTaskId: taskId };
    } catch {
      return { ok: false, code: 'COMMAND_FAILED' };
    }
  };

  return Object.freeze({
    execute,
    async executeSim(node: Pick<TreeNode, 'data'>): Promise<MountedIdeGsmCommandResult> {
      return execute(MOUNTED_IDE_GSM_SIM_ACTION, node);
    },
  });
}
