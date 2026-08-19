import { GraphQLClient } from 'graphql-request';
import { createClient } from 'graphql-ws';
import type { Client as WsClient } from 'graphql-ws';
import { ideGsmGraphqlDocuments } from './ideGsmGraphqlDocuments.js';
import type {
  CalibrateCommandInput,
  ExportFilter,
  IdeGsmCommand,
  InstallCommandInput,
  PreviewEventsCommandInput,
  RemoteCalibrateCommandInput,
  RemoteSimulateCommandInput,
  RsyncConnectionType,
  RsyncFilter,
  SimulateCommandInput,
  TaskResult,
  TaskStatus,
  TaskStatusListener,
} from './ideGsmTypes.js';

/** Factory type for creating a graphql-ws client. Injected for testability. */
export type WsClientFactory = (url: string, connectionParams: Record<string, string>) => WsClient;

const TASK_STATUSES: ReadonlySet<string> = new Set<TaskStatus>([
  'REGISTERED',
  'READY',
  'LEASED',
  'FINISHED',
  'FAILED',
  'CANCELED',
  'DELETED',
]);

const ACTIVE_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set(['REGISTERED', 'READY', 'LEASED']);

type MutationName = Exclude<keyof typeof ideGsmGraphqlDocuments, 'subscribeTask'>;

interface SubscribeTaskEvent {
  subscribeTaskOnFrontend?: unknown;
}

function buildAuthHeaders(authToken: string): Record<string, string> {
  return { Authorization: `Bearer ${authToken}` };
}

function assertProjectRelativePath(projectRelativePath: string): void {
  const value = projectRelativePath.trim();
  const segments = value.split(/[\\/]/u);
  const isWindowsAbsolute = /^[A-Za-z]:[\\/]/u.test(value);

  if (
    value.length === 0 ||
    value.startsWith('/') ||
    value.startsWith('\\') ||
    isWindowsAbsolute ||
    segments.includes('..')
  ) {
    throw new Error(
      'projectRelativePath must be a non-empty relative path without parent traversal'
    );
  }
}

function assertConnectionType(
  connectionType: string
): asserts connectionType is RsyncConnectionType {
  if (connectionType !== 'remote' && connectionType !== 'ssh' && connectionType !== 'ec2') {
    throw new Error('connectionType must be remote, ssh, or ec2');
  }
}

function assertNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
}

function addDefined(variables: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) {
    variables[key] = value;
  }
}

function projectVariables(projectRelativePath: string): Record<string, unknown> {
  assertProjectRelativePath(projectRelativePath);
  return { projectRelativePath };
}

function simulateVariables(
  projectRelativePath: string,
  options?: Omit<SimulateCommandInput, 'projectRelativePath'>
): Record<string, unknown> {
  const variables = projectVariables(projectRelativePath);
  addDefined(variables, 'profile', options?.profile);
  addDefined(variables, 'compute', options?.compute);
  addDefined(variables, 'apsp', options?.apsp);
  addDefined(variables, 'purgeCache', options?.purgeCache);
  addDefined(variables, 'reset', options?.reset);
  return variables;
}

function calibrateVariables(
  projectRelativePath: string,
  options?: Omit<CalibrateCommandInput, 'projectRelativePath'>
): Record<string, unknown> {
  const variables = simulateVariables(projectRelativePath, options);
  addDefined(variables, 'purgeCalib', options?.purgeCalib);
  return variables;
}

function remoteSimulateVariables(
  projectRelativePath: string,
  options?: Omit<RemoteSimulateCommandInput, 'projectRelativePath'>
): Record<string, unknown> {
  const variables = projectVariables(projectRelativePath);
  addDefined(variables, 'compute', options?.compute);
  addDefined(variables, 'apsp', options?.apsp);
  addDefined(variables, 'purgeCache', options?.purgeCache);
  addDefined(variables, 'reset', options?.reset);
  addDefined(variables, 'downloadCache', options?.downloadCache);
  return variables;
}

function remoteCalibrateVariables(
  projectRelativePath: string,
  options?: Omit<RemoteCalibrateCommandInput, 'projectRelativePath'>
): Record<string, unknown> {
  const variables = remoteSimulateVariables(projectRelativePath, options);
  addDefined(variables, 'purgeCalib', options?.purgeCalib);
  return variables;
}

