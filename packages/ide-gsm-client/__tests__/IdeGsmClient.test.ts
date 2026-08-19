import type { Client as WsClient } from 'graphql-ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveWsUrl, IdeGsmClient, IdeGsmTaskError } from '../src/IdeGsmClient.js';
import type { WsClientFactory } from '../src/IdeGsmClient.js';
import { IDE_GSM_COMMAND_IDS } from '../src/ideGsmTypes.js';
import type { IdeGsmCommand, TaskStatus } from '../src/ideGsmTypes.js';

type SinkLike = {
  next: (value: unknown) => void;
  complete: () => void;
  error: (error: unknown) => void;
};

interface TrackedWsClient {
  factory: WsClientFactory;
  unsubscribe: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

function makeTrackedWsClient(onSubscribe: (sink: SinkLike) => void): TrackedWsClient {
  const unsubscribe = vi.fn();
  const dispose = vi.fn().mockResolvedValue(undefined);
  const factory: WsClientFactory = () =>
    ({
      subscribe: (_operation: unknown, sink: SinkLike) => {
        onSubscribe(sink);
        return unsubscribe;
      },
      dispose,
      on: () => () => undefined,
      terminate: () => undefined,
      iterate: async function* () {
        yield* [];
      },
    }) as unknown as WsClient;
  return { factory, unsubscribe, dispose };
}

function taskEvent(id: string, status: string, resultJson: string | null = null): unknown {
  return {
    data: {
      subscribeTaskOnFrontend: {
        id,
        status,
        paramsJson: '{}',
        resultJson,
      },
    },
  };
}

interface CommandCase {
  command: IdeGsmCommand;
  mutation: string;
  variables?: Record<string, unknown>;
}

const projectRelativePath = 'group/project';

const commandCases: CommandCase[] = [
  {
    command: { id: 'install', input: { projectRelativePath, force: false } },
    mutation: 'install',
    variables: { projectRelativePath, force: false },
  },
  {
    command: { id: 'check', input: { projectRelativePath } },
    mutation: 'checkAll',
    variables: { projectRelativePath },
  },
  {
    command: { id: 'check-merge', input: { projectRelativePath } },
    mutation: 'checkMerge',
    variables: { projectRelativePath },
  },
  {
    command: {
      id: 'preview-events',
      input: { projectRelativePath, profile: 'baseline', yearFilter: 0 },
    },
    mutation: 'previewEvents',
    variables: { projectRelativePath, profile: 'baseline', yearFilter: 0 },
  },
  {
    command: {
      id: 'calib',
      input: {
        projectRelativePath,
        profile: 'baseline',
        compute: 'auto',
        apsp: 'johnson',
        purgeCache: false,
        purgeCalib: true,
        reset: false,
      },
    },
    mutation: 'calibrate',
    variables: {
      projectRelativePath,
      profile: 'baseline',
      compute: 'auto',
      apsp: 'johnson',
      purgeCache: false,
      purgeCalib: true,
      reset: false,
    },
  },
  {
    command: {
      id: 'sim',
      input: {
        projectRelativePath,
        profile: 'baseline',
        compute: 'auto',
        apsp: 'floyd-warshall',
        purgeCache: false,
        reset: true,
      },
    },
    mutation: 'simulate',
    variables: {
      projectRelativePath,
      profile: 'baseline',
      compute: 'auto',
      apsp: 'floyd-warshall',
      purgeCache: false,
      reset: true,
    },
  },
  {
    command: { id: 'purge-cache', input: { projectRelativePath } },
    mutation: 'purgeCache',
    variables: { projectRelativePath },
  },
  {
    command: {
      id: 'calib-remote',
      input: { projectRelativePath, compute: 'auto', purgeCalib: false, downloadCache: true },
    },
    mutation: 'calibrateRemote',
    variables: { projectRelativePath, compute: 'auto', purgeCalib: false, downloadCache: true },
  },
  {
    command: {
      id: 'sim-remote',
      input: { projectRelativePath, apsp: 'johnson', downloadCache: false },
    },
    mutation: 'simulateRemote',
    variables: { projectRelativePath, apsp: 'johnson', downloadCache: false },
  },
  {
    command: { id: 'start-container-remote', input: { projectRelativePath } },
    mutation: 'startContainerRemote',
  },
  {
    command: { id: 'stop-container-remote', input: { projectRelativePath } },
    mutation: 'stopContainerRemote',
  },
  {
    command: {
      id: 'calib-ssh',
      input: { projectRelativePath, purgeCache: true, reset: false },
    },
    mutation: 'calibrateSsh',
    variables: { projectRelativePath, purgeCache: true, reset: false },
  },
  {
    command: {
      id: 'sim-ssh',
      input: { projectRelativePath, compute: 'auto', downloadCache: true },
    },
    mutation: 'simulateSsh',
    variables: { projectRelativePath, compute: 'auto', downloadCache: true },
  },
  {
    command: {
      id: 'calib-ec2',
      input: { projectRelativePath, apsp: 'auto', purgeCalib: true },
    },
    mutation: 'calibrateEc2',
    variables: { projectRelativePath, apsp: 'auto', purgeCalib: true },
  },
  {
    command: {
      id: 'sim-ec2',
      input: { projectRelativePath, purgeCache: false, reset: false },
    },
    mutation: 'simulateEc2',
    variables: { projectRelativePath, purgeCache: false, reset: false },
  },
  {
    command: { id: 'start-container-ec2', input: { projectRelativePath } },
    mutation: 'startContainerEc2',
  },
  {
    command: { id: 'stop-container-ec2', input: { projectRelativePath } },
    mutation: 'stopContainerEc2',
  },
  {
    command: {
      id: 'rsync-push',
      input: { projectRelativePath, connectionType: 'remote', include: [], exclude: ['*.tmp'] },
    },
    mutation: 'rsyncPush',
    variables: {
      projectRelativePath,
      connectionType: 'remote',
      include: [],
      exclude: ['*.tmp'],
    },
  },
  {
    command: {
      id: 'rsync-pull',
      input: { projectRelativePath, connectionType: 'ssh', include: ['*.yml'] },
    },
    mutation: 'rsyncPull',
    variables: { projectRelativePath, connectionType: 'ssh', include: ['*.yml'] },
  },
  {
    command: {
      id: 'init',
      input: { projectRelativePath, githubToken: 'github-token', url: 'https://example.test/repo' },
    },
    mutation: 'init',
    variables: {
      projectRelativePath,
      token: 'github-token',
      url: 'https://example.test/repo',
    },
  },
];

describe('deriveWsUrl', () => {
  it('maps HTTP schemes and strips trailing slashes', () => {
    expect(deriveWsUrl('http://localhost:8080/')).toBe('ws://localhost:8080/graphql');
    expect(deriveWsUrl('https://example.test')).toBe('wss://example.test/graphql');
  });

  it('does not include an invalid endpoint in its error', () => {
    const endpoint = 'ftp://endpoint-secret.example';
    expect(() => deriveWsUrl(endpoint)).toThrow('expected http or https');
    expect(() => deriveWsUrl(endpoint)).not.toThrow(endpoint);
  });
});

describe('canonical command dispatch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('contains exactly the 20 canonical command IDs', () => {
    expect(IDE_GSM_COMMAND_IDS).toHaveLength(20);
    expect(new Set(IDE_GSM_COMMAND_IDS).size).toBe(20);
  });

  it.each(commandCases)(
    '$command.id dispatches only $mutation',
    async ({ command, mutation, variables }) => {
      const { GraphQLClient } = await import('graphql-request');
      const spy = vi.fn().mockResolvedValue({ [mutation]: `task-${mutation}` });
      vi.spyOn(GraphQLClient.prototype, 'request').mockImplementation(spy);

      await expect(
        new IdeGsmClient('https://endpoint.example', 'jwt-secret').executeCommand(command)
      ).resolves.toBe(`task-${mutation}`);

      expect(spy).toHaveBeenCalledTimes(1);
      const [document, actualVariables] = spy.mock.calls[0] as [string, unknown];
      expect(document).toContain(mutation);
      if (mutation === 'checkAll') {
        expect(document).not.toContain('checkProject');
      }
      expect(actualVariables).toEqual(variables);
    }
  );

  it('rejects an unknown command before creating a network request', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request');
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    expect(() =>
      client.executeCommand({ id: 'start-daemon-remote', input: { projectRelativePath } } as never)
    ).toThrow('Unsupported IDE-GSM command');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('input validation and optional variables', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['', '   ', '/absolute/path', '../parent', 'group/../parent', 'C:\\absolute'])(
    'rejects invalid project path %j without a network request',
    async (invalidPath) => {
      const { GraphQLClient } = await import('graphql-request');
      const spy = vi.spyOn(GraphQLClient.prototype, 'request');
      const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

      await expect(client.install(invalidPath)).rejects.toThrow('projectRelativePath');
      expect(spy).not.toHaveBeenCalled();
    }
  );

  it('rejects an invalid rsync connection type without a network request', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request');
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(client.rsyncPush(projectRelativePath, 'ftp' as never)).rejects.toThrow(
      'connectionType'
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects missing init credentials before a network request', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request');
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(client.init(projectRelativePath, '', 'https://example.test/repo')).rejects.toThrow(
      'githubToken'
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('distinguishes omitted rsync patterns from explicit empty arrays', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi
      .spyOn(GraphQLClient.prototype, 'request')
      .mockResolvedValueOnce({ rsyncPush: 'task-omitted' })
      .mockResolvedValueOnce({ rsyncPush: 'task-empty' });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await client.rsyncPush(projectRelativePath, 'remote');
    await client.rsyncPush(projectRelativePath, 'remote', { include: [], exclude: [] });

    expect(spy.mock.calls[0]?.[1]).toEqual({ projectRelativePath, connectionType: 'remote' });
    expect(spy.mock.calls[1]?.[1]).toEqual({
      projectRelativePath,
      connectionType: 'remote',
      include: [],
      exclude: [],
    });
    expect(String(spy.mock.calls[0]?.[0])).not.toContain('filter: String');
  });

  it('omits unspecified command options and preserves explicit false', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi
      .spyOn(GraphQLClient.prototype, 'request')
      .mockResolvedValue({ simulate: 'task-simulate' });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await client.simulate(projectRelativePath, { purgeCache: false });

    expect(spy.mock.calls[0]?.[1]).toEqual({ projectRelativePath, purgeCache: false });
  });

  it('does not expose endpoint or credentials from an HTTP failure', async () => {
    const { GraphQLClient } = await import('graphql-request');
    vi.spyOn(GraphQLClient.prototype, 'request').mockRejectedValue(
      new Error('https://endpoint-secret.example jwt-secret github-token')
    );
    const client = new IdeGsmClient('https://endpoint-secret.example', 'jwt-secret');

    const promise = client.init(projectRelativePath, 'github-token', 'https://example.test/repo');
    await expect(promise).rejects.toThrow('IDE-GSM GraphQL request failed');
    await expect(promise).rejects.not.toThrow(/endpoint-secret|jwt-secret|github-token/u);
  });
});

