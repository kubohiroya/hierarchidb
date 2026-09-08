import type { Client as WsClient } from 'graphql-ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WsClientFactory } from '../src/IdeGsmClient.js';
import { deriveWsUrl, IdeGsmClient, IdeGsmTaskError } from '../src/IdeGsmClient.js';
import type { IdeGsmCommand, TaskStatus } from '../src/ideGsmTypes.js';
import { IDE_GSM_COMMAND_IDS } from '../src/ideGsmTypes.js';

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
const yamlRelativePath = 'scenarios/base.yaml';
const csvRelativePath = 'outputs/table.csv';
const oldDigest = '0'.repeat(64);
const newDigest = '1'.repeat(64);

const directoryNode = {
  name: 'src',
  relativePath: 'src',
  kind: 'DIRECTORY',
  directory: true,
  exists: true,
  sizeBytes: 0,
  updatedAt: null,
  childCount: 1,
  children: [
    {
      name: 'index.ts',
      relativePath: 'src/index.ts',
      kind: 'FILE',
      directory: false,
      exists: true,
      sizeBytes: 42,
      updatedAt: '2026-08-29T00:00:00Z',
      childCount: 0,
      children: [],
    },
  ],
};

const fdmCellInput = {
  spaceId: 'default',
  parameterSet: 'baseline',
  dataset: 'world',
  compute: 'java-fp64-raw',
  timelinePoint: 'INIT_WORLD',
  label: 'Initial world',
  stateDir: 'state/latest',
};

const fdmStartup = {
  ready: true,
  phase: 'ready',
  startedAt: '2026-09-07T00:00:00Z',
  finishedAt: '2026-09-07T00:00:01Z',
  waitedMillis: 1000,
  waitingForHolder: null,
  apiStartupLock: {
    active: false,
    acquiredAt: null,
    ageMillis: null,
    fileName: null,
    host: null,
    owner: null,
    pid: null,
    role: null,
    staleMetadata: false,
  },
  simulatorLock: null,
};

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