function parseTaskResult(value: unknown): TaskResult {
  if (typeof value !== 'object' || value === null) {
    throw new Error('IDE-GSM task subscription returned a malformed event');
  }

  const event = value as Record<string, unknown>;
  if (
    typeof event.id !== 'string' ||
    typeof event.status !== 'string' ||
    !TASK_STATUSES.has(event.status) ||
    typeof event.paramsJson !== 'string' ||
    (event.resultJson !== null && typeof event.resultJson !== 'string')
  ) {
    throw new Error('IDE-GSM task subscription returned a malformed event');
  }

  return {
    id: event.id,
    status: event.status as TaskStatus,
    paramsJson: event.paramsJson,
    resultJson: event.resultJson,
  };
}

function assertNeverCommand(command: never): never {
  void command;
  throw new Error('Unsupported IDE-GSM command');
}

/**
 * Derive the WebSocket URL from an HTTP endpoint URL.
 * The endpoint value is intentionally excluded from validation errors.
 */
export function deriveWsUrl(endpointUrl: string): string {
  const withoutTrailingSlash = endpointUrl.replace(/\/+$/, '');
  if (withoutTrailingSlash.startsWith('https://')) {
    return `wss://${withoutTrailingSlash.slice('https://'.length)}/graphql`;
  }
  if (withoutTrailingSlash.startsWith('http://')) {
    return `ws://${withoutTrailingSlash.slice('http://'.length)}/graphql`;
  }
  throw new Error('Unsupported endpoint URL scheme; expected http or https');
}

/** Failure for a validated terminal task event that did not succeed. */
export class IdeGsmTaskError extends Error {
  readonly status: TaskStatus;

  constructor(status: TaskStatus) {
    super(`IDE-GSM task ended with status ${status}`);
    this.name = 'IdeGsmTaskError';
    this.status = status;
  }
}

/** Typed client for the pinned IDE-GSM GraphQL frontend surface. */
export class IdeGsmClient {
  private readonly endpointUrl: string;
  private readonly authToken: string;
  private readonly graphqlUrl: string;
  private readonly wsClientFactory: WsClientFactory;

  constructor(endpointUrl: string, authToken: string, wsClientFactory?: WsClientFactory) {
    this.endpointUrl = endpointUrl;
    this.authToken = authToken;
    const base = endpointUrl.replace(/\/+$/, '');
    this.graphqlUrl = `${base}/graphql`;
    this.wsClientFactory =
      wsClientFactory ?? ((url, params) => createClient({ url, connectionParams: params }));
  }

  private createHttpClient(): GraphQLClient {
    return new GraphQLClient(this.graphqlUrl, {
      headers: buildAuthHeaders(this.authToken),
    });
  }

  private async requestTask(
    mutationName: MutationName,
    variables?: Record<string, unknown>
  ): Promise<string> {
    try {
      const data = await this.createHttpClient().request<Record<string, unknown>>(
        ideGsmGraphqlDocuments[mutationName],
        variables
      );
      const taskId = data[mutationName];
      if (typeof taskId !== 'string' || taskId.length === 0) {
        throw new Error('invalid task ID');
      }
      return taskId;
    } catch {
      throw new Error('IDE-GSM GraphQL request failed');
    }
  }

  async importProject(projectSnapshot: string, projectRelativePath: string): Promise<string> {
    assertNonEmpty(projectSnapshot, 'projectSnapshot');
    return this.requestTask('importProject', {
      ...projectVariables(projectRelativePath),
      projectSnapshot,
    });
  }

  async exportProject(projectRelativePath: string, filter?: ExportFilter): Promise<string> {
    const variables = projectVariables(projectRelativePath);
    addDefined(variables, 'include', filter?.include);
    addDefined(variables, 'exclude', filter?.exclude);
    return this.requestTask('exportProject', variables);
  }

  async init(projectRelativePath: string, githubToken: string, url: string): Promise<string> {
    const variables = projectVariables(projectRelativePath);
    assertNonEmpty(githubToken, 'githubToken');
    assertNonEmpty(url, 'url');
    variables.token = githubToken;
    variables.url = url;
    return this.requestTask('init', variables);
  }

  async install(
    projectRelativePath: string,
    options?: Omit<InstallCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    const variables = projectVariables(projectRelativePath);
    addDefined(variables, 'force', options?.force);
    return this.requestTask('install', variables);
  }

  async checkAll(projectRelativePath: string): Promise<string> {
    return this.requestTask('checkAll', projectVariables(projectRelativePath));
  }

