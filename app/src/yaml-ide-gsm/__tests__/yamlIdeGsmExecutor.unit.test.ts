import type { NodeId } from '@hierarchidb/core-types';
import type { TaskResult } from '@hierarchidb/ide-gsm-client';
import type { YamlCanonicalZipAPI } from '@hierarchidb/worker-api';
import { describe, expect, it, vi } from 'vitest';
import { createYamlIdeGsmExecutor } from '../createYamlIdeGsmExecutor.js';
import { resolveYamlIdeGsmAppConfig } from '../YamlIdeGsmAppConfig.js';
import { createRuntimeYamlIdeGsmCredentialProvider } from '../yamlIdeGsmCredentialProvider.js';
import type { YamlIdeGsmClientPort } from '../yamlIdeGsmExecutorTypes.js';

const parentId = 'parent-node' as NodeId;

const finishedTask = (id: string): TaskResult =>
  Object.freeze({
    id,
    status: 'FINISHED',
    paramsJson: '{}',
    resultJson: null,
  });

const scenarioPayload = Object.freeze({
  subtype: 'scenario',
  schemaId: 'ide-gsm/scenario',
  content: 'name: scenario\n',
});

function createClient(): YamlIdeGsmClientPort {
  return {
    importProject: vi.fn().mockResolvedValue('task-import'),
    executeCommand: vi.fn().mockResolvedValue('task-command'),
    awaitTask: vi.fn(async (taskId: string, onStatus?: (task: TaskResult) => void) => {
      const task = finishedTask(taskId);
      onStatus?.(task);
      return task;
    }),
  };
}

function createZipApi(): YamlCanonicalZipAPI {
  return {
    exportYamlCanonicalZip: vi.fn().mockResolvedValue({
      ok: true,
      archiveBase64: 'UEsDBAo=',
      byteLength: 8,
      nodeIds: [],
    }),
    importYamlCanonicalZip: vi.fn(),
  };
}