describe('directory read contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches typed FDM and project directory requests', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi
      .spyOn(GraphQLClient.prototype, 'request')
      .mockResolvedValueOnce({
        fdmSpaces: { defaultSpaceId: 'default', spaces: [{ spaceId: 'default' }] },
      })
      .mockResolvedValueOnce({
        fdmDirectoryTree: { selectedPath: 'runs', maxDepth: 1, root: directoryNode },
      })
      .mockResolvedValueOnce({
        projectDirectoryInfo: {
          projectRelativePath,
          requestedPath: 'src',
          descendantCount: 1,
          node: directoryNode,
        },
      });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(client.fdmSpaces()).resolves.toEqual({
      defaultSpaceId: 'default',
      spaces: [{ spaceId: 'default' }],
    });
    await expect(
      client.fdmDirectoryTree({ spaceId: 'default', path: 'runs', depth: 1 })
    ).resolves.toMatchObject({ selectedPath: 'runs', root: { relativePath: 'src' } });
    await expect(
      client.projectDirectoryInfo({ projectRelativePath, path: 'src', depth: 0 })
    ).resolves.toMatchObject({ projectRelativePath, requestedPath: 'src' });

    expect(String(spy.mock.calls[0]?.[0])).toContain('fdmSpaces');
    expect(spy.mock.calls[0]?.[1]).toBeUndefined();
    expect(String(spy.mock.calls[1]?.[0])).toContain('fdmDirectoryTree');
    expect(spy.mock.calls[1]?.[1]).toEqual({ spaceId: 'default', path: 'runs', depth: 1 });
    expect(String(spy.mock.calls[2]?.[0])).toContain('projectDirectoryInfo');
    expect(spy.mock.calls[2]?.[1]).toEqual({ projectRelativePath, path: 'src', depth: 0 });
  });

  it('dispatches FDM remove through the explicit action mutation', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      fdmDirectoryRemove: {
        targetPath: 'runs/tmp',
        apply: true,
        existed: true,
        deleted: true,
        deletedFiles: 1,
        deletedBytes: 42,
        target: { ...directoryNode, relativePath: 'runs/tmp' },
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.fdmDirectoryRemove({ spaceId: 'default', path: 'runs/tmp', apply: true })
    ).resolves.toMatchObject({ targetPath: 'runs/tmp', deleted: true });

    expect(String(spy.mock.calls[0]?.[0])).toContain('fdmDirectoryRemove');
    expect(spy.mock.calls[0]?.[1]).toEqual({ spaceId: 'default', path: 'runs/tmp', apply: true });
  });

  it('loads current FDM space catalog metadata without requiring provenance fields', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      fdmSpaces: {
        defaultSpaceId: 'baseline',
        spaces: [
          {
            spaceId: 'baseline',
            label: 'Baseline',
            defaultSpace: true,
            visible: true,
            archived: false,
            owner: 'team-a',
            layoutVersion: 'v2',
            legacyRoot: false,
            order: 1,
            createdAt: '2026-09-07T00:00:00Z',
            defaults: {
              profile: ['baseline'],
              dataset: ['world'],
              compute: ['java'],
              timeline: ['INIT_WORLD'],
            },
            warnings: ['read-only'],
          },
        ],
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(client.fdmSpaces()).resolves.toEqual({
      defaultSpaceId: 'baseline',
      spaces: [
        {
          spaceId: 'baseline',
          label: 'Baseline',
          defaultSpace: true,
          visible: true,
          archived: false,
          owner: 'team-a',
          layoutVersion: 'v2',
          legacyRoot: false,
          order: 1,
          createdAt: '2026-09-07T00:00:00Z',
          defaults: {
            profile: ['baseline'],
            dataset: ['world'],
            compute: ['java'],
            timeline: ['INIT_WORLD'],
          },
          warnings: ['read-only'],
        },
      ],
    });
    expect(String(spy.mock.calls[0]?.[0])).toContain('defaultSpace');
  });

  it('dispatches current FDM space lifecycle mutations without wiring destructive UI behavior', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const space = {
      spaceId: 'working',
      label: 'Working',
      defaultSpace: false,
      visible: true,
      archived: false,
      owner: null,
      layoutVersion: 'v2',
      legacyRoot: false,
      order: 2,
      createdAt: null,
      defaults: null,
      warnings: null,
    };
    const spy = vi
      .spyOn(GraphQLClient.prototype, 'request')
      .mockResolvedValueOnce({ fdmSpaceCreate: space })
      .mockResolvedValueOnce({ fdmSpaceUpdate: { ...space, archived: true } })
      .mockResolvedValueOnce({
        fdmSpaceDelete: {
          apply: false,
          archived: true,
          byteCount: 0,
          confirmed: false,
          deleted: false,
          fileCount: 0,
          physicalDelete: false,
          spaceId: 'working',
          topLevelEntries: [],
          spaces: {
            defaultSpaceId: 'baseline',
            spaces: [space],
          },
        },
      });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.fdmSpaceCreate({ spaceId: 'working', label: 'Working', defaultSpace: false })
    ).resolves.toMatchObject({ spaceId: 'working', label: 'Working' });
    await expect(
      client.fdmSpaceUpdate({ spaceId: 'working', archived: true })
    ).resolves.toMatchObject({ spaceId: 'working', archived: true });
    await expect(
      client.fdmSpaceDelete({ spaceId: 'working', apply: false, deleteFiles: false })
    ).resolves.toMatchObject({ spaceId: 'working', apply: false, deleted: false });

    expect(spy.mock.calls[0]?.[1]).toEqual({
      spaceId: 'working',
      label: 'Working',
      defaultSpace: false,
    });
    expect(spy.mock.calls[1]?.[1]).toEqual({ spaceId: 'working', archived: true });
    expect(spy.mock.calls[2]?.[1]).toEqual({
      spaceId: 'working',
      apply: false,
      deleteFiles: false,
    });
  });

  it('runs FDM space delete dry-run through the space lifecycle mutation only', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      fdmSpaceDelete: {
        apply: false,
        archived: true,
        byteCount: 1024,
        confirmed: false,
        deleted: false,
        fileCount: 3,
        physicalDelete: false,
        spaceId: 'working',
        topLevelEntries: ['runs', 'snapshots'],
        spaces: null,
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.fdmSpaceDeleteDryRun({ spaceId: 'working', deleteFiles: true })
    ).resolves.toMatchObject({
      apply: false,
      deleted: false,
      physicalDelete: false,
      spaceId: 'working',
    });

    expect(String(spy.mock.calls[0]?.[0])).toContain('fdmSpaceDelete');
    expect(String(spy.mock.calls[0]?.[0])).not.toContain('fdmDirectoryRemove');
    expect(spy.mock.calls[0]?.[1]).toEqual({
      spaceId: 'working',
      apply: false,
      deleteFiles: true,
    });
  });

  it.each([
    [
      'project path',
      () =>
        new IdeGsmClient('https://endpoint.example', 'jwt-secret').projectDirectoryTree({
          projectRelativePath: '../x',
        }),
    ],
    [
      'logical path',
      () =>
        new IdeGsmClient('https://endpoint.example', 'jwt-secret').fdmDirectoryTree({
          path: '/absolute',
        }),
    ],
    [
      'depth',
      () =>
        new IdeGsmClient('https://endpoint.example', 'jwt-secret').fdmDirectoryInfo({ depth: -1 }),
    ],
    [
      'remove apply',
      () =>
        new IdeGsmClient('https://endpoint.example', 'jwt-secret').fdmDirectoryRemove({
          spaceId: 'default',
          path: 'x',
          apply: 'yes' as never,
        }),
    ],
  ])('rejects invalid %s input before a network request', async (_label, run) => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request');

    await expect(run()).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects malformed directory responses without exposing secrets', async () => {
    const { GraphQLClient } = await import('graphql-request');
    vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      projectDirectoryTree: {
        projectRelativePath,
        selectedPath: '',
        maxDepth: 1,
        root: { name: 'x' },
      },
    });
    const client = new IdeGsmClient('https://endpoint-secret.example', 'jwt-secret');

    const promise = client.projectDirectoryTree({ projectRelativePath });
    await expect(promise).rejects.toThrow('IDE-GSM GraphQL response malformed');
    await expect(promise).rejects.not.toThrow(/endpoint-secret|jwt-secret/u);
  });
});