  async checkMerge(projectRelativePath: string): Promise<string> {
    return this.requestTask('checkMerge', projectVariables(projectRelativePath));
  }

  async previewEvents(
    projectRelativePath: string,
    options?: Omit<PreviewEventsCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    const variables = projectVariables(projectRelativePath);
    addDefined(variables, 'profile', options?.profile);
    addDefined(variables, 'yearFilter', options?.yearFilter);
    return this.requestTask('previewEvents', variables);
  }

  async calibrate(
    projectRelativePath: string,
    options?: Omit<CalibrateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask('calibrate', calibrateVariables(projectRelativePath, options));
  }

  async simulate(
    projectRelativePath: string,
    options?: Omit<SimulateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask('simulate', simulateVariables(projectRelativePath, options));
  }

  async purgeCache(projectRelativePath: string): Promise<string> {
    return this.requestTask('purgeCache', projectVariables(projectRelativePath));
  }

  async calibrateRemote(
    projectRelativePath: string,
    options?: Omit<RemoteCalibrateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask(
      'calibrateRemote',
      remoteCalibrateVariables(projectRelativePath, options)
    );
  }

  async simulateRemote(
    projectRelativePath: string,
    options?: Omit<RemoteSimulateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask(
      'simulateRemote',
      remoteSimulateVariables(projectRelativePath, options)
    );
  }

  async startContainerRemote(projectRelativePath: string): Promise<string> {
    assertProjectRelativePath(projectRelativePath);
    return this.requestTask('startContainerRemote');
  }

  async stopContainerRemote(projectRelativePath: string): Promise<string> {
    assertProjectRelativePath(projectRelativePath);
    return this.requestTask('stopContainerRemote');
  }

  async calibrateSsh(
    projectRelativePath: string,
    options?: Omit<RemoteCalibrateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask('calibrateSsh', remoteCalibrateVariables(projectRelativePath, options));
  }

  async simulateSsh(
    projectRelativePath: string,
    options?: Omit<RemoteSimulateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask('simulateSsh', remoteSimulateVariables(projectRelativePath, options));
  }

  async calibrateEc2(
    projectRelativePath: string,
    options?: Omit<RemoteCalibrateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask('calibrateEc2', remoteCalibrateVariables(projectRelativePath, options));
  }

  async simulateEc2(
    projectRelativePath: string,
    options?: Omit<RemoteSimulateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask('simulateEc2', remoteSimulateVariables(projectRelativePath, options));
  }

  async startContainerEc2(projectRelativePath: string): Promise<string> {
    assertProjectRelativePath(projectRelativePath);
    return this.requestTask('startContainerEc2');
  }

  async stopContainerEc2(projectRelativePath: string): Promise<string> {
    assertProjectRelativePath(projectRelativePath);
    return this.requestTask('stopContainerEc2');
  }

  async rsyncPush(
    projectRelativePath: string,
    connectionType: RsyncConnectionType,
    filter?: RsyncFilter
  ): Promise<string> {
    return this.requestTask(
      'rsyncPush',
      this.rsyncVariables(projectRelativePath, connectionType, filter)
    );
  }

  async rsyncPull(
    projectRelativePath: string,
    connectionType: RsyncConnectionType,
    filter?: RsyncFilter
  ): Promise<string> {
    return this.requestTask(
      'rsyncPull',
      this.rsyncVariables(projectRelativePath, connectionType, filter)
    );
  }

  private rsyncVariables(
    projectRelativePath: string,
    connectionType: string,
    filter?: RsyncFilter
  ): Record<string, unknown> {
    const variables = projectVariables(projectRelativePath);
    assertConnectionType(connectionType);
    variables.connectionType = connectionType;
    addDefined(variables, 'include', filter?.include);
    addDefined(variables, 'exclude', filter?.exclude);
    return variables;
  }