describe('yaml IDE-GSM executor', () => {
  it('keeps the startup-fixed flag off by default', () => {
    expect(resolveYamlIdeGsmAppConfig({}).yamlIdeGsmStep4Enabled).toBe(false);
    expect(resolveYamlIdeGsmAppConfig({ VITE_YAML_IDE_GSM_STEP4_ENABLED: '1' })).toEqual({
      yamlIdeGsmStep4Enabled: true,
    });
    expect(() => resolveYamlIdeGsmAppConfig({ VITE_YAML_IDE_GSM_STEP4_ENABLED: 'true' })).toThrow(
      'VITE_YAML_IDE_GSM_STEP4_ENABLED must be unset, 0, or 1'
    );
  });

  it('does not touch credentials, sync, or network when the flag is disabled', async () => {
    const client = createClient();
    const zipApi = createZipApi();
    const getIdeGsmCredentials = vi.fn();
    const getGitHubToken = vi.fn();
    const executor = createYamlIdeGsmExecutor({
      config: { yamlIdeGsmStep4Enabled: false },
      credentialProvider: { getIdeGsmCredentials, getGitHubToken },
      createClient: vi.fn(() => client),
      getYamlCanonicalZipAPI: vi.fn(async () => zipApi),
    });

    const result = await executor.execute({
      parentId,
      filename: 'scenario.yml',
      payload: scenarioPayload,
      commandId: 'sim',
      runtimeInput: { projectRelativePath: 'project' },
    });

    expect(result).toEqual({ ok: false, code: 'FEATURE_DISABLED' });
    expect(getIdeGsmCredentials).not.toHaveBeenCalled();
    expect(zipApi.exportYamlCanonicalZip).not.toHaveBeenCalled();
    expect(client.executeCommand).not.toHaveBeenCalled();
  });

  it('rejects subtype/command mismatches before syncing or command execution', async () => {
    const client = createClient();
    const zipApi = createZipApi();
    const getGitHubToken = vi.fn(() => 'github-token');
    const executor = createYamlIdeGsmExecutor({
      config: { yamlIdeGsmStep4Enabled: true },
      credentialProvider: createRuntimeYamlIdeGsmCredentialProvider({
        getEndpointUrl: () => 'https://ide-gsm.example.test',
        getAuthToken: () => 'jwt',
        getGitHubToken,
      }),
      createClient: vi.fn(() => client),
      getYamlCanonicalZipAPI: vi.fn(async () => zipApi),
    });

    const result = await executor.execute({
      parentId,
      filename: 'scenario.yml',
      payload: scenarioPayload,
      commandId: 'init',
      runtimeInput: { projectRelativePath: 'project' },
    });

    expect(result).toEqual({ ok: false, code: 'UNAUTHORIZED_COMMAND' });
    expect(getGitHubToken).not.toHaveBeenCalled();
    expect(zipApi.exportYamlCanonicalZip).not.toHaveBeenCalled();
    expect(client.executeCommand).not.toHaveBeenCalled();
  });

  it('syncs YAML before running a non-bootstrap command', async () => {
    const client = createClient();
    const zipApi = createZipApi();
    const status = vi.fn();
    const executor = createYamlIdeGsmExecutor({
      config: { yamlIdeGsmStep4Enabled: true },
      credentialProvider: createRuntimeYamlIdeGsmCredentialProvider({
        getEndpointUrl: () => 'https://ide-gsm.example.test',
        getAuthToken: () => 'jwt',
        getGitHubToken: () => 'github-token',
      }),
      createClient: vi.fn(() => client),
      getYamlCanonicalZipAPI: vi.fn(async () => zipApi),
    });

    const result = await executor.execute(
      {
        parentId,
        filename: 'scenario.yml',
        payload: scenarioPayload,
        commandId: 'sim',
        runtimeInput: { projectRelativePath: 'project', reset: false },
      },
      status
    );

    expect(result).toEqual({
      ok: true,
      importTaskId: 'task-import',
      commandTaskId: 'task-command',
    });
    expect(zipApi.exportYamlCanonicalZip).toHaveBeenCalledWith({ parentId, slot: 'draft' });
    expect(client.importProject).toHaveBeenCalledWith('UEsDBAo=', 'project');
    expect(client.executeCommand).toHaveBeenCalledWith({
      id: 'sim',
      input: { projectRelativePath: 'project', reset: false },
    });
    expect(status).toHaveBeenCalledWith({ phase: 'sync', task: finishedTask('task-import') });
    expect(status).toHaveBeenCalledWith({ phase: 'command', task: finishedTask('task-command') });
  });

  it('runs git init without snapshot import and obtains the GitHub token at runtime', async () => {
    const client = createClient();
    const zipApi = createZipApi();
    const getGitHubToken = vi.fn(() => 'github-token');
    const executor = createYamlIdeGsmExecutor({
      config: { yamlIdeGsmStep4Enabled: true },
      credentialProvider: createRuntimeYamlIdeGsmCredentialProvider({
        getEndpointUrl: () => 'https://ide-gsm.example.test',
        getAuthToken: () => 'jwt',
        getGitHubToken,
      }),
      createClient: vi.fn(() => client),
      getYamlCanonicalZipAPI: vi.fn(async () => zipApi),
    });

    const result = await executor.execute({
      parentId,
      filename: 'git.yml',
      payload: {
        subtype: 'git',
        schemaId: 'ide-gsm/git',
        content: 'url: https://example.test/repo.git\n',
      },
      commandId: 'init',
      runtimeInput: { projectRelativePath: 'project' },
    });

    expect(result).toEqual({ ok: true, commandTaskId: 'task-command' });
    expect(getGitHubToken).toHaveBeenCalledTimes(1);
    expect(zipApi.exportYamlCanonicalZip).not.toHaveBeenCalled();
    expect(client.importProject).not.toHaveBeenCalled();
    expect(client.executeCommand).toHaveBeenCalledWith({
      id: 'init',
      input: {
        projectRelativePath: 'project',
        githubToken: 'github-token',
        url: 'https://example.test/repo.git',
      },
    });
  });

  it('prevents duplicate starts for the same parent and command', async () => {
    let release: (() => void) | undefined;
    const client = createClient();
    vi.mocked(client.importProject).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve('task-import');
        })
    );
    const executor = createYamlIdeGsmExecutor({
      config: { yamlIdeGsmStep4Enabled: true },
      credentialProvider: createRuntimeYamlIdeGsmCredentialProvider({
        getEndpointUrl: () => 'https://ide-gsm.example.test',
        getAuthToken: () => 'jwt',
        getGitHubToken: () => 'github-token',
      }),
      createClient: vi.fn(() => client),
      getYamlCanonicalZipAPI: vi.fn(async () => createZipApi()),
    });
    const input = {
      parentId,
      filename: 'scenario.yml' as const,
      payload: scenarioPayload,
      commandId: 'sim' as const,
      runtimeInput: { projectRelativePath: 'project' },
    };

    const first = executor.execute(input);
    await vi.waitFor(() => expect(client.importProject).toHaveBeenCalledTimes(1));
    const second = await executor.execute(input);
    release?.();
    await first;

    expect(second).toEqual({ ok: false, code: 'DUPLICATE_COMMAND' });
  });

  it('does not include credentials in public execution failures', async () => {
    const executor = createYamlIdeGsmExecutor({
      config: { yamlIdeGsmStep4Enabled: true },
      credentialProvider: createRuntimeYamlIdeGsmCredentialProvider({
        getEndpointUrl: () => 'https://secret-endpoint.example.test',
        getAuthToken: () => 'secret-jwt',
        getGitHubToken: () => 'secret-github-token',
      }),
      createClient: vi.fn(() => ({
        ...createClient(),
        executeCommand: vi.fn().mockRejectedValue(new Error('secret-jwt')),
      })),
      getYamlCanonicalZipAPI: vi.fn(async () => createZipApi()),
    });

    const result = await executor.execute({
      parentId,
      filename: 'git.yml',
      payload: {
        subtype: 'git',
        schemaId: 'ide-gsm/git',
        content: 'url: https://example.test/repo.git\n',
      },
      commandId: 'init',
      runtimeInput: { projectRelativePath: 'project' },
    });

    const serialized = JSON.stringify(result);
    expect(result).toEqual({ ok: false, code: 'COMMAND_FAILED' });
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('endpoint');
  });
});