describe('FDM dashboard GraphQL contracts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads dashboard status with timeline selectors and current schema cells', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      fdmDashboardStatus: {
        generatedAt: '2026-09-07T00:00:00Z',
        selectedSpaceId: 'default',
        selectedStateDir: 'state/latest',
        availableStateDirs: ['state/latest'],
        parameterSet: ['baseline'],
        profile: ['baseline'],
        dataset: ['world'],
        compute: ['java-fp64-raw'],
        timeline: ['2020'],
        state: { status: 'ready' },
        live: { status: 'running', startedAt: '2026-09-07T00:00:01Z' },
        startup: fdmStartup,
        cells: [
          {
            parameterSet: 'baseline',
            profile: 'baseline',
            dataset: 'world',
            compute: 'java-fp64-raw',
            timelinePoint: 'INIT_WORLD',
            checkpoint: 'INIT_WORLD',
            label: 'Initial world',
            source: 'current',
            bucket: 'succeeded',
            rawStatus: 'SUCCEEDED',
            accuracyLabel: null,
            summaryFile: 'summary.json',
            current: true,
            next: false,
            blockingDrift: false,
            variantCount: 1,
          },
        ],
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.fdmDashboardStatus({
        spaceId: 'default',
        timeline: '2020',
        stateDir: 'state/latest',
      })
    ).resolves.toMatchObject({
      selectedSpaceId: 'default',
      parameterSet: ['baseline'],
      timeline: ['2020'],
      cells: [{ parameterSet: 'baseline', timelinePoint: 'INIT_WORLD', current: true }],
    });
    expect(String(spy.mock.calls[0]?.[0])).toContain('fdmDashboardStatus');
    expect(spy.mock.calls[0]?.[1]).toEqual({
      spaceId: 'default',
      timeline: '2020',
      stateDir: 'state/latest',
    });
  });

  it('loads cell detail with canonical parameter set and timeline-point inputs', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      fdmCellDetail: {
        generatedAt: '2026-09-07T00:00:00Z',
        selectedStateDir: 'state/latest',
        startedAt: '2026-09-07T00:00:01Z',
        updatedAt: '2026-09-07T00:00:02Z',
        finishedAt: null,
        elapsedMs: 1000,
        estimatedRemainingMs: 2000,
        estimatedCompletedAt: '2026-09-07T00:00:04Z',
        logPath: 'logs/cell.log',
        latestLogLines: ['line 1'],
        stage: {
          parameterSet: 'baseline',
          profile: 'baseline',
          dataset: 'world',
          compute: 'java-fp64-raw',
          timelinePoint: 'INIT_WORLD',
          checkpoint: 'INIT_WORLD',
          label: 'Initial world',
          source: 'current',
        },
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(client.fdmCellDetail(fdmCellInput)).resolves.toMatchObject({
      stage: { parameterSet: 'baseline', timelinePoint: 'INIT_WORLD' },
      latestLogLines: ['line 1'],
    });
    expect(String(spy.mock.calls[0]?.[0])).toContain('fdmCellDetail');
    expect(spy.mock.calls[0]?.[1]).toEqual(fdmCellInput);
  });

  it('loads runtime diagnostics by projectRelativePath', async () => {
    const { GraphQLClient } = await import('graphql-request');
    vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      fdmRuntimeDiagnostics: {
        generatedAt: '2026-09-07T00:00:00Z',
        startup: fdmStartup,
        recoveredStates: [
          {
            command: 'fdmVerify',
            compute: 'java-fp64-raw',
            connectionType: 'local',
            launchLogFile: 'launch.log',
            launchPid: '123',
            launchPlanName: 'plan',
            liveStatus: 'running',
            message: 'recovered',
            phase: 'STARTED',
            recovered: true,
            runtimeIdentity: 'runtime-1',
            stateDir: 'state/latest',
            taskId: 'task-active',
          },
        ],
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(client.fdmRuntimeDiagnostics({ projectRelativePath })).resolves.toMatchObject({
      recoveredStates: [{ taskId: 'task-active', recovered: true }],
    });
  });

  it('runs fdmVerify and exposes current run metadata', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      fdmVerify: {
        axisPriority: ['parameterSet'],
        baselineCompute: 'java-fp64-raw',
        benchmarkAggregateMode: 'latest',
        calibrationRuntimeOptions: [{ key: 'heap', value: '4g' }],
        command: ['verify'],
        compareSelectors: 'all',
        compatibleSnapshotCommits: ['9e0a5a3a9'],
        compatibleSnapshotRevisions: ['rev-1'],
        compute: ['java-fp64-raw'],
        dataset: ['world'],
        dryRun: false,
        executionKind: 'local',
        logFile: 'verify.log',
        pathContext: {
          allowedProjectRoots: ['group/project'],
          allowedProjectRootsSource: 'config',
          fdmDirectory: 'fdm',
          fdmDirectorySource: 'config',
          fixtureDirectory: 'fixtures',
          fixtureDirectorySource: 'config',
        },
        pid: 123,
        planFile: 'plan.yml',
        planName: 'plan',
        profile: ['baseline'],
        remoteDataset: null,
        remoteInventoryFile: null,
        remoteLabel: null,
        runId: 'run-1',
        snapshotLevel: '2',
        snapshotPolicy: 'reuse',
        snapshotReusePolicy: 'compatible',
        sources: ['source.yml'],
        sshCompute: null,
        sshProfile: null,
        stateDir: 'state/latest',
        stateSegment: 'latest',
        timeline: ['2020'],
        tolerance: 'strict',
        toleranceProfile: 'default',
        useSharedBaseline: true,
        workflowId: 'workflow-1',
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.fdmVerify({ spaceId: 'default', parameterSet: ['baseline'], timeline: ['2020'] })
    ).resolves.toMatchObject({
      runId: 'run-1',
      workflowId: 'workflow-1',
      executionKind: 'local',
      calibrationRuntimeOptions: { heap: '4g' },
    });
    expect(String(spy.mock.calls[0]?.[0])).toContain('fdmVerify');
    expect(spy.mock.calls[0]?.[1]).toEqual({
      spaceId: 'default',
      parameterSet: ['baseline'],
      timeline: ['2020'],
    });
  });

  it('loads FDM lifecycle capabilities', async () => {
    const { GraphQLClient } = await import('graphql-request');
    vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      fdmCapabilities: {
        capabilities: [
          {
            level: 'L3',
            name: 'fdmSweep',
            note: 'available',
            operations: ['fdmSweep'],
            supported: true,
          },
        ],
        workflows: [
          {
            capabilities: ['read'],
            workflowId: 'workflow-1',
            runId: 'run-1',
            stateDir: 'state/latest',
            status: 'RUNNING',
            sourceFile: 'workflow.yml',
            sourceRevision: 'rev-1',
          },
        ],
        runs: [
          {
            capabilities: ['cancel'],
            diagnostics: [{ code: 'ok', message: null, path: null, severity: 'info' }],
            operations: [
              {
                attemptId: 'attempt-1',
                disposition: 'accepted',
                evidence: ['evidence.json'],
                operationId: 'operation-1',
                outcome: null,
                status: 'RUNNING',
                updatedAt: '2026-09-07T00:00:00Z',
              },
            ],
            projectionConsistent: true,
            runId: 'run-1',
            stateDir: 'state/latest',
            status: 'RUNNING',
            workflowId: 'workflow-1',
          },
        ],
        jobs: [
          {
            capabilities: ['cancel'],
            diagnostics: [],
            executionKind: 'LOCAL',
            jobId: 'job-1',
            operationId: 'operation-1',
            runId: 'run-1',
            status: 'RUNNING',
            taskId: 'task-1',
            workflowId: 'workflow-1',
          },
        ],
        rulesets: [
          {
            capabilities: ['read'],
            operations: ['fdmSweep'],
            reference: 'ruleset.yml',
            roles: ['operator'],
            rulesetId: 'ruleset-1',
            version: 1,
          },
        ],
        baselines: [
          {
            baselineId: 'baseline-1',
            capabilities: ['read'],
            computeEngine: 'java-fp64-raw',
            dataset: 'world',
            profile: 'baseline',
            source: 'current',
            timelinePoint: 'INIT_WORLD',
          },
        ],
        forks: [
          {
            capabilities: ['read'],
            forkId: 'fork-1',
            sourceRunId: 'run-1',
            sourceWorkflowId: 'workflow-1',
            status: 'AVAILABLE',
            targetRunId: 'run-2',
            targetWorkflowId: 'workflow-2',
          },
        ],
        lineage: [
          {
            capabilities: ['read'],
            lineageId: 'lineage-1',
            operationId: 'operation-1',
            runId: 'run-1',
            sourceOperationId: null,
            sourceRunId: null,
            workflowId: 'workflow-1',
          },
        ],
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(client.fdmCapabilities()).resolves.toMatchObject({
      capabilities: [{ name: 'fdmSweep', supported: true }],
      workflows: [{ workflowId: 'workflow-1' }],
      runs: [{ operations: [{ operationId: 'operation-1' }] }],
      jobs: [{ jobId: 'job-1' }],
      rulesets: [{ rulesetId: 'ruleset-1', version: 1 }],
      baselines: [{ baselineId: 'baseline-1', timelinePoint: 'INIT_WORLD' }],
      lineage: [{ lineageId: 'lineage-1' }],
    });
  });

  it('loads FDM workflow, run, and job projections', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi
      .spyOn(GraphQLClient.prototype, 'request')
      .mockResolvedValueOnce({
        fdmWorkflow: {
          capabilities: ['read'],
          workflowId: 'workflow-1',
          runId: 'run-1',
          stateDir: 'state/latest',
          status: 'RUNNING',
          sourceFile: 'workflow.yml',
          sourceRevision: 'rev-1',
        },
      })
      .mockResolvedValueOnce({
        fdmRun: {
          capabilities: ['cancel'],
          diagnostics: [],
          operations: [],
          projectionConsistent: true,
          runId: 'run-1',
          stateDir: 'state/latest',
          status: 'RUNNING',
          workflowId: 'workflow-1',
        },
      })
      .mockResolvedValueOnce({
        fdmJob: {
          capabilities: ['cancel'],
          diagnostics: [],
          executionKind: 'LOCAL',
          jobId: 'job-1',
          operationId: 'operation-1',
          runId: 'run-1',
          status: 'RUNNING',
          taskId: 'task-1',
          workflowId: 'workflow-1',
        },
      });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.fdmWorkflow({ spaceId: 'default', workflowId: 'workflow-1' })
    ).resolves.toMatchObject({
      workflowId: 'workflow-1',
    });
    await expect(client.fdmRun({ spaceId: 'default', runId: 'run-1' })).resolves.toMatchObject({
      runId: 'run-1',
    });
    await expect(client.fdmJob({ spaceId: 'default', jobId: 'job-1' })).resolves.toMatchObject({
      jobId: 'job-1',
    });
    expect(spy.mock.calls.map((call) => call[1])).toEqual([
      { spaceId: 'default', workflowId: 'workflow-1' },
      { spaceId: 'default', runId: 'run-1' },
      { spaceId: 'default', jobId: 'job-1' },
    ]);
  });

  it('runs fdmSweep with canonical parameter-set inputs', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      fdmSweep: {
        axisPriority: ['parameterSet'],
        baselineCompute: null,
        benchmarkAggregateMode: null,
        calibrationRuntimeOptions: [],
        command: ['sweep'],
        compareSelectors: null,
        compatibleSnapshotCommits: null,
        compatibleSnapshotRevisions: null,
        compute: ['java-fp64-raw'],
        dataset: ['world'],
        dryRun: false,
        executionKind: 'LOCAL',
        logFile: 'sweep.log',
        pathContext: null,
        pid: 123,
        planFile: null,
        planName: 'plan',
        profile: ['baseline'],
        remoteDataset: null,
        remoteInventoryFile: null,
        remoteLabel: null,
        runId: 'run-1',
        snapshotLevel: null,
        snapshotPolicy: null,
        snapshotReusePolicy: null,
        sources: null,
        sshCompute: null,
        sshProfile: null,
        stateDir: 'state/latest',
        stateSegment: 'latest',
        timeline: ['INIT_WORLD'],
        tolerance: null,
        toleranceProfile: null,
        useSharedBaseline: false,
        workflowId: 'workflow-1',
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.fdmSweep({
        spaceId: 'default',
        parameterSet: ['baseline'],
        timeline: ['INIT_WORLD'],
        originalSourceParameterSet: 'source-parameters',
      })
    ).resolves.toMatchObject({ runId: 'run-1', workflowId: 'workflow-1' });
    const requestDocument = String(spy.mock.calls[0]?.[0]);
    expect(requestDocument).toContain('fdmSweep');
    expect(requestDocument).not.toContain('$profile: [String]');
    expect(requestDocument).not.toContain('profile: $profile');
    expect(requestDocument).not.toContain('originalSourceProfile');
    expect(spy.mock.calls[0]?.[1]).toEqual({
      spaceId: 'default',
      parameterSet: ['baseline'],
      timeline: ['INIT_WORLD'],
      originalSourceParameterSet: 'source-parameters',
    });
  });

  it('normalizes deprecated fdmSweep aliases to canonical GraphQL variables', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      fdmSweep: {
        axisPriority: null,
        baselineCompute: null,
        benchmarkAggregateMode: null,
        calibrationRuntimeOptions: [],
        command: ['sweep'],
        compareSelectors: null,
        compatibleSnapshotCommits: null,
        compatibleSnapshotRevisions: null,
        compute: null,
        dataset: null,
        dryRun: true,
        executionKind: 'LOCAL',
        logFile: null,
        pathContext: null,
        pid: 0,
        planFile: null,
        planName: null,
        profile: ['legacy-profile'],
        remoteDataset: null,
        remoteInventoryFile: null,
        remoteLabel: null,
        runId: null,
        snapshotLevel: null,
        snapshotPolicy: null,
        snapshotReusePolicy: null,
        sources: null,
        sshCompute: null,
        sshProfile: null,
        stateDir: null,
        stateSegment: null,
        timeline: null,
        tolerance: null,
        toleranceProfile: null,
        useSharedBaseline: false,
        workflowId: null,
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await client.fdmSweep({
      spaceId: 'default',
      profile: ['legacy-profile'],
      originalSourceProfile: 'source-profile',
      preflight: true,
    });

    expect(spy.mock.calls[0]?.[1]).toEqual({
      spaceId: 'default',
      parameterSet: ['legacy-profile'],
      originalSourceParameterSet: 'source-profile',
      preflight: true,
    });
  });

  it('rejects conflicting fdmSweep parameter aliases before sending the request', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request');
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.fdmSweep({
        spaceId: 'default',
        parameterSet: ['canonical'],
        profile: ['legacy'],
      })
    ).rejects.toThrow('parameterSet and profile must match when both are provided');
    await expect(
      client.fdmSweep({
        spaceId: 'default',
        originalSourceParameterSet: 'canonical-source',
        originalSourceProfile: 'legacy-source',
      })
    ).rejects.toThrow(
      'originalSourceParameterSet and originalSourceProfile must match when both are provided'
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('cancels FDM run and job lifecycle handles', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi
      .spyOn(GraphQLClient.prototype, 'request')
      .mockResolvedValueOnce({ fdmRunCancel: true })
      .mockResolvedValueOnce({ fdmJobCancel: true });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(client.fdmRunCancel({ runId: 'run-1' })).resolves.toBe(true);
    await expect(client.fdmJobCancel({ jobId: 'job-1' })).resolves.toBe(true);
    expect(spy.mock.calls.map((call) => call[1])).toEqual([{ runId: 'run-1' }, { jobId: 'job-1' }]);
    await expect(client.fdmRunCancel({})).rejects.toThrow(
      'workflowId, runId, jobId, or taskId is required'
    );
  });

  it('subscribes to FDM cell logs and runtime events', () => {
    const sinks: SinkLike[] = [];
    const tracked = makeTrackedWsClient((sink) => {
      sinks.push(sink);
    });
    const cellLogListener = vi.fn();
    const runtimeEventListener = vi.fn();
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret', tracked.factory);

    const unsubscribeCell = client.subscribeFdmCellLog(fdmCellInput, cellLogListener);
    const unsubscribeRuntime = client.subscribeFdmRuntimeEvents(
      { projectRelativePath, stateDir: 'state/latest' },
      runtimeEventListener
    );
    sinks[0]?.next({
      data: {
        subscribeFdmCellLog: {
          generatedAt: '2026-09-07T00:00:00Z',
          logPath: 'logs/cell.log',
          latestLogLines: ['line 1'],
          stage: {
            parameterSet: 'baseline',
            profile: 'baseline',
            dataset: 'world',
            compute: 'java-fp64-raw',
            timelinePoint: 'INIT_WORLD',
            checkpoint: 'INIT_WORLD',
            label: 'Initial world',
            source: 'current',
          },
        },
      },
    });
    sinks[1]?.next({
      data: {
        subscribeFdmRuntimeEvents: {
          backendType: 'LOCAL',
          command: 'fdmVerify',
          compute: 'java-fp64-raw',
          connectionType: 'local',
          message: 'running',
          phase: 'PROGRESS',
          progress: 50,
          projectRelativePath,
          receivedAt: '2026-09-07T00:00:00Z',
          recovered: false,
          taskId: 'task-active',
          username: 'user',
          backendMetadata: [{ key: 'runId', value: 'run-1' }],
        },
      },
    });
    unsubscribeCell();
    unsubscribeRuntime();

    expect(cellLogListener).toHaveBeenCalledWith({
      generatedAt: '2026-09-07T00:00:00Z',
      logPath: 'logs/cell.log',
      latestLogLines: ['line 1'],
      stage: {
        parameterSet: 'baseline',
        profile: 'baseline',
        dataset: 'world',
        compute: 'java-fp64-raw',
        timelinePoint: 'INIT_WORLD',
        checkpoint: 'INIT_WORLD',
        label: 'Initial world',
        source: 'current',
      },
    });
    expect(runtimeEventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        backendType: 'LOCAL',
        phase: 'PROGRESS',
        progress: 50,
        backendMetadata: { runId: 'run-1' },
      })
    );
    expect(tracked.unsubscribe).toHaveBeenCalledTimes(2);
    expect(tracked.dispose).toHaveBeenCalledTimes(2);
  });
});

