import {
  assertProjectRelativePath,
  type IdeGsmCommand,
  type IdeGsmMountDescriptor,
  type IdeGsmMountedNodeReference,
} from '@hierarchidb/ide-gsm-client';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { YamlIdeGsmAppConfig } from '~/yaml-ide-gsm/YamlIdeGsmAppConfig.js';

export const MOUNTED_IDE_GSM_SIM_ACTION = 'ide-gsm:sim' as const;

type RecordValue = Readonly<Record<string, unknown>>;

export type MountedIdeGsmCommandAction = Readonly<{
  readonly id: typeof MOUNTED_IDE_GSM_SIM_ACTION;
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

export function buildMountedIdeGsmSimCommand(node: Pick<TreeNode, 'data'>): IdeGsmCommand | null {
  const projectRelativePath = resolveMountedIdeGsmProjectRelativePath(node);
  if (!projectRelativePath) return null;
  return { id: 'sim', input: { projectRelativePath } };
}

export function resolveMountedIdeGsmCommandActions(
  node: Pick<TreeNode, 'data'>,
  config: Pick<YamlIdeGsmAppConfig, 'mountedIdeGsmCommandUiEnabled'>
): readonly MountedIdeGsmCommandAction[] {
  const command = buildMountedIdeGsmSimCommand(node);
  if (!command) return [];
  return [
    {
      id: MOUNTED_IDE_GSM_SIM_ACTION,
      label: 'Run local sim',
      disabled: !config.mountedIdeGsmCommandUiEnabled,
      tooltip: config.mountedIdeGsmCommandUiEnabled
        ? undefined
        : 'Mounted IDE-GSM command UI is disabled',
    },
  ];
}

export function createMountedIdeGsmCommandExecutor(
  dependencies: MountedIdeGsmCommandExecutorDependencies
) {
  return Object.freeze({
    async executeSim(node: Pick<TreeNode, 'data'>): Promise<MountedIdeGsmCommandResult> {
      if (!dependencies.config.mountedIdeGsmCommandUiEnabled) {
        return { ok: false, code: 'FEATURE_DISABLED' };
      }
      const command = buildMountedIdeGsmSimCommand(node);
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
    },
  });
}