  /** Dispatch a canonical YAML Step 4 command without aliases or fallbacks. */
  executeCommand(command: IdeGsmCommand): Promise<string> {
    switch (command.id) {
      case 'install':
        return this.install(command.input.projectRelativePath, command.input);
      case 'check':
        return this.checkAll(command.input.projectRelativePath);
      case 'check-merge':
        return this.checkMerge(command.input.projectRelativePath);
      case 'preview-events':
        return this.previewEvents(command.input.projectRelativePath, command.input);
      case 'calib':
        return this.calibrate(command.input.projectRelativePath, command.input);
      case 'sim':
        return this.simulate(command.input.projectRelativePath, command.input);
      case 'purge-cache':
        return this.purgeCache(command.input.projectRelativePath);
      case 'calib-remote':
        return this.calibrateRemote(command.input.projectRelativePath, command.input);
      case 'sim-remote':
        return this.simulateRemote(command.input.projectRelativePath, command.input);
      case 'start-container-remote':
        return this.startContainerRemote(command.input.projectRelativePath);
      case 'stop-container-remote':
        return this.stopContainerRemote(command.input.projectRelativePath);
      case 'calib-ssh':
        return this.calibrateSsh(command.input.projectRelativePath, command.input);
      case 'sim-ssh':
        return this.simulateSsh(command.input.projectRelativePath, command.input);
      case 'calib-ec2':
        return this.calibrateEc2(command.input.projectRelativePath, command.input);
      case 'sim-ec2':
        return this.simulateEc2(command.input.projectRelativePath, command.input);
      case 'start-container-ec2':
        return this.startContainerEc2(command.input.projectRelativePath);
      case 'stop-container-ec2':
        return this.stopContainerEc2(command.input.projectRelativePath);
      case 'rsync-push':
        return this.rsyncPush(
          command.input.projectRelativePath,
          command.input.connectionType,
          command.input
        );
      case 'rsync-pull':
        return this.rsyncPull(
          command.input.projectRelativePath,
          command.input.connectionType,
          command.input
        );
      case 'init':
        return this.init(
          command.input.projectRelativePath,
          command.input.githubToken,
          command.input.url
        );
      default:
        return assertNeverCommand(command);
    }
  }

  /** Wait until a task emits a validated terminal status. */
  awaitTask(taskId: string, onStatus?: TaskStatusListener): Promise<TaskResult> {
    assertNonEmpty(taskId, 'taskId');

    return new Promise<TaskResult>((resolve, reject) => {
      let wsClient: WsClient | undefined;
      let unsubscribe: (() => void) | undefined;
      let cleanupPending = false;
      let unsubscribeCalled = false;
      let disposed = false;
      let settled = false;

      const cleanup = (): void => {
        if (!unsubscribeCalled) {
          if (unsubscribe === undefined) {
            cleanupPending = true;
          } else {
            unsubscribeCalled = true;
            try {
              unsubscribe();
            } catch {
              // Cleanup failures must not prevent the task promise from settling.
            }
          }
        }
        if (!disposed && wsClient !== undefined) {
          disposed = true;
          try {
            void Promise.resolve(wsClient.dispose()).catch(() => undefined);
          } catch {
            // Cleanup failures must not prevent the task promise from settling.
          }
        }
      };

      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      try {
        const wsUrl = deriveWsUrl(this.endpointUrl);
        wsClient = this.wsClientFactory(wsUrl, buildAuthHeaders(this.authToken));
        unsubscribe = wsClient.subscribe<SubscribeTaskEvent>(
          {
            query: ideGsmGraphqlDocuments.subscribeTask,
            variables: { taskId },
          },
          {
            next: (event) => {
              if (settled) return;

              let result: TaskResult;
              try {
                result = parseTaskResult(event.data?.subscribeTaskOnFrontend);
              } catch {
                fail(new Error('IDE-GSM task subscription returned a malformed event'));
                return;
              }

              if (result.id !== taskId) {
                fail(new Error('IDE-GSM task subscription returned a mismatched task ID'));
                return;
              }

              try {
                onStatus?.(result);
              } catch {
                fail(new Error('IDE-GSM task status listener failed'));
                return;
              }

              if (ACTIVE_TASK_STATUSES.has(result.status)) return;

              settled = true;
              cleanup();
              if (result.status === 'FINISHED') {
                resolve(result);
                return;
              }
              reject(new IdeGsmTaskError(result.status));
            },
            error: () => {
              fail(new Error('IDE-GSM task subscription failed'));
            },
            complete: () => {
              fail(new Error('IDE-GSM task subscription ended before a terminal status'));
            },
          }
        );

        if (cleanupPending && !unsubscribeCalled) {
          unsubscribeCalled = true;
          try {
            unsubscribe();
          } catch {
            // Cleanup failures must not replace the terminal task result.
          }
        }
      } catch {
        if (wsClient !== undefined) {
          fail(new Error('IDE-GSM task subscription failed'));
        } else {
          reject(new Error('IDE-GSM task subscription failed'));
        }
      }
    });
  }
}