describe('conditional project YAML write contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reads authoritative YAML content with digest metadata', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      projectYamlFileContent: {
        projectRelativePath,
        relativePath: yamlRelativePath,
        content: 'a: 1\n',
        contentDigest: oldDigest,
        updatedAt: '2026-08-30T00:00:00Z',
        byteCount: 5,
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.projectYamlFileContent({ projectRelativePath, relativePath: yamlRelativePath })
    ).resolves.toMatchObject({ content: 'a: 1\n', contentDigest: oldDigest });

    expect(String(spy.mock.calls[0]?.[0])).toContain('projectYamlFileContent');
    expect(spy.mock.calls[0]?.[1]).toEqual({ projectRelativePath, relativePath: yamlRelativePath });
  });

  it('writes with the required expectedDigest and returns updated metadata', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      conditionalProjectYamlWrite: {
        status: 'UPDATED',
        projectRelativePath,
        relativePath: yamlRelativePath,
        contentDigest: newDigest,
        updatedAt: '2026-08-30T00:00:01Z',
        byteCount: 5,
        resyncRequired: false,
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.conditionalProjectYamlWrite({
        projectRelativePath,
        relativePath: yamlRelativePath,
        expectedDigest: oldDigest,
        content: 'a: 2\n',
      })
    ).resolves.toMatchObject({ status: 'UPDATED', contentDigest: newDigest });

    expect(String(spy.mock.calls[0]?.[0])).toContain('conditionalProjectYamlWrite');
    expect(spy.mock.calls[0]?.[1]).toEqual({
      projectRelativePath,
      relativePath: yamlRelativePath,
      expectedDigest: oldDigest,
      content: 'a: 2\n',
    });
  });

  it('surfaces CONTENT_CONFLICT as a typed result without throwing', async () => {
    const { GraphQLClient } = await import('graphql-request');
    vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      conditionalProjectYamlWrite: {
        status: 'CONTENT_CONFLICT',
        projectRelativePath,
        relativePath: yamlRelativePath,
        contentDigest: newDigest,
        updatedAt: '2026-08-30T00:00:01Z',
        byteCount: 8,
        resyncRequired: false,
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.conditionalProjectYamlWrite({
        projectRelativePath,
        relativePath: yamlRelativePath,
        expectedDigest: oldDigest,
        content: 'a: 2\n',
      })
    ).resolves.toMatchObject({
      status: 'CONTENT_CONFLICT',
      contentDigest: newDigest,
      updatedAt: '2026-08-30T00:00:01Z',
    });
  });

  it.each([
    ['missing digest', { expectedDigest: '' }],
    ['uppercase digest', { expectedDigest: 'A'.repeat(64) }],
    ['non-yaml path', { relativePath: 'scenarios/base.json' }],
    ['parent traversal', { relativePath: '../base.yaml' }],
  ])('rejects %s before a network request', async (_label, overrides) => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request');
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.conditionalProjectYamlWrite({
        projectRelativePath,
        relativePath: yamlRelativePath,
        expectedDigest: oldDigest,
        content: 'a: 2\n',
        ...overrides,
      })
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects malformed write metadata without exposing secrets', async () => {
    const { GraphQLClient } = await import('graphql-request');
    vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      conditionalProjectYamlWrite: {
        status: 'UPDATED',
        projectRelativePath,
        relativePath: yamlRelativePath,
        contentDigest: 'not-a-digest',
        updatedAt: '2026-08-30T00:00:01Z',
        byteCount: 8,
        resyncRequired: false,
      },
    });
    const client = new IdeGsmClient('https://endpoint-secret.example', 'jwt-secret');

    const promise = client.conditionalProjectYamlWrite({
      projectRelativePath,
      relativePath: yamlRelativePath,
      expectedDigest: oldDigest,
      content: 'a: 2\n',
    });
    await expect(promise).rejects.toThrow('IDE-GSM GraphQL response malformed');
    await expect(promise).rejects.not.toThrow(/endpoint-secret|jwt-secret/u);
  });
});