describe('task subscription contract', () => {
  it('continues through active statuses, reports each event, and resolves FINISHED', async () => {
    const statuses: TaskStatus[] = [];
    const tracked = makeTrackedWsClient((sink) => {
      sink.next(taskEvent('task-1', 'REGISTERED'));
      sink.next(taskEvent('task-1', 'READY'));
      sink.next(taskEvent('task-1', 'LEASED'));
      sink.next(taskEvent('task-1', 'FINISHED', '{"ok":true}'));
    });

    const result = await new IdeGsmClient(
      'https://endpoint.example',
      'jwt-secret',
      tracked.factory
    ).awaitTask('task-1', (event) => statuses.push(event.status));

    expect(statuses).toEqual(['REGISTERED', 'READY', 'LEASED', 'FINISHED']);
    expect(result).toEqual({
      id: 'task-1',
      status: 'FINISHED',
      paramsJson: '{}',
      resultJson: '{"ok":true}',
    });
    expect(tracked.unsubscribe).toHaveBeenCalledTimes(1);
    expect(tracked.dispose).toHaveBeenCalledTimes(1);
  });

  it.each(['FAILED', 'CANCELED', 'DELETED'] as const)(
    'rejects %s with the typed result and cleans up once',
    async (status) => {
      const tracked = makeTrackedWsClient((sink) => sink.next(taskEvent('task-1', status, '{}')));
      const promise = new IdeGsmClient(
        'https://endpoint.example',
        'jwt-secret',
        tracked.factory
      ).awaitTask('task-1');

      await expect(promise).rejects.toBeInstanceOf(IdeGsmTaskError);
      await expect(promise).rejects.toMatchObject({ status });
      await expect(promise).rejects.not.toHaveProperty('result');
      expect(tracked.unsubscribe).toHaveBeenCalledTimes(1);
      expect(tracked.dispose).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    ['unknown status', taskEvent('task-1', 'UNKNOWN')],
    ['mismatched task ID', taskEvent('task-2', 'FINISHED')],
    ['malformed payload', { data: { subscribeTaskOnFrontend: { id: 'task-1' } } }],
  ])('rejects %s and cleans up once', async (_label, event) => {
    const tracked = makeTrackedWsClient((sink) => sink.next(event));
    const promise = new IdeGsmClient(
      'https://endpoint.example',
      'jwt-secret',
      tracked.factory
    ).awaitTask('task-1');

    await expect(promise).rejects.toThrow();
    expect(tracked.unsubscribe).toHaveBeenCalledTimes(1);
    expect(tracked.dispose).toHaveBeenCalledTimes(1);
  });

  it('rejects completion before a terminal event and cleans up once', async () => {
    const tracked = makeTrackedWsClient((sink) => {
      sink.next(taskEvent('task-1', 'READY'));
      sink.complete();
    });
    const promise = new IdeGsmClient(
      'https://endpoint.example',
      'jwt-secret',
      tracked.factory
    ).awaitTask('task-1');

    await expect(promise).rejects.toThrow('before a terminal status');
    expect(tracked.unsubscribe).toHaveBeenCalledTimes(1);
    expect(tracked.dispose).toHaveBeenCalledTimes(1);
  });

  it('sanitizes WebSocket errors and cleans up once', async () => {
    const tracked = makeTrackedWsClient((sink) => {
      sink.error(new Error('https://endpoint-secret.example jwt-secret'));
    });
    const promise = new IdeGsmClient(
      'https://endpoint-secret.example',
      'jwt-secret',
      tracked.factory
    ).awaitTask('task-1');

    await expect(promise).rejects.toThrow('IDE-GSM task subscription failed');
    await expect(promise).rejects.not.toThrow(/endpoint-secret|jwt-secret/u);
    expect(tracked.unsubscribe).toHaveBeenCalledTimes(1);
    expect(tracked.dispose).toHaveBeenCalledTimes(1);
  });

  it('settles successfully when unsubscribe throws and dispose rejects', async () => {
    const tracked = makeTrackedWsClient((sink) => {
      sink.next(taskEvent('task-1', 'FINISHED'));
    });
    tracked.unsubscribe.mockImplementation(() => {
      throw new Error('unsubscribe failed');
    });
    tracked.dispose.mockRejectedValue(new Error('dispose failed'));

    const promise = new IdeGsmClient(
      'https://endpoint.example',
      'jwt-secret',
      tracked.factory
    ).awaitTask('task-1');

    await expect(promise).resolves.toMatchObject({ status: 'FINISHED' });
    expect(tracked.unsubscribe).toHaveBeenCalledTimes(1);
    expect(tracked.dispose).toHaveBeenCalledTimes(1);
  });

  it('preserves terminal failure when unsubscribe throws and dispose rejects', async () => {
    const tracked = makeTrackedWsClient((sink) => {
      sink.next(taskEvent('task-1', 'FAILED', '{"credential":"must-not-be-retained"}'));
    });
    tracked.unsubscribe.mockImplementation(() => {
      throw new Error('unsubscribe failed');
    });
    tracked.dispose.mockRejectedValue(new Error('dispose failed'));

    const promise = new IdeGsmClient(
      'https://endpoint.example',
      'jwt-secret',
      tracked.factory
    ).awaitTask('task-1');

    await expect(promise).rejects.toMatchObject({ status: 'FAILED' });
    await expect(promise).rejects.not.toHaveProperty('result');
    expect(tracked.unsubscribe).toHaveBeenCalledTimes(1);
    expect(tracked.dispose).toHaveBeenCalledTimes(1);
  });
});