describe('project CSV content transfer contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('begins, pages, and closes an immutable CSV transfer with typed metadata', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const content = 'col\nvalue\n';
    const contentBase64 = Buffer.from(content, 'utf8').toString('base64');
    const spy = vi
      .spyOn(GraphQLClient.prototype, 'request')
      .mockResolvedValueOnce({
        beginProjectFileContentTransfer: {
          transferId: 'transfer-1',
          contentDigest: oldDigest,
          updatedAt: '2026-08-30T00:00:00Z',
          byteCount: Buffer.byteLength(content),
          chunkSizeBytes: 16_384,
          expiresAt: '2026-08-30T00:05:00Z',
        },
      })
      .mockResolvedValueOnce({
        projectFileContentPage: {
          contentChunkBase64: contentBase64,
          rawByteCount: Buffer.byteLength(content),
          nextCursor: null,
          hasNext: false,
        },
      })
      .mockResolvedValueOnce({ closeProjectFileContentTransfer: true });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.beginProjectFileContentTransfer({
        projectRelativePath,
        relativePath: csvRelativePath,
      })
    ).resolves.toMatchObject({ transferId: 'transfer-1', chunkSizeBytes: 16_384 });
    await expect(client.projectFileContentPage({ transferId: 'transfer-1' })).resolves.toEqual({
      contentChunkBase64: contentBase64,
      rawByteCount: Buffer.byteLength(content),
      nextCursor: null,
      hasNext: false,
    });
    await expect(client.closeProjectFileContentTransfer('transfer-1')).resolves.toBe(true);

    expect(String(spy.mock.calls[0]?.[0])).toContain('beginProjectFileContentTransfer');
    expect(spy.mock.calls[0]?.[1]).toEqual({
      projectRelativePath,
      relativePath: csvRelativePath,
    });
    expect(String(spy.mock.calls[1]?.[0])).toContain('projectFileContentPage');
    expect(spy.mock.calls[1]?.[1]).toEqual({ transferId: 'transfer-1' });
    expect(String(spy.mock.calls[2]?.[0])).toContain('closeProjectFileContentTransfer');
    expect(spy.mock.calls[2]?.[1]).toEqual({ transferId: 'transfer-1' });
  });

  it.each([
    ['non-csv path', { relativePath: 'outputs/table.tsv' }],
    ['parent traversal', { relativePath: '../table.csv' }],
  ])('rejects invalid transfer input %s before a network request', async (_label, overrides) => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request');
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(
      client.beginProjectFileContentTransfer({
        projectRelativePath,
        relativePath: csvRelativePath,
        ...overrides,
      })
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    [
      'wrong transfer chunk size',
      {
        beginProjectFileContentTransfer: {
          transferId: 'transfer-1',
          contentDigest: oldDigest,
          updatedAt: '2026-08-30T00:00:00Z',
          byteCount: 0,
          chunkSizeBytes: 16_385,
          expiresAt: '2026-08-30T00:05:00Z',
        },
      },
    ],
    [
      'page byte count mismatch',
      {
        projectFileContentPage: {
          contentChunkBase64: Buffer.from('a,b\n').toString('base64'),
          rawByteCount: 999,
          nextCursor: null,
          hasNext: false,
        },
      },
    ],
    [
      'missing continuation cursor',
      {
        projectFileContentPage: {
          contentChunkBase64: '',
          rawByteCount: 0,
          nextCursor: null,
          hasNext: true,
        },
      },
    ],
  ])('rejects malformed transfer response: %s', async (label, response) => {
    const { GraphQLClient } = await import('graphql-request');
    vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce(response);
    const client = new IdeGsmClient('https://endpoint-secret.example', 'jwt-secret');

    const promise =
      label === 'wrong transfer chunk size'
        ? client.beginProjectFileContentTransfer({
            projectRelativePath,
            relativePath: csvRelativePath,
          })
        : client.projectFileContentPage({ transferId: 'transfer-1' });

    await expect(promise).rejects.toThrow('IDE-GSM GraphQL response malformed');
    await expect(promise).rejects.not.toThrow(/endpoint-secret|jwt-secret/u);
  });
});

describe('external build session task contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('discovers active project tasks from typed server metadata', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      activeProjectTasks: [
        {
          taskId: 'task-active',
          commandId: 'sim',
          status: 'LEASED',
          projectRelativePath,
          progress: 25,
          phase: 'running',
          registeredAt: 1788048000000,
          startedAt: 1788048001000,
          updatedAt: 1788048002000,
          runId: 'run-1',
          jobId: 'job-1',
          workflowId: 'workflow-1',
          executionKind: 'local',
        },
      ],
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(client.activeProjectTasks(projectRelativePath)).resolves.toEqual([
      {
        taskId: 'task-active',
        commandId: 'sim',
        status: 'LEASED',
        projectRelativePath,
        progress: 25,
        phase: 'running',
        registeredAt: '2026-08-30T00:00:00.000Z',
        startedAt: '2026-08-30T00:00:01.000Z',
        updatedAt: '2026-08-30T00:00:02.000Z',
        runId: 'run-1',
        jobId: 'job-1',
        workflowId: 'workflow-1',
        executionKind: 'local',
      },
    ]);
    expect(String(spy.mock.calls[0]?.[0])).toContain('activeProjectTasks');
    expect(String(spy.mock.calls[0]?.[0])).not.toContain('paramsJson');
    expect(spy.mock.calls[0]?.[1]).toEqual({ projectRelativePath });
  });

  it('keeps cancellation acceptance distinct from terminal task state', async () => {
    const { GraphQLClient } = await import('graphql-request');
    const spy = vi.spyOn(GraphQLClient.prototype, 'request').mockResolvedValueOnce({
      cancelTask: {
        taskId: 'task-active',
        accepted: true,
      },
    });
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret');

    await expect(client.cancelTask('task-active')).resolves.toEqual({
      taskId: 'task-active',
      accepted: true,
    });
    expect(String(spy.mock.calls[0]?.[0])).toContain('cancelTask');
    expect(spy.mock.calls[0]?.[1]).toEqual({ taskId: 'task-active' });
  });

  it('subscribes to live task logs without a replay cursor', () => {
    let capturedSink: SinkLike | null = null;
    const tracked = makeTrackedWsClient((sink) => {
      capturedSink = sink;
    });
    const listener = vi.fn();
    const client = new IdeGsmClient('https://endpoint.example', 'jwt-secret', tracked.factory);

    const unsubscribe = client.subscribeTaskLog('task-active', listener);
    capturedSink?.next({
      data: {
        subscribeTaskLog: {
          taskId: 'task-active',
          sequence: 0,
          timestamp: '2026-08-30T00:00:00Z',
          stream: 'stdout',
          text: 'log body',
        },
      },
    });
    unsubscribe();

    expect(listener).toHaveBeenCalledWith({
      taskId: 'task-active',
      sequence: 0,
      timestamp: '2026-08-30T00:00:00Z',
      stream: 'stdout',
      text: 'log body',
    });
    expect(tracked.unsubscribe).toHaveBeenCalledOnce();
    expect(tracked.dispose).toHaveBeenCalledOnce();
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
      runId: null,
      jobId: null,
      workflowId: null,
      executionKind: null,
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
